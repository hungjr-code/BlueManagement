"""
Kiểm thử đầu-cuối Phase 2 (nhập học sinh, sinh buổi học, điểm danh, tổng quan).

    cd backend && python kiem-thu-phase2.py      (cần API đang chạy ở http://localhost:5080)

Script tự tạo giáo viên và học sinh riêng nên không làm lệch số liệu của kiem-thu-phase1.py.
Mật khẩu đọc từ user-secrets, KHÔNG in ra màn hình.
"""
from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta

API = "http://localhost:5080"
THU_MUC_API = r"c:\Joel_vh\ClassManagement\backend\ClassManagement.Api"
EMAIL_ADMIN = "admin@classmanagement.local"
EMAIL_GV_MAU = "giao.vien.mau@classmanagement.local"

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


def goi(duong_dan: str, *, method: str = "GET", body=None, token: str | None = None):
    du_lieu = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    yeu_cau = urllib.request.Request(API + duong_dan, data=du_lieu, method=method)
    yeu_cau.add_header("Content-Type", "application/json; charset=utf-8")
    if token:
        yeu_cau.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(yeu_cau, timeout=30) as phan_hoi:
            than = phan_hoi.read().decode("utf-8")
            return phan_hoi.status, (json.loads(than) if than else None)
    except urllib.error.HTTPError as loi:
        than = loi.read().decode("utf-8")
        return loi.code, (json.loads(than) if than else None)


def dang_nhap(email: str, mat_khau: str):
    ma, than = goi("/api/auth/login", method="POST", body={"email": email, "matKhau": mat_khau})
    return ma, than


def thu_cua(ngay: date) -> str:
    return ["chu_nhat", "thu_2", "thu_3", "thu_4", "thu_5", "thu_6", "thu_7"][ngay.isoweekday() % 7]


def chay_sql(cau: str) -> str:
    """Chạy một câu lệnh SQL và trả về toàn bộ kết quả dạng chuỗi."""

    return subprocess.run(
        ["sqlcmd", "-S", r".\SQLEXPRESS", "-d", "ClassManagement", "-E", "-h", "-1", "-W", "-w", "800", "-I", "-Q", cau],
        capture_output=True, text=True, encoding="utf-8", errors="replace").stdout or ""


def don_tai_khoan_kiem_thu() -> None:
    """Xoá tài khoản kiểm thử và dữ liệu đi kèm, để lần chạy sau bắt đầu sạch."""

    chay_sql(
        "SET NOCOUNT ON; "
        "DECLARE @gv TABLE (Id uniqueidentifier); "
        "INSERT INTO @gv SELECT Id FROM GiaoVien WHERE Email LIKE 'gv.p2.%'; "
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
    # Dọn tài khoản kiểm thử còn sót (lần chạy trước chết giữa đường cũng không để lại rác).
    don_tai_khoan_kiem_thu()

    mat_khau_admin = doc_mat_khau()
    hom_nay = date.today()
    dau_tuan = hom_nay - timedelta(days=hom_nay.weekday())
    cuoi_tuan = dau_tuan + timedelta(days=6)
    tuan_sau_tu = dau_tuan + timedelta(days=7)
    tuan_sau_den = tuan_sau_tu + timedelta(days=6)

    ma, than = dang_nhap(EMAIL_ADMIN, mat_khau_admin)
    if ma != 200:
        raise SystemExit(f"Không đăng nhập được admin (HTTP {ma})")
    token_admin = than["accessToken"]

    print("== 1. Tạo giáo viên riêng cho bài kiểm thử ==")
    email_gv = f"gv.p2.{uuid.uuid4().hex[:6]}@classmanagement.local"
    mat_khau_gv = "Aa1" + uuid.uuid4().hex[:12]
    ma, than = goi("/api/teachers", method="POST", token=token_admin, body={
        "hoTen": "Giáo viên Phase 2", "email": email_gv, "matKhauTamThoi": mat_khau_gv})
    kiem_tra(ma == 201, f"tạo giáo viên -> HTTP {ma}")
    gv_id = than["id"]
    ma, than = dang_nhap(email_gv, mat_khau_gv)
    kiem_tra(ma == 200, f"giáo viên đăng nhập -> HTTP {ma}")
    token_gv = than["accessToken"]

    print("== 2. Nhập học sinh kèm lịch học hằng tuần ==")
    ma, than = goi("/api/students", method="POST", token=token_gv, body={
        "hoTen": "Học sinh Phase 2", "cachTinhHocPhi": "theo_buoi", "donGiaTheoBuoi": 250000,
        "soBuoiMoiTuan": 2, "ngayDenHanDongTien": 5, "ngayBatDau": hom_nay.isoformat(),
        "phuHuynh": "Phụ huynh Phase 2", "soDienThoaiPhuHuynh": "0900000009",
        "lichHoc": [{"thu": "thu_3", "gioBatDau": "18:00:00", "gioKetThuc": "19:30:00"},
                    {"thu": "thu_6", "gioBatDau": "18:00:00", "gioKetThuc": "19:30:00"}]})
    kiem_tra(ma == 201, f"POST /api/students -> HTTP {ma}")
    kiem_tra(than and len(than["lichHoc"]) == 2 and than["tenGiaoVien"] == "Giáo viên Phase 2",
             f"trả về {len(than['lichHoc']) if than else 0} khung giờ, giáo viên {than['tenGiaoVien'] if than else '?'}")
    kiem_tra(than and than["giaoVienId"] == gv_id, "giáo viên tạo thì học sinh mặc định thuộc chính mình")
    hs1 = than["id"]

    print("== 3. Dữ liệu sai bị chặn ngay tại field ==")
    ma, than = goi("/api/students", method="POST", token=token_gv, body={
        "hoTen": "Lệch số buổi", "cachTinhHocPhi": "theo_buoi", "donGiaTheoBuoi": 200000,
        "soBuoiMoiTuan": 3, "ngayDenHanDongTien": 5, "ngayBatDau": hom_nay.isoformat(),
        "lichHoc": [{"thu": "thu_2", "gioBatDau": "18:00:00", "gioKetThuc": "19:30:00"}]})
    kiem_tra(ma == 400 and "SoBuoiMoiTuan" in (than.get("errors") or {}),
             f"số buổi mỗi tuần lệch số khung giờ -> {ma}: {(than.get('errors') or {}).get('SoBuoiMoiTuan')}")
    ma, than = goi("/api/students", method="POST", token=token_gv, body={
        "hoTen": "Thiếu đơn giá", "cachTinhHocPhi": "theo_buoi", "soBuoiMoiTuan": 1,
        "ngayDenHanDongTien": 5, "ngayBatDau": hom_nay.isoformat(),
        "lichHoc": [{"thu": "thu_2", "gioBatDau": "18:00:00", "gioKetThuc": "19:30:00"}]})
    kiem_tra(ma == 400 and "DonGiaTheoBuoi" in (than.get("errors") or {}),
             f"tính theo buổi mà thiếu đơn giá -> {ma}: {(than.get('errors') or {}).get('DonGiaTheoBuoi')}")
    ma, than = goi("/api/students", method="POST", token=token_gv, body={
        "hoTen": "Giờ ngược", "cachTinhHocPhi": "theo_thang", "hocPhiTheoThang": 1500000,
        "soBuoiMoiTuan": 1, "ngayDenHanDongTien": 5, "ngayBatDau": hom_nay.isoformat(),
        "lichHoc": [{"thu": "thu_2", "gioBatDau": "19:30:00", "gioKetThuc": "18:00:00"}]})
    kiem_tra(ma == 400, f"giờ kết thúc trước giờ bắt đầu -> {ma}: {(than.get('errors') or {}).get('LichHoc')}")

    print("== 4. Trùng tên là cảnh báo, không chặn cứng ==")
    ma, than = goi("/api/students", method="POST", token=token_gv, body={
        "hoTen": "Học sinh Phase 2", "cachTinhHocPhi": "theo_buoi", "donGiaTheoBuoi": 250000,
        "soBuoiMoiTuan": 1, "ngayDenHanDongTien": 10, "ngayBatDau": hom_nay.isoformat(),
        "lichHoc": [{"thu": "thu_4", "gioBatDau": "20:00:00", "gioKetThuc": "21:00:00"}]})
    kiem_tra(ma == 409 and "trùng tên" in (than.get("title") or "").lower(),
             f"trùng tên -> HTTP {ma}: {than.get('title')}")
    ma, than = goi("/api/students", method="POST", token=token_gv, body={
        "hoTen": "Học sinh Phase 2", "cachTinhHocPhi": "theo_buoi", "donGiaTheoBuoi": 250000,
        "soBuoiMoiTuan": 1, "ngayDenHanDongTien": 10, "ngayBatDau": hom_nay.isoformat(),
        "lichHoc": [{"thu": "thu_4", "gioBatDau": "20:00:00", "gioKetThuc": "21:00:00"}],
        "boQuaCanhBaoTrungTen": True})
    kiem_tra(ma == 201, f"xác nhận trùng tên thì tạo được -> HTTP {ma}")
    hs2 = than["id"] if than else None

    print("== 5. Cảnh báo trùng lịch của cùng một giáo viên ==")
    ma, than = goi("/api/students", method="POST", token=token_gv, body={
        "hoTen": "Học sinh trùng giờ", "cachTinhHocPhi": "theo_buoi", "donGiaTheoBuoi": 200000,
        "soBuoiMoiTuan": 1, "ngayDenHanDongTien": 5, "ngayBatDau": hom_nay.isoformat(),
        "lichHoc": [{"thu": "thu_3", "gioBatDau": "18:30:00", "gioKetThuc": "19:45:00"}]})
    kiem_tra(ma == 400 and "Học sinh Phase 2" in str((than.get("errors") or {}).get("LichHoc")),
             f"trùng giờ với học sinh khác -> {ma}: {(than.get('errors') or {}).get('LichHoc')}")

    print("== 6. Giáo viên không gán học sinh cho người khác ==")
    ma, than = goi("/api/teachers", token=token_admin)
    gv_mau = next((g for g in than["duLieu"] if g["email"] == EMAIL_GV_MAU), None)
    ma, than = goi("/api/students", method="POST", token=token_gv, body={
        "hoTen": "Gán nhầm giáo viên", "giaoVienId": gv_mau["id"], "cachTinhHocPhi": "theo_buoi",
        "donGiaTheoBuoi": 200000, "soBuoiMoiTuan": 1, "ngayDenHanDongTien": 5,
        "ngayBatDau": hom_nay.isoformat(),
        "lichHoc": [{"thu": "thu_7", "gioBatDau": "8:00:00", "gioKetThuc": "9:00:00"}]})
    kiem_tra(ma == 403, f"giáo viên gán học sinh cho giáo viên khác -> HTTP {ma} (mong đợi 403)")

    print("== 7. Buổi học được sinh từ lịch lặp hằng tuần ==")
    ma, than = goi(f"/api/attendance?tuNgay={dau_tuan}&denNgay={cuoi_tuan}", token=token_gv)
    kiem_tra(ma == 200, f"GET /api/attendance tuần này -> HTTP {ma}")
    buoi_tuan_nay = than["duLieu"] if than else []
    kiem_tra(len(buoi_tuan_nay) > 0, f"sinh ra {len(buoi_tuan_nay)} buổi học trong tuần")
    kiem_tra(all(b["trangThai"] == "chua_diem_danh" for b in buoi_tuan_nay),
             "mọi buổi mới đều ở trạng thái chưa điểm danh")
    kiem_tra(all(b["coTinhTien"] is False for b in buoi_tuan_nay),
             "buổi chưa điểm danh KHÔNG tính tiền")
    thu_trong_lich = {b["ngay"] for b in buoi_tuan_nay if b["hocSinhId"] == hs1}
    kiem_tra(all(thu_cua(date.fromisoformat(n)) in ("thu_3", "thu_6") for n in thu_trong_lich),
             f"buổi sinh đúng thứ đã khai: {sorted(thu_cua(date.fromisoformat(n)) for n in thu_trong_lich)}")

    # Học sinh này học thứ 3 và thứ 6, nên KHÔNG phải hôm nào cũng có buổi: chạy bài kiểm thử vào
    # thứ 4 hay thứ 7 thì danh sách buổi hôm nay rỗng. Chọn buổi từ danh sách CỦA TUẦN rồi nhớ ngày
    # của buổi đó, để các bước sau hỏi lại đúng ngày ấy thay vì giả định hôm nay có buổi.
    buoi_cua_hs1 = [b for b in buoi_tuan_nay if b["tenHocSinh"] == "Học sinh Phase 2"]
    buoi_chon = (next((b for b in buoi_cua_hs1 if b["ngay"] == hom_nay.isoformat()), None)
                 or (buoi_cua_hs1 or buoi_tuan_nay or [None])[0])
    buoi_de_diem_danh = buoi_chon["id"] if buoi_chon else None
    ngay_buoi = buoi_chon["ngay"] if buoi_chon else hom_nay.isoformat()
    kiem_tra(buoi_de_diem_danh is not None, "chọn được một buổi để thử điểm danh")

    print("== 8. Điểm danh theo lô và nhật ký khi sửa ==")
    ma, than = goi("/api/attendance/luu-hang-loat", method="POST", token=token_gv, body={"duLieu": [
        {"buoiHocId": buoi_de_diem_danh, "trangThai": "di_hoc", "ghiChu": "Học tốt, đã kiểm tra bài cũ"}]})
    kiem_tra(ma == 200 and than["soBuoiDaLuu"] == 1, f"lưu một buổi đi học -> HTTP {ma}")
    kiem_tra(than and than["soBuoiGhiNhatKy"] == 0, "lần điểm danh đầu tiên không ghi nhật ký sửa")

    ma, than = goi(f"/api/attendance?tuNgay={ngay_buoi}&denNgay={ngay_buoi}", token=token_gv)
    buoi = next(b for b in than["duLieu"] if b["id"] == buoi_de_diem_danh)
    kiem_tra(buoi["trangThai"] == "di_hoc" and buoi["coTinhTien"] is True,
             f"đi học thì mặc định tính tiền (coTinhTien={buoi['coTinhTien']})")
    kiem_tra(buoi["nguoiDiemDanh"] == "Giáo viên Phase 2", f"ghi nhận người điểm danh: {buoi['nguoiDiemDanh']}")

    ma, than = goi("/api/attendance/luu-hang-loat", method="POST", token=token_gv, body={"duLieu": [
        {"buoiHocId": buoi_de_diem_danh, "trangThai": "nghi", "lyDoNghi": "co_phep", "ghiChu": "Ốm, học bù sau"}]})
    kiem_tra(ma == 200 and than["soBuoiGhiNhatKy"] == 1, f"sửa lại thành nghỉ -> ghi {than and than['soBuoiGhiNhatKy']} dòng nhật ký")
    ma, than = goi(f"/api/attendance?tuNgay={ngay_buoi}&denNgay={ngay_buoi}", token=token_gv)
    buoi = next(b for b in than["duLieu"] if b["id"] == buoi_de_diem_danh)
    kiem_tra(buoi["trangThai"] == "nghi" and buoi["lyDoNghi"] == "co_phep" and buoi["coTinhTien"] is False,
             "nghỉ có phép thì không tính tiền")

    ma, than = goi("/api/attendance/luu-hang-loat", method="POST", token=token_gv, body={"duLieu": [
        {"buoiHocId": buoi_de_diem_danh, "trangThai": "di_hoc"}]})
    kiem_tra(ma == 200, f"đổi lại thành đi học -> HTTP {ma}")

    print("== 9. Chặn điểm danh buổi của giáo viên khác ==")
    ma, than = goi(f"/api/attendance?tuNgay={dau_tuan}&denNgay={cuoi_tuan}", token=token_admin)
    buoi_gv_khac = next((b for b in than["duLieu"] if b["giaoVienId"] != gv_id), None)
    if buoi_gv_khac:
        ma, than = goi("/api/attendance/luu-hang-loat", method="POST", token=token_gv, body={"duLieu": [
            {"buoiHocId": buoi_gv_khac["id"], "trangThai": "di_hoc"}]})
        kiem_tra(ma == 404, f"lưu điểm danh buổi của giáo viên khác -> HTTP {ma} (mong đợi 404)")
        ma, than = goi(f"/api/students/{buoi_gv_khac['hocSinhId']}", token=token_gv)
        kiem_tra(ma == 404, f"xem học sinh của giáo viên khác -> HTTP {ma} (mong đợi 404)")
        ma, than = goi("/api/teachers", token=token_gv)
        kiem_tra(than["tongSo"] == 1, f"giáo viên chỉ thấy {than['tongSo']} tài khoản (chính mình)")
    else:
        kiem_tra(False, "không tìm được buổi của giáo viên khác để thử")

    print("== 10. Thêm buổi dạy bù ==")
    ma, than = goi("/api/attendance/buoi-day-bu", method="POST", token=token_gv, body={
        "hocSinhId": hs1, "ngay": str(hom_nay), "gioBatDau": "20:00:00", "gioKetThuc": "21:00:00",
        "ghiChu": "Dạy bù buổi nghỉ"})
    kiem_tre = ma == 201
    kiem_tra(kiem_tre and than["laBuoiDayBu"] is True, f"thêm buổi dạy bù -> HTTP {ma}")
    if kiem_tre:
        ma, than = goi("/api/attendance/buoi-day-bu", method="POST", token=token_gv, body={
            "hocSinhId": hs1, "ngay": str(hom_nay), "gioBatDau": "20:30:00", "gioKetThuc": "21:30:00"})
        kiem_tra(ma == 400, f"dạy bù trùng giờ buổi khác -> HTTP {ma}: {(than.get('errors') or {}).get('GioBatDau')}")

    print("== 11. Tổng quan hôm nay và tuần này ==")
    ma, than = goi("/api/dashboard/hom-nay", token=token_gv)
    kiem_tra(ma == 200 and than["ngay"] == str(hom_nay),
             f"hôm nay {than.get('ngay')}: {than.get('soBuoi')} buổi, {than.get('soChuaDiemDanh')} chưa điểm danh")
    kiem_tra(all(b["giaoVienId"] == gv_id for b in than["duLieu"]), "chỉ thấy buổi của chính mình")

    ma, than_tuan = goi("/api/dashboard/tuan-nay", token=token_gv)
    kiem_tra(ma == 200 and than_tuan["soBuoi"] >= 1,
             f"tuần này: {than_tuan.get('soBuoi')} buổi — đi học {than_tuan.get('soDiHoc')}, "
             f"nghỉ có phép {than_tuan.get('soNghiCoPhep')}, chưa điểm danh {than_tuan.get('soChuaDiemDanh')}")
    kiem_tra(than_tuan["hocPhiDuKienThangNay"] == 3_000_000,
             f"học phí dự kiến tháng = {than_tuan['hocPhiDuKienThangNay']:,.0f} "
             f"(2 buổi/tuần × 4 × 250.000 + 1 buổi/tuần × 4 × 250.000)")
    # Đừng đếm cứng số học sinh: học sinh thứ hai chỉ có buổi trong tuần khi buổi của họ chưa trôi qua
    # (học sinh bắt đầu học từ HÔM NAY, và buổi trước ngày bắt đầu thì đúng ra không được sinh). Điều
    # luôn đúng là: tổng hợp nhóm theo học sinh và theo giáo viên, và cộng lại phải bằng tổng số buổi.
    tong_hop_hs = than_tuan["tongHopTheoHocSinh"]
    tong_hop_gv = than_tuan["tongHopTheoGiaoVien"]
    kiem_tra(len(tong_hop_hs) >= 1 and len(tong_hop_gv) == 1
             and sum(d["soBuoi"] for d in tong_hop_hs) == than_tuan["soBuoi"]
             and sum(d["soBuoi"] for d in tong_hop_gv) == than_tuan["soBuoi"],
             f"tổng hợp {len(tong_hop_hs)} học sinh / {len(tong_hop_gv)} giáo viên, "
             f"cộng lại đúng {than_tuan['soBuoi']} buổi")

    ma, than_admin = goi(f"/api/dashboard/tuan-nay?giaoVienId={gv_id}", token=token_admin)
    kiem_tra(ma == 200 and than_admin["soBuoi"] == than_tuan["soBuoi"],
             f"admin lọc theo giáo viên thấy đúng {than_admin.get('soBuoi')} buổi")

    print("== 12. Sửa lịch học thì sinh lại buổi chưa dạy ==")
    ma, than = goi(f"/api/students/{hs1}", method="PUT", token=token_gv, body={
        "hoTen": "Học sinh Phase 2", "lop": "Lớp 9", "cachTinhHocPhi": "theo_buoi", "donGiaTheoBuoi": 300000,
        "soBuoiMoiTuan": 2, "ngayDenHanDongTien": 5, "ngayBatDau": hom_nay.isoformat(),
        "lichHoc": [{"thu": "thu_2", "gioBatDau": "17:00:00", "gioKetThuc": "18:30:00"},
                    {"thu": "thu_5", "gioBatDau": "17:00:00", "gioKetThuc": "18:30:00"}]})
    kiem_tra(ma == 200, f"PUT /api/students đổi lịch -> HTTP {ma}")
    kiem_tra(than and any(k["thu"] == "thu_2" for k in than["lichHoc"]), "lịch mới đã lưu")
    # Lớp phải theo được sang nhánh sửa: lần đầu làm, bản vá chỉ khớp nhánh TẠO nên `lop` bị nuốt im lặng.
    kiem_tra(than and than["lop"] == "Lớp 9", f"lớp lưu được khi sửa học sinh: {than and than['lop']}")

    ma, than = goi(f"/api/attendance?tuNgay={tuan_sau_tu}&denNgay={tuan_sau_den}", token=token_gv)
    buoi_tuan_sau = [b for b in than["duLieu"] if b["hocSinhId"] == hs1]
    thu_tuan_sau = {thu_cua(date.fromisoformat(b["ngay"])) for b in buoi_tuan_sau}
    kiem_tra(thu_tuan_sau <= {"thu_2", "thu_5"} and thu_tuan_sau,
             f"tuần sau sinh theo lịch mới: {sorted(thu_tuan_sau)}")

    ma, than = goi(f"/api/attendance?tuNgay={ngay_buoi}&denNgay={ngay_buoi}", token=token_gv)
    buoi_cu = [b for b in than["duLieu"] if b["id"] == buoi_de_diem_danh]
    kiem_tra(len(buoi_cu) == 1 and buoi_cu[0]["trangThai"] == "di_hoc",
             "buổi đã điểm danh vẫn giữ nguyên sau khi đổi lịch")

    print("== 13. Cho học sinh nghỉ: đổi trạng thái, không xoá hồ sơ ==")
    ma, than = goi(f"/api/students/{hs2}", method="DELETE", token=token_gv)
    kiem_tra(ma == 204, f"DELETE (cho nghỉ) -> HTTP {ma}")
    ma, than = goi("/api/students?kichThuoc=50", token=token_gv)
    hs2_sau = next((h for h in than["duLieu"] if h["id"] == hs2), None)
    kiem_tra(hs2_sau is not None and hs2_sau["trangThai"] == "da_nghi",
             f"hồ sơ vẫn còn và ở trạng thái {hs2_sau and hs2_sau['trangThai']}")
    ma, than = goi(f"/api/attendance?tuNgay={tuan_sau_tu}&denNgay={tuan_sau_den}", token=token_gv)
    kiem_tra(not any(b["hocSinhId"] == hs2 for b in than["duLieu"]),
             "học sinh đã nghỉ thì không sinh buổi mới nữa")

    print("== 14. Nhật ký và số liệu trong database ==")
    sql = ("SET NOCOUNT ON; SELECT HanhDong + ' — ' + CAST(COUNT(*) AS varchar) + ' dòng' FROM NhatKy "
           "WHERE HanhDong IN ('sua_diem_danh','tao_hoc_sinh','sua_hoc_sinh','cho_hoc_sinh_nghi','them_buoi_day_bu') "
           "GROUP BY HanhDong ORDER BY HanhDong; SELECT TOP 3 HanhDong + '|' + ISNULL(LEFT(DuLieuTruoc, 45),'-') "
           "+ '|' + ISNULL(LEFT(DuLieuSau, 60),'-') FROM NhatKy WHERE HanhDong = 'sua_diem_danh' "
           "ORDER BY ThoiDiemUtc DESC;")
    nhat_ky = subprocess.run(["sqlcmd", "-S", r".\SQLEXPRESS", "-d", "ClassManagement", "-E", "-W", "-Q", sql],
                             capture_output=True, text=True, encoding="utf-8", errors="replace").stdout or ""
    print("  Nhật ký Phase 2:\n" + "\n".join("    " + d for d in nhat_ky.splitlines()[:8]))
    kiem_tra("sua_diem_danh" in nhat_ky, "có dòng nhật ký sua_diem_danh")
    kiem_tra("tao_hoc_sinh" in nhat_ky and "sua_hoc_sinh" in nhat_ky and "cho_hoc_sinh_nghi" in nhat_ky,
             "có nhật ký tạo / sửa / cho nghỉ học sinh")

    sql = ("SET NOCOUNT ON; SELECT HoTen + '|' + CAST(SoBuoiMoiTuan AS varchar) + '|' + cachTinhHocPhi + '|' "
           "+ trangThai FROM HocSinh WHERE HoTen LIKE '%Phase 2%';")
    hoc_sinh_sql = subprocess.run(["sqlcmd", "-S", r".\SQLEXPRESS", "-d", "ClassManagement", "-E", "-W", "-Q", sql],
                                  capture_output=True, text=True, encoding="utf-8", errors="replace").stdout or ""
    print("  Học sinh Phase 2 trong SQL:\n" + "\n".join("    " + d for d in hoc_sinh_sql.splitlines()))

    ma, than = goi("/api/teachers", token=token_admin)
    gv_p2 = next(g for g in than["duLieu"] if g["id"] == gv_id)
    kiem_tra(gv_p2["soBuoiDayTrongThang"] >= 1,
             f"giáo viên được đếm {gv_p2['soBuoiDayTrongThang']} buổi đã dạy trong tháng")

    print("== 15. Dọn dẹp: cho giáo viên kiểm thử nghỉ ==")
    ma, than = goi(f"/api/teachers/{gv_id}", method="PUT", token=token_admin, body={
        "hoTen": "Giáo viên Phase 2", "vaiTro": "giao_vien", "trangThai": "da_nghi"})
    kiem_tra(ma == 200 and than["trangThai"] == "da_nghi", f"khoá tài khoản kiểm thử -> HTTP {ma}")

    # Dọn luôn ở cuối: sau một lần chạy trọn vẹn thì không còn tài khoản thử nào sót lại.
    don_tai_khoan_kiem_thu()

    so_dat = sum(1 for ok, _ in ket_qua if ok)
    print(f"\n===== KẾT QUẢ PHASE 2: {so_dat}/{len(ket_qua)} bước đạt =====")
    for ok, mo_ta in ket_qua:
        if not ok:
            print("  CHƯA ĐẠT: " + mo_ta)
    return 0 if so_dat == len(ket_qua) else 1


if __name__ == "__main__":
    sys.exit(main())
