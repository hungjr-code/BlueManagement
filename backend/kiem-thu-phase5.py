"""
Kiểm thử đầu-cuối phần đăng nhập/đăng ký (tự tạo tài khoản + Google + quên mật khẩu qua email).

    Chạy API ở chế độ giả:
    GoogleCalendar__CheDoGia=true Email__CheDoGia=true dotnet run --launch-profile http

    cd backend && python kiem-thu-phase5.py      (cần API đang chạy ở http://localhost:5080)

Chạy ở môi trường Development với GoogleCalendar:CheDoGia = true (khách Google giả) và
Email:CheDoGia = true (hộp thư giả), nên kiểm được trọn luồng: tự đăng ký, đăng nhập/đăng ký bằng
Google, xin thư đặt lại mật khẩu, lấy liên kết trong thư, đặt mật khẩu mới, và thu hồi phiên cũ.

Phần CHƯA kiểm thử được ở đây (cần tài khoản Google thật + máy chủ SMTP thật): việc gọi REST tới
Google, việc xác thực chữ ký id_token, và việc gửi thư qua SMTP thật.
"""
from __future__ import annotations

import html as html_module
import json
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

API = "http://localhost:5080"
THU_MUC_API = r"c:\Joel_vh\ClassManagement\backend\ClassManagement.Api"
COOKIE_PHIEN = "cm_phien"

# Email kiểm thử đặt theo mốc thời gian để chạy lại nhiều lần vẫn sạch.
dau_thoi_gian = datetime.now().strftime("%H%M%S")
EMAIL_MOI = f"giao.vien.tu.tao.{dau_thoi_gian}@vidu.vn"
EMAIL_GOOGLE_MOI = f"giao.vien.google.{dau_thoi_gian}@vidu.vn"
MAT_KHAU_MOI = "matkhau123"
MAT_KHAU_SAU = "matkhaumoi456"

ket_qua: list[tuple[bool, str]] = []


def kiem_tra(dieu_kien: bool, mo_ta: str) -> None:
    ket_qua.append((bool(dieu_kien), mo_ta))
    print(("  PASS  " if dieu_kien else "  FAIL  ") + mo_ta)


def bam_tiep_tuc(trang_html: str) -> str:
    """Lấy liên kết "vẫn tiếp tục" trên màn hình đồng ý GIẢ của máy dev.

    Ở chế độ giả, backend không tự đăng nhập: nó hiện một trang nói rõ đang đóng vai ai rồi mới cho
    bấm tiếp. Nhờ vậy không ai nhầm đó là việc đăng nhập bằng Google thật.
    """

    khop = re.search(r'href="([^"]+)"', trang_html or "")
    if not khop:
        raise SystemExit(
            "Không thấy nút tiếp tục trên màn hình đồng ý giả.\n"
            "Bài kiểm thử này cần API chạy ở chế độ giả:\n"
            "  GoogleCalendar__CheDoGia=true Email__CheDoGia=true dotnet run --launch-profile http")

    return html_module.unescape(khop.group(1))

def doc_bi_mat() -> dict[str, str]:
    out = subprocess.run(["dotnet", "user-secrets", "list"], cwd=THU_MUC_API,
                         capture_output=True, text=True, encoding="utf-8").stdout
    ket_qua: dict[str, str] = {}
    for dong in out.splitlines():
        if " = " in dong:
            ten, gia_tri = dong.split(" = ", 1)
            ket_qua[ten.strip()] = gia_tri.strip()
    return ket_qua


def chay_sql(cau: str) -> str:
    return subprocess.run(
        ["sqlcmd", "-S", r".\SQLEXPRESS", "-d", "ClassManagement", "-E", "-h", "-1", "-W", "-w", "800", "-I", "-Q", cau],
        capture_output=True, text=True, encoding="utf-8", errors="replace").stdout or ""


def doc_so_sql(cau: str) -> int:
    for dong in chay_sql(cau).splitlines():
        dong = dong.strip()
        if dong.startswith("CM=") and dong[3:].strip().isdigit():
            return int(dong[3:].strip())
    raise SystemExit("Không đọc được số từ sqlcmd:\n" + chay_sql(cau))


def doc_cookie(headers) -> dict[str, str]:
    ket_qua_cookie: dict[str, str] = {}
    for gia_tri in headers.get_all("Set-Cookie") or []:
        cap = gia_tri.split(";")[0]
        if "=" in cap:
            ten, gia_tri_cookie = cap.split("=", 1)
            ket_qua_cookie[ten.strip()] = gia_tri_cookie.strip()
    return ket_qua_cookie


def goi(duong_dan: str, *, method: str = "GET", body=None, token: str | None = None, cookie: str | None = None):
    du_lieu = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    yeu_cau = urllib.request.Request(API + duong_dan, data=du_lieu, method=method)
    yeu_cau.add_header("Content-Type", "application/json; charset=utf-8")
    if token:
        yeu_cau.add_header("Authorization", "Bearer " + token)
    if cookie:
        yeu_cau.add_header("Cookie", cookie)

    try:
        with urllib.request.urlopen(yeu_cau, timeout=30) as phan_hoi:
            than = phan_hoi.read().decode("utf-8")
            return phan_hoi.status, (json.loads(than) if than.strip().startswith(("{", "[")) else than), doc_cookie(phan_hoi.headers)
    except urllib.error.HTTPError as loi:
        than = loi.read().decode("utf-8")
        return loi.code, (json.loads(than) if than.strip().startswith(("{", "[")) else than), doc_cookie(loi.headers)


class ChanRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        return None


def goi_chuyen_huong(duong_dan: str):
    opener = urllib.request.build_opener(ChanRedirect)
    try:
        with opener.open(API + duong_dan, timeout=30) as phan_hoi:
            return phan_hoi.status, phan_hoi.headers.get("Location", ""), doc_cookie(phan_hoi.headers)
    except urllib.error.HTTPError as loi:
        return loi.code, loi.headers.get("Location", ""), doc_cookie(loi.headers)


def dang_nhap_google(email: str):
    """Chạy trọn luồng Google ở chế độ giả cho một email bất kỳ."""
    ma, than, _ = goi("/api/auth/google/duong-dan")
    if ma != 200:
        raise SystemExit(f"Không lấy được đường dẫn đăng nhập Google (HTTP {ma})")
    url = than["url"] + "&email=" + urllib.parse.quote(email)

    ma_dong_y, trang_dong_y, _ = goi(url)
    if ma_dong_y != 200:
        raise SystemExit(f"Màn hình đồng ý giả không hiện ra (HTTP {ma_dong_y}).")

    ma2, vi_tri2, cookie = goi_chuyen_huong(bam_tiep_tuc(trang_dong_y))
    return ma2, vi_tri2, cookie


def don_tai_khoan_kiem_thu() -> None:
    """Xoá các tài khoản do bài kiểm thử này tạo (email @vidu.vn) và nhật ký của chúng."""

    chay_sql("SET NOCOUNT ON; DELETE FROM NhatKy WHERE NguoiThucHienId IN "
             "(SELECT Id FROM GiaoVien WHERE Email LIKE '%@vidu.vn'); SELECT 'CM=0';")
    chay_sql("SET NOCOUNT ON; DELETE FROM GiaoVien WHERE Email LIKE '%@vidu.vn'; SELECT 'CM=0';")


def hop_thu_cho(email: str):
    """Chỉ lấy thư ĐẶT LẠI MẬT KHẨU (hộp thư còn có thư chào mừng khi tự đăng ký)."""
    ma, thu, _ = goi("/api/auth/gia-hop-thu")
    if ma != 200:
        return []
    return [x for x in thu
            if x["den"].lower() == email.lower() and "Đặt lại mật khẩu" in x["tieuDe"]]


def lay_token_tu_thu(noi_dung: str) -> str | None:
    khop = re.search(r"token=([A-Za-z0-9_\-]+)", noi_dung)
    return khop.group(1) if khop else None


def main() -> int:
    bi_mat = doc_bi_mat()
    mat_khau_admin = bi_mat.get("Seed:Admin:MatKhau")
    if not mat_khau_admin:
        raise SystemExit("Không đọc được Seed:Admin:MatKhau từ user-secrets.")

    ma, than, _ = goi("/api/auth/login", method="POST", body={"email": "admin@classmanagement.local", "matKhau": mat_khau_admin})
    token_admin = than["accessToken"]

    goi("/api/auth/gia-xoa-hop-thu", method="POST")
    so_tai_khoan_truoc = doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM GiaoVien;")

    print("== 1. Tự tạo tài khoản bằng email và mật khẩu ==")
    ma, than, cookie = goi("/api/auth/dang-ky", method="POST",
                           body={"hoTen": "Giáo viên tự tạo", "email": EMAIL_MOI, "matKhau": MAT_KHAU_MOI})
    kiem_tra(ma == 200 and "accessToken" in than, f"đăng ký -> HTTP {ma}, đăng nhập luôn")
    kiem_tra(than.get("nguoiDung", {}).get("vaiTro") == "giao_vien",
             f"tài khoản mới có vai trò '{than.get('nguoiDung', {}).get('vaiTro')}' (không bao giờ là admin)")
    kiem_tra(COOKIE_PHIEN in cookie, "đăng ký xong là có phiên luôn (cookie httpOnly)")

    token_tu_tao = than["accessToken"]
    ma, toi, _ = goi("/api/auth/me", token=token_tu_tao)
    kiem_tra(ma == 200 and toi["email"] == EMAIL_MOI, f"/api/auth/me trả đúng tài khoản vừa tạo: {toi.get('email')}")

    vai_tro_sql = chay_sql("SET NOCOUNT ON; SELECT 'CM=' + VaiTro + '|' + TrangThai FROM GiaoVien "
                           f"WHERE Email = '{EMAIL_MOI}';")
    kiem_tra("giao_vien|dang_lam" in vai_tro_sql, "trong database: vai trò giáo viên, trạng thái đang làm")

    ma, than, _ = goi("/api/auth/login", method="POST", body={"email": EMAIL_MOI, "matKhau": MAT_KHAU_MOI})
    kiem_tra(ma == 200, f"đăng nhập lại bằng mật khẩu vừa đặt -> HTTP {ma}")

    ma, than, _ = goi("/api/auth/dang-ky", method="POST",
                      body={"hoTen": "Trùng", "email": EMAIL_MOI, "matKhau": MAT_KHAU_MOI})
    kiem_tra(ma == 409, f"đăng ký lại cùng email -> HTTP {ma} (mong đợi 409)")

    ma, than, _ = goi("/api/auth/dang-ky", method="POST",
                      body={"hoTen": "Gõ sai", "email": f"yeu.{dau_thoi_gian}@vidu.vn", "matKhau": "matkhaudai"})
    chuoi_loi = json.dumps(than, ensure_ascii=False).lower()
    kiem_tra(ma == 400 and ("số" in chuoi_loi or "digit" in chuoi_loi),
             f"mật khẩu không có chữ số bị chặn -> HTTP {ma} kèm lời giải thích")

    ma, than, _ = goi("/api/auth/dang-ky", method="POST", body={
        "hoTen": "Giả danh admin", "email": f"gia.danh.{dau_thoi_gian}@vidu.vn",
        "matKhau": MAT_KHAU_MOI, "vaiTro": "admin", "trangThai": "dang_lam"})
    kiem_tra(ma == 200 and than["nguoiDung"]["vaiTro"] == "giao_vien",
             "gửi kèm 'vaiTro: admin' vẫn chỉ tạo được giáo viên")

    print("== 2. Tài khoản tự tạo không với tới được việc của admin ==")
    ma, _, _ = goi("/api/google-calendar/tong-hop", token=token_tu_tao)
    kiem_tra(ma == 403, f"tài khoản tự tạo xem số liệu tổng hợp -> HTTP {ma} (mong đợi 403)")
    ma, _, _ = goi("/api/tuition/chot-so/xem-truoc?thang=1&nam=2026", token=token_tu_tao)
    kiem_tra(ma == 403, f"tài khoản tự tạo mở chốt sổ -> HTTP {ma} (mong đợi 403)")
    ma, _, _ = goi("/api/teachers", method="POST", token=token_tu_tao,
                   body={"hoTen": "Tự phong", "email": f"tu.phong.{dau_thoi_gian}@vidu.vn",
                         "matKhauTamThoi": "Aa12345678"})
    kiem_tra(ma == 403, f"tài khoản tự tạo tạo thêm giáo viên -> HTTP {ma} (mong đợi 403)")
    ma, _, _ = goi("/api/settings", method="PUT", token=token_tu_tao, body={"nhacTruocBaoLauPhut": 5})
    kiem_tra(ma == 403, f"tài khoản tự tạo sửa cấu hình trung tâm -> HTTP {ma} (mong đợi 403)")

    print("== 3. Đăng nhập bằng Google cho email chưa từng có tài khoản ==")
    ma2, vi_tri2, cookie_google = dang_nhap_google(EMAIL_GOOGLE_MOI)
    kiem_tra(ma2 == 302 and "google=dang-nhap-thanh-cong" in vi_tri2,
             f"đăng nhập Google lần đầu -> HTTP {ma2}, quay về {vi_tri2[:56]}")
    kiem_tra(COOKIE_PHIEN in cookie_google, "có phiên đăng nhập cho tài khoản tự tạo bằng Google")

    ma, than, _ = goi("/api/auth/refresh", method="POST", cookie=f"{COOKIE_PHIEN}={cookie_google[COOKIE_PHIEN]}")
    kiem_tra(ma == 200 and than["nguoiDung"]["email"] == EMAIL_GOOGLE_MOI
             and than["nguoiDung"]["vaiTro"] == "giao_vien",
             f"tài khoản Google mới có vai trò '{than.get('nguoiDung', {}).get('vaiTro')}'")
    token_google = than["accessToken"]

    so_tai_khoan_google = doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM GiaoVien "
                                     f"WHERE Email = '{EMAIL_GOOGLE_MOI}';")
    kiem_tra(so_tai_khoan_google == 1, "email Google mới được tạo đúng một tài khoản")
    kiem_tra(doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM GiaoVien "
                        f"WHERE Email = '{EMAIL_GOOGLE_MOI}' AND GoogleTaiKhoan = '{EMAIL_GOOGLE_MOI}';") == 1,
             "đăng nhập bằng Google cũng liên kết luôn lịch Google của người đó")
    kiem_tra(doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM GiaoVien "
                        f"WHERE Email = '{EMAIL_GOOGLE_MOI}' AND MatKhauBam IS NULL;") == 1,
             "tài khoản tạo bằng Google chưa có mật khẩu (muốn có thì dùng quên mật khẩu)")

    dang_nhap_google(EMAIL_GOOGLE_MOI)
    kiem_tra(doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM GiaoVien "
                        f"WHERE Email = '{EMAIL_GOOGLE_MOI}';") == 1,
             "đăng nhập Google lần hai không tạo thêm tài khoản")

    ma, than, _ = goi("/api/auth/dang-ky", method="POST",
                      body={"hoTen": "Tự tạo lại bằng email Google", "email": EMAIL_GOOGLE_MOI, "matKhau": MAT_KHAU_MOI})
    kiem_tra(ma == 409, f"tự đăng ký bằng email đã có (từ Google) -> HTTP {ma} (mong đợi 409)")

    print("== 4. Quên mật khẩu: gửi thư và không tiết lộ email có tài khoản hay không ==")
    ma, _, _ = goi("/api/auth/quen-mat-khau", method="POST", body={"email": EMAIL_MOI})
    kiem_tra(ma == 204, f"xin thư đặt lại mật khẩu -> HTTP {ma}")
    thu_gui = hop_thu_cho(EMAIL_MOI)
    kiem_tra(len(thu_gui) == 1, f"hộp thư giả có {len(thu_gui)} thư gửi tới {EMAIL_MOI}")
    token_dat_lai = lay_token_tu_thu(thu_gui[0]["noiDung"]) if thu_gui else None
    kiem_tra(token_dat_lai is not None, "thư có liên kết kèm mã đặt lại mật khẩu")
    kiem_tra(doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM YeuCauDatLaiMatKhau;") >= 1,
             "yêu cầu được lưu trong database")
    # Trong database chỉ có bản băm, không có token thật.
    if token_dat_lai:
        kiem_tra(doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM YeuCauDatLaiMatKhau "
                            f"WHERE TokenBam = '{token_dat_lai}';") == 0,
                 "token thật KHÔNG được lưu trong database (chỉ lưu bản băm)")

    ma, _, _ = goi("/api/auth/quen-mat-khau", method="POST", body={"email": EMAIL_MOI})
    kiem_tra(ma == 204 and len(hop_thu_cho(EMAIL_MOI)) == 1,
             f"bấm lại trong vòng một phút thì không gửi thêm thư (vẫn {len(hop_thu_cho(EMAIL_MOI))} thư)")

    ma, _, _ = goi("/api/auth/quen-mat-khau", method="POST", body={"email": f"khong.co.{dau_thoi_gian}@vidu.vn"})
    kiem_tra(ma == 204, f"email không có tài khoản vẫn trả HTTP {ma} (không tiết lộ email nào đã đăng ký)")
    kiem_tra(len(hop_thu_cho(f"khong.co.{dau_thoi_gian}@vidu.vn")) == 0, "và không gửi thư nào")

    print("== 5. Đặt mật khẩu mới bằng mã trong thư ==")
    _, _, cookie_truoc = goi("/api/auth/login", method="POST",
                             body={"email": EMAIL_MOI, "matKhau": MAT_KHAU_MOI})
    kiem_tra(COOKIE_PHIEN in cookie_truoc, "có phiên cũ trước khi đổi mật khẩu để kiểm việc thu hồi")

    ma, than, _ = goi("/api/auth/dat-lai-mat-khau", method="POST",
                      body={"token": "ma-khong-co-that", "matKhauMoi": MAT_KHAU_SAU})
    kiem_tra(ma == 400, f"mã sai -> HTTP {ma} (mong đợi 400)")

    ma, _, _ = goi("/api/auth/dat-lai-mat-khau", method="POST",
                   body={"token": token_dat_lai, "matKhauMoi": MAT_KHAU_SAU})
    kiem_tra(ma == 204, f"đặt mật khẩu mới bằng mã trong thư -> HTTP {ma}")

    ma, _, _ = goi("/api/auth/login", method="POST", body={"email": EMAIL_MOI, "matKhau": MAT_KHAU_MOI})
    kiem_tra(ma == 401, f"mật khẩu cũ không dùng được nữa -> HTTP {ma}")
    ma, than, _ = goi("/api/auth/login", method="POST", body={"email": EMAIL_MOI, "matKhau": MAT_KHAU_SAU})
    kiem_tra(ma == 200, f"đăng nhập bằng mật khẩu mới -> HTTP {ma}")

    ma, _, _ = goi("/api/auth/dat-lai-mat-khau", method="POST",
                   body={"token": token_dat_lai, "matKhauMoi": "matkhaukhac789"})
    kiem_tra(ma == 400, f"dùng lại cùng một mã -> HTTP {ma} (mong đợi 400: mã chỉ dùng một lần)")

    ma, _, _ = goi("/api/auth/refresh", method="POST", cookie=f"{COOKIE_PHIEN}={cookie_truoc[COOKIE_PHIEN]}")
    kiem_tra(ma == 401, f"phiên cũ bị thu hồi sau khi đổi mật khẩu -> HTTP {ma} (mong đợi 401)")

    print("== 6. Tài khoản tạo bằng Google vẫn lấy được mật khẩu qua quên mật khẩu ==")
    goi("/api/auth/gia-xoa-hop-thu", method="POST")
    ma, _, _ = goi("/api/auth/quen-mat-khau", method="POST", body={"email": EMAIL_GOOGLE_MOI})
    thu_google = hop_thu_cho(EMAIL_GOOGLE_MOI)
    kiem_tra(ma == 204 and len(thu_google) == 1, f"gửi được thư cho tài khoản tạo bằng Google ({len(thu_google)} thư)")
    if thu_google:
        token_google_dat_lai = lay_token_tu_thu(thu_google[0]["noiDung"])
        ma, _, _ = goi("/api/auth/dat-lai-mat-khau", method="POST",
                       body={"token": token_google_dat_lai, "matKhauMoi": MAT_KHAU_MOI})
        kiem_tra(ma == 204, f"đặt mật khẩu cho tài khoản Google -> HTTP {ma}")
        ma, _, _ = goi("/api/auth/login", method="POST", body={"email": EMAIL_GOOGLE_MOI, "matKhau": MAT_KHAU_MOI})
        kiem_tra(ma == 200, f"sau đó đăng nhập bằng mật khẩu (không cần Google) -> HTTP {ma}")

    print("== 7. Dấu vết trong nhật ký ==")
    so_tu_dang_ky = doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM NhatKy "
                               "WHERE HanhDong IN ('tu_dang_ky_tai_khoan','tu_dang_ky_bang_google');")
    so_doi_mat_khau = doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM NhatKy "
                                 "WHERE HanhDong = 'dat_lai_mat_khau';")
    kiem_tra(so_tu_dang_ky >= 2, f"có {so_tu_dang_ky} dòng nhật ký về việc tự tạo tài khoản")
    kiem_tra(so_doi_mat_khau >= 1, f"có {so_doi_mat_khau} dòng nhật ký về việc đặt lại mật khẩu")

    so_tai_khoan_sau = doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM GiaoVien;")
    kiem_tra(so_tai_khoan_sau >= so_tai_khoan_truoc + 3,
             f"số tài khoản tăng từ {so_tai_khoan_truoc} lên {so_tai_khoan_sau} (2 tự tạo + 1 tài khoản giả danh admin)")

    print("== 8. Dọn tài khoản thử nghiệm ==")
    so_truoc_khi_don = doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM GiaoVien;")
    so_tai_khoan_rac = doc_so_sql(
        "SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM GiaoVien WHERE Email LIKE '%@vidu.vn';")
    if so_tai_khoan_rac > 0:
        don_tai_khoan_kiem_thu()
    so_sau_khi_don = doc_so_sql("SET NOCOUNT ON; SELECT 'CM=' + CONVERT(varchar(20), COUNT(*)) FROM GiaoVien;")
    kiem_tra(so_sau_khi_don == so_truoc_khi_don - so_tai_khoan_rac,
             f"đã dọn {so_tai_khoan_rac} tài khoản thử, còn lại {so_sau_khi_don} tài khoản thật")

    so_dat = sum(1 for ok, _ in ket_qua if ok)
    print(f"\n===== KẾT QUẢ ĐĂNG NHẬP/ĐĂNG KÝ: {so_dat}/{len(ket_qua)} bước đạt =====")
    for ok, mo_ta in ket_qua:
        if not ok:
            print("  CHƯA ĐẠT: " + mo_ta)
    return 0 if so_dat == len(ket_qua) else 1


if __name__ == "__main__":
    sys.exit(main())
