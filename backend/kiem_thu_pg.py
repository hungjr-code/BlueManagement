"""Chạy truy vấn SQL trên Postgres cho các script kiem-thu-phase*.py.

Chuỗi kết nối lấy từ user-secrets của ClassManagement.Api (khoá ConnectionStrings:MacDinh),
hoặc từ biến môi trường CM_PG nếu có (dùng khi thử với Postgres cục bộ trong Docker).

chay_sql(cau) nhận chuỗi gồm một hay nhiều câu lệnh Postgres cách nhau bằng ';' và trả về kết quả
dạng chuỗi giống sqlcmd trước đây: mỗi dòng một bản ghi, các cột cách nhau bằng dấu cách, NULL in
thành 'NULL'. Nhờ vậy các hàm bóc số 'CM=...' trong script kiểm thử giữ nguyên hình dạng.
"""
from __future__ import annotations

import json
import os
import re
import ssl

try:
    import pg8000.native
except ImportError:  # pragma: no cover
    raise SystemExit(
        "Thiếu thư viện pg8000. Cài bằng: python -m pip install pg8000"
    ) from None

ID_USER_SECRETS = "classmanagement-api-9f1c2a54"

_ket_noi = None
_tham_so: dict | None = None


def _boc_tach(kv: str) -> dict[str, str]:
    """Bóc chuỗi kết nối kiểu 'Host=...;Port=...;...' thành dict (giá trị có thể bọc nháy đơn)."""

    ket_qua: dict[str, str] = {}
    for manh in re.split(r";(?=(?:[^']*'[^']*')*[^']*$)", kv):
        if "=" not in manh:
            continue
        ten, gia_tri = manh.split("=", 1)
        gia_tri = gia_tri.strip()
        if len(gia_tri) >= 2 and gia_tri[0] == gia_tri[-1] and gia_tri[0] in "'\"":
            gia_tri = gia_tri[1:-1].replace("''", "'")
        ket_qua[ten.strip().lower()] = gia_tri
    return ket_qua


def _doc_chuoi_tu_user_secrets() -> str:
    goc = os.path.join(
        os.environ.get("APPDATA", os.path.expanduser("~")), "Microsoft", "UserSecrets")
    ung_vien: list[str] = []
    uu_tien = os.path.join(goc, ID_USER_SECRETS, "secrets.json")
    if os.path.isfile(uu_tien):
        ung_vien.append(uu_tien)
    if os.path.isdir(goc):
        for ten in sorted(os.listdir(goc)):
            duong_dan = os.path.join(goc, ten, "secrets.json")
            if os.path.isfile(duong_dan) and duong_dan not in ung_vien:
                ung_vien.append(duong_dan)
    for duong_dan in ung_vien:
        try:
            with open(duong_dan, encoding="utf-8-sig") as tep:
                du_lieu = json.load(tep)
        except Exception:
            continue
        if du_lieu.get("ConnectionStrings:MacDinh"):
            return du_lieu["ConnectionStrings:MacDinh"]
    raise SystemExit(
        "Không tìm thấy ConnectionStrings:MacDinh trong user-secrets. "
        "Đặt biến môi trường CM_PG thay thế cũng được.")


def _doc_tham_so() -> dict:
    chuoi = os.environ.get("CM_PG") or _doc_chuoi_tu_user_secrets()
    c = _boc_tach(chuoi)
    tham_so: dict = {
        "user": c.get("username") or c.get("user id"),
        "password": c.get("password"),
        "host": c.get("host") or c.get("server"),
        "port": int(c.get("port") or 5432),
        "database": c.get("database") or c.get("initial catalog") or "postgres",
    }
    if (c.get("ssl mode") or c.get("sslmode") or "").lower() in ("require", "verify-ca", "verify-full"):
        ngu_canh = ssl.create_default_context()
        if (c.get("trust server certificate") or "").strip().lower() in ("true", "1", "yes"):
            ngu_canh.check_hostname = False
            ngu_canh.verify_mode = ssl.CERT_NONE
        tham_so["ssl_context"] = ngu_canh
    return tham_so


def _mo_ket_noi():
    global _ket_noi, _tham_so
    if _tham_so is None:
        _tham_so = _doc_tham_so()
    if _ket_noi is None:
        _ket_noi = pg8000.native.Connection(**_tham_so)
    return _ket_noi


def _chay_mot(cau: str):
    global _ket_noi
    try:
        ket_qua = _mo_ket_noi().run(cau)
    except Exception:
        # Kết nối có thể đã bị đóng sau một lúc rảnh — mở lại rồi thử đúng một lần nữa.
        try:
            if _ket_noi is not None:
                _ket_noi.close()
        except Exception:
            pass
        _ket_noi = None
        ket_qua = _mo_ket_noi().run(cau)
    return ket_qua


def chay_sql(cau: str) -> str:
    """Chạy lần lượt từng câu lệnh; trả về mọi dòng của mọi câu SELECT, giống sqlcmd trước đây."""

    cau = re.sub(r"(?i)\bSET\s+NOCOUNT\s+ON\s*;", "", cau)
    dong: list[str] = []
    for mot in cau.split(";"):
        mot = mot.strip()
        if not mot:
            continue
        for ban_ghi in (_chay_mot(mot) or []):
            dong.append(" ".join("NULL" if gia_tri is None else str(gia_tri) for gia_tri in ban_ghi))
    return "\n".join(dong) + ("\n" if dong else "")
