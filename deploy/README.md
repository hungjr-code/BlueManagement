# Đưa ClassManagement lên máy chủ thật

Bản chạy thật dùng **một tên miền duy nhất** cho cả giao diện lẫn API. Đây không phải chuyện thẩm mỹ:
cookie phiên là `SameSite=Lax` và backend **không bật CORS**, nên nếu giao diện nằm ở tên miền khác API
(ví dụ `*.vercel.app` gọi `*.onrender.com`) thì trình duyệt sẽ **chặn cookie phiên** và người dùng đăng
nhập xong là mất phiên.

Cách làm: build giao diện rồi nhúng vào `wwwroot` của API — `Program.cs` tự phục vụ và tự trả
`index.html` cho mọi đường dẫn không phải API.

## 1. Chuẩn bị trên máy chủ

| Cần | Ghi chú |
|---|---|
| .NET 9 (ASP.NET Core Runtime) | Hoặc dùng image Docker `mcr.microsoft.com/dotnet/aspnet:9.0` |
| SQL Server (hoặc Azure SQL) | Giữ nguyên vì app dùng `Microsoft.Data.SqlClient` |
| Ổ đĩa **bền** cho khoá Data Protection | Thư mục này **phải nằm trong bản sao lưu** cùng database |
| HTTPS | Bắt buộc với Google khi không còn là `localhost` (Caddy/Nginx + Let's Encrypt, hoặc chứng chỉ của nền tảng) |

Biến môi trường **bắt buộc** (thay cho user-secrets của máy dev — máy chủ **không** đọc user-secrets):

```
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__MacDinh=Server=...;Database=ClassManagement;User Id=...;Password=...;Encrypt=True;TrustServerCertificate=False
Jwt__Key=<chuỗi ngẫu nhiên ≥32 ký tự>
Seed__Admin__MatKhau=<mật khẩu admin đầu tiên>
DataProtection__ThuMucKhoa=/var/classmanagement/khoa-bao-mat      (Windows: C:\ClassManagement\khoa-bao-mat)

# Chỉ khi dùng Google thật:
GoogleCalendar__ClientId=<client id>
GoogleCalendar__ClientSecret=<client secret>

# Chỉ khi gửi thư thật:
Email__SmtpHost / Email__SmtpPort / Email__SmtpTaiKhoan / Email__SmtpMatKhau / Email__TuDiaChi
```

Nếu chạy **sau reverse proxy** (Nginx/Caddy/App Service) thì thêm:

```
ASPNETCORE_FORWARDEDHEADERS_ENABLED=true
```

Thiếu biến này thì `Request.IsHttps` luôn là `false` và cookie phiên sẽ **không được gắn cờ `Secure`**
dù trình duyệt đang dùng HTTPS.

Sửa các chỗ `THAY-BANG-...` trong `appsettings.Production.json` (tệp này **không chứa bí mật**, chỉ có
địa chỉ và đường dẫn).

## 2. Đóng gói

```bash
./deploy/build.sh            # kiểm tra kiểu + build giao diện + nhúng wwwroot + publish ra deploy/publish
./deploy/build.sh --chay     # đóng gói rồi chạy thử ở chế độ Production ngay trên máy này
```

Kết quả là thư mục `deploy/publish` — copy nguyên thư mục đó lên máy chủ, chạy bằng:

```bash
ASPNETCORE_URLS=http://127.0.0.1:5080 dotnet ClassManagement.Api.dll
```

## 3. Tạo/cập nhật database (làm MỘT lần, trước khi chạy app)

Ở môi trường Production app **cố tình không tự chạy migration** khi khởi động (không để app tự sửa
database). Chạy tay từ máy có mã nguồn:

```bash
cd backend/ClassManagement.Api
ConnectionStrings__MacDinh="<chuỗi kết nối của máy chủ>" dotnet dotnet-ef database update
```

## 4. Kiểm tra sau khi lên

1. `GET https://<ten-mien>/api/health` → `database.canConnect = true`.
2. Mở `https://<ten-mien>/` → trang đăng nhập hiện ra (đây là giao diện tĩnh nằm cùng tên miền).
3. Đăng nhập admin → mở **Lịch dạy**, **Điểm danh**, **Học phí**, **Nhật ký**.
4. Đăng nhập bằng Google (nếu đã khai Client ID/Secret) → vào **Cài đặt** thấy "đã kết nối", vào **Lịch dạy** bấm *Đồng bộ* rồi mở Google Calendar xem sự kiện.
5. Chạy lại **một lần** các bộ kiểm thử trên máy chủ (chúng gọi `http://localhost:5080`, nên chạy ngay
   trên máy chủ hoặc qua SSH tunnel):
   ```bash
   cd backend && python kiem-thu-phase1.py    # 63 bước, không cần cấu hình gì thêm
   ```
   Bốn bộ còn lại: phase2 (48), phase4 (66), phase6 (37) chạy ở chế độ thật; phase3 (55) và phase5 (43)
   cần `GoogleCalendar__CheDoGia=true Email__CheDoGia=true` — **chỉ bật ở máy dev**, đừng bật trên máy chủ thật.

## 5. Google Cloud khi đã có tên miền

- Khai lại **cả hai** redirect URI theo tên miền thật:
  `https://<ten-mien>/api/auth/google/callback` và `https://<ten-mien>/api/google-calendar/callback`.
- Sửa `GoogleCalendar:RedirectUri`, `RedirectUriDangNhap`, `FrontendUrl` trong `appsettings.Production.json`.
- Chuyển OAuth consent screen sang **In production** (nếu để *Testing* mà xin quyền `calendar.events` thì
  refresh token **hết hạn sau 7 ngày**, giáo viên phải nối lại mỗi tuần).
- Ba ô App domain (home page / privacy policy / terms) giờ mới cần: đưa 3 trang trong `website/` lên
  một host tĩnh miễn phí (GitHub Pages / Cloudflare Pages) rồi dán link vào.

## 6. Sao lưu (đừng bỏ)

- **Database**: `BACKUP DATABASE ClassManagement TO DISK = '...'` theo lịch.
- **Thư mục khoá Data Protection** (`DataProtection:ThuMucKhoa`): mất thư mục này thì mọi refresh token
  Google đã lưu không giải mã được — tất cả giáo viên phải bấm kết nối lại.

## 7. Chạy tự động (systemd, ví dụ Linux)

```ini
[Unit]
Description=ClassManagement API
After=network.target

[Service]
WorkingDirectory=/opt/classmanagement
ExecStart=/usr/bin/dotnet /opt/classmanagement/ClassManagement.Api.dll
Restart=always
EnvironmentFile=/etc/classmanagement.env

[Install]
WantedBy=multi-user.target
```

## Ghi chú kỹ thuật đã có sẵn trong mã

- `Program.cs`: phục vụ giao diện từ `wwwroot` + fallback `index.html` (chỉ khi có `index.html`).
- `Program.cs`: `PersistKeysToFileSystem` khi có `DataProtection:ThuMucKhoa`.
- Cookie phiên tự gắn `Secure` khi request là HTTPS (`AuthController.TaoTuyChonCookie`).
- Ở Production app chỉ **cảnh báo** khi không kết nối được database, không tự migration.
