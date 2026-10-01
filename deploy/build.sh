#!/usr/bin/env bash
# Đóng gói bản chạy thật: build giao diện → nhúng vào wwwroot của API → publish ra deploy/publish.
#
#   ./deploy/build.sh            # chỉ đóng gói
#   ./deploy/build.sh --chay     # đóng gói rồi chạy thử ở chế độ Production trên cổng 5080
#
# Bản chạy thật phục vụ giao diện và API trên CÙNG một tên miền (xem Program.cs): không cần CORS,
# cookie phiên SameSite=Lax hoạt động, và Google chỉ phải khai 2 redirect URI trên tên miền đó.
set -euo pipefail

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="$GOC/backend/ClassManagement.Api"
FE="$GOC/frontend"
XUAT="$GOC/deploy/publish"

# `dotnet` là chương trình Windows: nó KHÔNG hiểu đường dẫn kiểu MSYS (/c/...). Trên máy này phải đưa
# cho nó đường dẫn có ký tự ổ đĩa (C:/...), còn các lệnh của bash (rm, cp) thì vẫn dùng đường dẫn MSYS.
duong_dan_windows() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi
}

echo "== 1/3 Kiểm tra kiểu và build giao diện =="
cd "$FE"
npm run typecheck
npm run build

echo "== 2/3 Nhúng giao diện vào wwwroot của API =="
rm -rf "$API/wwwroot"
mkdir -p "$API/wwwroot"
cp -r "$FE/dist/." "$API/wwwroot/"
echo "   $(find "$API/wwwroot" -type f | wc -l) tệp trong wwwroot"

echo "== 3/3 Publish API =="
cd "$API"
rm -rf "$XUAT"
dotnet publish -c Release -o "$(duong_dan_windows "$XUAT")" --nologo -v q
echo "   xong: $XUAT"

# Bản publish đã có bản sao wwwroot của riêng nó. Dọn wwwroot trong mã nguồn để lần sau `dotnet run`
# ở máy dev không phục vụ nhầm một giao diện cũ đã build (máy dev xem giao diện ở Vite cổng 5173).
rm -rf "$API/wwwroot"

if [[ "${1:-}" == "--chay" ]]; then
  echo
  echo "Chạy ở chế độ Production (Ctrl+C để dừng). Cần biến môi trường bí mật — xem deploy/README.md:"
  echo "  Jwt__Key / Seed__Admin__MatKhau / ConnectionStrings__MacDinh"
  cd "$XUAT"
  ASPNETCORE_ENVIRONMENT=Production ASPNETCORE_URLS=http://localhost:5080 dotnet ClassManagement.Api.dll
fi
