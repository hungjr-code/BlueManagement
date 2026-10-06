"""
Kiểm thử đầu-cuối Phase 3 (Google Calendar + đăng nhập bằng Google).

    Chạy API ở chế độ giả:
    GoogleCalendar__CheDoGia=true Email__CheDoGia=true dotnet run --launch-profile http

    cd backend && python kiem-thu-phase3.py     (cần API đang chạy ở http://localhost:5080)

Chạy ở CHẾ ĐỘ GIẢ (GoogleCalendar:CheDoGia = true, đã bật sẵn ở appsettings.Development.json):
backend dùng một khách Google giả nên kiểm thử được toàn bộ luồng — đăng nhập bằng Google, cấp
quyền, đổi mã, lưu refresh token (mã hoá), chọn lịch, đồng bộ sự kiện, xoá sự kiện — mà không cần
tài khoản Google thật.

Phần CHƯA kiểm thử được (cần tài khoản Google thật): chính các lời gọi REST tới Google và việc xác
thực chữ ký id_token, vì ở chế độ giả không có lời gọi mạng nào ra ngoài.
"""
from __future__ import annotations

import html as html_module
import json
import random
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta

import kiem_thu_pg

API = "http://localhost:5080"
THU_MUC_API = r"c:\Joel_vh\ClassManagement\backend\ClassManagement.Api"
EMAIL_ADMIN = "admin@classmanagement.local"
EMAIL_GV_MAU = "giao.vien.mau@classmanagement.local"       # giáo viên A: kết nối lịch từ Cài đặt
EMAIL_CO_HA = "co.ha@classmanagement.local"                # giáo viên B: đăng nhập bằng Google
COOKIE_PHIEN = "cm_phien"

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

def cuoi_thang_sau(ngay: date) -> date:
    """Ngày cuối cùng của tháng sau — đúng bằng mốc đồng bộ mặc định của backend."""

    thang = ngay.month + 2
    nam = ngay.year + (thang - 1) // 12
    thang = (thang - 1) % 12 + 1
    return date(nam, thang, 1) - timedelta(days=1)


def goi(duong_dan: str, *, method: str = "GET", body=None, token: str | None = None,
        cookie: str | None = None):
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
            return phan_hoi.status, (json.loads(than) if than.strip().startswith(("{", "[")) else than)
    except urllib.error.HTTPError as loi:
        than = loi.read().decode("utf-8")
        return loi.code, (json.loads(than) if than.strip().startswith(("{", "[")) else than)


class ChanRedirect(urllib.request.HTTPRedirectHandler):
    """Không đi theo chuyển hướng, để đọc được chính header Location và Set-Cookie."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        return None


def goi_chuyen_huong(duong_dan: str) -> tuple[int, str, dict[str, str]]:
    opener = urllib.request.build_opener(ChanRedirect)
    try:
        with opener.open(API + duong_dan, timeout=30) as phan_hoi:
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


def dang_nhap(email: str, mat_khau: str):
    return goi("/api/auth/login", method="POST", body={"email": email, "matKhau": mat_khau})


def dang_nhap_bang_google(email: str | None = None):
    """Chạy trọn luồng đăng nhập bằng Google ở chế độ giả và trả về (đường dẫn 1, đường dẫn 2, cookie)."""
    ma, than = goi("/api/auth/google/duong-dan")
    if ma != 200:
        return ma, "", "", {}, than

    url = than["url"]
    if email:
        url += "&email=" + urllib.parse.quote(email)

    ma_dong_y, trang_dong_y = goi(url)
    if ma_dong_y != 200:
        return ma_dong_y, None, 0, "", {}

    ma_callback, vi_tri, cookie = goi_chuyen_huong(bam_tiep_tuc(trang_dong_y))
    return ma_dong_y, None, ma_callback, vi_tri, cookie


def phien_tu_cookie(cookie: dict[str, str]):
    if COOKIE_PHIEN not in cookie:
        return 0, {}
    return goi("/api/auth/refresh", method="POST", cookie=f"{COOKIE_PHIEN}={cookie[COOKIE_PHIEN]}")


def doc_so_sql(cau: str) -> int:
    out = kiem_thu_pg.chay_sql(cau)
    for dong in out.splitlines():
        dong = dong.strip()
        if dong.startswith("CM=") and dong[3:].strip().isdigit():
            return int(dong[3:].strip())
    raise SystemExit("Không đọc được số từ Postgres:\n" + out)


def dem_buoi_can_dong_bo(email: str, tu: date, den: date) -> int:
    return doc_so_sql(
        "SELECT 'CM=' || COUNT(*) FROM \"BuoiHoc\" b "
        "JOIN \"GiaoVien\" g ON g.\"Id\" = b.\"GiaoVienId\" "
        f"WHERE g.\"Email\" = '{email}' AND b.\"Ngay\" >= '{tu:%Y-%m-%d}' AND b.\"Ngay\" <= '{den:%Y-%m-%d}' "
        "AND NOT EXISTS (SELECT 1 FROM \"DiemDanh\" dd WHERE dd.\"BuoiHocId\" = b.\"Id\" AND dd.\"TrangThai\" = 'nghi');")


def dem_buoi_da_len_google(email: str) -> int:
    return doc_so_sql(
        "SELECT 'CM=' || COUNT(*) FROM \"BuoiHoc\" b "
        "JOIN \"GiaoVien\" g ON g.\"Id\" = b.\"GiaoVienId\" "
        f"WHERE g.\"Email\" = '{email}' AND b.\"GoogleEventId\" IS NOT NULL;")


def main() -> int:
    mat_khau = doc_mat_khau()

    ma, than = dang_nhap(EMAIL_ADMIN, mat_khau)
    if ma != 200:
        raise SystemExit(f"Không đăng nhập được admin (HTTP {ma})")
    token_admin = than["accessToken"]

    ma, than = dang_nhap(EMAIL_GV_MAU, mat_khau)
    if ma != 200:
        raise SystemExit(f"Không đăng nhập được giáo viên A (HTTP {ma})")
    token_a = than["accessToken"]

    hom_nay = date.today()
    dau_tuan = hom_nay - timedelta(days=hom_nay.weekday())
    cuoi_tuan = dau_tuan + timedelta(days=6)
    den_ky = cuoi_thang_sau(hom_nay)

    print("== 0. Dọn trạng thái từ lần chạy trước ==")
    for token in (token_a, token_admin):
        goi("/api/google-calendar/ngat-ket-noi", method="POST", token=token, body={"xoaSuKienDaTao": True})
    # Giáo viên B chưa có token ở đây (sẽ đăng nhập bằng Google), nên dọn bằng SQL cho chắc.
    doc_so_sql("UPDATE \"BuoiHoc\" SET \"GoogleEventId\" = NULL, \"GoogleDongBoUtc\" = NULL; SELECT 'CM=0';")
    doc_so_sql("UPDATE \"GiaoVien\" SET \"GoogleTaiKhoan\" = NULL, \"GoogleCalendarId\" = NULL, "
               "\"GoogleRefreshTokenMaHoa\" = NULL; SELECT 'CM=0';")
    goi("/api/google-calendar/gia-xoa-dau-vet", method="POST")
    kiem_tra(True, "đã dọn kết nối và id sự kiện cũ")

    print("== 1. Đăng nhập bằng Google: đồng bộ có được ngay từ bước này ==")
    ma_dong_y, _, ma_callback, vi_tri2, cookie = dang_nhap_bang_google(EMAIL_CO_HA)
    kiem_tra(ma_dong_y == 200, f"màn hình đồng ý giả hiện ra và phải bấm mới tiếp tục: HTTP {ma_dong_y}")
    kiem_tra(ma_callback == 302 and "/?google=dang-nhap-thanh-cong" in vi_tri2,
             f"bấm tiếp tục thì tạo phiên rồi đưa về giao diện: HTTP {ma_callback} -> {vi_tri2[:60]}")
    kiem_tra(COOKIE_PHIEN in cookie, "refresh token nằm trong cookie httpOnly, không nằm trong URL")

    ma, than = phien_tu_cookie(cookie)
    kiem_tra(ma == 200 and than.get("nguoiDung", {}).get("email") == EMAIL_CO_HA,
             f"cookie đổi được access token, đăng nhập đúng tài khoản: HTTP {ma}")
    token_b = than["accessToken"]

    ma, b = goi("/api/google-calendar/trang-thai", token=token_b)
    kiem_tra(b["daKetNoi"] is True and b["taiKhoan"] == EMAIL_CO_HA,
             f"vừa đăng nhập bằng Google là đã kết nối sẵn lịch: {b['taiKhoan']}")
    kiem_tra(len([q for q in b["quyen"] if "calendar" in q]) == 2
             and "openid" in b["quyen"] and "email" in b["quyen"],
             f"một lần cấp quyền gồm định danh + 2 quyền lịch: {[q.rsplit('/', 1)[-1] for q in b['quyen']]}")

    print("== 2. Email Google lạ thì TỰ TẠO tài khoản giáo viên (không phải admin) ==")
    email_la = "nguoi.moi.bang.google@vidu.vn"
    doc_so_sql("DELETE FROM \"GiaoVien\" WHERE \"Email\" = '" + email_la + "'; SELECT 'CM=0';")
    ma1, _, ma2, vi_tri2, cookie_la = dang_nhap_bang_google(email_la)
    kiem_tra(ma2 == 302 and COOKIE_PHIEN in cookie_la and "dang-nhap-thanh-cong" in vi_tri2,
             "email Google chưa có tài khoản thì tạo mới rồi vào luôn")
    kiem_tra(doc_so_sql("SELECT 'CM=' || COUNT(*) FROM \"GiaoVien\" "
                        f"WHERE \"Email\" = '{email_la}' AND \"VaiTro\" = 'giao_vien';") == 1,
             "tài khoản tạo bằng Google có vai trò giáo viên, không phải admin")

    print("== 3. Kết nối lịch từ Cài đặt (giáo viên A) ==")
    ma, a = goi("/api/google-calendar/trang-thai", token=token_a)
    kiem_tra(a["daKetNoi"] is False and a["taiKhoan"] is None,
             "A chưa kết nối, và không thấy thông tin tài khoản Google của B")
    ma, than = goi("/api/google-calendar/duong-dan-uy-quyen", token=token_a)
    _, trang_dong_y = goi(than["url"])
    ma2, vi_tri2, _ = goi_chuyen_huong(bam_tiep_tuc(trang_dong_y))
    kiem_tra(ma2 == 302 and "/settings?google=ket-noi-thanh-cong" in vi_tri2,
             f"cấp quyền xong quay về màn hình Cài đặt: HTTP {ma2}")

    ma, a = goi("/api/google-calendar/trang-thai", token=token_a)
    kiem_tra(a["daKetNoi"] is True and a["taiKhoan"] == EMAIL_GV_MAU,
             f"A đã kết nối lịch của chính mình: {a['taiKhoan']}")
    kiem_tra(a["calendarId"] == EMAIL_GV_MAU, "mặc định ghi vào lịch chính của A")

    print("== 4. Chọn lịch đích: mỗi người một lịch ==")
    ma, ds_lich = goi("/api/google-calendar/danh-sach-lich", token=token_a)
    kiem_tra(ma == 200 and len(ds_lich) == 2, f"A liệt kê được {len(ds_lich)} lịch của mình")
    lich_phu = next(x for x in ds_lich if not x["laLichChinh"])
    ma, _ = goi("/api/google-calendar/chon-lich", method="PUT", token=token_a, body={"calendarId": lich_phu["id"]})
    kiem_tra(ma == 204, f"A chọn lịch '{lich_phu['ten']}' -> HTTP {ma}")

    print("== 5. Admin chỉ quan sát số lượng, không đọc được của ai ==")
    ma, tong_hop = goi("/api/google-calendar/tong-hop", token=token_admin)
    kiem_tra(ma == 200 and tong_hop["soDaKetNoi"] >= 2
             and tong_hop["soDaKetNoi"] + tong_hop["soChuaKetNoi"] == tong_hop["soGiaoVienDangLam"],
             f"admin thấy {tong_hop['soDaKetNoi']}/{tong_hop['soGiaoVienDangLam']} người đã kết nối, "
             f"chưa kết nối: {tong_hop['tenChuaKetNoi']}")
    kiem_tra("taikhoan" not in json.dumps(tong_hop).lower() and "token" not in json.dumps(tong_hop).lower(),
             "số liệu tổng hợp không chứa email Google hay token của ai")
    ma, than = goi("/api/google-calendar/tong-hop", token=token_a)
    kiem_tra(ma == 403, f"giáo viên xem số liệu tổng hợp -> HTTP {ma} (mong đợi 403)")
    ma, than = goi("/api/google-calendar/dong-bo", method="POST", token=token_a, body={"tatCaGiaoVien": True})
    kiem_tra(ma == 403, f"giáo viên đồng bộ cho tất cả mọi người -> HTTP {ma} (mong đợi 403)")

    print("== 6. A đồng bộ: chỉ buổi của A, chỉ lên lịch của A ==")
    goi("/api/google-calendar/gia-xoa-dau-vet", method="POST")
    ma, kq_a = goi("/api/google-calendar/dong-bo", method="POST", token=token_a, body={})
    kiem_tra(ma == 200, f"A đồng bộ -> HTTP {ma}")
    so_buoi_a = dem_buoi_can_dong_bo(EMAIL_GV_MAU, hom_nay, den_ky)
    kiem_tra(kq_a["soTao"] == so_buoi_a, f"A: tạo {kq_a['soTao']} sự kiện = {so_buoi_a} buổi của A trong kỳ")
    kiem_tra(dem_buoi_da_len_google(EMAIL_CO_HA) == 0,
             "buổi của B KHÔNG bị đẩy lên (mỗi người tự đồng bộ lịch của mình)")
    ma, su_kien = goi("/api/google-calendar/gia-su-kien-da-gui")
    kiem_tra(all(s["calendarId"] == lich_phu["id"] for s in su_kien),
             f"cả {len(su_kien)} sự kiện đều vào đúng lịch A đã chọn")

    print("== 7. Nội dung sự kiện: tiêu đề, giờ, múi giờ, nhắc trước ==")
    mot = su_kien[0]["suKien"]
    kiem_tra(mot["tieuDe"].startswith("Dạy "), f"tiêu đề: {mot['tieuDe']}")
    kiem_tra(mot["batDau"].endswith("+07:00"), f"giờ gửi kèm múi giờ Việt Nam: {mot['batDau']}")
    kiem_tra(mot["nhacTruocPhut"] == 45, f"nhắc trước {mot['nhacTruocPhut']} phút (lấy từ Cài đặt)")
    kiem_tra(all(s["hanhDong"] == "tao" for s in su_kien), "lần đầu toàn là hành động tạo")

    print("== 8. Đồng bộ lại: không tạo trùng ==")
    ma, kq_a2 = goi("/api/google-calendar/dong-bo", method="POST", token=token_a, body={})
    kiem_tra(kq_a2["soTao"] == 0 and kq_a2["soCapNhat"] == 0,
             f"không có gì đổi thì không gọi Google: tạo {kq_a2['soTao']}, cập nhật {kq_a2['soCapNhat']}, "
             f"bỏ qua {kq_a2['soBoQua']}")

    print("== 9. B đồng bộ: hai người không giẫm lên nhau ==")
    goi("/api/google-calendar/gia-xoa-dau-vet", method="POST")
    so_buoi_a_truoc = dem_buoi_da_len_google(EMAIL_GV_MAU)
    ma, kq_b = goi("/api/google-calendar/dong-bo", method="POST", token=token_b, body={})
    so_buoi_b = dem_buoi_can_dong_bo(EMAIL_CO_HA, hom_nay, den_ky)
    kiem_tra(kq_b["soTao"] == so_buoi_b, f"B: tạo {kq_b['soTao']} sự kiện = {so_buoi_b} buổi của B")
    ma, su_kien_b = goi("/api/google-calendar/gia-su-kien-da-gui")
    kiem_tra(all(s["calendarId"] == EMAIL_CO_HA for s in su_kien_b),
             f"cả {len(su_kien_b)} sự kiện của B vào lịch chính của B")
    kiem_tra(dem_buoi_da_len_google(EMAIL_GV_MAU) == so_buoi_a_truoc,
             "bản ghi sự kiện của A không bị đụng tới")

    print("== 10. Buổi nghỉ thì gỡ sự kiện khỏi lịch ==")
    # Chỉ lấy buổi NẰM TRONG KHOẢNG ĐỒNG BỘ (từ hôm nay tới cuối kỳ): buổi của những ngày đã qua không
    # bao giờ được đẩy lên lịch, lấy chúng ra thử thì "gỡ sự kiện" chẳng có gì để gỡ. Và trả hai buổi
    # sắp dùng về "chưa điểm danh" rồi đồng bộ một lần trước khi thử: lần chạy trước đã điểm danh chúng
    # rồi thì lần này đổi trạng thái cũng không còn là thay đổi — bài kiểm thử phải chạy lại được mãi.
    ma, than = goi(f"/api/attendance?tuNgay={hom_nay}&denNgay={den_ky}", token=token_a)
    ung_vien = list(than["duLieu"])[:2]
    kiem_tra(len(ung_vien) == 2, f"chọn 2 buổi trong kỳ để thử: {[b['tenHocSinh'] for b in ung_vien]}")
    buoi_nghi, buoi_sua = ung_vien[0], ung_vien[1]
    doc_so_sql("DELETE FROM \"DiemDanh\" dd WHERE dd.\"BuoiHocId\" IN "
               f"('{buoi_nghi['id']}', '{buoi_sua['id']}'); SELECT 'CM=0';")
    goi("/api/google-calendar/dong-bo", method="POST", token=token_a, body={})
    kiem_tra(doc_so_sql("SELECT 'CM=' || COUNT(*) FROM \"BuoiHoc\" "
                        f"WHERE \"Id\" = '{buoi_nghi['id']}' AND \"GoogleEventId\" IS NOT NULL;") == 1,
             "chuẩn bị xong: buổi sắp cho nghỉ đã có sự kiện trên lịch")
    ma, _ = goi("/api/attendance/luu-hang-loat", method="POST", token=token_a, body={"duLieu": [
        {"buoiHocId": buoi_nghi["id"], "trangThai": "nghi", "lyDoNghi": "co_phep", "ghiChu": "Học sinh báo nghỉ"}]})
    kiem_tra(ma == 200, f"điểm danh nghỉ -> HTTP {ma}")
    ma, kq_a3 = goi("/api/google-calendar/dong-bo", method="POST", token=token_a, body={})
    kiem_tra(kq_a3["soXoa"] == 1, f"buổi nghỉ bị gỡ khỏi Google: xoá {kq_a3['soXoa']}")
    kiem_tra(doc_so_sql("SELECT 'CM=' || COUNT(*) FROM \"BuoiHoc\" "
                        f"WHERE \"Id\" = '{buoi_nghi['id']}' AND \"GoogleEventId\" IS NOT NULL;") == 0,
             "buổi đã nghỉ không còn id sự kiện")
    kiem_tra(dem_buoi_da_len_google(EMAIL_CO_HA) == so_buoi_b, "sự kiện của B vẫn nguyên")

    print("== 11. Sửa điểm danh thì ghi lại sự kiện ==")
    ma, _ = goi("/api/attendance/luu-hang-loat", method="POST", token=token_a, body={"duLieu": [
        {"buoiHocId": buoi_sua["id"], "trangThai": "di_hoc", "ghiChu": "Đã kiểm tra bài cũ"}]})
    kiem_tra(ma == 200, f"điểm danh đi học kèm ghi chú -> HTTP {ma}")
    ma, kq_a4 = goi("/api/google-calendar/dong-bo", method="POST", token=token_a, body={})
    kiem_tra(kq_a4["soTao"] + kq_a4["soCapNhat"] == 1,
             f"buổi vừa sửa được ghi lại đúng một lần: tạo {kq_a4['soTao']}, cập nhật {kq_a4['soCapNhat']}")
    ma, kq_a4b = goi("/api/google-calendar/dong-bo", method="POST", token=token_a, body={})
    kiem_tra(kq_a4b["soTao"] == 0 and kq_a4b["soCapNhat"] == 0,
             f"đồng bộ ngay sau đó không gọi Google thêm (bỏ qua {kq_a4b['soBoQua']} buổi không đổi)")

    print("== 12. Buổi dạy bù cũng lên lịch ==")
    ma, than = goi("/api/students?kichThuoc=50", token=token_a)
    hoc_sinh = than["duLieu"][0]
    ma, buoi_bu = 400, None
    # Mỗi lần chạy thử một khung giờ ngẫu nhiên trên một ngày khác nhau: các lần chạy trước đã chiếm
    # khá nhiều khung, mà trùng giờ với buổi khác thì backend chặn đúng (HTTP 400).
    for lan_thu in range(10):
        ngay_bu = hom_nay + timedelta(days=7 + lan_thu)
        phut = random.randint(0, 59)
        ma, buoi_bu = goi("/api/attendance/buoi-day-bu", method="POST", token=token_a, body={
            "hocSinhId": hoc_sinh["id"], "ngay": str(ngay_bu),
            "gioBatDau": f"{12 + lan_thu % 8:02d}:{phut:02d}:00",
            "gioKetThuc": f"{13 + lan_thu % 8:02d}:{phut:02d}:00", "ghiChu": "Buổi dạy bù để kiểm thử"})
        if ma == 201:
            break
    kiem_tra(ma == 201, f"thêm buổi dạy bù -> HTTP {ma}")
    ma, kq_a5 = goi("/api/google-calendar/dong-bo", method="POST", token=token_a, body={})
    kiem_tra(kq_a5["soTao"] == 1, f"buổi dạy bù được tạo sự kiện mới: tạo {kq_a5['soTao']}")
    ma, su_kien = goi("/api/google-calendar/gia-su-kien-da-gui")
    kiem_tra(any("dạy bù" in s["suKien"]["tieuDe"] for s in su_kien),
             "sự kiện dạy bù có đánh dấu rõ trong tiêu đề")

    print("== 13. Mỗi người có lần đồng bộ riêng ==")
    ma, a = goi("/api/google-calendar/trang-thai", token=token_a)
    ma, b = goi("/api/google-calendar/trang-thai", token=token_b)
    kiem_tra(a["lanDongBoCuoi"] is not None and b["lanDongBoCuoi"] is not None,
             f"A thấy {len(a['lanDongBoCuoi'])} số liệu, B thấy {len(b['lanDongBoCuoi'])} số liệu riêng")
    kiem_tra(a["lanDongBoCuoi"]["thoiDiemUtc"] != b["lanDongBoCuoi"]["thoiDiemUtc"]
             or a["lanDongBoCuoi"]["soBoQua"] != b["lanDongBoCuoi"]["soBoQua"],
             "lần đồng bộ cuối của A và B là hai bản ghi khác nhau")

    print("== 14. Admin chạy đồng bộ cho tất cả ==")
    goi("/api/google-calendar/gia-xoa-dau-vet", method="POST")
    ma, kq_all = goi("/api/google-calendar/dong-bo", method="POST", token=token_admin, body={"tatCaGiaoVien": True})
    kiem_tra(ma == 200 and kq_all["soTao"] == 0 and kq_all["soCapNhat"] == 0,
             f"admin đồng bộ tất cả: tạo {kq_all['soTao']}, cập nhật {kq_all['soCapNhat']} (mọi thứ đã đồng bộ)")
    kiem_tra(kq_all["loi"] is None, "không giáo viên nào lỗi")
    kiem_tra(dem_buoi_da_len_google(EMAIL_GV_MAU) > 0 and dem_buoi_da_len_google(EMAIL_CO_HA) > 0,
             "cả A và B đều đang có sự kiện trên lịch của mình")

    print("== 15. Ngắt kết nối chỉ xoá sự kiện của chính mình ==")
    so_su_kien_a = dem_buoi_da_len_google(EMAIL_GV_MAU)
    ma, kq_ngat = goi("/api/google-calendar/ngat-ket-noi", method="POST", token=token_a,
                      body={"xoaSuKienDaTao": True})
    kiem_tra(ma == 200 and kq_ngat["soXoa"] == so_su_kien_a,
             f"A ngắt kết nối, xoá {kq_ngat['soXoa']} sự kiện đã tạo (đang theo dõi {so_su_kien_a})")
    kiem_tra(dem_buoi_da_len_google(EMAIL_GV_MAU) == 0, "A không còn buổi nào giữ id sự kiện")
    kiem_tra(dem_buoi_da_len_google(EMAIL_CO_HA) == so_buoi_b, "sự kiện của B không bị xoá theo")
    ma, a = goi("/api/google-calendar/trang-thai", token=token_a)
    kiem_tra(a["daKetNoi"] is False and a["taiKhoan"] is None, "A đã ngắt kết nối, không giữ lại token")
    ma, b = goi("/api/google-calendar/trang-thai", token=token_b)
    kiem_tra(b["daKetNoi"] is True, "B vẫn đang kết nối bình thường")

    print("== 16. Sau khi ngắt thì đồng bộ bị chặn rõ ràng ==")
    ma, than = goi("/api/google-calendar/dong-bo", method="POST", token=token_a, body={})
    kiem_tra(ma == 409 and "Chưa kết nối Google Calendar" in (than.get("title") or ""),
             f"A đồng bộ khi chưa kết nối -> HTTP {ma}: {than.get('title')}")

    print("== 17. Không lộ token Google ra ngoài ==")
    ma, than = goi("/api/settings", token=token_admin)
    chuoi = json.dumps(than, ensure_ascii=False).lower()
    kiem_tra("googlerefreshtoken" not in chuoi and "googletai" not in chuoi and "googlecalendarid" not in chuoi,
             "cài đặt chung không trả thông tin kết nối Google của ai")

    so_dat = sum(1 for ok, _ in ket_qua if ok)
    print(f"\n===== KẾT QUẢ PHASE 3: {so_dat}/{len(ket_qua)} bước đạt =====")
    for ok, mo_ta in ket_qua:
        if not ok:
            print("  CHƯA ĐẠT: " + mo_ta)
    return 0 if so_dat == len(ket_qua) else 1


if __name__ == "__main__":
    sys.exit(main())
