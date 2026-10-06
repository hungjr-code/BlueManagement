"""Chuẩn bị dữ liệu nền cho các bộ kiểm thử (chạy TRƯỚC phase3/phase4).

Trên một database mới, bộ kiểm thử cần có "giáo viên thứ hai" — cô Hà — để phase 4 kiểm chuyện
giáo viên chỉ nhìn thấy học sinh của mình, và để tổng hợp doanh thu có ít nhất hai giáo viên.
Script này:
  1. Tạo tài khoản co.ha@classmanagement.local với mật khẩu trong user-secrets (nếu chưa có).
  2. Tạo cho cô ấy một học sinh có lịch học các ngày trong tuần, bắt đầu từ đầu tháng này —
     nhờ vậy học phí của cô Hà xuất hiện trong kỳ đang kiểm tra.
  3. Kiểm tra lại bằng API điểm danh: học sinh đó có buổi trong tháng này thật.

Chạy:  cd backend && python kiem-thu-chuan-bi.py      (API phải đang chạy ở http://localhost:5080)
Chạy lại được nhiều lần: có rồi thì bỏ qua, không tạo trùng.
"""
from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date

API = "http://localhost:5080"
THU_MUC_API = r"c:\Joel_vh\ClassManagement\backend\ClassManagement.Api"
EMAIL_ADMIN = "admin@classmanagement.local"
EMAIL_CO_HA = "co.ha@classmanagement.local"
TEN_CO_HA = "Cô Nguyễn Thu Hà"
TEN_HOC_SINH = "Học sinh Cô Hà"


def doc_bi_mat() -> dict[str, str]:
    out = subprocess.run(["dotnet", "user-secrets", "list"], cwd=THU_MUC_API,
                         capture_output=True, text=True, encoding="utf-8").stdout
    ket_qua: dict[str, str] = {}
    for dong in out.splitlines():
        if " = " in dong:
            ten, gia_tri = dong.split(" = ", 1)
            ket_qua[ten.strip()] = gia_tri.strip()
    return ket_qua


def goi(duong_dan: str, *, method: str = "GET", body=None, token: str | None = None):
    du_lieu = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    yeu_cau = urllib.request.Request(API + duong_dan, data=du_lieu, method=method)
    yeu_cau.add_header("Content-Type", "application/json; charset=utf-8")
    if token:
        yeu_cau.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(yeu_cau, timeout=30) as phan_hoi:
            than = phan_hoi.read().decode("utf-8")
            return phan_hoi.status, (json.loads(than) if than.strip().startswith(("{", "[")) else than)
    except urllib.error.HTTPError as loi:
        than = loi.read().decode("utf-8")
        return loi.code, (json.loads(than) if than.strip().startswith(("{", "[")) else than)


def main() -> int:
    bi_mat = doc_bi_mat()
    mat_khau_admin = bi_mat.get("Seed:Admin:MatKhau")
    mat_khau_ha = bi_mat.get("TaiKhoanThuNghiem:GiaoVien1:MatKhau")
    if not mat_khau_admin or not mat_khau_ha:
        raise SystemExit("Thiếu Seed:Admin:MatKhau hoặc TaiKhoanThuNghiem:GiaoVien1:MatKhau trong user-secrets.")

    ma, than = goi("/api/auth/login", method="POST", body={"email": EMAIL_ADMIN, "matKhau": mat_khau_admin})
    if ma != 200:
        raise SystemExit(f"Không đăng nhập được admin (HTTP {ma})")
    token_admin = than["accessToken"]

    # 1. Tài khoản cô Hà
    ma, ds = goi("/api/teachers?kichThuoc=100", token=token_admin)
    if ma != 200:
        raise SystemExit(f"Không đọc được danh sách giáo viên (HTTP {ma})")
    ha = next((g for g in ds["duLieu"] if g["email"] == EMAIL_CO_HA), None)
    if ha is None:
        ma, ha = goi("/api/teachers", method="POST", token=token_admin, body={
            "hoTen": TEN_CO_HA, "email": EMAIL_CO_HA, "matKhauTamThoi": mat_khau_ha})
        print(f"[1] tao co Ha -> HTTP {ma}")
        if ma != 201:
            raise SystemExit("Không tạo được tài khoản cô Hà: " + json.dumps(ha, ensure_ascii=False))
    else:
        print("[1] co Ha da co san")

    # 2. Đăng nhập cô Hà, đảm bảo có học sinh với lịch các ngày trong tuần từ đầu tháng này
    ma, than = goi("/api/auth/login", method="POST", body={"email": EMAIL_CO_HA, "matKhau": mat_khau_ha})
    if ma != 200:
        raise SystemExit(
            f"Không đăng nhập được cô Hà (HTTP {ma}) — mật khẩu trong user-secrets có thể đã cũ.")
    token_ha = than["accessToken"]

    ma, ds_hs = goi("/api/students?kichThuoc=100", token=token_ha)
    hs_cu = next((h for h in ds_hs["duLieu"] if h["hoTen"] == TEN_HOC_SINH), None)
    dau_thang = date.today().replace(day=1)
    lich = [{"thu": t, "gioBatDau": "16:00:00", "gioKetThuc": "17:00:00"}
            for t in ("thu_2", "thu_3", "thu_4", "thu_5", "thu_6")]
    if hs_cu is None:
        ma, hs = goi("/api/students", method="POST", token=token_ha, body={
            "hoTen": TEN_HOC_SINH, "cachTinhHocPhi": "theo_buoi", "donGiaTheoBuoi": 180000,
            "soBuoiMoiTuan": 5, "ngayDenHanDongTien": 5, "ngayBatDau": dau_thang.isoformat(),
            "phuHuynh": "Phụ huynh Cô Hà", "soDienThoaiPhuHuynh": "0900000004", "lichHoc": lich})
        print(f"[2] tao hoc sinh co Ha -> HTTP {ma}")
        if ma != 201:
            raise SystemExit("Không tạo được học sinh: " + json.dumps(hs, ensure_ascii=False))
        hs_id = hs["id"]
    else:
        hs_id = hs_cu["id"]
        ma, hs = goi(f"/api/students/{hs_id}", method="PUT", token=token_ha, body={
            "hoTen": TEN_HOC_SINH, "cachTinhHocPhi": "theo_buoi", "donGiaTheoBuoi": 180000,
            "soBuoiMoiTuan": 5, "ngayDenHanDongTien": 5, "ngayBatDau": str(hs_cu["ngayBatDau"]),
            "phuHuynh": "Phụ huynh Cô Hà", "soDienThoaiPhuHuynh": "0900000004",
            "trangThai": hs_cu.get("trangThai", "dang_hoc"), "lichHoc": lich})
        print(f"[2] cap nhat hoc sinh co Ha -> HTTP {ma}")

    # 3. Kiểm tra thật: học sinh có buổi trong tháng này (điều kiện để phase4 thấy học phí)
    ma, diem_danh = goi(f"/api/attendance?tuNgay={dau_thang}&denNgay={date.today()}", token=token_ha)
    so_buoi = len([b for b in diem_danh.get("duLieu", []) if b["hocSinhId"] == hs_id])
    print(f"[3] hoc sinh co {so_buoi} buoi trong thang nay (api diem danh)")
    if so_buoi < 1:
        raise SystemExit("Học sinh cô Hà chưa có buổi nào trong tháng này — dữ liệu nền chưa đạt.")
    print("OK — dữ liệu nền đã sẵn sàng.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
