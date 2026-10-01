"""
Kiểm thử đầu-cuối màn hình Nhật ký (ĐỌC LẠI nhật ký thay đổi).

    cd backend && python kiem-thu-phase6.py      (cần API đang chạy ở http://localhost:5080)

Nhật ký đã được ghi từ Phase 1 nhưng trước đây chỉ ghi mà không có đường đọc ra. Bộ này kiểm phần
đọc: ai được xem gì, lọc theo ngày / hành động / bảng bị tác động, phân trang, thứ tự mới nhất
trước — và quan trọng nhất là giáo viên KHÔNG đọc được nhật ký của người khác.

Script tự tạo tài khoản thử (tiền tố gv.p6.) và tự dọn trước lẫn sau khi chạy. Nhật ký là sổ ghi
một chiều nên script KHÔNG xoá dòng nhật ký; khi dọn tài khoản thử thì chỉ gỡ người thực hiện
(NguoiThucHienId = NULL) để giữ lại vết.
"""
from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, datetime, timedelta, timezone

API = "http://localhost:5080"
THU_MUC_API = r"c:\Joel_vh\ClassManagement\backend\ClassManagement.Api"
EMAIL_ADMIN = "admin@classmanagement.local"

hom_nay = date.today()
ket_qua: list[tuple[bool, str]] = []


def kiem_tra(dieu_kien: bool, mo_ta: str) -> None:
    ket_qua.append((bool(dieu_kien), mo_ta))
    print(("  PASS  " if dieu_kien else "  FAIL  ") + mo_ta)


def doc_mat_khau() -> str:
    out = subprocess.run(["dotnet", "user-secrets", "list"], cwd=THU_MUC_API,
                         capture_output=True, text=True, encoding="utf-8").stdout
    for dong in out.splitlines():
        if "Seed:Admin:MatKhau" in dong:
            return dong.split("=", 1)[1].strip()
    raise SystemExit("Không đọc được Seed:Admin:MatKhau từ user-secrets.")


def chay_sql(cau: str) -> str:
    return subprocess.run(
        ["sqlcmd", "-S", r".\SQLEXPRESS", "-d", "ClassManagement", "-E", "-h", "-1", "-W", "-w", "800", "-I", "-Q", cau],
        capture_output=True, text=True, encoding="utf-8", errors="replace").stdout or ""


def goi(duong_dan: str, *, method: str = "GET", body=None, token: str | None = None):
    du_lieu = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    yeu_cau = urllib.request.Request(API + duong_dan, data=du_lieu, method=method)
    yeu_cau.add_header("Content-Type", "application/json; charset=utf-8")
    if token:
        yeu_cau.add_header("Authorization", "Bearer " + token)

    try:
        with urllib.request.urlopen(yeu_cau, timeout=60) as phan_hoi:
            chuoi = phan_hoi.read().decode("utf-8")
            return phan_hoi.status, (json.loads(chuoi) if chuoi.strip().startswith(("{", "[")) else chuoi)
    except urllib.error.HTTPError as loi:
        chuoi = loi.read().decode("utf-8", "replace")
        return loi.code, (json.loads(chuoi) if chuoi.strip().startswith(("{", "[")) else chuoi)


def dang_nhap(email: str, mat_khau: str):
    return goi("/api/auth/login", method="POST", body={"email": email, "matKhau": mat_khau})


def don_tai_khoan_kiem_thu() -> None:
    """Xoá tài khoản kiểm thử và dữ liệu đi kèm. Nhật ký thì GIỮ LẠI, chỉ gỡ người thực hiện."""

    chay_sql(
        "SET NOCOUNT ON; "
        "DECLARE @gv TABLE (Id uniqueidentifier); "
        "INSERT INTO @gv SELECT Id FROM GiaoVien WHERE Email LIKE 'gv.p6.%'; "
        "DECLARE @hs TABLE (Id uniqueidentifier); "
        "INSERT INTO @hs SELECT h.Id FROM HocSinh h JOIN @gv g ON g.Id = h.GiaoVienId; "
        "DELETE pt FROM PhieuThu pt JOIN HocPhi hp ON hp.Id = pt.HocPhiId WHERE hp.HocSinhId IN (SELECT Id FROM @hs); "
        "DELETE FROM HocPhi WHERE HocSinhId IN (SELECT Id FROM @hs); "
        "DELETE dd FROM DiemDanh dd JOIN BuoiHoc b ON b.Id = dd.BuoiHocId WHERE b.HocSinhId IN (SELECT Id FROM @hs); "
        "DELETE FROM BuoiHoc WHERE HocSinhId IN (SELECT Id FROM @hs); "
        "DELETE FROM KhungGioHoc WHERE HocSinhId IN (SELECT Id FROM @hs); "
        "DELETE FROM HocSinh WHERE Id IN (SELECT Id FROM @hs); "
        "DELETE FROM PhienDangNhap WHERE GiaoVienId IN (SELECT Id FROM @gv); "
        "DELETE FROM YeuCauDatLaiMatKhau WHERE GiaoVienId IN (SELECT Id FROM @gv); "
        "UPDATE NhatKy SET NguoiThucHienId = NULL WHERE NguoiThucHienId IN (SELECT Id FROM @gv); "
        "DELETE FROM GiaoVien WHERE Id IN (SELECT Id FROM @gv);")


def main() -> int:
    # Lần chạy trước chết giữa đường cũng không để lại rác.
    don_tai_khoan_kiem_thu()

    mat_khau_admin = doc_mat_khau()

    print("== 1. Tài khoản cho bài kiểm thử ==")
    ma, than = dang_nhap(EMAIL_ADMIN, mat_khau_admin)
    if ma != 200:
        raise SystemExit(f"Không đăng nhập được admin (HTTP {ma})")
    token_admin = than["accessToken"]
    ma, toi_admin = goi("/api/auth/me", token=token_admin)
    admin_id, ten_admin = toi_admin["id"], toi_admin["hoTen"]

    email_gv = f"gv.p6.{uuid.uuid4().hex[:6]}@classmanagement.local"
    mat_khau_gv = "Aa1" + uuid.uuid4().hex[:12]
    ten_gv = "Giáo viên Nhật ký"
    ma, than = goi("/api/teachers", method="POST", token=token_admin, body={
        "hoTen": ten_gv, "email": email_gv, "matKhauTamThoi": mat_khau_gv})
    kiem_tra(ma == 201, f"tạo giáo viên thử -> HTTP {ma}")
    ma, than = dang_nhap(email_gv, mat_khau_gv)
    kiem_tra(ma == 200, f"giáo viên thử đăng nhập -> HTTP {ma}")
    token_gv = than["accessToken"]

    print("== 2. Gây ra thay đổi để có dòng nhật ký ==")
    ma, hoc_sinh = goi("/api/students", method="POST", token=token_gv, body={
        "hoTen": "Học sinh Nhật ký", "cachTinhHocPhi": "theo_buoi", "donGiaTheoBuoi": 200000,
        "soBuoiMoiTuan": 1, "ngayDenHanDongTien": 5, "ngayBatDau": hom_nay.isoformat(),
        "lichHoc": [{"thu": "thu_2", "gioBatDau": "05:00:00", "gioKetThuc": "06:00:00"}]})
    kiem_tra(ma == 201, f"giáo viên tạo học sinh -> HTTP {ma}")

    # Buổi dạy bù NGAY HÔM NAY: không phụ thuộc hôm nay là thứ mấy mới có buổi theo lịch lặp.
    ma, buoi = goi("/api/attendance/buoi-day-bu", method="POST", token=token_gv, body={
        "hocSinhId": hoc_sinh["id"], "ngay": hom_nay.isoformat(),
        "gioBatDau": "05:10:00", "gioKetThuc": "06:10:00", "ghiChu": "Buổi cho bài kiểm thử nhật ký"})
    kiem_tra(ma == 201, f"thêm buổi để điểm danh -> HTTP {ma}")
    buoi_id = buoi["id"]

    ma, than = goi("/api/attendance/luu-hang-loat", method="POST", token=token_gv, body={"duLieu": [
        {"buoiHocId": buoi_id, "trangThai": "di_hoc", "ghiChu": "Học tốt"}]})
    kiem_tra(ma == 200 and than["soBuoiGhiNhatKy"] == 0,
             "điểm danh lần đầu KHÔNG ghi nhật ký sửa (không có gì để so)")
    ma, than = goi("/api/attendance/luu-hang-loat", method="POST", token=token_gv, body={"duLieu": [
        {"buoiHocId": buoi_id, "trangThai": "nghi", "lyDoNghi": "co_phep", "ghiChu": "Ốm"}]})
    kiem_tra(ma == 200 and than["soBuoiGhiNhatKy"] == 1,
             f"sửa lại thành nghỉ -> ghi {than and than['soBuoiGhiNhatKy']} dòng nhật ký")

    ma, _ = goi("/api/settings", method="PUT", token=token_admin, body={"tinhTienNghiKhongPhep": True})

    print("== 3. Admin đọc nhật ký ==")
    ma, trang = goi("/api/nhat-ky?hanhDong=sua_diem_danh&kichThuoc=100", token=token_admin)
    kiem_tra(ma == 200 and "duLieu" in trang, f"admin đọc nhật ký -> HTTP {ma}")
    dong_cua_gv = next((d for d in trang["duLieu"] if d["doiTuongId"] == buoi_id), None)
    kiem_tra(dong_cua_gv is not None, "thấy dòng nhật ký của buổi vừa sửa")
    if dong_cua_gv:
        kiem_tra(dong_cua_gv["nguoiThucHien"] == ten_gv,
                 f"ghi đúng người thực hiện: {dong_cua_gv['nguoiThucHien']}")
        kiem_tra(dong_cua_gv["doiTuong"] == "DiemDanh" and dong_cua_gv["hanhDong"] == "sua_diem_danh",
                 f"đúng bảng và hành động: {dong_cua_gv['doiTuong']}/{dong_cua_gv['hanhDong']}")
        kiem_tra("di_hoc" in (dong_cua_gv["duLieuTruoc"] or "") and "nghi" in (dong_cua_gv["duLieuSau"] or ""),
                 "ảnh chụp trước là đi học, sau là nghỉ")
        try:
            thoi_diem = datetime.fromisoformat(dong_cua_gv["thoiDiemUtc"].replace("Z", "+00:00"))
            kiem_tra(thoi_diem.tzinfo is not None
                     and thoi_diem <= datetime.now(timezone.utc) + timedelta(minutes=5),
                     f"thời điểm ở dạng UTC đọc được: {dong_cua_gv['thoiDiemUtc']}")
        except ValueError:
            kiem_tra(False, f"thời điểm không parse được: {dong_cua_gv['thoiDiemUtc']}")

    print("== 4. Thứ tự và bộ lọc ==")
    ma, tat_ca = goi("/api/nhat-ky?kichThuoc=50", token=token_admin)
    moc = [d["thoiDiemUtc"] for d in tat_ca["duLieu"]]
    kiem_tra(moc == sorted(moc, reverse=True), "mới nhất lên đầu")

    ma, hom_nay_trang = goi(f"/api/nhat-ky?tuNgay={hom_nay}&denNgay={hom_nay}&kichThuoc=100", token=token_admin)
    kiem_tra(any(d["doiTuongId"] == buoi_id for d in hom_nay_trang["duLieu"]),
             "lọc theo ngày hôm nay thì có dòng vừa tạo")
    hom_qua = hom_nay - timedelta(days=1)
    ma, hom_qua_trang = goi(f"/api/nhat-ky?tuNgay={hom_qua}&denNgay={hom_qua}&kichThuoc=100", token=token_admin)
    kiem_tra(all(d["doiTuongId"] != buoi_id for d in hom_qua_trang["duLieu"]),
             "lọc theo ngày hôm qua thì KHÔNG có dòng vừa tạo")

    ma, loc_hanh_dong = goi("/api/nhat-ky?hanhDong=tao_hoc_sinh&kichThuoc=50", token=token_admin)
    kiem_tra(loc_hanh_dong["tongSo"] > 0 and all(d["hanhDong"] == "tao_hoc_sinh" for d in loc_hanh_dong["duLieu"]),
             f"lọc theo hành động: {loc_hanh_dong['tongSo']} dòng, tất cả đúng loại")

    ma, loc_doi_tuong = goi("/api/nhat-ky?doiTuong=DiemDanh&kichThuoc=50", token=token_admin)
    kiem_tra(loc_doi_tuong["tongSo"] > 0 and all(d["doiTuong"] == "DiemDanh" for d in loc_doi_tuong["duLieu"]),
             f"lọc theo bảng bị tác động: {loc_doi_tuong['tongSo']} dòng, tất cả là DiemDanh")

    ma, loc_nguoi = goi(f"/api/nhat-ky?nguoiThucHienId={admin_id}&kichThuoc=50", token=token_admin)
    kiem_tra(all(d["nguoiThucHien"] in (None, ten_admin) for d in loc_nguoi["duLieu"]),
             f"lọc theo người thực hiện: {loc_nguoi['tongSo']} dòng của admin")

    print("== 5. Phân trang ==")
    ma, trang_1 = goi("/api/nhat-ky?trang=1&kichThuoc=1", token=token_admin)
    ma, trang_2 = goi("/api/nhat-ky?trang=2&kichThuoc=1", token=token_admin)
    kiem_tra(len(trang_1["duLieu"]) == 1 and trang_1["kichThuoc"] == 1 and trang_1["tongSo"] > 1,
             f"1 dòng mỗi trang, tổng {trang_1['tongSo']} dòng")
    kiem_tra(trang_2["duLieu"] and trang_2["duLieu"][0]["id"] != trang_1["duLieu"][0]["id"],
             "trang 2 là dòng khác trang 1")
    kiem_tra(trang_1["trang"] == 1 and trang_2["trang"] == 2, "số trang trả về đúng như yêu cầu")

    ma, to = goi("/api/nhat-ky?kichThuoc=999", token=token_admin)
    kiem_tra(to["kichThuoc"] == 200, f"xin 999 dòng một trang -> chặn ở {to['kichThuoc']} (trần 200)")
    ma, nho = goi("/api/nhat-ky?kichThuoc=0&trang=0", token=token_admin)
    kiem_tra(nho["kichThuoc"] == 20 and nho["trang"] == 1,
             f"xin kích thước 0 và trang 0 -> về mặc định {nho['kichThuoc']} dòng, trang {nho['trang']}")

    print("== 6. Giáo viên chỉ đọc được nhật ký của chính mình ==")
    ma, cua_gv = goi("/api/nhat-ky?kichThuoc=100", token=token_gv)
    kiem_tra(ma == 200 and cua_gv["tongSo"] > 0, f"giáo viên đọc nhật ký của mình -> HTTP {ma}, {cua_gv['tongSo']} dòng")
    kiem_tra(all(d["nguoiThucHien"] == ten_gv for d in cua_gv["duLieu"]),
             "mọi dòng đều do chính giáo viên này thực hiện")
    kiem_tra(cua_gv["tongSo"] < tat_ca["tongSo"],
             f"giáo viên thấy ít hơn admin ({cua_gv['tongSo']} < {tat_ca['tongSo']})")

    ma, gia_admin = goi(f"/api/nhat-ky?nguoiThucHienId={admin_id}&kichThuoc=100", token=token_gv)
    kiem_tra(all(d["nguoiThucHien"] in (None, ten_gv) for d in gia_admin["duLieu"]),
             "giáo viên hỏi nhật ký của admin -> không nhận được dòng nào của admin")

    ma, cua_admin_lien_quan = goi("/api/nhat-ky?hanhDong=sua_cai_dat&kichThuoc=100", token=token_admin)
    kiem_tra(cua_admin_lien_quan["tongSo"] > 0, "admin có nhật ký sửa cài đặt")
    ma, gv_sua_cai_dat = goi("/api/nhat-ky?hanhDong=sua_cai_dat&kichThuoc=100", token=token_gv)
    kiem_tra(gv_sua_cai_dat["tongSo"] == 0,
             f"giáo viên chưa từng sửa cài đặt thì thấy {gv_sua_cai_dat['tongSo']} dòng")

    ma, danh_muc_admin = goi("/api/nhat-ky/danh-muc", token=token_admin)
    kiem_tra(ma == 200 and "sua_diem_danh" in danh_muc_admin["hanhDong"] and "DiemDanh" in danh_muc_admin["doiTuong"],
             f"danh mục của admin: {len(danh_muc_admin['hanhDong'])} loại việc, {len(danh_muc_admin['doiTuong'])} bảng")
    ma, danh_muc_gv = goi("/api/nhat-ky/danh-muc", token=token_gv)
    kiem_tra("sua_cai_dat" not in danh_muc_gv["hanhDong"],
             "danh mục của giáo viên không chứa việc chỉ người khác làm")

    print("== 7. Chặn truy cập ==")
    ma, _ = goi("/api/nhat-ky")
    kiem_tra(ma == 401, f"không có token -> HTTP {ma} (mong đợi 401)")
    ma, _ = goi("/api/nhat-ky/danh-muc")
    kiem_tra(ma == 401, f"danh mục khi chưa đăng nhập -> HTTP {ma} (mong đợi 401)")

    print("== 8. Không lộ dữ liệu của người khác ==")
    ma, gv_moi_nhat = goi("/api/nhat-ky?kichThuoc=100", token=token_gv)
    chuoi = json.dumps(gv_moi_nhat, ensure_ascii=False).lower()
    kiem_tra("gv.p6." not in chuoi and "@" not in chuoi,
             "phản hồi của giáo viên không chứa email hay tài khoản của ai")

    print("== 9. Dọn dẹp tài khoản kiểm thử ==")

    def dem_nhat_ky_cua_buoi() -> str:
        return chay_sql("SET NOCOUNT ON; SELECT 'CM=' + CAST(COUNT(*) AS varchar) FROM NhatKy "
                        f"WHERE DoiTuongId = '{buoi_id}';").strip()

    # Hai dòng cho buổi này: thêm buổi dạy bù và sửa điểm danh (lần điểm danh ĐẦU không ghi nhật ký).
    truoc_khi_don = dem_nhat_ky_cua_buoi()
    kiem_tra("CM=2" == truoc_khi_don, f"buổi kiểm thử có đúng 2 dòng nhật ký ({truoc_khi_don})")
    don_tai_khoan_kiem_thu()
    con_lai = chay_sql("SET NOCOUNT ON; SELECT 'CM=' + CAST(COUNT(*) AS varchar) FROM GiaoVien WHERE Email LIKE 'gv.p6.%';")
    kiem_tra("CM=0" in con_lai, "đã dọn tài khoản kiểm thử")
    # Dọn tài khoản KHÔNG được xoá vết: nhật ký là sổ ghi một chiều, chỉ gỡ người thực hiện.
    kiem_tra(dem_nhat_ky_cua_buoi() == truoc_khi_don,
             f"nhật ký vẫn còn nguyên {truoc_khi_don} sau khi dọn tài khoản (chỉ gỡ người thực hiện)")

    so_dat = sum(1 for ok, _ in ket_qua if ok)
    print(f"\n===== KẾT QUẢ PHASE 6 (nhật ký): {so_dat}/{len(ket_qua)} bước đạt =====")
    for ok, mo_ta in ket_qua:
        if not ok:
            print("  CHƯA ĐẠT: " + mo_ta)
    return 0 if so_dat == len(ket_qua) else 1


if __name__ == "__main__":
    sys.exit(main())
