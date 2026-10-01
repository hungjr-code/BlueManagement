#!/usr/bin/env python3
"""Kiểm tra sau deploy — chạy từ máy của bạn, KHÔNG cần cài gì thêm (chỉ dùng thư viện chuẩn).

    python deploy/kiem-tra-sau-deploy.py https://<fe>.pages.dev https://<be>.onrender.com \
        --email admin@classmanagement.local --mat-khau "<mat khau admin>"

Việc mật khẩu chỉ dùng để đăng nhập thử, không lưu lại đâu cả.

LƯU Ý: Python gửi cookie bất kể SameSite, nên kịch bản này KHÔNG chứng minh được trình duyệt có giữ
phiên khi giao diện và API khác tên miền hay không. Nó kiểm tra cờ SameSite/Secure của cookie, CORS,
health, SPA routing, và việc bản build còn sót địa chỉ localhost — còn phần giữ phiên thì phải mở
trình duyệt thật (xem bước 7 trong danh sách in ra ở cuối).
"""
from __future__ import annotations

import argparse
import http.cookiejar
import json
import re
import sys
import urllib.error
import urllib.request

DAT = "[92mĐẠT[0m"
HONG = "[91mHỎNG[0m"
CANH_BAO = "[93mCẢNH BÁO[0m"
ket_qua: list[tuple[str, str, str]] = []


def ghi(trang_thai: str, ten: str, chi_tiet: str = "") -> None:
    ket_qua.append((trang_thai, ten, chi_tiet))
    print(f"  [{trang_thai}] {ten}" + (f" — {chi_tiet}" if chi_tiet else ""))


def goi(url: str, *, phuong_thuc: str = "GET", du_lieu: bytes | None = None,
        tieu_de: dict[str, str] | None = None, opener=None, cho_phep_loi: bool = True):
    """Trả (mã, tiêu đề, thân). Không ném lỗi HTTP."""
    request = urllib.request.Request(url, data=du_lieu, method=phuong_thuc, headers=tieu_de or {})
    try:
        with (opener or urllib.request.build_opener()).open(request, timeout=45) as phan_hoi:
            return phan_hoi.status, dict(phan_hoi.headers), phan_hoi.read(400_000)
    except urllib.error.HTTPError as loi:
        if not cho_phep_loi:
            raise
        return loi.code, dict(loi.headers), loi.read(400_000)
    except Exception as loi:  # noqa: BLE001 - in ra lý do thật cho người dùng
        return 0, {}, str(loi).encode()


def main() -> int:
    tham_so = argparse.ArgumentParser()
    tham_so.add_argument("fe", help="URL giao diện, ví dụ https://abc.pages.dev")
    tham_so.add_argument("be", help="URL API, ví dụ https://abc.onrender.com")
    tham_so.add_argument("--email", default="admin@classmanagement.local")
    tham_so.add_argument("--mat-khau", required=True)
    doi_so = tham_so.parse_args()

    fe, be = doi_so.fe.rstrip("/"), doi_so.be.rstrip("/")
    goc_fe, goc_be = fe, be

    print(f"\nGiao diện: {fe}\nAPI      : {be}\n")

    # 1. Health
    print("1. API sống chưa")
    ma, _, than = goi(f"{be}/api/health")
    if ma == 200:
        try:
            du_lieu = json.loads(than)
        except json.JSONDecodeError:
            ghi(HONG, "GET /api/health", f"HTTP 200 nhưng thân không phải JSON: {than[:120]!r}")
        else:
            ghi(DAT, "GET /api/health", f"environment={du_lieu.get('environment')}")
            if du_lieu.get("database", {}).get("canConnect"):
                ghi(DAT, "Database kết nối được", f"provider={du_lieu['database'].get('provider')}")
            else:
                ghi(HONG, "Database KHÔNG kết nối được", str(du_lieu.get("database"))[:200])
    else:
        ghi(HONG, "GET /api/health", f"HTTP {ma} {than[:200]!r}")

    # 2. Giao diện mở được
    print("\n2. Giao diện")
    ma, _, than = goi(fe + "/")
    chu = than.decode("utf-8", "replace")
    if ma == 200 and "<div id=" in chu:
        ghi(DAT, "GET / (giao diện tải được)")
    else:
        ghi(HONG, "GET /", f"HTTP {ma}, {len(chu)} ký tự")

    # 3. SPA routing: mở thẳng một đường dẫn con
    for duong_dan in ("/schedule", "/nhat-ky"):
        ma, _, than_con = goi(fe + duong_dan)
        if ma == 200 and b"<div id=" in than_con:
            ghi(DAT, f"F5 ở {duong_dan} (SPA routing)")
        else:
            ghi(HONG, f"F5 ở {duong_dan}", f"HTTP {ma} — thiếu _redirects / fallback index.html?")

    # 4. Bản build còn sót địa chỉ localhost?
    print("\n3. Bản build có còn trỏ về localhost không")
    duong_dan_js = [a or b for a, b in re.findall(r'(?:src|href)="([^"]+\.js)"|(?:src|href)="(/src/[^"]+)"', chu)][:8]
    sot = []
    for duong_dan in duong_dan_js:
        if duong_dan.startswith("http"):
            ma_js, _, noi_dung_js = goi(duong_dan)
        else:
            ma_js, _, noi_dung_js = goi(fe + "/" + duong_dan.lstrip("/"))
        if ma_js == 200:
            van_ban = noi_dung_js.decode("utf-8", "replace")
            for mau in ("localhost:5080", "127.0.0.1:5080", "localhost:5173", "http://localhost"):
                if mau in van_ban:
                    sot.append(f"{duong_dan} chứa {mau}")
    if sot:
        ghi(HONG, "Bản build còn địa chỉ localhost", "; ".join(sot))
    elif not duong_dan_js:
        ghi(CANH_BAO, "Không tìm thấy tệp JS nào để kiểm", "đang chạy bản dev? phải kiểm trên bản build thật")
    else:
        ghi(DAT, f"Không còn địa chỉ localhost trong {len(duong_dan_js)} tệp JS đã kiểm")

    # 5. HTTPS / mixed content
    print("\n4. HTTPS và mixed content")
    ghi(DAT if fe.startswith("https://") else CANH_BAO, "Giao diện dùng HTTPS",
        "đúng" if fe.startswith("https://") else f"phát hiện: {fe.split(':')[0]} — chỉ dùng cho máy dev")
    ghi(DAT if be.startswith("https://") else CANH_BAO, "API dùng HTTPS",
        "đúng" if be.startswith("https://") else f"phát hiện: {be.split(':')[0]} — chỉ dùng cho máy dev")
    if fe.startswith("https://") and be.startswith("http://"):
        ghi(HONG, "Mixed content", "giao diện HTTPS gọi API HTTP — trình duyệt sẽ chặn")

    # 6. CORS (chỉ có ý nghĩa khi khác tên miền)
    print("\n5. CORS")
    khac_ten_mien = fe.split("/")[2] != be.split("/")[2]
    if not khac_ten_mien:
        ghi(DAT, "Cùng tên miền — không cần CORS")
    else:
        ma, tieu_de, _ = goi(f"{be}/api/auth/login", phuong_thuc="OPTIONS", tieu_de={
            "Origin": goc_fe, "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"})
        cho_phep = tieu_de.get("Access-Control-Allow-Origin", "")
        if cho_phep in (goc_fe, "*"):
            ghi(DAT, "CORS cho phép giao diện", f"Access-Control-Allow-Origin={cho_phep}")
        else:
            ghi(HONG, "CORS CHƯA cho phép giao diện",
                f"preflight HTTP {ma}, Access-Control-Allow-Origin={cho_phep or '(thiếu)'} — trình duyệt sẽ chặn")
        if cho_phep == "*" and tieu_de.get("Access-Control-Allow-Credentials", "").lower() == "true":
            ghi(HONG, "CORS cấu hình sai", "Allow-Origin=* không được đi kèm Allow-Credentials=true")

    # 7. Đăng nhập + cờ cookie + giữ phiên
    print("\n6. Đăng nhập và phiên")
    binh_cookie = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(binh_cookie))
    than_gui = json.dumps({"email": doi_so.email, "matKhau": doi_so.mat_khau}).encode()
    ma, tieu_de, than = goi(f"{be}/api/auth/login", phuong_thuc="POST", du_lieu=than_gui,
                            tieu_de={"Content-Type": "application/json; charset=utf-8", "Origin": goc_fe},
                            opener=opener)
    access_token = ""
    if ma == 200:
        ghi(DAT, "POST /api/auth/login", "HTTP 200")
        try:
            access_token = json.loads(than).get("accessToken", "") or ""
        except json.JSONDecodeError:
            pass
        ghi(DAT if access_token else HONG, "Đọc được access token từ phản hồi đăng nhập",
            "" if access_token else than[:160].decode("utf-8", "replace"))
    else:
        ghi(HONG, "POST /api/auth/login", f"HTTP {ma} {than[:200]!r}")

    cookie_phien = [c for c in binh_cookie if c.name == "cm_phien"]
    if not cookie_phien:
        ghi(HONG, "Không nhận được cookie phiên cm_phien")
    else:
        cookie = cookie_phien[0]
        ghi(DAT, "Nhận cookie phiên cm_phien")
        cung_tinh = str(cookie.get_nonstandard_attr("SameSite") or "").lower()
        if khac_ten_mien and cung_tinh != "none":
            ghi(HONG, "Cookie phiên SameSite chưa đúng cho khác tên miền",
                f"SameSite={cung_tinh or '(không đặt, mặc định Lax)'} — trình duyệt sẽ KHÔNG gửi cookie "
                "trong request từ *.pages.dev sang *.onrender.com, người dùng đăng nhập xong là mất phiên")
        elif khac_ten_mien:
            ghi(DAT, "Cookie phiên SameSite=None (đúng cho khác tên miền)")
        if be.startswith("https://") and not cookie.secure:
            ghi(HONG, "Cookie phiên thiếu cờ Secure khi API dùng HTTPS")

    # Đây là request quyết định khi giao diện và API khác tên miền: access token nằm trong bộ nhớ
    # (mất khi F5), muốn giữ phiên thì trình duyệt PHẢI gửi được cookie cm_phien sang API.
    ma, _, than = goi(f"{be}/api/auth/refresh", phuong_thuc="POST", du_lieu=b"",
                      tieu_de={"Origin": goc_fe, "Content-Type": "application/json"}, opener=opener)
    ghi(DAT if ma == 200 else HONG, "POST /api/auth/refresh (chỉ bằng cookie phiên)", f"HTTP {ma}")

    tieu_de_phien = {"Origin": goc_fe, "Authorization": f"Bearer {access_token}"}
    ma, _, than = goi(f"{be}/api/auth/me", opener=opener, tieu_de=tieu_de_phien)
    ghi(DAT if ma == 200 else HONG, "GET /api/auth/me (bằng access token)", f"HTTP {ma}")

    # 8. Vài API chính
    print("\n7. API chính (bằng access token)")
    for duong_dan in ("/api/students", "/api/teachers", "/api/nhat-ky", "/api/dashboard/tuan-nay"):
        ma, _, than = goi(f"{be}{duong_dan}", opener=opener, tieu_de=tieu_de_phien)
        ghi(DAT if ma == 200 else HONG, f"GET {duong_dan}", f"HTTP {ma}")

    # Tổng kết
    so_hong = sum(1 for trang_thai, _, _ in ket_qua if trang_thai == HONG)
    so_canh_bao = sum(1 for trang_thai, _, _ in ket_qua if trang_thai == CANH_BAO)
    print(f"\n{'=' * 60}\nTỔNG: {len(ket_qua)} mục — {len(ket_qua) - so_hong - so_canh_bao} đạt, "
          f"{so_hong} hỏng, {so_canh_bao} cảnh báo\n{'=' * 60}")
    if so_hong:
        print("\nCòn việc phải làm:")
        for trang_thai, ten, chi_tiet in ket_qua:
            if trang_thai == HONG:
                print(f"  - {ten}: {chi_tiet}")
    print("\nCòn phải tự kiểm bằng TRÌNH DUYỆT THẬT (máy khác, mạng khác):")
    print("  1. Mở giao diện, đăng nhập, bấm F5 ở /schedule và /nhat-ky → phải còn đăng nhập")
    print("  2. Mở DevTools > Network: mọi request phải đi tới tên miền API, KHÔNG có localhost")
    print("  3. Console không có lỗi CORS / mixed content")
    print("  4. Thêm/sửa/xoá thử 1 học sinh rồi tải lại trang")
    print("  5. Đăng xuất → về trang đăng nhập")
    return 1 if so_hong else 0


if __name__ == "__main__":
    sys.exit(main())
