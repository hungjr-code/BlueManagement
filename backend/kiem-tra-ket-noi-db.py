"""Kiểm tra một chuỗi kết nối Postgres (Supabase) có DÙNG ĐƯỢC thật hay không.

Trả lời đúng câu hỏi "đã nạp database lên Supabase rồi mà không biết có chạy được không", và nói
rõ nguyên nhân khi không chạy được — thay vì chỉ báo "kết nối thất bại".

    cd backend
    python kiem-tra-ket-noi-db.py                     # kiểm chuỗi đang lưu trong user-secrets
    python kiem-tra-ket-noi-db.py --hoi               # dán chuỗi mới (không lộ ra màn hình lệnh)
    python kiem-tra-ket-noi-db.py --hoi --luu         # dán, LƯU vào user-secrets, rồi kiểm lại
    python kiem-tra-ket-noi-db.py --hoi --luu --migrate   # thêm: chạy dotnet ef database update

Mật khẩu không bao giờ được in ra (chỉ hiện độ dài). Mã thoát: 0 = dùng được, 2 = không dùng được.
"""
from __future__ import annotations

import argparse
import os
import re
import socket
import ssl
import subprocess
import sys

try:
    import pg8000.native as pg
except ImportError:  # pragma: no cover
    raise SystemExit("Thiếu thư viện pg8000. Cài bằng: python -m pip install pg8000")

THU_MUC_API = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ClassManagement.Api")
DOTNET = os.environ.get("DOTNET_EXE") or "dotnet"
BANG_CAN_XEM = ("GiaoVien", "HocSinh", "BuoiHoc", "HocPhi", "NhatKy", "__EFMigrationsHistory")


def doc_tu_user_secrets() -> str | None:
    """Đọc ConnectionStrings:MacDinh từ user-secrets (không in giá trị)."""
    try:
        out = subprocess.run([DOTNET, "user-secrets", "list"], cwd=THU_MUC_API,
                             capture_output=True, text=True, encoding="utf-8").stdout
    except FileNotFoundError:
        return None
    for dong in out.splitlines():
        if dong.startswith("ConnectionStrings:MacDinh = "):
            return dong.split(" = ", 1)[1].strip()
    return None


def luu_vao_user_secrets(chuoi: str) -> bool:
    for ten in ("ConnectionStrings:MacDinh", "ConnectionStrings:Supabase"):
        r = subprocess.run([DOTNET, "user-secrets", "set", ten, chuoi], cwd=THU_MUC_API,
                           capture_output=True, text=True, encoding="utf-8")
        if r.returncode != 0:
            print("  KHÔNG lưu được", ten, "->", (r.stderr or "").strip()[:200])
            return False
    print("  đã lưu ConnectionStrings:MacDinh và ConnectionStrings:Supabase (giá trị không in ra)")
    return True


def boc_tach(chuoi: str) -> dict[str, str]:
    ket_qua: dict[str, str] = {}
    for manh in re.split(r";(?=(?:[^']*'[^']*')*[^']*$)", chuoi):
        if "=" not in manh:
            continue
        ten, gia_tri = manh.split("=", 1)
        gia_tri = gia_tri.strip().strip("'\"")
        ket_qua[ten.strip().lower().replace(" ", "")] = gia_tri
    return ket_qua


def phan_tich_loi(loi: Exception, host: str) -> str:
    """Dịch lỗi của driver/thư viện thành câu nói rõ phải làm gì."""
    chuoi = str(loi)
    if "tenant/user" in chuoi and "not found" in chuoi:
        return (
            "Pooler của Supabase KHÔNG biết project này (tenant/user not found).\n"
            "  Nghĩa là: project đã bị XOÁ, đang bị TẠM DỪNG (gói free tự dừng sau ~1 tuần không dùng),\n"
            "  hoặc project-ref trong chuỗi bị sai.\n"
            "  Việc cần làm: mở https://supabase.com/dashboard — nếu project còn mà đang 'Paused' thì bấm\n"
            "  Restore; nếu không còn thì tạo project mới, rồi lấy lại chuỗi 'Shared pooler' và chạy lại\n"
            "  lệnh này với --hoi --luu --migrate."
        )
    if "28P01" in chuoi or "password authentication failed" in chuoi:
        return (
            "Sai MẬT KHẨU (pooler in tên role là 'postgres', không in 'postgres.<ref>' — đừng tưởng sai\n"
            "  username). Lấy lại mật khẩu ở Supabase > Project Settings > Database > Reset database password."
        )
    if "ENOTFOUND" in chuoi or "getaddrinfo" in chuoi:
        return f"Không phân giải được tên miền '{host}' — sai host, hoặc project không còn tồn tại."
    if "timeout" in chuoi.lower() or "timed out" in chuoi.lower():
        return ("Hết thời gian chờ — thường là sai cổng (pooler dùng 5432), sai vùng (region), hoặc mạng "
                "công ty chặn cổng 5432.")
    if "SSL" in chuoi or "ssl" in chuoi:
        return "Lỗi SSL — chuỗi cần 'SSL Mode=Require;Trust Server Certificate=true'."
    return "Lỗi chưa gặp: " + chuoi[:300]


def kiem(chuoi: str) -> int:
    kv = boc_tach(chuoi)
    host = kv.get("host", "")
    port = int(kv.get("port", "5432"))
    db = kv.get("database", "postgres")
    user = kv.get("username", "postgres")
    mat_khau = kv.get("password", "")
    la_pooler = "pooler.supabase.com" in host
    print(f"  host={host}  port={port}  database={db}")
    print(f"  user={user.split('.')[0] + '.<project-ref>' if '.' in user else user}  "
          f"mật khẩu: {len(mat_khau)} ký tự (không in)")
    print(f"  kiểu kết nối: {'pooler Supabase' if la_pooler else 'trực tiếp / Postgres khác'}")
    if la_pooler and "." not in user:
        print("  ! Pooler yêu cầu username dạng 'postgres.<project-ref>' — thiếu phần sau dấu chấm.")

    print("\n[1/4] Phân giải tên miền")
    try:
        ip = sorted({i[4][0] for i in socket.getaddrinfo(host, None)})
        print(f"  OK -> {', '.join(ip[:3])}")
    except Exception as e:
        print(f"  THẤT BẠI: {type(e).__name__}")
        print("  " + phan_tich_loi(e, host))
        if la_pooler and "." in user:
            ref = user.split(".", 1)[1]
            print(f"\n  Thử thêm: tên miền của project là {ref}.supabase.co — nếu tên đó cũng không phân giải "
                  f"được thì project đã bị xoá.")
        return 2

    # Tôn trọng "SSL Mode" trong chuỗi: Postgres cục bộ trong Docker thường KHÔNG bật SSL, còn Supabase
    # thì bắt buộc. Ép SSL cho mọi chuỗi sẽ báo lỗi oan cho database cục bộ (InterfaceError).
    che_do_ssl = kv.get("sslmode", "").lower()
    dung_ssl = che_do_ssl not in ("disable", "allow")
    print(f"\n[2/4] Kết nối ({'có SSL' if dung_ssl else 'không SSL (SSL Mode=Disable)'})")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        con = pg.Connection(user=user, password=mat_khau, host=host, port=port, database=db,
                            ssl_context=ctx if dung_ssl else None, timeout=25)
    except Exception as e:
        print(f"  THẤT BẠI: {type(e).__name__}")
        print("  " + phan_tich_loi(e, host))
        return 2
    print("  OK")
    print("  server:", con.run("select version()")[0][0][:70])

    print("\n[3/4] Bảng và dữ liệu")
    bang = [r[0] for r in con.run(
        "select tablename from pg_tables where schemaname='public' order by 1")]
    print(f"  {len(bang)} bảng trong schema public")
    if not bang:
        print("  Database TRỐNG — chưa nạp schema. Chạy: python kiem-tra-ket-noi-db.py --hoi --luu --migrate")
    for ten in BANG_CAN_XEM:
        if ten in bang:
            n = con.run(f'select count(*) from "{ten}"')[0][0]
            print(f"    {ten}: {n} dòng")
    if "__EFMigrationsHistory" in bang:
        print("  migration đã áp:", [r[0] for r in con.run(
            'select "MigrationId" from "__EFMigrationsHistory" order by 1')])

    print("\n[4/4] Kết luận")
    if "GiaoVien" in bang and "__EFMigrationsHistory" in bang:
        so_gv = con.run('select count(*) from "GiaoVien"')[0][0]
        print(f"  DÙNG ĐƯỢC. Có {so_gv} tài khoản giáo viên."
              + (" (0 tài khoản: máy chủ sẽ tự tạo admin khi khởi động, cần Seed__Admin__MatKhau.)"
                 if so_gv == 0 else ""))
        return 0
    print("  Kết nối được nhưng SCHEMA CHƯA ĐỦ — chạy migration rồi kiểm lại.")
    return 2


def chay_migration(chuoi: str) -> int:
    print("\n== dotnet ef database update (trỏ vào chuỗi vừa nhập) ==")
    env = dict(os.environ)
    env["ConnectionStrings__MacDinh"] = chuoi
    r = subprocess.run([DOTNET, "dotnet-ef", "database", "update"], cwd=THU_MUC_API, env=env,
                       capture_output=True, text=True, encoding="utf-8")
    cuoi = [d for d in (r.stdout or "").splitlines() if d.strip()][-6:]
    print("\n".join("  " + d for d in cuoi))
    if r.returncode != 0:
        print("  THẤT BẠI (mã", r.returncode, "):")
        print("\n".join("  " + d for d in (r.stderr or "").splitlines()[-8:]))
    return r.returncode


def main() -> int:
    ap = argparse.ArgumentParser(description="Kiểm tra chuỗi kết nối Postgres/Supabase.")
    ap.add_argument("--hoi", action="store_true", help="hỏi và dán chuỗi mới thay vì đọc user-secrets")
    ap.add_argument("--luu", action="store_true", help="lưu chuỗi vừa dán vào user-secrets")
    ap.add_argument("--migrate", action="store_true", help="chạy dotnet ef database update với chuỗi đó")
    ap.add_argument("--chuoi", help="chuỗi kết nối (cẩn thận: sẽ nằm trong lịch sử lệnh)")
    tham_so = ap.parse_args()

    if tham_so.chuoi:
        chuoi = tham_so.chuoi
    elif tham_so.hoi:
        print("Dán chuỗi kết nối Postgres (Supabase > Connect > Shared pooler > URI/Parameters), rồi Enter:")
        chuoi = sys.stdin.readline().strip()
    else:
        chuoi = doc_tu_user_secrets()
        if not chuoi:
            print("Không đọc được ConnectionStrings:MacDinh trong user-secrets. Dùng --hoi để dán chuỗi mới.")
            return 2
        print("Đang kiểm chuỗi trong user-secrets của backend (không in giá trị).")

    if not chuoi or "host=" not in chuoi.lower():
        print("Chuỗi không hợp lệ: phải có dạng 'Host=...;Port=...;Database=...;Username=...;Password=...'")
        return 2

    ma = kiem(chuoi)
    if tham_so.luu:
        print("\n== Lưu vào user-secrets ==")
        if not luu_vao_user_secrets(chuoi):
            return 2
    if tham_so.migrate:
        if chay_migration(chuoi) != 0:
            return 2
        print("\n== Kiểm lại sau khi chạy migration ==")
        ma = kiem(chuoi)
    return ma


if __name__ == "__main__":
    sys.exit(main())
