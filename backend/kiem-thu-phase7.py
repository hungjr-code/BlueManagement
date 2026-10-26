"""
Kiểm thử đầu-cuối Phase 7 — hai chiều Google và tài khoản học sinh.

    cd backend && python kiem-thu-phase7.py      (cần API đang chạy ở http://localhost:5080)

Bộ này kiểm ba việc mới:

 1. KÉO VỀ (Google → app): giáo viên đổi giờ hoặc huỷ buổi NGAY TRÊN Google Calendar thì app phải
    cập nhật theo — nhưng chỉ trong giới hạn an toàn: đổi giờ thì áp luôn, huỷ thì đánh dấu nghỉ
    (chỉ khi buổi chưa điểm danh), dời sang ngày khác hoặc buổi đã điểm danh thì chỉ CẢNH BÁO.
 2. TÀI LIỆU: giáo viên gửi tệp lên Drive của mình, học sinh tải qua app (tệp không công khai),
    và tên bài tập xuất hiện trong mô tả sự kiện trên Google Calendar.
 3. TÀI KHOẢN HỌC SINH: cấp mã + mật khẩu tạm, học sinh đăng nhập, xem lịch học + điểm danh +
    bài tập của CHÍNH MÌNH, đổi mật khẩu, thu hồi tài khoản.

Chạy ở CHẾ ĐỘ GIẢ (GoogleCalendar__CheDoGia=true) nên không cần tài khoản Google thật: khách Google
giả giữ một danh sách "sự kiện trên lịch Google" để script đóng vai giáo viên sửa/huỷ chúng qua
/api/google-calendar/gia-sua-tren-google, còn Drive giả giữ tệp trong bộ nhớ.

Script tự tạo tài khoản thử (tiền tố gv.p7.) và tự dọn trước lẫn sau khi chạy.
"""
from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date, datetime, timedelta, timezone

import kiem_thu_pg

API = "http://localhost:5080"
THU_MUC_API = r"c:\Joel_vh\ClassManagement\backend\ClassManagement.Api"
EMAIL_ADMIN = "admin@classmanagement.local"
COOKIE_PHIEN_HS = "cm_phien_hs"

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
    return kiem_thu_pg.chay_sql(cau)


def goi(duong_dan: str, *, method: str = "GET", body=None, token: str | None = None,
        cookie: dict[str, str] | None = None):
    du_lieu = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    yeu_cau = urllib.request.Request(API + duong_dan, data=du_lieu, method=method)
    yeu_cau.add_header("Content-Type", "application/json; charset=utf-8")
    if token:
        yeu_cau.add_header("Authorization", "Bearer " + token)
    if cookie:
        yeu_cau.add_header("Cookie", "; ".join(f"{k}={v}" for k, v in cookie.items()))

    try:
        with urllib.request.urlopen(yeu_cau, timeout=90) as phan_hoi:
            chuoi = phan_hoi.read().decode("utf-8")
            return phan_hoi.status, (json.loads(chuoi) if chuoi.strip().startswith(("{", "[")) else chuoi)
    except urllib.error.HTTPError as loi:
        chuoi = loi.read().decode("utf-8", "replace")
        return loi.code, (json.loads(chuoi) if chuoi.strip().startswith(("{", "[")) else chuoi)


class ChanRedirect(urllib.request.HTTPRedirectHandler):
    """Không đi theo chuyển hướng, để đọc được chính header Location và Set-Cookie."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        return None


def goi_chuyen_huong(duong_dan: str) -> tuple[int, str, dict[str, str]]:
    opener = urllib.request.build_opener(ChanRedirect)
    try:
        with opener.open(API + duong_dan, timeout=60) as phan_hoi:
            return phan_hoi.status, phan_hoi.headers.get("Location", ""), doc_cookie(phan_hoi.headers)
    except urllib.error.HTTPError as loi:
        return loi.code, loi.headers.get("Location", ""), doc_cookie(loi.headers)


def doc_cookie(headers) -> dict[str, str]:
    ket_qua_cookie: dict[str, str] = {}
    for gia_tri in headers.get_all("Set-Cookie") or []:
        cap = gia_tri.split(";")[0]
        if "=" in cap:
            ten, gia_tri_cookie = cap.split("=", 1)
            ket_qua_cookie[ten.strip()] = gia_tri_cookie.strip()
    return ket_qua_cookie


def doc_tieu_de_cookie(headers, ten: str) -> str:
    for gia_tri in headers.get_all("Set-Cookie") or []:
        if gia_tri.startswith(ten + "="):
            return gia_tri
    return ""


def dang_nhap(email: str, mat_khau: str, *, cookie: bool = False):
    """Đăng nhập giáo viên. cookie=True thì trả về cả cookie phiên (để thử luồng có cookie)."""
    if not cookie:
        return goi("/api/auth/login", method="POST", body={"email": email, "matKhau": mat_khau})

    yeu_cau = urllib.request.Request(
        API + "/api/auth/login",
        data=json.dumps({"email": email, "matKhau": mat_khau}).encode("utf-8"),
        method="POST")
    yeu_cau.add_header("Content-Type", "application/json; charset=utf-8")
    with urllib.request.urlopen(yeu_cau, timeout=60) as phan_hoi:
        return phan_hoi.status, json.loads(phan_hoi.read().decode("utf-8")), doc_cookie(phan_hoi.headers)


def bam_tiep_tuc(trang_html: str) -> str:
    """Lấy đường dẫn của nút "Vẫn tiếp tục" trong trang màn hình đồng ý giả."""
    vi_tri = trang_html.find("/api/google-calendar/callback?")
    if vi_tri < 0:
        raise SystemExit("Không tìm thấy đường dẫn callback trong trang đồng ý giả.")
    ket_thuc = trang_html.find('"', vi_tri)
    return trang_html[vi_tri:ket_thuc].replace("&amp;", "&")


def ket_noi_google(token: str) -> tuple[int, str]:
    """Chạy trọn luồng cấp quyền ở chế độ giả và trả về (mã callback, vị trí chuyển hướng)."""
    ma, than = goi("/api/google-calendar/duong-dan-uy-quyen", token=token)
    if ma != 200:
        return ma, ""

    _, trang_dong_y = goi(than["url"])
    ma_callback, vi_tri, _ = goi_chuyen_huong(bam_tiep_tuc(trang_dong_y))
    return ma_callback, vi_tri


def gui_tep(duong_dan: str, token: str, tep_ten: str, noi_dung: bytes, *, mime: str = "application/pdf",
            truong: dict[str, str] | None = None):
    """Gửi multipart/form-data giống trình duyệt — thư viện chuẩn không có sẵn nên tự dựng thân request."""
    boundary = "----cm" + uuid.uuid4().hex
    phan: list[bytes] = []

    for ten, gia_tri in (truong or {}).items():
        if gia_tri is None:
            continue
        phan.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{ten}\"\r\n\r\n{gia_tri}\r\n"
            .encode("utf-8"))

    phan.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"tep\"; filename=\"{tep_ten}\"\r\n"
        f"Content-Type: {mime}\r\n\r\n".encode("utf-8") + noi_dung + b"\r\n")
    phan.append(f"--{boundary}--\r\n".encode("utf-8"))

    yeu_cau = urllib.request.Request(API + duong_dan, data=b"".join(phan), method="POST")
    yeu_cau.add_header("Content-Type", "multipart/form-data; boundary=" + boundary)
    yeu_cau.add_header("Authorization", "Bearer " + token)

    try:
        with urllib.request.urlopen(yeu_cau, timeout=90) as phan_hoi:
            chuoi = phan_hoi.read().decode("utf-8")
            return phan_hoi.status, (json.loads(chuoi) if chuoi.strip().startswith(("{", "[")) else chuoi)
    except urllib.error.HTTPError as loi:
        chuoi = loi.read().decode("utf-8", "replace")
        return loi.code, (json.loads(chuoi) if chuoi.strip().startswith(("{", "[")) else chuoi)


def tai_teps(duong_dan: str, *, token: str | None = None, cookie: dict[str, str] | None = None):
    """Tải tệp nhị phân: trả về (mã, nội dung byte, tiêu đề Content-Disposition)."""
    yeu_cau = urllib.request.Request(API + duong_dan, method="GET")
    if token:
        yeu_cau.add_header("Authorization", "Bearer " + token)
    if cookie:
        yeu_cau.add_header("Cookie", "; ".join(f"{k}={v}" for k, v in cookie.items()))

    try:
        with urllib.request.urlopen(yeu_cau, timeout=90) as phan_hoi:
            return phan_hoi.status, phan_hoi.read(), phan_hoi.headers.get("Content-Disposition", "")
    except urllib.error.HTTPError as loi:
        return loi.code, loi.read(), loi.headers.get("Content-Disposition", "")


def dang_nhap_hoc_sinh(ma_hoc_sinh: str, mat_khau: str):
    yeu_cau = urllib.request.Request(
        API + "/api/hoc-sinh/auth/login",
        data=json.dumps({"maHocSinh": ma_hoc_sinh, "matKhau": mat_khau}).encode("utf-8"),
        method="POST")
    yeu_cau.add_header("Content-Type", "application/json; charset=utf-8")

    try:
        with urllib.request.urlopen(yeu_cau, timeout=60) as phan_hoi:
            than = json.loads(phan_hoi.read().decode("utf-8"))
            return phan_hoi.status, than, doc_cookie(phan_hoi.headers), doc_tieu_de_cookie(phan_hoi.headers, COOKIE_PHIEN_HS)
    except urllib.error.HTTPError as loi:
        chuoi = loi.read().decode("utf-8", "replace")
        than = json.loads(chuoi) if chuoi.strip().startswith(("{", "[")) else chuoi
        return loi.code, than, doc_cookie(loi.headers), ""


def don_tai_khoan_kiem_thu() -> None:
    """Xoá tài khoản thử (gv.p7.%) và mọi dữ liệu đi kèm, đúng thứ tự khoá ngoại."""
    chay_sql(
        "DELETE FROM \"TaiLieu\" WHERE \"GiaoVienId\" IN (SELECT \"Id\" FROM \"GiaoVien\" "
        "WHERE \"Email\" LIKE 'gv.p7.%'); "
        "DELETE FROM \"DiemDanh\" WHERE \"BuoiHocId\" IN (SELECT b.\"Id\" FROM \"BuoiHoc\" b "
        "JOIN \"HocSinh\" hs ON hs.\"Id\" = b.\"HocSinhId\" JOIN \"GiaoVien\" g ON g.\"Id\" = hs.\"GiaoVienId\" "
        "WHERE g.\"Email\" LIKE 'gv.p7.%'); "
        "DELETE FROM \"BuoiHoc\" WHERE \"HocSinhId\" IN (SELECT hs.\"Id\" FROM \"HocSinh\" hs "
        "JOIN \"GiaoVien\" g ON g.\"Id\" = hs.\"GiaoVienId\" WHERE g.\"Email\" LIKE 'gv.p7.%'); "
        "DELETE FROM \"PhienHocSinh\" WHERE \"HocSinhId\" IN (SELECT hs.\"Id\" FROM \"HocSinh\" hs "
        "JOIN \"GiaoVien\" g ON g.\"Id\" = hs.\"GiaoVienId\" WHERE g.\"Email\" LIKE 'gv.p7.%'); "
        "DELETE FROM \"KhungGioHoc\" WHERE \"HocSinhId\" IN (SELECT hs.\"Id\" FROM \"HocSinh\" hs "
        "JOIN \"GiaoVien\" g ON g.\"Id\" = hs.\"GiaoVienId\" WHERE g.\"Email\" LIKE 'gv.p7.%'); "
        "DELETE FROM \"HocPhi\" WHERE \"HocSinhId\" IN (SELECT hs.\"Id\" FROM \"HocSinh\" hs "
        "JOIN \"GiaoVien\" g ON g.\"Id\" = hs.\"GiaoVienId\" WHERE g.\"Email\" LIKE 'gv.p7.%'); "
        "DELETE FROM \"HocSinh\" WHERE \"GiaoVienId\" IN (SELECT \"Id\" FROM \"GiaoVien\" "
        "WHERE \"Email\" LIKE 'gv.p7.%'); "
        "DELETE FROM \"PhienDangNhap\" WHERE \"GiaoVienId\" IN (SELECT \"Id\" FROM \"GiaoVien\" "
        "WHERE \"Email\" LIKE 'gv.p7.%'); "
        "UPDATE \"NhatKy\" SET \"NguoiThucHienId\" = NULL WHERE \"NguoiThucHienId\" IN (SELECT \"Id\" FROM \"GiaoVien\" "
        "WHERE \"Email\" LIKE 'gv.p7.%'); "
        "DELETE FROM \"GiaoVien\" WHERE \"Email\" LIKE 'gv.p7.%';")


def tao_giao_vien(token_admin: str, ten: str, tien_to: str = "gv.p7.") -> tuple[str, str, str]:
    email = f"{tien_to}{uuid.uuid4().hex[:6]}@classmanagement.local"
    mat_khau = "Aa1" + uuid.uuid4().hex[:12]
    ma, _ = goi("/api/teachers", method="POST", token=token_admin,
                body={"hoTen": ten, "email": email, "matKhauTamThoi": mat_khau})
    if ma != 201:
        raise SystemExit(f"Không tạo được giáo viên thử (HTTP {ma}).")
    ma, than = dang_nhap(email, mat_khau)
    if ma != 200:
        raise SystemExit(f"Giáo viên thử không đăng nhập được (HTTP {ma}).")
    return email, than["accessToken"], than["nguoiDung"]["id"]


def tao_hoc_sinh(token: str, ten: str, gio_bat_dau: str = "18:00:00", gio_ket_thuc: str = "19:30:00") -> dict:
    ma, than = goi("/api/students", method="POST", token=token, body={
        "hoTen": ten, "cachTinhHocPhi": "theo_buoi", "donGiaTheoBuoi": 200000,
        "soBuoiMoiTuan": 2, "ngayDenHanDongTien": 5, "ngayBatDau": hom_nay.isoformat(),
        "lichHoc": [
            {"thu": "thu_3", "gioBatDau": gio_bat_dau, "gioKetThuc": gio_ket_thuc},
            {"thu": "thu_5", "gioBatDau": gio_bat_dau, "gioKetThuc": gio_ket_thuc},
        ]})
    if ma != 201:
        raise SystemExit(f"Không tạo được học sinh thử (HTTP {ma}): {than}")
    return than


def lay_buoi(token: str, hoc_sinh_id: str, tu_ngay: date, den_ngay: date) -> list[dict]:
    ma, than = goi(f"/api/attendance?hocSinhId={hoc_sinh_id}&tuNgay={tu_ngay.isoformat()}"
                   f"&denNgay={den_ngay.isoformat()}", token=token)
    if ma != 200:
        raise SystemExit(f"Không đọc được buổi học (HTTP {ma}).")
    return than["duLieu"]


def buoi_theo_id(danh_sach: list[dict], buoi_id: str) -> dict | None:
    return next((x for x in danh_sach if x["id"] == buoi_id), None)


def su_kien_tren_google() -> list[dict]:
    ma, than = goi("/api/google-calendar/gia-su-kien-tren-google")
    return than if ma == 200 else []


def sua_tren_google(event_id: str, bat_dau: str, ket_thuc: str):
    return goi("/api/google-calendar/gia-sua-tren-google", method="POST",
               body={"eventId": event_id, "batDau": bat_dau, "ketThuc": ket_thuc})


def moc_gio(ngay: date, gio: str) -> str:
    return f"{ngay.isoformat()}T{gio}+07:00"


def main() -> int:
    print("== 0. Dọn dữ liệu thử cũ và tạo tài khoản thử ==")
    don_tai_khoan_kiem_thu()
    goi("/api/google-calendar/gia-xoa-dau-vet", method="POST")

    mat_khau_admin = doc_mat_khau()
    ma, than = dang_nhap(EMAIL_ADMIN, mat_khau_admin)
    if ma != 200:
        raise SystemExit(f"Không đăng nhập được admin (HTTP {ma}).")
    token_admin = than["accessToken"]

    email_gv, token_gv, giao_vien_id = tao_giao_vien(token_admin, "Giáo viên Google hai chiều")
    print(f"  giáo viên thử: {email_gv}")

    hs_a = tao_hoc_sinh(token_gv, "Học sinh Kéo Về")
    # Giờ của B phải KHÁC giờ của A: một giáo viên không dạy hai học sinh trùng giờ.
    hs_b = tao_hoc_sinh(token_gv, "Học sinh Không Liên Quan", "20:00:00", "21:00:00")
    kiem_tra(bool(hs_a.get("maHocSinh", "").startswith("HS-")),
             f"học sinh mới được cấp mã đăng nhập: {hs_a.get('maHocSinh')}")
    kiem_tra(hs_a["maHocSinh"] != hs_b["maHocSinh"], "hai học sinh nhận hai mã khác nhau")

    # API điểm danh giới hạn 62 ngày một lần, nên lấy 60 ngày cho chắc.
    den_ngay = hom_nay + timedelta(days=60)
    buoi_a = lay_buoi(token_gv, hs_a["id"], hom_nay, den_ngay)
    kiem_tra(len(buoi_a) >= 4, f"lịch của học sinh A có {len(buoi_a)} buổi để thử")

    print("== 1. Kết nối Google (chế độ giả) và đẩy lịch lên ==")
    ma_callback, vi_tri = ket_noi_google(token_gv)
    kiem_tra(ma_callback == 302 and "ket-noi-thanh-cong" in vi_tri,
             f"kết nối Google xong quay về Cài đặt: HTTP {ma_callback}")

    ma, trang_thai = goi("/api/google-calendar/trang-thai", token=token_gv)
    kiem_tra(trang_thai["daKetNoi"] is True, "trạng thái: đã kết nối")
    kiem_tra(trang_thai["coQuyenDrive"] is True, "token mới có đủ quyền ghi tài liệu lên Drive")
    kiem_tra(trang_thai["tuDongDongBo"] is True, "mặc định BẬT tự đồng bộ khi mở Lịch dạy")
    kiem_tra(trang_thai["lanDongBoVeCuoi"] is None, "chưa từng kéo về nên chưa có mốc đồng bộ về")

    ma, kq_day = goi("/api/google-calendar/dong-bo", method="POST", token=token_gv, body={})
    kiem_tra(ma == 200 and kq_day["soTao"] >= 4, f"đẩy lên Google: tạo {kq_day['soTao']} sự kiện")

    su_kien = [x for x in su_kien_tren_google() if "Học sinh Kéo Về" in x["tieuDe"]]
    kiem_tra(len(su_kien) >= 4, f"Google (giả) đang giữ {len(su_kien)} sự kiện của học sinh A")
    su_kien.sort(key=lambda x: x["batDau"])
    giua = su_kien[0]

    print("== 2. Kéo về khi không có gì đổi ==")
    ma, kq = goi("/api/google-calendar/dong-bo-ve", method="POST", token=token_gv, body={"chiKhiQuaHan": False})
    kiem_tra(ma == 200 and kq["boQua"] is False, "kéo về chạy thật (không bị bỏ qua)")
    kiem_tra(kq["soDoiGio"] == 0 and kq["soDanhDauNghi"] == 0 and kq["soCanhBao"] == 0,
             f"không có gì đổi: xét {kq['soDaXet']} buổi, không sửa gì")
    kiem_tra(kq["soDaXet"] >= 1, f"đã đối chiếu {kq['soDaXet']} buổi với Google")

    ma, kq_lai = goi("/api/google-calendar/dong-bo-ve", method="POST", token=token_gv, body={"chiKhiQuaHan": True})
    kiem_tra(kq_lai["boQua"] is True, "gọi lại ngay sau đó (chiKhiQuaHan) -> máy chủ bỏ qua, không gọi Google")

    ma, trang_thai = goi("/api/google-calendar/trang-thai", token=token_gv)
    kiem_tra(bool(trang_thai["lanDongBoVeCuoi"]), "trạng thái đã có mốc kéo về gần nhất")
    kiem_tra(trang_thai["lanDongBoVeCuoi"]["soDaXet"] >= 1, "mốc đó kèm số buổi đã đối chiếu")

    print("== 3. Giáo viên đổi GIỜ trên Google -> app cập nhật giờ ==")
    ngay_doi = date.fromisoformat(giua["batDau"][:10])
    buoi_doi_gio_id = next(x["id"] for x in buoi_a
                           if x["ngay"] == ngay_doi.isoformat() and x["gioBatDau"] == "18:00:00")
    kiem_tra(giua["batDau"][11:16] == "18:00",
             f"sự kiện trên Google đang là 18:00 đúng như buổi trong app ({giua['batDau']})")

    ma, _ = sua_tren_google(giua["id"], moc_gio(ngay_doi, "20:15:00"), moc_gio(ngay_doi, "21:45:00"))
    kiem_tra(ma == 200, "đã đổi giờ sự kiện NGAY TRÊN Google (không qua app)")

    ma, kq = goi("/api/google-calendar/dong-bo-ve", method="POST", token=token_gv, body={"chiKhiQuaHan": False})
    kiem_tra(kq["soDoiGio"] == 1, f"kéo về: cập nhật giờ cho {kq['soDoiGio']} buổi")

    sau = buoi_theo_id(lay_buoi(token_gv, hs_a["id"], hom_nay, den_ngay), buoi_doi_gio_id)
    kiem_tra(sau["gioBatDau"] == "20:15:00" and sau["gioKetThuc"] == "21:45:00",
             f"buổi trong app đã theo Google: {sau['gioBatDau']}–{sau['gioKetThuc']}")
    kiem_tra(sau["trangThai"] == "chua_diem_danh", "đổi giờ KHÔNG đụng tới điểm danh")

    ma, nhat_ky = goi(f"/api/nhat-ky?hanhDong=sua_buoi_theo_google&kichThuoc=5", token=token_admin)
    kiem_tra(ma == 200 and nhat_ky["tongSo"] >= 1, "có dòng nhật ký ghi việc sửa buổi theo Google")

    print("== 4. Google dời sang NGÀY khác -> chỉ cảnh báo, không tự sửa ==")
    ngay_khac = ngay_doi + timedelta(days=1)
    sua_tren_google(giua["id"], moc_gio(ngay_khac, "20:15:00"), moc_gio(ngay_khac, "21:45:00"))
    ma, kq = goi("/api/google-calendar/dong-bo-ve", method="POST", token=token_gv, body={"chiKhiQuaHan": False})
    kiem_tra(kq["soDoiGio"] == 0 and kq["soCanhBao"] == 1,
             f"dời sang ngày khác: không tự sửa, có {kq['soCanhBao']} cảnh báo")

    sau = buoi_theo_id(lay_buoi(token_gv, hs_a["id"], hom_nay, den_ngay), buoi_doi_gio_id)
    kiem_tra(sau["ngay"] == ngay_doi.isoformat() and sau["gioBatDau"] == "20:15:00",
             "buổi trong app vẫn ở ngày cũ, giờ cũ")
    kiem_tra(bool(sau["googleLechGanNhat"]) and "ngày" in sau["googleLechGanNhat"],
             f"giao diện có cảnh báo lệch: {sau['googleLechGanNhat']}")

    sua_tren_google(giua["id"], moc_gio(ngay_doi, "20:15:00"), moc_gio(ngay_doi, "21:45:00"))
    ma, kq = goi("/api/google-calendar/dong-bo-ve", method="POST", token=token_gv, body={"chiKhiQuaHan": False})
    sau = buoi_theo_id(lay_buoi(token_gv, hs_a["id"], hom_nay, den_ngay), buoi_doi_gio_id)
    kiem_tra(sau["googleLechGanNhat"] is None, "đưa Google về đúng thì cảnh báo lệch được xoá")

    print("== 5. Google huỷ sự kiện -> app đánh dấu nghỉ (buổi chưa điểm danh) ==")
    buoi_huy = su_kien[1]
    ngay_huy = date.fromisoformat(buoi_huy["batDau"][:10])
    buoi_huy_id = next(x["id"] for x in buoi_a if x["ngay"] == ngay_huy.isoformat() and x["gioBatDau"] == "18:00:00")

    ma, _ = goi("/api/google-calendar/gia-sua-tren-google", method="POST",
                body={"eventId": buoi_huy["id"], "huy": True})
    kiem_tra(ma == 200, "đã huỷ sự kiện NGAY TRÊN Google")

    ma, kq = goi("/api/google-calendar/dong-bo-ve", method="POST", token=token_gv, body={"chiKhiQuaHan": False})
    kiem_tra(kq["soDanhDauNghi"] == 1, f"kéo về: đánh dấu nghỉ {kq['soDanhDauNghi']} buổi")

    sau = buoi_theo_id(lay_buoi(token_gv, hs_a["id"], hom_nay, den_ngay), buoi_huy_id)
    kiem_tra(sau["trangThai"] == "nghi", f"buổi đó thành nghỉ: {sau['trangThai']}")
    kiem_tra(sau["coTinhTien"] is False, "buổi nghỉ do Google huỷ KHÔNG tính tiền")
    kiem_tra(sau["googleDaHuy"] is True, "buổi được đánh dấu là đã huỷ trên Google")

    ma, kq = goi("/api/google-calendar/dong-bo-ve", method="POST", token=token_gv, body={"chiKhiQuaHan": False})
    kiem_tra(kq["soDanhDauNghi"] == 0 and kq["soCanhBao"] == 0,
             "kéo về lần nữa KHÔNG đánh dấu lại và không sinh cảnh báo sai")

    print("== 6. Buổi ĐÃ điểm danh rồi mới bị huỷ -> không tự sửa, chỉ cảnh báo ==")
    buoi_dd_id = next(x["id"] for x in buoi_a
                      if x["ngay"] not in (ngay_doi.isoformat(), ngay_huy.isoformat()))
    ma, _ = goi("/api/attendance/luu-hang-loat", method="POST", token=token_gv, body={
        "duLieu": [{"buoiHocId": buoi_dd_id, "trangThai": "di_hoc", "ghiChu": "Đã dạy"}]})
    kiem_tra(ma == 200, "điểm danh buổi đó là đi học")

    ngay_dd = next(y["ngay"] for y in buoi_a if y["id"] == buoi_dd_id)
    su_kien_dd = next(x for x in su_kien_tren_google()
                      if "Học sinh Kéo Về" in x["tieuDe"] and x["batDau"][:10] == ngay_dd)
    goi("/api/google-calendar/gia-sua-tren-google", method="POST",
        body={"eventId": su_kien_dd["id"], "huy": True})

    ma, kq = goi("/api/google-calendar/dong-bo-ve", method="POST", token=token_gv, body={"chiKhiQuaHan": False})
    kiem_tra(kq["soCanhBao"] >= 1 and kq["soDanhDauNghi"] == 0,
             f"buổi đã điểm danh: chỉ cảnh báo ({kq['soCanhBao']}), không tự đánh dấu nghỉ")

    sau = buoi_theo_id(lay_buoi(token_gv, hs_a["id"], hom_nay, den_ngay), buoi_dd_id)
    kiem_tra(sau["trangThai"] == "di_hoc", "điểm danh đã lưu vẫn nguyên vẹn")
    kiem_tra(bool(sau["googleLechGanNhat"]) and "đã điểm danh" in sau["googleLechGanNhat"],
             f"cảnh báo nói rõ vì sao: {sau['googleLechGanNhat']}")

    print("== 7. Công tắc tự đồng bộ ==")
    ma, _ = goi("/api/google-calendar/tu-dong-dong-bo", method="PUT", token=token_gv, body={"bat": False})
    ma, trang_thai = goi("/api/google-calendar/trang-thai", token=token_gv)
    kiem_tra(trang_thai["tuDongDongBo"] is False, "tắt tự đồng bộ -> trạng thái trả về false")
    goi("/api/google-calendar/tu-dong-dong-bo", method="PUT", token=token_gv, body={"bat": True})
    ma, trang_thai = goi("/api/google-calendar/trang-thai", token=token_gv)
    kiem_tra(trang_thai["tuDongDongBo"] is True, "bật lại -> trạng thái trả về true")
    # Công tắc là của CHÍNH người đang đăng nhập: admin bật/tắt cũng chỉ đổi của admin, không đụng
    # tới giáo viên khác — nên không có tham số nào để đổi hộ.
    goi("/api/google-calendar/tu-dong-dong-bo", method="PUT", token=token_gv, body={"bat": False})
    goi("/api/google-calendar/tu-dong-dong-bo", method="PUT", token=token_admin, body={"bat": True})
    ma, trang_thai = goi("/api/google-calendar/trang-thai", token=token_gv)
    kiem_tra(trang_thai["tuDongDongBo"] is False,
             "admin đổi công tắc của mình KHÔNG làm đổi công tắc của giáo viên")
    goi("/api/google-calendar/tu-dong-dong-bo", method="PUT", token=token_gv, body={"bat": True})

    print("== 8. Gửi tài liệu cho học sinh ==")
    noi_dung = ("Đề bài kiểm thử " + uuid.uuid4().hex).encode("utf-8") * 50
    buoi_gan = next(x for x in buoi_a if x["id"] == buoi_doi_gio_id)

    ma, tai_lieu = goi("/api/tai-lieu/danh-sach", token=token_gv)
    kiem_tra(ma == 200 and tai_lieu == [], "ban đầu chưa có tài liệu nào")

    ma, tl = gui_tep("/api/tai-lieu", token_gv, "de-bai.pdf", noi_dung, truong={
        "hocSinhId": hs_a["id"],
        "buoiHocId": buoi_doi_gio_id,
        "tieuDe": "Đề ôn tập tuần này",
        "hanNop": (hom_nay + timedelta(days=7)).isoformat(),
        "ghiChu": "Làm trước buổi sau",
    })
    kiem_tra(ma == 200 and tl["tenTep"] == "de-bai.pdf" and tl["tieuDe"] == "Đề ôn tập tuần này",
             f"gửi tài liệu gắn buổi học -> HTTP {ma}")
    kiem_tra(tl["kichThuocByte"] == len(noi_dung), f"kích thước ghi lại đúng: {tl.get('kichThuocByte')}")
    kiem_tra(tl["ngayBuoi"] == buoi_gan["ngay"], "tài liệu gắn đúng ngày của buổi học")
    kiem_tra("googleDriveFileId" not in json.dumps(tl), "không lộ id tệp trên Drive ra giao diện")

    ma, than = gui_tep("/api/tai-lieu", token_gv, "virus.exe", noi_dung, truong={"hocSinhId": hs_a["id"]})
    kiem_tra(ma == 400, f"định dạng không cho phép bị chặn: HTTP {ma}")

    ma, than = gui_tep("/api/tai-lieu", token_gv, "rong.pdf", b"", truong={"hocSinhId": hs_a["id"]})
    kiem_tra(ma == 400, f"tệp rỗng bị chặn: HTTP {ma}")

    ma, than = gui_tep("/api/tai-lieu", token_gv, "de-bai.pdf", noi_dung,
                       truong={"hocSinhId": hs_b["id"], "buoiHocId": buoi_doi_gio_id})
    kiem_tra(ma == 400, f"gắn tài liệu vào buổi của học sinh khác bị chặn: HTTP {ma}")

    ma, tai_lieu = goi(f"/api/tai-lieu/danh-sach?hocSinhId={hs_a['id']}", token=token_gv)
    kiem_tra(ma == 200 and len(tai_lieu) == 1, f"danh sách tài liệu của A có {len(tai_lieu)} mục")

    ma, byte_ve, _ = tai_teps(f"/api/tai-lieu/{tl['id']}/tai-ve", token=token_gv)
    kiem_tra(ma == 200 and byte_ve == noi_dung, f"giáo viên tải lại tài liệu: HTTP {ma}, {len(byte_ve)} byte")

    email_gv2, token_gv2, _ = tao_giao_vien(token_admin, "Giáo viên không liên quan", tien_to="gv.p7b.")
    ma, ds_khac = goi("/api/tai-lieu/danh-sach", token=token_gv2)
    kiem_tra(ma == 200 and ds_khac == [], "giáo viên khác không thấy tài liệu của người khác")
    ma, _, _ = tai_teps(f"/api/tai-lieu/{tl['id']}/tai-ve", token=token_gv2)
    kiem_tra(ma == 404, f"giáo viên khác tải tài liệu -> HTTP {ma} (mong đợi 404)")

    chay_sql(f"UPDATE \"GiaoVien\" SET \"GoogleQuyenDaCap\" = 'openid email' WHERE \"Email\" = '{email_gv}';")
    ma, than = gui_tep("/api/tai-lieu", token_gv, "de-bai.pdf", noi_dung, truong={"hocSinhId": hs_a["id"]})
    kiem_tra(ma == 409 and "Drive" in json.dumps(than, ensure_ascii=False),
             f"token thiếu quyền Drive -> HTTP {ma} kèm lời nhắc kết nối lại")
    chay_sql(f"UPDATE \"GiaoVien\" SET \"GoogleQuyenDaCap\" = "
             f"'openid email https://www.googleapis.com/auth/calendar.events "
             f"https://www.googleapis.com/auth/calendar.calendarlist.readonly "
             f"https://www.googleapis.com/auth/drive.file' WHERE \"Email\" = '{email_gv}';")

    ma, kq_day = goi("/api/google-calendar/dong-bo", method="POST", token=token_gv, body={})
    ma, da_gui = goi("/api/google-calendar/gia-su-kien-da-gui")
    gui_lai = [x for x in da_gui if x["suKien"]["tieuDe"].find("Học sinh Kéo Về") >= 0
               and "Đề ôn tập tuần này" in (x["suKien"]["moTa"] or "")]
    kiem_tra(len(gui_lai) >= 1,
             "sự kiện đẩy lên Google có kèm tên bài tập trong mô tả (học sinh thấy ngay trên lịch)")

    print("== 9. Tài khoản học sinh: cấp, đăng nhập, xem bài của mình ==")
    ma, tk = goi(f"/api/students/{hs_a['id']}/tai-khoan", method="POST", token=token_gv, body={})
    kiem_tra(ma == 200 and tk["maHocSinh"] == hs_a["maHocSinh"], f"cấp tài khoản -> mã {tk.get('maHocSinh')}")
    kiem_tra(len(tk["matKhauTam"]) == 8 and any(c.isdigit() for c in tk["matKhauTam"])
             and any(c.isalpha() for c in tk["matKhauTam"]),
             f"mật khẩu tạm 8 ký tự có chữ và số: {tk['matKhauTam']}")
    mat_khau_a = tk["matKhauTam"]

    ma, trang_thai_tk = goi(f"/api/students/{hs_a['id']}/tai-khoan", token=token_gv)
    kiem_tra(trang_thai_tk["coMatKhau"] is True and "matKhauTam" not in json.dumps(trang_thai_tk),
             "trạng thái tài khoản nói đã có mật khẩu, KHÔNG trả lại mật khẩu")

    ma, chi_tiet = goi(f"/api/students/{hs_a['id']}", token=token_gv)
    kiem_tra(chi_tiet["coTaiKhoan"] is True and "matKhauBam" not in json.dumps(chi_tiet),
             "hồ sơ học sinh nói đã có tài khoản, không lộ bản băm mật khẩu")

    ma, _, _, _ = dang_nhap_hoc_sinh("HS-9999", mat_khau_a)
    kiem_tra(ma == 401, f"mã học sinh không tồn tại -> HTTP {ma}")
    ma, _, _, _ = dang_nhap_hoc_sinh(hs_a["maHocSinh"], "saibet123")
    kiem_tra(ma == 401, f"mật khẩu sai -> HTTP {ma}")

    ma, than_hs, cookie_hs, tieu_de_cookie = dang_nhap_hoc_sinh(hs_a["maHocSinh"], mat_khau_a)
    kiem_tra(ma == 200 and than_hs["hocSinh"]["hoTen"] == "Học sinh Kéo Về",
             f"học sinh đăng nhập được: {than_hs.get('hocSinh', {}).get('hoTen')}")
    kiem_tra("refreshToken" not in json.dumps(than_hs), "phản hồi đăng nhập KHÔNG chứa refresh token")
    kiem_tra(COOKIE_PHIEN_HS in cookie_hs and "path=/api/hoc-sinh/auth" in tieu_de_cookie.lower()
             and "httponly" in tieu_de_cookie.lower(),
             "cookie phiên học sinh đặt đúng tên, path và HttpOnly")
    token_hs = than_hs["accessToken"]

    ma, _ = goi("/api/attendance", token=token_hs)
    kiem_tra(ma == 401, f"token học sinh KHÔNG dùng được cho API giáo viên: HTTP {ma}")
    ma, _ = goi("/api/tai-lieu/danh-sach", token=token_hs)
    kiem_tra(ma == 401, f"token học sinh không xem được tài liệu qua API giáo viên: HTTP {ma}")

    ma, toi_hs = goi("/api/hoc-sinh/toi", token=token_hs)
    kiem_tra(ma == 200 and toi_hs["maHocSinh"] == hs_a["maHocSinh"], "học sinh đọc được hồ sơ của mình")

    ma, bai_tap = goi("/api/hoc-sinh/bai-tap", token=token_hs)
    kiem_tra(ma == 200 and len(bai_tap) == 1 and bai_tap[0]["tieuDe"] == "Đề ôn tập tuần này",
             f"học sinh thấy {len(bai_tap)} bài tập của mình")
    kiem_tra(bai_tap[0]["tenGiaoVien"] == "Giáo viên Google hai chiều", "bài tập nói rõ giáo viên giao")

    # Đọc lại danh sách của GIÁO VIÊN ngay tại đây: bản đọc ở đầu bài là ảnh chụp trước khi giáo viên
    # sửa giờ (trên Google) và điểm danh, nên so với nó là so sai.
    buoi_a_moi = lay_buoi(token_gv, hs_a["id"], hom_nay, den_ngay)
    ma, lich = goi(f"/api/hoc-sinh/lich-hoc?tuNgay={hom_nay.isoformat()}&denNgay={den_ngay.isoformat()}",
                   token=token_hs)
    kiem_tra(ma == 200 and len(lich) == len(buoi_a_moi),
             f"học sinh thấy {len(lich)} buổi, giáo viên thấy {len(buoi_a_moi)} buổi của cùng em")
    kiem_tra({x["id"] for x in lich} == {x["id"] for x in buoi_a_moi},
             "đúng cùng một danh sách buổi học, không thừa không thiếu")
    kiem_tra(all("gioBatDau" in x for x in lich), "mỗi buổi học sinh thấy đều có giờ bắt đầu")
    buoi_nghi = buoi_theo_id(lich, buoi_huy_id)
    kiem_tra(buoi_nghi["trangThai"] == "nghi", "học sinh thấy buổi đã nghỉ")
    buoi_bai = buoi_theo_id(lich, buoi_doi_gio_id)
    kiem_tra(buoi_bai["soTaiLieu"] == 1, "buổi có bài tập hiện số tài liệu")
    kiem_tra(buoi_bai["tenGiaoVien"] == "Giáo viên Google hai chiều", "lịch học có tên giáo viên")

    ma, byte_hs, ten_tep = tai_teps(f"/api/hoc-sinh/bai-tap/{tl['id']}/tai-ve", token=token_hs)
    kiem_tra(ma == 200 and byte_hs == noi_dung, f"học sinh tải bài tập: HTTP {ma}, {len(byte_hs)} byte")
    kiem_tra("de-bai.pdf" in ten_tep, f"tên tệp khi tải giữ nguyên: {ten_tep}")

    ma, _, _, _ = dang_nhap_hoc_sinh(hs_b["maHocSinh"], "chua123co")
    kiem_tra(ma == 409 or ma == 401, f"học sinh B chưa được cấp tài khoản -> HTTP {ma}")

    tk_b = goi(f"/api/students/{hs_b['id']}/tai-khoan", method="POST", token=token_gv, body={})[1]
    ma, than_hs_b, _, _ = dang_nhap_hoc_sinh(hs_b["maHocSinh"], tk_b["matKhauTam"])
    token_hs_b = than_hs_b["accessToken"]
    ma, bai_tap_b = goi("/api/hoc-sinh/bai-tap", token=token_hs_b)
    kiem_tra(bai_tap_b == [], "học sinh B không thấy bài tập của học sinh A")
    ma, _, _ = tai_teps(f"/api/hoc-sinh/bai-tap/{tl['id']}/tai-ve", token=token_hs_b)
    kiem_tra(ma == 404, f"học sinh B tải bài của A -> HTTP {ma} (mong đợi 404)")

    print("== 10. Làm mới phiên, đổi mật khẩu, thu hồi ==")
    ma, than_moi = goi("/api/hoc-sinh/auth/refresh", method="POST", cookie=cookie_hs)
    kiem_tra(ma == 200 and than_moi["accessToken"] != token_hs, f"làm mới phiên học sinh: HTTP {ma}")
    ma, _ = goi("/api/hoc-sinh/auth/refresh", method="POST", cookie=cookie_hs)
    kiem_tra(ma == 401, f"dùng lại cookie cũ (đã xoay vòng) -> HTTP {ma}")
    ma, _ = goi("/api/hoc-sinh/auth/refresh", method="POST")
    kiem_tra(ma == 401, f"không có cookie -> HTTP {ma}")

    ma, _ = goi("/api/hoc-sinh/auth/doi-mat-khau", method="POST", token=token_hs,
                body={"matKhauHienTai": "sai12345", "matKhauMoi": "moi12345"})
    kiem_tra(ma == 400, f"đổi mật khẩu với mật khẩu cũ sai -> HTTP {ma}")
    ma, _ = goi("/api/hoc-sinh/auth/doi-mat-khau", method="POST", token=token_hs,
                body={"matKhauHienTai": mat_khau_a, "matKhauMoi": "abcd"})
    kiem_tra(ma == 400, f"mật khẩu mới quá ngắn -> HTTP {ma}")

    ma, _ = goi("/api/hoc-sinh/auth/doi-mat-khau", method="POST", token=token_hs,
                body={"matKhauHienTai": mat_khau_a, "matKhauMoi": "moi2026a"})
    kiem_tra(ma == 204, f"học sinh tự đổi mật khẩu -> HTTP {ma}")
    ma, _, _, _ = dang_nhap_hoc_sinh(hs_a["maHocSinh"], mat_khau_a)
    kiem_tra(ma == 401, "mật khẩu cũ không dùng được nữa")
    ma, than_moi2, _, _ = dang_nhap_hoc_sinh(hs_a["maHocSinh"], "moi2026a")
    kiem_tra(ma == 200, "đăng nhập bằng mật khẩu mới thành công")

    ma, _ = goi(f"/api/students/{hs_a['id']}/tai-khoan", method="DELETE", token=token_gv)
    kiem_tra(ma == 204, f"thu hồi tài khoản -> HTTP {ma}")
    ma, than, _, _ = dang_nhap_hoc_sinh(hs_a["maHocSinh"], "moi2026a")
    kiem_tra(ma == 409, f"đăng nhập sau khi thu hồi -> HTTP {ma} (chưa có mật khẩu)")

    tk_lai = goi(f"/api/students/{hs_a['id']}/tai-khoan", method="POST", token=token_gv, body={})[1]
    ma, _ = goi(f"/api/students/{hs_a['id']}", method="DELETE", token=token_gv)
    kiem_tra(ma == 204, "cho học sinh nghỉ học")
    ma, than, _, _ = dang_nhap_hoc_sinh(hs_a["maHocSinh"], tk_lai["matKhauTam"])
    kiem_tra(ma == 403, f"học sinh đã nghỉ không đăng nhập được -> HTTP {ma}")

    ma, _ = goi(f"/api/students/{hs_a['id']}/tai-khoan", method="DELETE", token=token_gv2)
    kiem_tra(ma == 404, f"giáo viên khác thu hồi tài khoản học sinh của người khác -> HTTP {ma}")

    print("== 11. Lịch sử đăng nhập và nhật ký ==")
    ma, nhat_ky = goi("/api/nhat-ky?hanhDong=cap_tai_khoan_hoc_sinh&kichThuoc=50", token=token_admin)
    kiem_tra(ma == 200 and nhat_ky["tongSo"] >= 3, f"nhật ký ghi việc cấp tài khoản học sinh: {nhat_ky['tongSo']} dòng")
    ma, nhat_ky = goi("/api/nhat-ky?hanhDong=dong_bo_ve_lich_google&kichThuoc=50", token=token_admin)
    kiem_tra(ma == 200 and nhat_ky["tongSo"] >= 5, f"nhật ký ghi các lần kéo Google về: {nhat_ky['tongSo']} dòng")

    print("== 12. Dọn dữ liệu thử ==")
    don_tai_khoan_kiem_thu()
    ma, con_lai = goi("/api/tai-lieu/danh-sach?hocSinhId=" + hs_a["id"], token=token_admin)
    kiem_tra(ma == 200 and con_lai == [], "tài liệu thử đã được dọn sạch")

    so_dat = sum(1 for ok, _ in ket_qua if ok)
    print(f"\n===== KẾT QUẢ PHASE 7: {so_dat}/{len(ket_qua)} bước đạt =====")

    for ok, mo_ta in ket_qua:
        if not ok:
            print("  - CHƯA ĐẠT: " + mo_ta)

    return 0 if so_dat == len(ket_qua) else 1


if __name__ == "__main__":
    sys.exit(main())
