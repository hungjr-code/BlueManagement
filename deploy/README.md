# Đưa ClassManagement lên máy chủ thật

Bản chạy thật dùng **một tên miền duy nhất** cho cả giao diện lẫn API. Đây không phải chuyện thẩm mỹ:
cookie phiên là `SameSite=Lax` và backend **không bật CORS**, nên nếu giao diện nằm ở tên miền khác API
(ví dụ `*.github.io` gọi `*.onrender.com`) thì trình duyệt sẽ **chặn cookie phiên** — người dùng đăng
nhập xong là mất phiên.

Cách làm: build giao diện rồi nhúng vào `wwwroot` của API — `Program.cs` tự phục vụ và tự trả
`index.html` cho mọi đường dẫn không phải API. Vì vậy **không cần** GitHub Pages cho giao diện; thư mục
`website/` chỉ dùng cho 3 trang tĩnh Google yêu cầu (trang chủ + quyền riêng tư + điều khoản).

## Kiến trúc đang dùng

| Thành phần | Ở đâu | Ghi chú |
|---|---|---|
| Giao diện + API | **Một** web service Docker (Render free) | `deploy/render/Dockerfile`, context = gốc repo |
| Database | **PostgreSQL trên Supabase** (free) | Shared/Session pooler, có SSL |
| Mã nguồn | GitHub `hungjr-code/BlueManagement` | Render tự kéo code từ đây |

Nền tảng khác (Azure App Service + Azure SQL, VPS) đều chạy được với cùng Dockerfile; chỉ khác nơi
cấu hình biến môi trường.

## 1. Biến môi trường (máy chủ KHÔNG đọc user-secrets)

Ở Production mọi giá trị phải đặt bằng biến môi trường của host:

```
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_FORWARDEDHEADERS_ENABLED=true          # bắt buộc sau reverse proxy, nếu không cookie phiên không có cờ Secure

ConnectionStrings__MacDinh=Host=aws-0-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.<ref>;Password=<mk>;SSL Mode=Require;Trust Server Certificate=true
Jwt__Key=<chuỗi ngẫu nhiên ≥32 ký tự>
Seed__Admin__MatKhau=<mật khẩu admin đầu tiên>
DataProtection__ThuMucKhoa=/app/khoa-bao-mat

# Chỉ khi dùng Google thật:
GoogleCalendar__ClientId=<client id>
GoogleCalendar__ClientSecret=<client secret>
GoogleCalendar__RedirectUri=https://<ten-mien>/api/google-calendar/callback
GoogleCalendar__RedirectUriDangNhap=https://<ten-miền>/api/auth/google/callback
GoogleCalendar__FrontendUrl=https://<ten-mien>

# Chỉ khi gửi thư thật (quên mật khẩu):
Email__SmtpHost / Email__SmtpPort / Email__SmtpTaiKhoan / Email__SmtpMatKhau / Email__TuDiaChi
```

Các chỗ `THAY-BANG-...` trong `appsettings.Production.json` (tệp này **không chứa bí mật**, chỉ có địa
chỉ và đường dẫn) phải được thay hoặc để biến môi trường đè lên.

## 2. Đóng gói

```bash
./deploy/build.sh            # kiểm tra kiểu + build giao diện + nhúng wwwroot + publish ra deploy/publish
./deploy/build.sh --chay     # đóng gói rồi chạy thử ở chế độ Production ngay trên máy này
```

Kết quả là thư mục `deploy/publish` — copy lên máy chủ và chạy:

```bash
ASPNETCORE_URLS=http://127.0.0.1:5080 dotnet ClassManagement.Api.dll
```

Hoặc đóng gói bằng Docker (Render dùng đúng lệnh này):

```bash
docker build -f deploy/render/Dockerfile -t bluemanagement:test .
```

## 3. Tạo/cập nhật database (làm MỘT lần, trước khi chạy app)

Ở Production app **cố tình không tự chạy migration** khi khởi động (không để app tự sửa database). Chạy
tay từ máy có mã nguồn, trỏ vào chuỗi kết nối Supabase:

```bash
cd backend/ClassManagement.Api
ConnectionStrings__MacDinh="<chuỗi kết nối Supabase>" dotnet dotnet-ef database update
```

## 4. Deploy lên Render (free)

1. Render Dashboard → **New → Blueprint** → chọn repo `hungjr-code/BlueManagement`. Render đọc
   `render.yaml` ở gốc repo và dựng sẵn web service (Docker, gói free).
2. Điền các biến `sync: false` khi Render hỏi (chuỗi kết nối Supabase, mật khẩu admin, Google sau).
3. Lần deploy đầu sẽ chạy `dotnet ef`? **Không** — phải tự chạy migration ở bước 3 trước, hoặc sau khi
   service sống thì chạy migration trỏ vào Supabase.
4. Gắn tên miền riêng: Render → Settings → Custom Domain → thêm `ten-mien-cua-ban` → trỏ DNS theo hướng
   dẫn của Render (HTTPS miễn phí). Gói free **có** hỗ trợ tên miền riêng.

### Gói free — những giới hạn phải biết trước khi đưa dùng thật

- Web service **ngủ sau ~15 phút** không có request; lần mở đầu tiên sau đó chờ ~1 phút.
- **Ổ đĩa TẠM**: mỗi lần deploy lại là mất `DataProtection__ThuMucKhoa` ⇒ mọi refresh token Google đã
  mã hoá không giải mã được ⇒ **tất cả giáo viên phải kết nối lại Google**. Xem mục 6.

## 5. Google Cloud khi đã có tên miền

- Khai lại **cả hai** redirect URI theo tên miền thật:
  `https://<ten-mien>/api/auth/google/callback` và `https://<ten-mien>/api/google-calendar/callback`.
- Sửa `GoogleCalendar__RedirectUri`, `RedirectUriDangNhap`, `FrontendUrl` (biến môi trường trên host).
- Chuyển OAuth consent screen sang **In production** (nếu để *Testing* mà xin quyền `calendar.events` thì
  refresh token **hết hạn sau 7 ngày**, giáo viên phải nối lại mỗi tuần).
- Ba ô App domain (home page / privacy policy / terms) chỉ cần khi app ở production: đưa 3 trang trong
  `website/` lên chính tên miền đó (xem `website/README.md`).

## 6. Khoá Data Protection — điểm cần quyết định khi deploy thật

Khoá này mã hoá refresh token Google lưu trong database. Trên Render free (ổ tạm) nó **mất sau mỗi
lần deploy**. Ba lựa chọn, chọn một trước khi mở cho nhiều người dùng:

1. **Chấp nhận** — giáo viên kết nối lại Google sau mỗi lần cập nhật. Đơn giản nhất, hợp giai đoạn thử.
2. **Gắn đĩa trả phí** của Render vào `/app/khoa-bao-mat` — khoá nằm yên một chỗ (tốn phí đĩa).
3. **Chuyển khoá vào database** (thêm gói `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` +
   một bảng + migration) — bền mà không cần đĩa. Đây là thay đổi có migration nên phải làm và kiểm thử
   cẩn thận riêng.

## 7. Kiểm tra sau khi lên

1. `GET https://<ten-mien>/api/health` → `database.canConnect = true`, `provider = PostgreSQL`.
2. Mở `https://<ten-mien>/` → trang đăng nhập hiện ra.
3. Đăng nhập admin → mở **Lịch dạy**, **Điểm danh**, **Học phí**, **Nhật ký**.
4. Đăng nhập bằng Google → **Cài đặt** thấy "đã kết nối"; **Lịch dạy** bấm *Đồng bộ* rồi mở Google
   Calendar xem sự kiện.
5. Chạy `python deploy/kiem-tra-sau-deploy.py https://<ten-mien> https://<ten-mien> --mat-khau <mk admin>`.

## 8. Sao lưu (đừng bỏ)

- **Database**: Supabase → Database → Backups (gói free có sao lưu hằng ngày, giữ vài ngày) hoặc tự
  `pg_dump` theo lịch.
- **Thư mục khoá Data Protection** (`DataProtection__ThuMucKhoa`): mất là mọi refresh token Google vô
  hiệu — xem mục 6.
