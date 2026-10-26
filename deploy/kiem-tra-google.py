#!/usr/bin/env python3
"""Kiểm tra cấu hình Google OAuth của một máy chủ — chạy được cả khi CHƯA có credential.

    python deploy/kiem-tra-google.py https://bluemanagement.onrender.com
    python deploy/kiem-tra-google.py http://localhost:5080

Script trả lời đúng ba câu hỏi cần biết sau khi dán ClientId/ClientSecret vào biến môi trường:

  1. Máy chủ đã nhận credential chưa (`googleDaCauHinh`) — chưa thì mọi nút Google đều mờ, và
     `/api/auth/google/duong-dan` trả 409.
  2. Đường dẫn uỷ quyền thật mà Google sẽ nhận: `client_id`, `redirect_uri`, và danh sách quyền.
     Đối chiếu `redirect_uri` với hai địa chỉ đã khai trong Google Cloud Console — sai một ký tự là
     Google trả `redirect_uri_mismatch` và người dùng chỉ thấy "đăng nhập bằng Google không được".
  3. Hai địa chỉ gọi lại có cùng tên miền với máy chủ đang chạy không (lệch tên miền là lỗi hay gặp
     nhất khi vừa gắn tên miền riêng mà quên đổi ba biến `GoogleCalendar__*`).

Không cần thư viện ngoài; không in ClientSecret (nó không bao giờ được trả xuống máy khách).
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

DAT = "ĐẠT"
HONG = "HỎNG"
CANH_BAO = "CẢNH BÁO"


def goi(dia_chi: str):
    try:
        with urllib.request.urlopen(dia_chi, timeout=45) as phan_hoi:
            chuoi = phan_hoi.read().decode("utf-8", "replace")
            return phan_hoi.status, chuoi
    except urllib.error.HTTPError as loi:
        return loi.code, loi.read().decode("utf-8", "replace")
    except Exception as loi:  # noqa: BLE001 - in ra lý do thật cho người dùng
        return 0, str(loi)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    goc = sys.argv[1].rstrip("/")
    ten_mien = urllib.parse.urlparse(goc).netloc
    so_loi = 0

    print(f"== Kiểm tra Google OAuth tại {goc} ==")

    ma, than = goi(goc + "/api/health")
    if ma != 200:
        print(f"  [{HONG}] /api/health trả HTTP {ma} — máy chủ chưa chạy hoặc sai địa chỉ: {than[:200]}")
        return 1
    print(f"  [{DAT}] /api/health sống")

    ma, than = goi(goc + "/api/auth/tuy-chon-dang-nhap")
    if ma != 200:
        print(f"  [{HONG}] không đọc được /api/auth/tuy-chon-dang-nhap (HTTP {ma})")
        return 1

    tuy_chon = json.loads(than)
    da_cau_hinh = bool(tuy_chon.get("googleDaCauHinh"))
    che_do_gia = bool(tuy_chon.get("googleCheDoGia"))

    if che_do_gia:
        print(f"  [{CANH_BAO}] máy chủ đang chạy CHẾ ĐỘ GIẢ (GoogleCalendar__CheDoGia=true) — "
              "chỉ dùng để kiểm thử, Google thật không được gọi.")
    elif da_cau_hinh:
        print(f"  [{DAT}] máy chủ đã nhận ClientId/ClientSecret (googleDaCauHinh=true)")
    else:
        so_loi += 1
        print(f"  [{HONG}] máy chủ CHƯA nhận credential Google: hãy đặt GoogleCalendar__ClientId và "
              "GoogleCalendar__ClientSecret (biến môi trường trên máy chủ, user-secrets ở máy dev), "
              "rồi để máy chủ khởi động lại.")

    ma, than = goi(goc + "/api/auth/google/duong-dan")
    if ma == 409:
        print(f"  [{CANH_BAO}] /api/auth/google/duong-dan trả 409 — đúng như thiết kế khi chưa cấu hình; "
              "nút Google ở màn đăng nhập sẽ bị mờ kèm lời giải thích.")
        print("\n  Việc cần làm: điền credential theo deploy/GOOGLE-AUTH.md rồi chạy lại script này.")
        return 1

    if ma != 200:
        print(f"  [{HONG}] /api/auth/google/duong-dan trả HTTP {ma}: {than[:200]}")
        return 1

    duong_dan = json.loads(than)["url"]

    if che_do_gia and duong_dan.startswith("/"):
        print(f"  [{CANH_BAO}] chế độ giả nên đường dẫn uỷ quyền là đường nội bộ: {duong_dan[:80]}…")
        print("\n  Muốn kiểm với Google thật: tắt GoogleCalendar__CheDoGia rồi chạy lại.")
        return 0

    tham_so = urllib.parse.parse_qs(urllib.parse.urlparse(duong_dan).query)
    client_id = (tham_so.get("client_id") or [""])[0]
    redirect_uri = (tham_so.get("redirect_uri") or [""])[0]
    quyen = (tham_so.get("scope") or [""])[0].split()
    che_do = {k: (tham_so.get(k) or [""])[0] for k in ("response_type", "access_type", "prompt")}

    print("  Đường dẫn uỷ quyền máy chủ sẽ dùng:")
    print(f"    client_id     = {client_id}")
    print(f"    redirect_uri  = {redirect_uri}")
    print(f"    {che_do}")

    if not client_id.endswith(".apps.googleusercontent.com"):
        so_loi += 1
        print(f"  [{HONG}] client_id không có dạng <mã>.apps.googleusercontent.com — "
              "nhiều khả năng vẫn là chỗ trống trong tài liệu.")

    if che_do.get("access_type") != "offline" or che_do.get("prompt") != "consent":
        so_loi += 1
        print(f"  [{HONG}] thiếu access_type=offline hoặc prompt=consent — Google sẽ KHÔNG trả refresh "
              "token, và mọi lần đồng bộ sau đó sẽ hỏng.")
    else:
        print(f"  [{DAT}] xin refresh token đúng cách (offline + consent)")

    quyen_can = {
        "openid",
        "email",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
        "https://www.googleapis.com/auth/drive.file",
    }
    thieu = quyen_can - set(quyen)
    thua = set(quyen) - quyen_can
    if thieu:
        so_loi += 1
        print(f"  [{HONG}] thiếu quyền: {sorted(thieu)} — tính năng tương ứng sẽ lỗi 403.")
    else:
        print(f"  [{DAT}] đủ {len(quyen_can)} quyền cần thiết (đăng nhập, lịch, tài liệu Drive)")

    if thua:
        print(f"  [{CANH_BAO}] xin thừa quyền (Google sẽ hỏi kỹ hơn khi xác minh): {sorted(thua)}")

    if urllib.parse.urlparse(redirect_uri).netloc != ten_mien:
        so_loi += 1
        print(f"  [{HONG}] redirect_uri nằm ở tên miền khác với máy chủ đang chạy ({ten_mien}) — "
              "kiểm tra lại GoogleCalendar__RedirectUri / __RedirectUriDangNhap / __FrontendUrl.")
    else:
        print(f"  [{DAT}] redirect_uri cùng tên miền với máy chủ")

    cong_lai = redirect_uri.replace("/api/google-calendar/callback", "/api/auth/google/callback")
    print("\n  Hai địa chỉ phải khai trong Google Cloud Console → Credentials → OAuth client → "
          "Authorized redirect URIs (đúng từng ký tự):")
    print(f"    {redirect_uri}      (kết nối lịch trong Cài đặt)")
    print(f"    {cong_lai}      (đăng nhập bằng Google)")
    print("\n  Kiểm tra bằng mắt: mở đường dẫn uỷ quyền dưới đây bằng trình duyệt — nếu Google báo "
          "redirect_uri_mismatch thì địa chỉ khai trong Console đang lệch:\n")
    print("    " + duong_dan)

    print(f"\n== Kết luận: {'CẤU HÌNH ĐÃ ỔN' if so_loi == 0 else str(so_loi) + ' điểm cần sửa'} ==")
    return 0 if so_loi == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
