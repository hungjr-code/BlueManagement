#!/usr/bin/env bash
# Kiểm thử đầu-cuối Phase 1. Mật khẩu đọc từ user-secrets, KHÔNG in ra màn hình.
set -u
API=http://localhost:5080
T="C:/Users/Admin/AppData/Local/Temp/cm-smoke"
mkdir -p "$T"
cd /c/Joel_vh/ClassManagement/backend/ClassManagement.Api

doc_json() { python -c "import json,sys;d=json.load(open(sys.argv[1]));$1" "$2"; }
ma() { curl -s -o "$T/out.json" -w '%{http_code}' "$@"; }
dong() { echo "  $1"; }

PW="$(dotnet user-secrets list 2>/dev/null | grep 'Seed:Admin:MatKhau' | sed 's/.*= //')"
ADMIN_EMAIL="admin@classmanagement.local"
GV_EMAIL="giao.vien.mau@classmanagement.local"

echo "== 1. GET /api/health (không cần đăng nhập) =="
MA_HEALTH=$(ma "$API/api/health")
doc_json "print('  HTTP', '$MA_HEALTH', '| status:', d['status'], '| db:', d['database']['canConnect'], d['database']['provider'], '| version:', d['version'], '| env:', d['environment'])" "$T/out.json"

echo "== 2. GET /api/students khi chưa đăng nhập (phải 401) =="
echo "  HTTP $(ma "$API/api/students")"

echo "== 3. Đăng nhập admin =="
echo "  HTTP $(ma -c "$T/cookie_admin.txt" -X POST "$API/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"matKhau\":\"$PW\"}")"
doc_json "print('  ', d['nguoiDung']['hoTen'], '| vaiTro:', d['nguoiDung']['vaiTro'], '| accessToken:', len(d['accessToken']), 'ký tự | hết hạn:', d['hetHanUtc'][:19])" "$T/out.json"
TOKEN_ADMIN=$(doc_json "print(d['accessToken'])" "$T/out.json")

echo "== 4. GET /api/auth/me =="
echo "  HTTP $(ma -H "Authorization: Bearer $TOKEN_ADMIN" "$API/api/auth/me")"
doc_json "print('  vaiTro:', d['vaiTro'], '| trangThai:', d['trangThai'])" "$T/out.json"

echo "== 5. Admin xem học sinh / giáo viên / cài đặt =="
echo "  GET /api/students -> HTTP $(ma -H "Authorization: Bearer $TOKEN_ADMIN" "$API/api/students?kichThuoc=50")"
doc_json "print('  tổng số:', d['tongSo'], '| dòng đầu:', d['duLieu'][0]['hoTen'], '| giáo viên:', d['duLieu'][0]['tenGiaoVien'], '| lịch:', [k['thu'] for k in d['duLieu'][0]['lichHoc']])" "$T/out.json"
echo "  GET /api/teachers -> HTTP $(ma -H "Authorization: Bearer $TOKEN_ADMIN" "$API/api/teachers")"
doc_json "print('  tổng số:', d['tongSo'], '| ', [(g['hoTen'], g['vaiTro'], g['soHocSinhDangPhuTrach']) for g in d['duLieu']])" "$T/out.json"
echo "  GET /api/settings -> HTTP $(ma -H "Authorization: Bearer $TOKEN_ADMIN" "$API/api/settings")"
doc_json "print('  múi giờ:', d['muiGio'], '| đã khai tài khoản nhận tiền:', d['daCauHinhTaiKhoanNhanTien'], '| vai trò mặc định:', d['vaiTroMacDinh'])" "$T/out.json"

echo "== 6. Admin lưu cài đặt rồi đọc lại =="
echo "  PUT /api/settings -> HTTP $(ma -X PUT "$API/api/settings" -H "Authorization: Bearer $TOKEN_ADMIN" -H 'Content-Type: application/json' -d '{"nganHangBin":"970436","soTaiKhoan":"0123456789","chuTaiKhoan":"NGUYEN VAN A","nhacTruocBaoLauPhut":45,"mauNoiDungChuyenKhoan":"{tenHocSinh} - Hoc phi {thang}"}')"
doc_json "print('  đã lưu:', d['nganHangBin'], d['soTaiKhoan'], d['chuTaiKhoan'], '| nhắc trước', d['nhacTruocBaoLauPhut'], 'phút | đã khai tài khoản:', d['daCauHinhTaiKhoanNhanTien'])" "$T/out.json"
echo "  GET lại /api/settings -> HTTP $(ma -H "Authorization: Bearer $TOKEN_ADMIN" "$API/api/settings")"
doc_json "print('  đọc lại từ database:', d['nganHangBin'], d['soTaiKhoan'], d['chuTaiKhoan'], '| múi giờ:', d['muiGio'])" "$T/out.json"
echo "  PUT cài đặt với BIN sai (phải 400 kèm lỗi theo field) -> HTTP $(ma -X PUT "$API/api/settings" -H "Authorization: Bearer $TOKEN_ADMIN" -H 'Content-Type: application/json' -d '{"nganHangBin":"99"}')"
doc_json "print('  ', d.get('title'), '| errors:', d.get('errors'))" "$T/out.json"

echo "== 7. Admin tạo giáo viên thứ hai =="
PW2="Aa1$(tr -dc 'a-z0-9' < /dev/urandom | head -c 12)"
echo "  POST /api/teachers -> HTTP $(ma -X POST "$API/api/teachers" -H "Authorization: Bearer $TOKEN_ADMIN" -H 'Content-Type: application/json' -d "{\"hoTen\":\"Giáo viên kiểm thử\",\"email\":\"gv.kiem.thu@classmanagement.local\",\"matKhauTamThoi\":\"$PW2\"}")"
doc_json "print('  tạo được:', d['hoTen'], '| vaiTro:', d['vaiTro'], '(bỏ trống vaiTro thì mặc định là giáo viên)')" "$T/out.json"
GV2_ID=$(doc_json "print(d['id'])" "$T/out.json")

echo "== 8. Đăng nhập giáo viên thứ hai và kiểm tra phạm vi dữ liệu =="
echo "  login -> HTTP $(ma -c "$T/cookie_gv2.txt" -X POST "$API/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"gv.kiem.thu@classmanagement.local\",\"matKhau\":\"$PW2\"}")"
doc_json "print('  vaiTro:', d['nguoiDung']['vaiTro'])" "$T/out.json"
TOKEN_GV2=$(doc_json "print(d['accessToken'])" "$T/out.json")
echo "  giáo viên này xem /api/students -> HTTP $(ma -H "Authorization: Bearer $TOKEN_GV2" "$API/api/students")"
doc_json "print('  thấy', d['tongSo'], 'học sinh (đúng: 0, vì chưa phụ trách ai)')" "$T/out.json"
HS_ID=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" "$API/api/students" | python -c "import json,sys;print(json.load(sys.stdin)['duLieu'][0]['id'])")
echo "  giáo viên này xem học sinh của người khác -> HTTP $(ma -H "Authorization: Bearer $TOKEN_GV2" "$API/api/students/$HS_ID") (phải 404, không phải 403)"
doc_json "print('  ', d.get('title'))" "$T/out.json"
echo "  giáo viên này xem /api/teachers -> HTTP $(ma -H "Authorization: Bearer $TOKEN_GV2" "$API/api/teachers")"
doc_json "print('  thấy', d['tongSo'], 'giáo viên (chỉ chính mình)')" "$T/out.json"
echo "  giáo viên này gọi PUT /api/settings -> HTTP $(ma -X PUT "$API/api/settings" -H "Authorization: Bearer $TOKEN_GV2" -H 'Content-Type: application/json' -d '{"nhacTruocBaoLauPhut":5}') (phải 403)"
doc_json "print('  ', d.get('title'))" "$T/out.json"
echo "  giáo viên này tự tạo giáo viên khác -> HTTP $(ma -X POST "$API/api/teachers" -H "Authorization: Bearer $TOKEN_GV2" -H 'Content-Type: application/json' -d '{"hoTen":"Ke gian","email":"ke.gian@classmanagement.local","matKhauTamThoi":"Aa123456"}') (phải 403)"

echo "== 9. Xoay vòng refresh token qua cookie =="
echo "  POST /api/auth/refresh (cookie admin) -> HTTP $(ma -b "$T/cookie_admin.txt" -c "$T/cookie_admin.txt" -X POST "$API/api/auth/refresh")"
doc_json "print('  cấp access token mới, dài', len(d['accessToken']), 'ký tự')" "$T/out.json"

echo "== 10. Đổi vai trò + khoá tài khoản giáo viên thứ hai =="
echo "  PUT /api/teachers/$GV2_ID (đặt da_nghi) -> HTTP $(ma -X PUT "$API/api/teachers/$GV2_ID" -H "Authorization: Bearer $TOKEN_ADMIN" -H 'Content-Type: application/json' -d '{"hoTen":"Giáo viên kiểm thử","vaiTro":"giao_vien","trangThai":"da_nghi"}')"
doc_json "print('  trạng thái mới:', d['trangThai'], '| còn phụ trách:', d['soHocSinhDangPhuTrach'], 'học sinh')" "$T/out.json"
echo "  giáo viên đã nghỉ đăng nhập lại -> HTTP $(ma -X POST "$API/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"gv.kiem.thu@classmanagement.local\",\"matKhau\":\"$PW2\"}") (phải 403)"
doc_json "print('  ', d.get('title'), '—', d.get('detail'))" "$T/out.json"
echo "  đăng nhập sai mật khẩu -> HTTP $(ma -X POST "$API/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"matKhau\":\"sai-mat-khau\"}") (phải 401)"
doc_json "print('  ', d.get('title'))" "$T/out.json"

echo "== 11. Nhật ký thao tác nhạy cảm =="
sqlcmd -S '.\SQLEXPRESS' -d ClassManagement -E -W -Q "SET NOCOUNT ON; SELECT HanhDong, DoiTuong, ISNULL(DuLieuSau,'-') AS Sau FROM NhatKy ORDER BY ThoiDiemUtc;" | head -12

echo "== 12. Giá trị enum lưu trong database =="
sqlcmd -S '.\SQLEXPRESS' -d ClassManagement -E -W -Q "SET NOCOUNT ON; SELECT HoTen, cachTinhHocPhi, trangThai FROM HocSinh; SELECT HoTen, vaiTro, trangThai FROM GiaoVien;"

echo "== 13. Đăng xuất và dùng lại cookie cũ =="
echo "  POST /api/auth/logout -> HTTP $(ma -b "$T/cookie_admin.txt" -X POST "$API/api/auth/logout")"
echo "  refresh bằng cookie đã thu hồi -> HTTP $(ma -b "$T/cookie_admin.txt" -X POST "$API/api/auth/refresh") (phải 401)"
doc_json "print('  ', d.get('title'))" "$T/out.json"
