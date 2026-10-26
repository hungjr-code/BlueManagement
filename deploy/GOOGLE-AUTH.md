# Bật Google thật (đăng nhập + Calendar + Drive) — checklist

Mục tiêu: app chạy ở `https://bluemanagement.onrender.com` (hoặc tên miền riêng) và mỗi giáo viên
bấm một lần là vừa đăng nhập bằng Google, vừa có đường đẩy/kéo lịch dạy, vừa gửi được tài liệu cho
học sinh.

**Phần nào phải do bạn bấm:** tạo OAuth client trong Google Cloud Console (cần đăng nhập tài khoản
Google của bạn) và dán hai giá trị vào Render. Không có cách nào tự động hoá hai việc đó — Google
không cho tạo client bằng API khi chưa có tài khoản, còn Render cần API key riêng của bạn.

Sau khi làm xong các bước dưới, chạy `python deploy/kiem-tra-google.py https://<ten-mien>` để máy tự
kiểm: credential đã nhận chưa, redirect URI có cùng tên miền không, có xin refresh token không, có đủ
bốn nhóm quyền không.

---

## Bước 1. Google Cloud Console (khoảng 10 phút)

1. Vào https://console.cloud.google.com → **New Project** → tên ví dụ `ClassManagement`.
2. **APIs & Services → Library** → tìm và **Enable**: `Google Calendar API` **và** `Google Drive API`
   (Drive API là bắt buộc từ khi có tính năng gửi tài liệu).
3. **Google Auth Platform → Branding** (chỗ cũ gọi là *OAuth consent screen*):
   - App name: `ClassManagement`; User support email: email của bạn.
   - **Application home page**: `https://bluemanagement.onrender.com`
   - **Application privacy policy link**: `https://bluemanagement.onrender.com/quyen-rieng-tu.html`
   - **Application terms of service link**: `https://bluemanagement.onrender.com/dieu-khoan.html`
   - Ba trang này đã được nhúng sẵn vào app (thư mục `frontend/public/`) nên chúng nằm **cùng tên
     miền** với trang chủ — đúng yêu cầu của Google. Trong ba tệp đó còn ba chỗ trong ngoặc vuông
     (`[EMAIL LIÊN HỆ]`, `[NGƯỜI PHỤ TRÁCH]`, `[ĐỊA CHỈ LIÊN HỆ]`) bạn nên thay bằng thông tin thật.
   - **Authorized domains**: `onrender.com` (và tên miền riêng của bạn nếu có).
4. **Audience** (chỗ chọn user type):
   - Nếu bạn có Google Workspace của trung tâm: chọn **Internal** — không phải xác minh, không giới
     hạn 100 người, refresh token không hết hạn theo tuần. Đây là lựa chọn tốt nhất nếu có.
   - Nếu dùng Gmail thường: phải là **External**. Khi đó:
     - Để *Testing* thì refresh token **chết sau 7 ngày** (Google quy định với External + Testing +
       quyền ngoài openid/email) ⇒ giáo viên phải kết nối lại mỗi tuần.
     - Nên bấm **Publish app** (In production). App chưa xác minh vẫn dùng được, chỉ hiện cảnh báo
       "unverified" và giới hạn 100 người dùng, đổi lại token bền.
   - Trong **Data access** khai đủ 4 nhóm quyền:
     `openid`, `email`, `.../auth/calendar.events`, `.../auth/calendar.calendarlist.readonly`,
     `.../auth/drive.file`.
5. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://bluemanagement.onrender.com`
   - **Authorized redirect URIs** (dán đúng từng ký tự, cả hai dòng):
     ```
     https://bluemanagement.onrender.com/api/auth/google/callback
     https://bluemanagement.onrender.com/api/google-calendar/callback
     ```
   - Bấm Create → chép **Client ID** và **Client secret**.
6. Nếu app chạy ở tên miền riêng, khai lại **cả bốn** dòng (hai cho Render, hai cho tên miền riêng).

## Bước 2. Render (khoảng 2 phút)

Render Dashboard → service `bluemanagement` → **Environment** → thêm/sửa 5 biến sau (không có dấu `/`
ở cuối; đúng tên, sai tên là hỏng âm thầm):

```
GoogleCalendar__ClientId            = <client id vừa chép>
GoogleCalendar__ClientSecret        = <client secret vừa chép>
GoogleCalendar__RedirectUri         = https://bluemanagement.onrender.com/api/google-calendar/callback
GoogleCalendar__RedirectUriDangNhap = https://bluemanagement.onrender.com/api/auth/google/callback
GoogleCalendar__FrontendUrl         = https://bluemanagement.onrender.com
```

Lưu xong Render tự deploy lại (~2–4 phút). **Dán Client secret trực tiếp vào ô của Render** (ô đó bị
che) — đừng gửi qua chat hay ghi vào tệp trong repo.

Nhân đây kiểm luôn hai biến còn thiếu từ trước tới nay (nếu chưa đặt thì đăng nhập hoặc Google đều
hỏng theo cách khó hiểu):

```
Jwt__Key                    = <Render tự sinh nếu để generateValue: true trong render.yaml>
ConnectionStrings__MacDinh  = <chuỗi Supabase Shared pooler>
DataProtection__ThuMucKhoa  = /app/khoa-bao-mat
```

## Bước 3. Kiểm chứng

```bash
python deploy/kiem-tra-google.py https://bluemanagement.onrender.com
```

Kết quả mong đợi: `googleDaCauHinh=true`, `redirect_uri` cùng tên miền, có `access_type=offline` +
`prompt=consent`, đủ 5 quyền, và in ra hai địa chỉ để đối chiếu với Console.

Rồi trên trình duyệt:

1. Mở `https://bluemanagement.onrender.com/login` → nút **Đăng nhập bằng Google** đã sáng.
2. Đăng nhập → vào **Cài đặt** → **Kết nối Google Calendar** → đồng ý cấp quyền → thấy "Đã kết nối"
   và `coQuyenDrive` không còn cảnh báo.
3. **Lịch dạy → Đồng bộ lại** → lần đầu sẽ *Tạo N sự kiện*; mở Google Calendar của bạn để xem.
4. Sửa giờ một sự kiện ngay trên Google, tải lại màn Lịch dạy → app tự kéo thay đổi về (báo "Đã kéo
   thay đổi từ Google: xét … buổi, cập nhật giờ …").
5. **Học sinh → Tài khoản → Cấp tài khoản**, gửi một tài liệu, rồi đăng nhập cổng học sinh
   `/hoc-sinh/dang-nhap` bằng mã + mật khẩu tạm để xem bài tập và tải về.

## Bốn cái bẫy đã gặp thật

- **Đổi tên miền mà quên đổi ba biến `GoogleCalendar__*`** ⇒ Google chuyển hướng về tên miền không
  tồn tại. Log lúc khởi động của backend đã cảnh báo sẵn tên ba biến cần đặt.
- **Xin quyền `calendar.events` khi app còn ở *Testing*** ⇒ refresh token chết sau 7 ngày, giáo viên
  phải nối lại mỗi tuần. Publish app (dù chưa xác minh) là hết.
- **Ai kết nối Google trước khi có tính năng tài liệu** thì thiếu quyền `drive.file` ⇒ gửi bài lỗi 403.
  Màn Cài đặt hiện cảnh báo `coQuyenDrive = false`: Ngắt kết nối rồi Kết nối lại.
- **Gói free của Render có ổ đĩa TẠM**: mỗi lần deploy lại là mất `DataProtection__ThuMucKhoa` ⇒ mọi
  refresh token Google đã lưu không giải mã được ⇒ **tất cả giáo viên phải kết nối lại**. Muốn bền thì
  gắn đĩa trả phí hoặc chuyển khoá vào database (xem mục 6 của deploy/README.md).
