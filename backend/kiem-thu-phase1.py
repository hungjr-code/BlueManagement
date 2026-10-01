"""
Kiểm thử đầu-cuối Phase 1 (backend). Chạy khi API đang chạy ở http://localhost:5080:

    cd backend && python kiem-thu-phase1.py

Mật khẩu đọc từ user-secrets, KHÔNG in ra màn hình. Script tự tạo một giáo viên để thử,
rồi khoá tài khoản đó lại. Mọi bước đều assert, cuối cùng in bảng PASS/FAIL.
"""
from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

API = "http://localhost:5080"
THU_MUC_API = r"c:\Joel_vh\ClassManagement\backend\ClassManagement.Api"
EMAIL_ADMIN = "admin@classmanagement.local"
EMAIL_GV_MAU = "giao.vien.mau@classmanagement.local"

ket_qua: list[tuple[bool, str]] = []


def kiem_tra(dieu_kien: bool, mo_ta: str) -> None:
    ket_qua.append((bool(dieu_kien), mo_ta))
    print(("  PASS  " if dieu_kien else "  FAIL  ") + mo_ta)


def doc_mat_khau() -> str:
    out = subprocess.run(
        ["dotnet", "user-secrets", "list"], cwd=THU_MUC_API,
        capture_output=True, text=True, encoding="utf-8").stdout
    for dong in out.splitlines():
        if "Seed:Admin:MatKhau" in dong:
            return dong.split("=", 1)[1].strip()
    raise SystemExit("Không đọc được Seed:Admin:MatKhau từ user-secrets.")


def goi(duong_dan: str, *, method: str = "GET", body: dict | None = None,
        token: str | None = None, cookie: str | None = None):
    du_lieu = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    yeu_cau = urllib.request.Request(API + duong_dan, data=du_lieu, method=method)
    yeu_cau.add_header("Content-Type", "application/json; charset=utf-8")
    if token:
        yeu_cau.add_header("Authorization", "Bearer " + token)
    if cookie:
        yeu_cau.add_header("Cookie", cookie)

    try:
        with urllib.request.urlopen(yeu_cau) as phan_hoi:
            than = phan_hoi.read().decode("utf-8")
            return phan_hoi.status, (json.loads(than) if than else None), phan_hoi.headers.get("Set-Cookie")
    except urllib.error.HTTPError as loi:
        than = loi.read().decode("utf-8")
        return loi.code, (json.loads(than) if than else None), loi.headers.get("Set-Cookie")


def lay_cookie(header: str | None) -> str | None:
    if not header:
        return None
    return header.split(";", 1)[0]


def dang_nhap(email: str, mat_khau: str):
    return goi("/api/auth/login", method="POST", body={"email": email, "matKhau": mat_khau})


def chay_sql(cau: str) -> str:
    """Chạy một câu lệnh SQL và trả về toàn bộ kết quả dạng chuỗi."""

    return subprocess.run(
        ["sqlcmd", "-S", r".\SQLEXPRESS", "-d", "ClassManagement", "-E", "-h", "-1", "-W", "-w", "800", "-I", "-Q", cau],
        capture_output=True, text=True, encoding="utf-8", errors="replace").stdout or ""


def don_tai_khoan_kiem_thu() -> None:
    """Xoá tài khoản kiểm thử và dữ liệu đi kèm, để lần chạy sau bắt đầu sạch.

    Chạy ở đầu mỗi lần kiểm thử: nếu lần trước chết giữa đường thì rác cũng bị dọn.
    """

    chay_sql(
        "SET NOCOUNT ON; "
        "DECLARE @gv TABLE (Id uniqueidentifier); "
        f"INSERT INTO @gv SELECT Id FROM GiaoVien WHERE Email LIKE 'gv.kiem.thu.%'; "
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
    print("== 1. /api/health ==")
    ma, than, _ = goi("/api/health")
    kiem_tra(ma == 200, f"HTTP {ma}")
    kiem_tra(than["status"] == "ok" and than["database"]["canConnect"] is True,
             f"status={than['status']} database.canConnect={than['database']['canConnect']}")
    kiem_tra(than["provider"] if False else than["database"]["provider"] == "SQL Server",
             f"provider={than['database']['provider']}, version={than['version']}, env={than['environment']}")

    print("== 2. Chặn khi chưa đăng nhập ==")
    ma, _, _ = goi("/api/students")
    kiem_tra(ma == 401, f"GET /api/students không token -> HTTP {ma} (mong đợi 401)")

    print("== 3. Đăng nhập admin ==")
    ma, than, _ = dang_nhap(EMAIL_ADMIN, mat_khau_admin)
    kiem_tra(ma == 200, f"HTTP {ma}")
    token_admin = than["accessToken"]
    kiem_tra(than["nguoiDung"]["vaiTro"] == "admin", f"vaiTro={than['nguoiDung']['vaiTro']}")
    kiem_tra(than["nguoiDung"]["hoTen"] == "Chủ trung tâm",
             f"họ tên có dấu đọc đúng: {than['nguoiDung']['hoTen']}")

    print("== 4. /api/auth/me ==")
    ma, than, _ = goi("/api/auth/me", token=token_admin)
    kiem_tra(ma == 200 and than["vaiTro"] == "admin" and than["trangThai"] == "dang_lam",
             f"HTTP {ma}, vaiTro={than.get('vaiTro')}, trangThai={than.get('trangThai')}")

    print("== 5. Admin xem dữ liệu ==")
    ma, than_hs, _ = goi("/api/students?kichThuoc=50", token=token_admin)
    kiem_tra(ma == 200 and than_hs["tongSo"] >= 3, f"/api/students -> HTTP {ma}, tổng số {than_hs.get('tongSo')}")
    kiem_tra(any("ầ" in str(h["hoTen"]) or "ễ" in str(h["hoTen"]) or "ê" in str(h["hoTen"]) for h in than_hs["duLieu"]),
             "tên học sinh tiếng Việt trả về nguyên dấu")
    hs_id = than_hs["duLieu"][0]["id"]
    kiem_tra(all(len(h["lichHoc"]) == h["soBuoiMoiTuan"] for h in than_hs["duLieu"]),
             "số khung giờ khai trong lichHoc khớp sốBuoiMoiTuan với mọi học sinh mẫu")

    ma, than_gv, _ = goi("/api/teachers", token=token_admin)
    gv_mau = next((g for g in than_gv["duLieu"] if g["email"] == EMAIL_GV_MAU), None)
    kiem_tra(ma == 200 and than_gv["tongSo"] >= 2, f"/api/teachers -> HTTP {ma}, tổng số {than_gv.get('tongSo')}")
    kiem_tra(gv_mau is not None and gv_mau["soHocSinhDangPhuTrach"] == 3,
             f"giáo viên mẫu phụ trách {gv_mau and gv_mau['soHocSinhDangPhuTrach']} học sinh (đếm từ bảng HocSinh)")

    print("== 6. Cài đặt: đọc, ghi, kiểm tra dữ liệu sai ==")
    ma, than, _ = goi("/api/settings", token=token_admin)
    kiem_tra(ma == 200 and than["muiGio"] == "Asia/Ho_Chi_Minh",
             f"GET /api/settings -> HTTP {ma}, múi giờ {than.get('muiGio')}")
    kiem_tra("googleRefreshToken" not in than and "googleRefreshTokenMaHoa" not in than,
             "không trả refresh token của Google xuống frontend")

    ma, than, _ = goi("/api/settings", method="PUT", token=token_admin, body={
        "mauNoiDungChuyenKhoan": "{tenHocSinh} - Hoc phi {thang}", "nhacTruocBaoLauPhut": 45,
    })
    kiem_tra(ma == 200 and than["nhacTruocBaoLauPhut"] == 45, f"PUT /api/settings (cấu hình chung) -> HTTP {ma}")
    kiem_tra("soTaiKhoan" not in than and "nganHangBin" not in than,
             "cài đặt chung không còn chứa tài khoản nhận tiền của ai")
    ma, than, _ = goi("/api/settings", token=token_admin)
    kiem_tra(ma == 200 and than["nhacTruocBaoLauPhut"] == 45,
             "đọc lại từ database thấy đúng số phút nhắc")
    kiem_tra(than.get("soGiaoVienDaKhaiTaiKhoanNhanTien") is not None,
             f"admin thấy số lượng đã khai: {than.get('soGiaoVienDaKhaiTaiKhoanNhanTien')} khai / "
             f"{than.get('soGiaoVienChuaKhaiTaiKhoanNhanTien')} chưa khai")

    ma, than, _ = goi("/api/settings", method="PUT", token=token_admin, body={"muiGio": "Khong/Co/Mui/Gio/Nay"})
    kiem_tra(ma == 400 and "MuiGio" in (than.get("errors") or {}),
             f"PUT với múi giờ sai -> HTTP {ma}, lỗi theo field: {(than.get('errors') or {}).get('MuiGio')}")

    print("== 7. Admin tạo giáo viên (tên có dấu) ==")
    email_gv2 = f"gv.kiem.thu.{uuid.uuid4().hex[:6]}@classmanagement.local"
    mat_khau_gv2 = "Aa1" + uuid.uuid4().hex[:12]
    ma, than, _ = goi("/api/teachers", method="POST", token=token_admin, body={
        "hoTen": "Giáo viên kiểm thử", "email": email_gv2, "soDienThoai": "0912345678",
        "matKhauTamThoi": mat_khau_gv2, "ghiChu": "Tạo tự động bởi script kiểm thử",
    })
    kiem_tra(ma == 201, f"HTTP {ma} (mong đợi 201)")
    kiem_tra(than and than["hoTen"] == "Giáo viên kiểm thử", f"tên lưu nguyên dấu: {than and than['hoTen']}")
    kiem_tra(than and than["vaiTro"] == "giao_vien", f"bỏ trống vaiTro -> mặc định {than and than['vaiTro']}")
    gv2_id = than["id"]

    ma, than, _ = goi("/api/teachers", method="POST", token=token_admin, body={
        "hoTen": "Trùng email", "email": email_gv2, "matKhauTamThoi": "Aa12345678"})
    kiem_tra(ma == 400, f"tạo trùng email -> HTTP {ma} (mong đợi 400)")

    print("== 8. Giáo viên mới: phạm vi dữ liệu bị chặn ở backend ==")
    ma, than, _ = dang_nhap(email_gv2, mat_khau_gv2)
    kiem_tra(ma == 200 and than["nguoiDung"]["vaiTro"] == "giao_vien", f"đăng nhập -> HTTP {ma}")
    token_gv2 = than["accessToken"]

    ma, than, _ = goi("/api/students", token=token_gv2)
    kiem_tra(ma == 200 and than["tongSo"] == 0, f"thấy {than.get('tongSo')} học sinh (mong đợi 0, chưa phụ trách ai)")

    ma, than, _ = goi(f"/api/students/{hs_id}", token=token_gv2)
    kiem_tra(ma == 404, f"học sinh của giáo viên khác -> HTTP {ma} (mong đợi 404, không phải 403)")

    _, than_gv_khac, _ = goi(f"/api/students?giaoVienId={gv_mau['id']}", token=token_gv2)
    kiem_tra(than_gv_khac["tongSo"] == 0,
             f"gửi kèm ?giaoVienId của người khác -> vẫn thấy {than_gv_khac['tongSo']} học sinh (bộ lọc không vượt được hàng rào)")

    ma, than, _ = goi("/api/teachers", token=token_gv2)
    kiem_tra(ma == 200 and than["tongSo"] == 1, f"giáo viên xem /api/teachers -> {than.get('tongSo')} (chỉ chính mình)")

    ma, _, _ = goi(f"/api/teachers/{gv_mau['id']}", token=token_gv2)
    kiem_tra(ma == 404, f"xem hồ sơ giáo viên khác -> HTTP {ma} (mong đợi 404)")

    ma, than, _ = goi("/api/settings", method="PUT", token=token_gv2, body={"nhacTruocBaoLauPhut": 5})
    kiem_tra(ma == 403, f"giáo viên sửa cài đặt chung -> HTTP {ma} (mong đợi 403): {than.get('title')}")

    ma, than, _ = goi("/api/teachers", method="POST", token=token_gv2, body={
        "hoTen": "Kẻ gian", "email": "ke.gian@classmanagement.local", "matKhauTamThoi": "Aa12345678"})
    kiem_tra(ma == 403, f"giáo viên tự tạo tài khoản -> HTTP {ma} (mong đợi 403): {than.get('title')}")

    ma, than, _ = goi("/api/settings", token=token_gv2)
    kiem_tra(ma == 200, f"giáo viên vẫn đọc được cài đặt chung -> HTTP {ma}")

    print("== 9. Làm mới token bằng cookie (xoay vòng) ==")
    ma, than, set_cookie = dang_nhap(EMAIL_ADMIN, mat_khau_admin)
    cookie_admin = lay_cookie(set_cookie)
    kiem_tra(cookie_admin is not None and "cm_phien" in cookie_admin, f"cookie phiên được đặt: {cookie_admin and cookie_admin.split('=')[0]}")
    ma, than, set_cookie2 = goi("/api/auth/refresh", method="POST", cookie=cookie_admin)
    kiem_tra(ma == 200 and than["accessToken"] != token_admin, f"refresh -> HTTP {ma}, token mới khác token cũ")
    cookie_moi = lay_cookie(set_cookie2)
    kiem_tra(cookie_moi != cookie_admin, "refresh token đã được xoay vòng, cookie mới khác cookie cũ")

    print("== 10. Khoá tài khoản giáo viên đã nghỉ ==")
    ma, than, _ = goi(f"/api/teachers/{gv2_id}", method="PUT", token=token_admin, body={
        "hoTen": "Giáo viên kiểm thử", "vaiTro": "giao_vien", "trangThai": "da_nghi"})
    kiem_tra(ma == 200 and than["trangThai"] == "da_nghi", f"PUT đổi trạng thái -> HTTP {ma}, trangThai={than.get('trangThai')}")
    ma, than, _ = dang_nhap(email_gv2, mat_khau_gv2)
    kiem_tra(ma == 403, f"giáo viên đã nghỉ đăng nhập -> HTTP {ma} (mong đợi 403): {than.get('title')}")

    print("== 11. Admin tự hạ quyền khi là admin cuối cùng ==")
    ma, than, _ = goi("/api/auth/me", token=token_admin)
    admin_id = than["id"]
    ma, than, _ = goi(f"/api/teachers/{admin_id}", method="PUT", token=token_admin, body={
        "hoTen": "Chủ trung tâm", "vaiTro": "giao_vien", "trangThai": "dang_lam"})
    kiem_tra(ma == 400, f"tự hạ quyền admin cuối -> HTTP {ma} (mong đợi 400): {(than.get('errors') or {})}")

    print("== 12. Đăng nhập sai và đăng xuất ==")
    ma, than, _ = dang_nhap(EMAIL_ADMIN, "sai-mat-khau-hoan-toan")
    kiem_tra(ma == 401 and than.get("title") == "Email hoặc mật khẩu không đúng",
             f"mật khẩu sai -> HTTP {ma}: {than.get('title')}")
    ma, than, _ = dang_nhap("khong.ton.tai@classmanagement.local", mat_khau_admin)
    kiem_tra(ma == 401 and than.get("title") == "Email hoặc mật khẩu không đúng",
             "email không tồn tại trả cùng một thông báo, không lộ email nào có tài khoản")

    ma, _, _ = goi("/api/auth/logout", method="POST", cookie=cookie_moi)
    kiem_tra(ma == 204, f"đăng xuất -> HTTP {ma}")
    ma, than, _ = goi("/api/auth/refresh", method="POST", cookie=cookie_moi)
    kiem_tra(ma == 401, f"dùng lại cookie đã thu hồi -> HTTP {ma} (mong đợi 401)")

    print("== 13. Kiểm tra trong database ==")
    sql = (
        "SET NOCOUNT ON; "
        "SELECT TOP 5 HanhDong, DoiTuong, ISNULL(DoiTuongId,'-') FROM NhatKy ORDER BY ThoiDiemUtc DESC;"
    )
    nhat_ky = subprocess.run(["sqlcmd", "-S", r".\SQLEXPRESS", "-d", "ClassManagement", "-E", "-W", "-Q", sql],
                             capture_output=True, text=True, encoding="utf-8", errors="replace").stdout or ""
    print("  Nhật ký thao tác:\n" + "\n".join("    " + d for d in nhat_ky.splitlines()))
    kiem_tra("doi_vai_tro" not in nhat_ky, "chưa có dòng doi_vai_tro vì lần này chỉ đổi trạng thái")

    sql = ("SET NOCOUNT ON; SELECT HoTen + '|' + cachTinhHocPhi + '|' + trangThai FROM HocSinh; "
           "SELECT HoTen + '|' + vaiTro + '|' + trangThai FROM GiaoVien;")
    du_lieu = subprocess.run(["sqlcmd", "-S", r".\SQLEXPRESS", "-d", "ClassManagement", "-E", "-W", "-Q", sql],
                             capture_output=True, text=True, encoding="utf-8", errors="replace").stdout or ""
    print("  Dữ liệu thô trong SQL:\n" + "\n".join("    " + d for d in du_lieu.splitlines()))
    kiem_tra("theo_buoi" in du_lieu and "theo_thang" in du_lieu,
             "enum trong database lưu đúng chuỗi như API trả về (theo_buoi / theo_thang)")

    print("== 14. Đổi mật khẩu của chính mình ==")
    ma, than, _ = dang_nhap(EMAIL_ADMIN, mat_khau_admin)
    token_moi = than["accessToken"]
    mat_khau_tam = "Aa1" + uuid.uuid4().hex[:12]
    ma, than, _ = goi("/api/auth/doi-mat-khau", method="POST", token=token_moi, body={
        "matKhauHienTai": mat_khau_admin, "matKhauMoi": mat_khau_tam})
    kiem_tra(ma == 204, f"đổi mật khẩu admin -> HTTP {ma}")
    ma, _, _ = dang_nhap(EMAIL_ADMIN, mat_khau_tam)
    kiem_tra(ma == 200, f"đăng nhập bằng mật khẩu mới -> HTTP {ma}")
    # đổi lại về mật khẩu cũ để lần sau chạy script vẫn dùng được user-secrets
    ma, than, _ = dang_nhap(EMAIL_ADMIN, mat_khau_tam)
    ma, _, _ = goi("/api/auth/doi-mat-khau", method="POST", token=than["accessToken"], body={
        "matKhauHienTai": mat_khau_tam, "matKhauMoi": mat_khau_admin})
    kiem_tra(ma == 204, f"đổi lại về mật khẩu trong user-secrets -> HTTP {ma}")

    print("== 15. Hai tab cùng làm mới token: không được đăng xuất oan ==")
    _, _, set_cookie_a = dang_nhap(EMAIL_ADMIN, mat_khau_admin)
    cookie_a = lay_cookie(set_cookie_a)
    ma, than, set_cookie_b = goi("/api/auth/refresh", method="POST", cookie=cookie_a)
    cookie_b = lay_cookie(set_cookie_b)
    kiem_tra(ma == 200 and cookie_b != cookie_a, f"tab A làm mới được, cookie đã xoay vòng (HTTP {ma})")
    ma, than, _ = goi("/api/auth/refresh", method="POST", cookie=cookie_a)
    kiem_tra(ma == 401 and "nơi khác" in (than.get("title") or ""),
             f"tab B dùng cookie cũ -> HTTP {ma}: {than.get('title')}")
    ma, than, _ = goi("/api/auth/refresh", method="POST", cookie=cookie_b)
    kiem_tra(ma == 200, f"cookie mới của tab A vẫn dùng được -> HTTP {ma} (không thu hồi oan cả họ phiên)")
    ma, _, _ = goi("/api/auth/logout", method="POST", cookie=cookie_b)
    kiem_tra(ma == 204, f"dọn dẹp phiên thử -> HTTP {ma}")

    print("== 16. Mỗi giáo viên tự khai tài khoản nhận tiền của mình ==")
    ma, than, _ = dang_nhap(EMAIL_GV_MAU, mat_khau_admin)
    kiem_tra(ma == 200, f"đăng nhập tài khoản giáo viên -> HTTP {ma}")
    token_gv_mau = than["accessToken"]
    kiem_tra("taiKhoanNhanTien" in than["nguoiDung"],
             "thông tin đăng nhập có kèm tài khoản nhận tiền của chính mình")

    ma, than, _ = goi("/api/teachers/me/tai-khoan-nhan-tien", method="PUT", token=token_gv_mau,
                      body={"nganHangBin": "99"})
    kiem_tra(ma == 400, f"BIN sai -> HTTP {ma}: {(than.get('errors') or {}).get('NganHangBin')}")
    ma, than, _ = goi("/api/teachers/me/tai-khoan-nhan-tien", method="PUT", token=token_gv_mau,
                      body={"soTaiKhoan": "123456789"})
    kiem_tra(ma == 400, f"có số tài khoản mà thiếu ngân hàng -> HTTP {ma}: {(than.get('errors') or {}).get('NganHangBin')}")

    ma, than, _ = goi("/api/teachers/me/tai-khoan-nhan-tien", method="PUT", token=token_gv_mau, body={
        "nganHangBin": "970436", "soTaiKhoan": "1029384756", "chuTaiKhoan": "NGUYEN VAN A"})
    kiem_tra(ma == 200 and than["daCauHinh"] is True and than["soTaiKhoan"] == "1029384756",
             f"giáo viên khai tài khoản của mình -> HTTP {ma}")
    ma, than, _ = goi("/api/auth/me", token=token_gv_mau)
    kiem_tra(than["taiKhoanNhanTien"]["soTaiKhoan"] == "1029384756",
             "phiên đăng nhập đọc lại thấy tài khoản vừa khai")

    ma, than, _ = goi("/api/teachers", token=token_admin)
    co_so_tai_khoan = any(("soTaiKhoan" in g) or ("nganHangBin" in g) for g in than["duLieu"])
    kiem_tra(not co_so_tai_khoan, "danh sách giáo viên cho admin KHÔNG chứa số tài khoản của ai")
    ma, than, _ = goi("/api/settings", token=token_admin)
    kiem_tra("1029384756" not in json.dumps(than, ensure_ascii=False),
             f"cài đặt chung không lộ số tài khoản của giáo viên; admin chỉ thấy "
             f"{than.get('soGiaoVienDaKhaiTaiKhoanNhanTien')} đã khai / {than.get('soGiaoVienChuaKhaiTaiKhoanNhanTien')} chưa khai")
    kiem_tra(than.get("tenGiaoVienChuaKhaiTaiKhoanNhanTien") is not None,
             f"còn ai chưa khai: {than.get('tenGiaoVienChuaKhaiTaiKhoanNhanTien')}")
    ma, than, _ = goi("/api/settings", token=token_gv_mau)
    kiem_tra(than.get("soGiaoVienDaKhaiTaiKhoanNhanTien") is None,
             "giáo viên không thấy số liệu tổng hợp của cả trung tâm")

    ma, than, _ = goi("/api/teachers/me/tai-khoan-nhan-tien", method="PUT", token=token_gv_mau, body={})
    kiem_tra(ma == 200 and than["daCauHinh"] is False, f"gửi rỗng để gỡ tài khoản đã khai -> HTTP {ma}")
    goi("/api/teachers/me/tai-khoan-nhan-tien", method="PUT", token=token_gv_mau, body={
        "nganHangBin": "970436", "soTaiKhoan": "1029384756", "chuTaiKhoan": "NGUYEN VAN A"})

    # Dọn luôn ở cuối: sau một lần chạy trọn vẹn thì không còn tài khoản thử nào sót lại.
    don_tai_khoan_kiem_thu()

    so_dat = sum(1 for ok, _ in ket_qua if ok)
    print(f"\n===== KẾT QUẢ: {so_dat}/{len(ket_qua)} bước đạt =====")
    for ok, mo_ta in ket_qua:
        if not ok:
            print("  CHƯA ĐẠT: " + mo_ta)
    return 0 if so_dat == len(ket_qua) else 1


if __name__ == "__main__":
    sys.exit(main())
