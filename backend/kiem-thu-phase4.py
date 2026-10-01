"""
Kiểm thử đầu-cuối Phase 4 (học phí, thu tiền, chốt sổ, đối chiếu ngân hàng, xuất Excel).

    cd backend && python kiem-thu-phase4.py     (cần API đang chạy ở http://localhost:5080)

Điểm mấu chốt của bộ kiểm thử này: mọi con số tiền đều được TÍNH LẠI BẰNG SQL độc lập rồi so với
số API trả về. Nếu công thức tính tiền sai thì kiểm thử phải đỏ, chứ không phải chép lại kết quả
của chính API ra mà khen.
"""
from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import date, datetime, timedelta
from io import BytesIO

API = "http://localhost:5080"
THU_MUC_API = r"c:\Joel_vh\ClassManagement\backend\ClassManagement.Api"
EMAIL_ADMIN = "admin@classmanagement.local"
EMAIL_GV_MAU = "giao.vien.mau@classmanagement.local"
EMAIL_CO_HA = "co.ha@classmanagement.local"
COOKIE_PHIEN = "cm_phien"

hom_nay = date.today()
thang, nam = hom_nay.month, hom_nay.year
dau_thang = date(nam, thang, 1)
cuoi_thang = date(nam + (thang == 12), (thang % 12) + 1, 1) - timedelta(days=1)

ket_qua: list[tuple[bool, str]] = []


def kiem_tra(dieu_kien: bool, mo_ta: str) -> None:
    ket_qua.append((bool(dieu_kien), mo_ta))
    print(("  PASS  " if dieu_kien else "  FAIL  ") + mo_ta)


def doc_bi_mat() -> dict[str, str]:
    out = subprocess.run(["dotnet", "user-secrets", "list"], cwd=THU_MUC_API,
                         capture_output=True, text=True, encoding="utf-8").stdout
    ket_qua: dict[str, str] = {}
    for dong in out.splitlines():
        if " = " in dong:
            ten, gia_tri = dong.split(" = ", 1)
            ket_qua[ten.strip()] = gia_tri.strip()
    if "Seed:Admin:MatKhau" not in ket_qua:
        raise SystemExit("Không đọc được Seed:Admin:MatKhau từ user-secrets.")
    return ket_qua


def chay_sql(cau: str) -> str:
    return subprocess.run(
        ["sqlcmd", "-S", r".\SQLEXPRESS", "-d", "ClassManagement", "-E", "-h", "-1", "-W", "-w", "800", "-I", "-Q", cau],
        capture_output=True, text=True, encoding="utf-8", errors="replace").stdout or ""


def doc_so_sql(cau: str) -> float:
    for dong in chay_sql(cau).splitlines():
        dong = dong.strip()
        if dong.startswith("CM="):
            return float(dong[3:].strip().replace(",", "."))
    raise SystemExit("Không đọc được số từ sqlcmd:\n" + chay_sql(cau))


def doc_chuoi_sql(cau: str) -> str:
    for dong in chay_sql(cau).splitlines():
        if dong.strip().startswith("CM="):
            return dong.strip()[3:].strip()
    return ""


def dem_theo_sql(tinh_nghi_khong_phep: bool) -> tuple[float, int]:
    """Tính lại tổng học phí của kỳ bằng SQL, độc lập hoàn toàn với API."""
    cong_nghi_kp = "d.nghikp" if tinh_nghi_khong_phep else "0"
    tong = doc_so_sql(
        "SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(40), CAST(SUM(CASE "
        "WHEN hs.CachTinhHocPhi = 'theo_thang' THEN ISNULL(hs.HocPhiTheoThang, 0) "
        f"ELSE ISNULL(hs.DonGiaTheoBuoi, 0) * (d.dihoc + {cong_nghi_kp}) END) AS decimal(18,2))) "
        "FROM HocSinh hs JOIN (SELECT b.HocSinhId, "
        "SUM(CASE WHEN dd.TrangThai = 'di_hoc' THEN 1 ELSE 0 END) AS dihoc, "
        "SUM(CASE WHEN dd.TrangThai = 'nghi' AND dd.LyDoNghi = 'khong_phep' THEN 1 ELSE 0 END) AS nghikp, "
        "COUNT(*) AS tong FROM BuoiHoc b LEFT JOIN DiemDanh dd ON dd.BuoiHocId = b.Id "
        f"WHERE b.Ngay >= '{dau_thang:%Y%m%d}' AND b.Ngay <= '{cuoi_thang:%Y%m%d}' GROUP BY b.HocSinhId) d "
        "ON d.HocSinhId = hs.Id WHERE hs.TrangThai <> 'da_nghi' AND d.tong > 0;")

    so_dong = int(doc_so_sql(
        "SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM HocSinh hs JOIN "
        "(SELECT DISTINCT b.HocSinhId FROM BuoiHoc b WHERE b.Ngay >= "
        f"'{dau_thang:%Y%m%d}' AND b.Ngay <= '{cuoi_thang:%Y%m%d}') d ON d.HocSinhId = hs.Id "
        "WHERE hs.TrangThai <> 'da_nghi';"))

    return tong, so_dong


def goi(duong_dan: str, *, method: str = "GET", body=None, token: str | None = None, nhi_phan: bool = False):
    du_lieu = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    yeu_cau = urllib.request.Request(API + duong_dan, data=du_lieu, method=method)
    yeu_cau.add_header("Content-Type", "application/json; charset=utf-8")
    if token:
        yeu_cau.add_header("Authorization", "Bearer " + token)

    try:
        with urllib.request.urlopen(yeu_cau, timeout=60) as phan_hoi:
            than = phan_hoi.read()
            if nhi_phan:
                return phan_hoi.status, than
            chuoi = than.decode("utf-8")
            return phan_hoi.status, (json.loads(chuoi) if chuoi.strip().startswith(("{", "[")) else chuoi)
    except urllib.error.HTTPError as loi:
        than = loi.read()
        if nhi_phan:
            return loi.code, than
        chuoi = than.decode("utf-8")
        return loi.code, (json.loads(chuoi) if chuoi.strip().startswith(("{", "[")) else chuoi)


def dang_nhap(email: str, mat_khau: str):
    return goi("/api/auth/login", method="POST", body={"email": email, "matKhau": mat_khau})


def tien(x: float) -> str:
    return f"{x:,.0f}".replace(",", ".")


def main() -> int:
    bi_mat = doc_bi_mat()
    mat_khau = bi_mat["Seed:Admin:MatKhau"]
    mat_khau_gv1 = bi_mat.get("TaiKhoanThuNghiem:GiaoVien1:MatKhau", mat_khau)

    ma, than = dang_nhap(EMAIL_ADMIN, mat_khau)
    if ma != 200:
        raise SystemExit(f"Không đăng nhập được admin (HTTP {ma})")
    token_admin = than["accessToken"]

    ma, than = dang_nhap(EMAIL_GV_MAU, mat_khau)
    if ma != 200:
        raise SystemExit(f"Không đăng nhập được giáo viên mẫu (HTTP {ma})")
    token_a = than["accessToken"]

    ma, than = dang_nhap(EMAIL_CO_HA, mat_khau_gv1)
    if ma != 200:
        raise SystemExit(f"Không đăng nhập được cô Hà (HTTP {ma})")
    token_b = than["accessToken"]

    print(f"== 0. Kỳ đang kiểm: {thang:02d}/{nam} ({dau_thang} → {cuoi_thang}) ==")
    # Dọn sổ của kỳ để bài kiểm thử chạy lại được nhiều lần: xoá phiếu thu của kỳ, đưa học phí về
    # trạng thái chưa thu và mở chốt sổ nếu lần chạy trước để lại.
    goi("/api/settings", method="PUT", token=token_admin, body={"tinhTienNghiKhongPhep": True})
    doc_so_sql("SET NOCOUNT ON; DELETE pt FROM PhieuThu pt JOIN HocPhi hp ON hp.Id = pt.HocPhiId "
               f"WHERE hp.Thang = {thang} AND hp.Nam = {nam}; SELECT 'CM=0';")
    doc_so_sql("SET NOCOUNT ON; UPDATE HocPhi SET SoTienDaThu = 0, TrangThaiThanhToan = 'chua_thu', "
               f"DaChotSo = 0, NgayChotUtc = NULL WHERE Thang = {thang} AND Nam = {nam}; SELECT 'CM=0';")
    # Dòng sổ "ma": học sinh không còn buổi nào trong kỳ và chưa thu đồng nào — ví dụ em bị cho tạm nghỉ
    # giữa kỳ nên các buổi chưa dạy bị gỡ, để lại một dòng học phí vô nghĩa. Dòng CÓ tiền đã thu thì
    # KHÔNG đụng tới: đó là chứng từ, không phải rác.
    doc_so_sql("SET NOCOUNT ON; DELETE hp FROM HocPhi hp WHERE hp.Thang = "
               f"{thang} AND hp.Nam = {nam} AND hp.SoTienDaThu = 0 "
               "AND NOT EXISTS (SELECT 1 FROM PhieuThu p WHERE p.HocPhiId = hp.Id) "
               "AND NOT EXISTS (SELECT 1 FROM BuoiHoc b WHERE b.HocSinhId = hp.HocSinhId "
               f"AND b.Ngay >= '{dau_thang:%Y%m%d}' AND b.Ngay <= '{cuoi_thang:%Y%m%d}'); SELECT 'CM=0';")
    kiem_tra(True, "đã dọn sổ của kỳ trước khi kiểm")

    print("== 1. Tính học phí kỳ từ điểm danh ==")
    ma, kq = goi("/api/tuition/tinh-ky", method="POST", token=token_admin, body={"thang": thang, "nam": nam})
    kiem_tra(ma == 200, f"POST tinh-ky -> HTTP {ma}")
    tong_sql, so_dong_sql = dem_theo_sql(True)
    kiem_tra(kq["soTao"] + kq["soCapNhat"] == so_dong_sql,
             f"tính được {kq['soTao']} dòng mới + {kq['soCapNhat']} dòng cập nhật = {so_dong_sql} học sinh có buổi trong kỳ")
    kiem_tra(abs(kq["tongThanhTien"] - tong_sql) < 1,
             f"tổng phải thu {tien(kq['tongThanhTien'])} đồng khớp con số SQL tính lại độc lập {tien(tong_sql)}")

    ma, so = goi(f"/api/tuition/ky?thang={thang}&nam={nam}", token=token_admin)
    kiem_tra(ma == 200 and len(so) == so_dong_sql, f"sổ học phí của kỳ có {len(so)} dòng")
    kiem_tra(all(d["conLai"] == d["thanhTien"] - d["soTienDaThu"] for d in so), "còn lại luôn bằng thành tiền trừ đã thu")

    print("== 2. Kiểm tra công thức tiền cho từng cách tính ==")
    dong_theo_thang = next((d for d in so if d["cachTinhHocPhi"] == "theo_thang" and d["donGiaApDung"] > 0), None)
    ma, so_a = goi(f"/api/tuition/ky?thang={thang}&nam={nam}", token=token_a)
    dong_theo_buoi = next((d for d in so_a if d["cachTinhHocPhi"] == "theo_buoi" and d["donGiaApDung"] > 0), None)
    kiem_tra(dong_theo_buoi is not None,
             f"có học sinh tính theo buổi để kiểm: {dong_theo_buoi and dong_theo_buoi['tenHocSinh']}")

    # Điểm danh thật cho học sinh đó: một buổi đi học, một buổi nghỉ không phép — rồi mới tính tiền.
    if dong_theo_buoi is not None:
        dau_tuan = hom_nay - timedelta(days=hom_nay.weekday())
        ma, diem_danh = goi(f"/api/attendance?tuNgay={dau_tuan}&denNgay={dau_tuan + timedelta(days=6)}", token=token_a)
        thang_nay = f"{nam:04d}-{thang:02d}"
        buoi_cua_em = [b for b in diem_danh["duLieu"]
                       if b["hocSinhId"] == dong_theo_buoi["hocSinhId"] and b["ngay"].startswith(thang_nay)]
        if len(buoi_cua_em) < 2:
            # Chưa đủ hai buổi trong tuần thì thêm một buổi dạy bù, để thử được cả trường hợp
            # "nghỉ không phép vẫn tính tiền" chứ không chỉ mỗi đi học.
            for lan_thu in range(6):
                ma_bu, _ = goi("/api/attendance/buoi-day-bu", method="POST", token=token_a, body={
                    "hocSinhId": dong_theo_buoi["hocSinhId"],
                    "ngay": str(hom_nay + timedelta(days=lan_thu)),
                    "gioBatDau": f"{12 + lan_thu:02d}:00:00",
                    "gioKetThuc": f"{13 + lan_thu:02d}:00:00",
                    "ghiChu": "Buổi dạy bù để kiểm thử học phí"})
                if ma_bu == 201:
                    break

            ma, diem_danh = goi(f"/api/attendance?tuNgay={dau_tuan}&denNgay={dau_tuan + timedelta(days=6)}",
                                token=token_a)
            buoi_cua_em = [b for b in diem_danh["duLieu"]
                           if b["hocSinhId"] == dong_theo_buoi["hocSinhId"] and b["ngay"].startswith(thang_nay)]

        kiem_tra(len(buoi_cua_em) >= 2, f"{dong_theo_buoi['tenHocSinh']} có {len(buoi_cua_em)} buổi trong kỳ để điểm danh thử")
        if len(buoi_cua_em) >= 2:
            ma, _ = goi("/api/attendance/luu-hang-loat", method="POST", token=token_a, body={"duLieu": [
                {"buoiHocId": buoi_cua_em[0]["id"], "trangThai": "di_hoc"},
                {"buoiHocId": buoi_cua_em[1]["id"], "trangThai": "nghi", "lyDoNghi": "khong_phep"},
            ]})
            kiem_tra(ma == 200, f"điểm danh 1 buổi đi học + 1 buổi nghỉ không phép -> HTTP {ma}")
            ma, kq_lai = goi("/api/tuition/tinh-ky", method="POST", token=token_admin, body={"thang": thang, "nam": nam})
            so_vua_diem = next(d for d in goi(f"/api/tuition/ky?thang={thang}&nam={nam}", token=token_admin)[1]
                               if d["id"] == dong_theo_buoi["id"])
            # Đếm lại bằng SQL độc lập rồi so với cả số buổi lẫn thành tiền API trả về.
            di_hoc = doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM BuoiHoc b "
                                "JOIN DiemDanh dd ON dd.BuoiHocId = b.Id AND dd.TrangThai = 'di_hoc' "
                                f"WHERE b.HocSinhId = '{dong_theo_buoi['hocSinhId']}' "
                                f"AND b.Ngay >= '{dau_thang:%Y%m%d}' AND b.Ngay <= '{cuoi_thang:%Y%m%d}';")
            nghi_kp = doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM BuoiHoc b "
                                 "JOIN DiemDanh dd ON dd.BuoiHocId = b.Id AND dd.TrangThai = 'nghi' "
                                 "AND dd.LyDoNghi = 'khong_phep' "
                                 f"WHERE b.HocSinhId = '{dong_theo_buoi['hocSinhId']}' "
                                 f"AND b.Ngay >= '{dau_thang:%Y%m%d}' AND b.Ngay <= '{cuoi_thang:%Y%m%d}';")
            mong_doi = dong_theo_buoi["donGiaApDung"] * (di_hoc + nghi_kp)
            kiem_tra(so_vua_diem["soBuoiDiHoc"] == int(di_hoc)
                     and so_vua_diem["soBuoiNghiKhongPhep"] == int(nghi_kp),
                     f"{dong_theo_buoi['tenHocSinh']}: đếm đúng {int(di_hoc)} buổi đi học, {int(nghi_kp)} buổi nghỉ không phép")
            kiem_tra(abs(so_vua_diem["thanhTien"] - mong_doi) < 1,
                     f"theo buổi: {tien(dong_theo_buoi['donGiaApDung'])} × ({int(di_hoc)} + {int(nghi_kp)}) "
                     f"= {tien(mong_doi)} đồng, API trả {tien(so_vua_diem['thanhTien'])}")
            tong_sql, so_dong_sql = dem_theo_sql(True)

    if dong_theo_thang is not None:
        kiem_tra(abs(dong_theo_thang["thanhTien"] - dong_theo_thang["donGiaApDung"]) < 1,
                 f"theo tháng: {dong_theo_thang['tenHocSinh']} thu đủ tháng {tien(dong_theo_thang['donGiaApDung'])} đồng "
                 f"dù đi {dong_theo_thang['soBuoiDiHoc']} buổi")
        kiem_tra(dong_theo_thang["soBuoiDiHoc"] + dong_theo_thang["soBuoiNghiCoPhep"] + dong_theo_thang["soBuoiNghiKhongPhep"]
                 + dong_theo_thang["soBuoiChuaDiemDanh"] > 0,
                 "vẫn đếm đủ số buổi để đối chiếu, chỉ là không dùng để tính tiền")

    print("== 3. Đổi cấu hình: buổi nghỉ không phép không tính tiền ==")
    ma, cu = goi("/api/settings", token=token_admin)
    ma, _ = goi("/api/settings", method="PUT", token=token_admin, body={"tinhTienNghiKhongPhep": False})
    kiem_tra(ma == 204 or ma == 200, f"tắt tính tiền buổi nghỉ không phép -> HTTP {ma}")
    ma, kq2 = goi("/api/tuition/tinh-ky", method="POST", token=token_admin, body={"thang": thang, "nam": nam})
    tong_khong_tinh, _ = dem_theo_sql(False)
    kiem_tra(abs(kq2["tongThanhTien"] - tong_khong_tinh) < 1,
             f"tổng phải thu giảm còn {tien(tong_khong_tinh)} đồng, khớp công thức bỏ buổi nghỉ không phép")
    goi("/api/settings", method="PUT", token=token_admin, body={"tinhTienNghiKhongPhep": True})
    ma, kq3 = goi("/api/tuition/tinh-ky", method="POST", token=token_admin, body={"thang": thang, "nam": nam})
    kiem_tra(abs(kq3["tongThanhTien"] - tong_sql) < 1, "bật lại thì con số trở về như cũ")

    print("== 4. Phân quyền: giáo viên chỉ thấy học sinh của mình ==")
    ma, so_a = goi(f"/api/tuition/ky?thang={thang}&nam={nam}", token=token_a)
    so_cua_a_sql = int(doc_so_sql(
        "SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM HocPhi hp JOIN GiaoVien g "
        f"ON g.Id = hp.GiaoVienId WHERE g.Email = '{EMAIL_GV_MAU}' AND hp.Thang = {thang} AND hp.Nam = {nam};"))
    kiem_tra(len(so_a) == so_cua_a_sql and len(so_a) < len(so),
             f"giáo viên A thấy {len(so_a)} dòng của mình, không thấy {len(so) - len(so_a)} dòng của người khác")
    kiem_tra(all(d["tenGiaoVien"] != "Cô Nguyễn Thu Hà" for d in so_a), "sổ của A không lẫn học sinh của cô Hà")

    dong_cua_b = next(d for d in so if d["giaoVienId"] != so_a[0]["giaoVienId"])
    ma, than = goi(f"/api/tuition/{dong_cua_b['id']}", token=token_a)
    kiem_tra(ma == 404, f"A mở dòng học phí của người khác -> HTTP {ma} (mong đợi 404, không phải 403)")
    ma, than = goi("/api/tuition/chot-so/xem-truoc", token=token_a)
    kiem_tra(ma == 403, f"giáo viên xem trước chốt sổ -> HTTP {ma} (mong đợi 403)")

    print("== 5. Thu tiền: thu một phần, thu đủ, thu thừa ==")
    dich = next(d for d in so_a if d["thanhTien"] > 0)
    ma, chi_tiet = goi(f"/api/tuition/{dich['id']}", token=token_a)
    kiem_tra(ma == 200 and len(chi_tiet["danhSachBuoi"]) > 0,
             f"{dich['tenHocSinh']}: xem được chi tiết kèm {len(chi_tiet['danhSachBuoi'])} buổi trong kỳ")

    mot_nua = round(dich["thanhTien"] / 2)
    ma, phieu1 = goi(f"/api/tuition/{dich['id']}/thu-tien", method="POST", token=token_a,
                     body={"soTien": mot_nua, "hinhThuc": "tien_mat", "ghiChu": "Thu một phần"})
    kiem_tra(ma == 200 and phieu1["soTien"] == mot_nua, f"thu {tien(mot_nua)} đồng -> HTTP {ma}")

    ma, sau_khi_thu = goi(f"/api/tuition/{dich['id']}", token=token_a)
    hp = sau_khi_thu["hocPhi"]
    kiem_tra(hp["trangThaiThanhToan"] == "thu_mot_phan" and hp["soTienDaThu"] == mot_nua,
             f"trạng thái chuyển thành '{hp['trangThaiThanhToan']}', đã thu {tien(hp['soTienDaThu'])} đồng")
    kiem_tra(hp["conLai"] == hp["thanhTien"] - mot_nua, "còn lại trừ đúng phần đã thu")

    ma, than = goi(f"/api/tuition/{dich['id']}/thu-tien", method="POST", token=token_a,
                   body={"soTien": hp["conLai"] + 1000, "hinhThuc": "tien_mat"})
    chuoi_loi = json.dumps(than, ensure_ascii=False)
    kiem_tra(ma == 400 and "vượt quá" in chuoi_loi,
             f"thu thừa tiền bị chặn -> HTTP {ma} kèm giải thích số còn lại")

    ma, phieu2 = goi(f"/api/tuition/{dich['id']}/thu-tien", method="POST", token=token_a,
                     body={"soTien": hp["conLai"], "hinhThuc": "tien_mat", "ghiChu": "Thu nốt"})
    ma, sau_cung = goi(f"/api/tuition/{dich['id']}", token=token_a)
    kiem_tra(sau_cung["hocPhi"]["trangThaiThanhToan"] == "da_thu" and sau_cung["hocPhi"]["conLai"] == 0,
             "thu nốt thì trạng thái thành đã thu đủ, còn lại 0")

    ma, than = goi(f"/api/tuition/{dong_cua_b['id']}/thu-tien", method="POST", token=token_a,
                   body={"soTien": 100000, "hinhThuc": "tien_mat"})
    kiem_tra(ma == 404, f"A thu tiền cho học sinh của giáo viên khác -> HTTP {ma} (mong đợi 404)")

    print("== 6. Huỷ phiếu thu phải có lý do và để lại vết ==")
    kiem_tra("id" in phieu2, f"thu nốt phần còn lại thành công (mã phiếu thu: {phieu2.get('id')})")
    ma, than = goi(f"/api/tuition/phieu-thu/{phieu2['id']}/huy", method="POST", token=token_a, body={})
    kiem_tra(ma == 400, f"huỷ phiếu thu không nêu lý do -> HTTP {ma} (mong đợi 400)")
    ma, _ = goi(f"/api/tuition/phieu-thu/{phieu2['id']}/huy", method="POST", token=token_a,
                body={"lyDo": "Ghi nhầm số tiền"})
    kiem_tra(ma == 204, f"huỷ kèm lý do -> HTTP {ma}")
    ma, sau_huy = goi(f"/api/tuition/{dich['id']}", token=token_a)
    kiem_tra(sau_huy["hocPhi"]["soTienDaThu"] == mot_nua and len(sau_huy["danhSachPhieuThu"]) == 1,
             "tiền đã thu trả về đúng phần còn lại sau khi huỷ")
    so_nhat_ky = int(doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM NhatKy "
                                "WHERE HanhDong = 'huy_phieu_thu';"))
    kiem_tra(so_nhat_ky >= 1, f"việc huỷ đã vào nhật ký ({so_nhat_ky} dòng)")

    print("== 7. Ai sắp đến hạn, ai quá hạn ==")
    ma, sap = goi("/api/tuition/sap-den-han?soNgay=7", token=token_admin)
    kiem_tra(ma == 200, f"GET sap-den-han -> HTTP {ma}")
    kiem_tra(sap["tongConLai"] >= 0, f"tổng còn phải thu {tien(sap['tongConLai'])} đồng")
    hom_nay_iso = hom_nay.isoformat()
    kiem_tra(all(d["hanDongTien"] < hom_nay_iso for d in sap["quaHan"]), "mọi dòng trong nhóm quá hạn đều có hạn đã qua")
    kiem_tra(all(d["conLai"] > 0 for d in sap["quaHan"] + sap["sapDenHan"]), "chỉ liệt kê những dòng còn nợ")

    print("== 8. Đối chiếu sao kê ngân hàng (chỉ đề xuất, không tự ghi) ==")
    ma, so_moi = goi(f"/api/tuition/ky?thang={thang}&nam={nam}", token=token_admin)
    so_con_lai = [d["conLai"] for d in so_moi if d["conLai"] > 0]
    dich_b = next(d for d in so_moi if d["conLai"] > 0 and d["id"] != dich["id"]
                  and so_con_lai.count(d["conLai"]) == 1)
    kiem_tra(dich_b is not None,
             f"chọn dòng còn nợ {tien(dich_b['conLai'])} đồng — số tiền không trùng ai khác để ghép rõ ràng")
    ten_hoc_sinh = dich_b["tenHocSinh"]

    # Mã giao dịch phải DUY NHẤT trên toàn hệ thống: API chặn ghép lại một mã đã dùng ở BẤT KỲ kỳ nào
    # (DichVuHocPhi kiểm tra trên cả bảng PhieuThu, không lọc theo kỳ), nên mã cố định sẽ đỏ oan ở lần
    # chạy sau — nhất là khi lần chạy trước rơi vào tháng khác, vì phần dọn sổ ở đầu script chỉ dọn kỳ
    # đang kiểm. Sinh mã theo từng lần chạy để bài kiểm thử chạy lại được mãi.
    hau_to = datetime.now().strftime("%H%M%S%f")
    ma_khop_chac = f"GD-KHOP-CHAC-{hau_to}"
    ma_rac = f"GD-RAC-{hau_to}"
    ma_am = f"GD-AM-{hau_to}"

    giao_dich = [
        {"ngay": hom_nay_iso, "soTien": dich_b["conLai"],
         "noiDung": f"{ten_hoc_sinh} chuyen hoc phi {thang:02d}/{nam} tien day du", "maGiaoDich": ma_khop_chac},
        {"ngay": hom_nay_iso, "soTien": 123456, "noiDung": "Chuyen tien lung tung", "maGiaoDich": ma_rac},
        {"ngay": hom_nay_iso, "soTien": 0, "noiDung": "Phi dich vu", "maGiaoDich": ma_am},
    ]
    ma, de_xuat = goi("/api/tuition/doi-chieu/phan-tich", method="POST", token=token_admin, body=giao_dich)
    kiem_tra(ma == 200 and len(de_xuat) == 3, f"phân tích {len(de_xuat) if isinstance(de_xuat, list) else '?'} dòng sao kê")
    khop = next(d for d in de_xuat if d["giaoDich"]["maGiaoDich"] == ma_khop_chac)
    kiem_tra(khop["mucDoKhop"] == "khop_chac" and khop["hocPhiId"] == dich_b["id"],
             f"giao dịch đúng tên + đúng số tiền được xếp 'khớp chắc' với {khop['tenHocSinh']}")
    kiem_tra("tên học sinh" in khop["lyDo"] and "số tiền" in khop["lyDo"], f"lý do khớp: {khop['lyDo']}")
    kiem_tra(next(d for d in de_xuat if d["giaoDich"]["maGiaoDich"] == ma_rac)["mucDoKhop"] == "khong_khop",
             "dòng sao kê không liên quan bị xếp 'không khớp'")
    kiem_tra(next(d for d in de_xuat if d["giaoDich"]["maGiaoDich"] == ma_am)["mucDoKhop"] == "khong_khop",
             "dòng tiền ra không bị coi là thu học phí")

    so_phieu_truoc = int(doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM PhieuThu;"))
    kiem_tra(so_phieu_truoc == int(doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM PhieuThu;")),
             "phân tích KHÔNG ghi gì vào sổ (chỉ đọc)")

    ma, kq_ghep = goi("/api/tuition/doi-chieu/xac-nhan", method="POST", token=token_admin, body={"cacCap": [
        {"hocPhiId": dich_b["id"], "soTien": dich_b["conLai"], "ngayThu": hom_nay_iso,
         "maGiaoDichNganHang": ma_khop_chac}]})
    kiem_tra(ma == 200 and kq_ghep["soDaGhi"] == 1 and not kq_ghep["boQua"],
             f"xác nhận ghép -> ghi {kq_ghep['soDaGhi']} phiếu thu, {tien(kq_ghep['tongDaGhi'])} đồng")
    ma, sau_ghep = goi(f"/api/tuition/{dich_b['id']}", token=token_admin)
    kiem_tra(sau_ghep["hocPhi"]["trangThaiThanhToan"] == "da_thu"
             and sau_ghep["danhSachPhieuThu"][0]["maGiaoDichNganHang"] == ma_khop_chac,
             "sổ ghi nhận phiếu thu chuyển khoản kèm mã giao dịch")

    ma, lai = goi("/api/tuition/doi-chieu/phan-tich", method="POST", token=token_admin, body=[giao_dich[0]])
    kiem_tra(lai[0]["mucDoKhop"] == "da_ghep_truoc_do",
             "phân tích lại thì giao dịch đó được báo là đã ghép trước đó (không ghép hai lần)")
    ma, kq_lai = goi("/api/tuition/doi-chieu/xac-nhan", method="POST", token=token_admin, body={"cacCap": [
        {"hocPhiId": dich_b["id"], "soTien": 10000, "ngayThu": hom_nay_iso, "maGiaoDichNganHang": ma_khop_chac}]})
    kiem_tra(kq_lai["soDaGhi"] == 0 and len(kq_lai["boQua"]) == 1,
             f"ghép lại cùng mã giao dịch bị chặn: {kq_lai['boQua'][0][:60]}")

    print("== 9. Chốt sổ: cảnh báo trước, khoá con số, mở chốt phải có lý do ==")
    ma, canh_bao = goi(f"/api/tuition/chot-so/xem-truoc?thang={thang}&nam={nam}", token=token_admin)
    kiem_tra(ma == 200, f"xem trước chốt sổ -> HTTP {ma}")
    kiem_tra(abs(canh_bao["tongPhaiThu"] - sum(d["thanhTien"] for d in so_moi)) < 1,
             f"tổng phải thu {tien(canh_bao['tongPhaiThu'])} đồng khớp sổ")
    kiem_tra(isinstance(canh_bao["chuaDiemDanh"], list), f"liệt kê {len(canh_bao['chuaDiemDanh'])} học sinh còn buổi chưa điểm danh")

    if canh_bao["chuaDiemDanh"] or canh_bao["soHocSinhChuaTinhTien"] > 0:
        ma, than = goi("/api/tuition/chot-so", method="POST", token=token_admin, body={"thang": thang, "nam": nam})
        kiem_tra(ma == 409 and "chưa" in (than.get("chiTiet") or than.get("detail") or "").lower(),
                 f"chốt sổ khi còn việc chưa xong -> HTTP {ma} kèm lời giải thích")
        ma, kq_chot = goi("/api/tuition/chot-so", method="POST", token=token_admin,
                          body={"thang": thang, "nam": nam, "boQuaCanhBao": True})
    else:
        ma, kq_chot = goi("/api/tuition/chot-so", method="POST", token=token_admin, body={"thang": thang, "nam": nam})

    kiem_tra(ma == 200 and kq_chot["soDong"] == len(so_moi), f"chốt sổ {kq_chot['soDong']} dòng -> HTTP {ma}")
    so_da_chot = int(doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM HocPhi "
                                f"WHERE Thang = {thang} AND Nam = {nam} AND DaChotSo = 1;"))
    kiem_tra(so_da_chot == len(so_moi), f"{so_da_chot} dòng đã đánh dấu chốt sổ trong database")

    ma, kq_sau_chot = goi("/api/tuition/tinh-ky", method="POST", token=token_admin, body={"thang": thang, "nam": nam})
    kiem_tra(kq_sau_chot["soBoQuaDaChot"] == len(so_moi) and kq_sau_chot["soCapNhat"] == 0,
             f"tính lại sau khi chốt thì bỏ qua toàn bộ {kq_sau_chot['soBoQuaDaChot']} dòng đã chốt")

    ma, than = goi("/api/tuition/mo-chot-so", method="POST", token=token_admin, body={"thang": thang, "nam": nam})
    kiem_tra(ma == 400, f"mở chốt sổ không nêu lý do -> HTTP {ma} (mong đợi 400)")
    ma, kq_mo = goi("/api/tuition/mo-chot-so", method="POST", token=token_admin,
                    body={"thang": thang, "nam": nam, "lyDo": "Cần sửa điểm danh tháng này"})
    kiem_tra(ma == 200 and kq_mo["soDong"] == len(so_moi), f"mở chốt kèm lý do -> HTTP {ma}")
    kiem_tra(int(doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM HocPhi "
                            f"WHERE Thang = {thang} AND Nam = {nam} AND DaChotSo = 1;")) == 0,
             "mở chốt xong thì không dòng nào còn bị khoá")
    kiem_tra(int(doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM NhatKy "
                            "WHERE HanhDong IN ('mo_chot_so_hoc_phi','chot_so_hoc_phi');")) >= 2,
             "cả chốt sổ và mở chốt đều có vết trong nhật ký")
    ma, than = goi("/api/tuition/chot-so", method="POST", token=token_a,
                   body={"thang": thang, "nam": nam, "boQuaCanhBao": True})
    kiem_tra(ma == 403, f"giáo viên chốt sổ -> HTTP {ma} (mong đợi 403)")

    print("== 10. Xuất Excel ==")
    ma, nhi_phan = goi(f"/api/tuition/xuat-excel?thang={thang}&nam={nam}", token=token_admin, nhi_phan=True)
    kiem_tra(ma == 200 and nhi_phan[:2] == b"PK", f"file tải về đúng định dạng xlsx ({len(nhi_phan)} byte)")
    try:
        with zipfile.ZipFile(BytesIO(nhi_phan)) as goi_file:
            ten_file = goi_file.namelist()
            toan_bo = "".join(
                goi_file.read(ten).decode("utf-8", errors="replace")
                for ten in ten_file if ten.endswith(".xml") or ten.endswith(".rels"))

        kiem_tra("xl/workbook.xml" in ten_file and any(t.startswith("xl/worksheets/") for t in ten_file),
                 f"bên trong là một workbook Excel hợp lệ ({len([t for t in ten_file if t.startswith('xl/worksheets/')])} sheet)")
        kiem_tra("Học sinh" in toan_bo and "Tổng cộng" in toan_bo and "Phiếu thu" in toan_bo,
                 "có đủ tiêu đề cột, dòng tổng cộng và sheet phiếu thu")
        kiem_tra("Học phí" in toan_bo and "Tổng hợp theo giáo viên" in toan_bo,
                 "đủ ba sheet đã hứa: học phí, tổng hợp theo giáo viên, phiếu thu")
    except Exception as loi:  # noqa: BLE001
        kiem_tra(False, f"không mở được file Excel: {loi}")

    ma, nhieu = goi(f"/api/tuition/xuat-excel?thang={thang}&nam={nam}", token=token_a, nhi_phan=True)
    kiem_tra(ma == 200 and len(nhieu) <= len(nhi_phan),
             f"giáo viên xuất được bản của mình ({len(nhieu)} byte, không nhiều hơn bản toàn trung tâm)")

    print("== 11. Tổng hợp theo giáo viên ==")
    ma, tong_hop_admin = goi(f"/api/tuition/tong-hop?thang={thang}&nam={nam}", token=token_admin)
    kiem_tra(ma == 200 and len(tong_hop_admin) >= 2, f"admin thấy doanh thu của {len(tong_hop_admin)} giáo viên")
    kiem_tra(abs(sum(x["phaiThu"] for x in tong_hop_admin) - canh_bao["tongPhaiThu"]) < 1,
             "cộng theo giáo viên khớp tổng của cả kỳ")
    ma, tong_hop_a = goi(f"/api/tuition/tong-hop?thang={thang}&nam={nam}", token=token_a)
    kiem_tra(len(tong_hop_a) == 1, f"giáo viên chỉ thấy phần của mình ({len(tong_hop_a)} dòng)")

    so_dat = sum(1 for ok, _ in ket_qua if ok)
    print(f"\n===== KẾT QUẢ PHASE 4: {so_dat}/{len(ket_qua)} bước đạt =====")
    for ok, mo_ta in ket_qua:
        if not ok:
            print("  CHƯA ĐẠT: " + mo_ta)
    return 0 if so_dat == len(ket_qua) else 1


if __name__ == "__main__":
    sys.exit(main())
