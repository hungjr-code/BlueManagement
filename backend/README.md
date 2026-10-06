# ClassManagement — Backend (Phase 1 → 6)

ASP.NET Core 9 Web API trên **PostgreSQL** (Npgsql; máy dev cũ từng chạy SQL Server Express), phục vụ frontend Vite + React.

- **Phase 1**: database, đăng nhập hai vai trò, chặn quyền theo `giaoVienId`, cấu hình dùng chung,
  `/api/health`.
- **Phase 2**: nhập/sửa học sinh kèm lịch học lặp hằng tuần, sinh buổi học, điểm danh theo lô kèm
  nhật ký sửa đổi, buổi dạy bù, và tổng quan "hôm nay dạy ai" / "tuần này dạy ai".
- **Phase 3**: đăng nhập bằng Google và kết nối Google Calendar theo TỪNG GIÁO VIÊN (OAuth 2.0, một
  lần cấp quyền là vừa đăng nhập vừa nối lịch), chọn lịch đích, đẩy mỗi buổi học thành một sự kiện
  vào lịch của chính giáo viên dạy buổi đó, và gỡ sự kiện khi buổi đó là nghỉ. Đồng bộ MỘT CHIỀU
  (hệ thống → Google); nhận thay đổi từ Google về (webhook) chưa làm.
- **Phase 4**: học phí tính từ điểm danh, thu tiền nhiều lần (phiếu thu), danh sách sắp đến hạn/quá
  hạn, đối chiếu sao kê ngân hàng (máy đề xuất — người xác nhận), chốt sổ theo kỳ, và xuất sổ ra Excel.
- **Phase 5**: ba đường vào hệ thống — admin tạo tài khoản, tự đăng ký (luôn là giáo viên), và Google
  tự tạo tài khoản cho email lạ; quên/đặt lại mật khẩu qua email, đổi mật khẩu thì thu hồi phiên cũ.
- **Phase 6**: đọc lại nhật ký thay đổi — lọc theo khoảng ngày, hành động, bảng bị tác động và người
  thực hiện, có phân trang; admin thấy toàn trung tâm, giáo viên chỉ thấy việc do chính mình làm.

## Chạy lần đầu

```bash
cd backend/ClassManagement.Api

# 1. Bí mật của máy dev (KHÔNG nằm trong appsettings, không commit)
dotnet user-secrets set "Jwt:Key" "<chuỗi ngẫu nhiên dài ít nhất 32 ký tự>"
dotnet user-secrets set "Seed:Admin:MatKhau" "<mật khẩu admin đầu tiên>"

# 2. Database: tạo hoặc cập nhật schema
dotnet dotnet-ef database update      # dotnet-ef cài theo manifest của repo (backend/.config)

# 3. Chạy API (cổng 5080, khớp VITE_PROXY_TARGET của frontend)
dotnet run --launch-profile http
```

Lần chạy đầu, backend tự tạo tài khoản admin từ `Seed:Admin` (email trong `appsettings.json`,
mật khẩu trong user-secrets) và một dòng cấu hình mặc định. Ở môi trường Development nó cũng
tạo sẵn 1 giáo viên mẫu và 3 học sinh mẫu để thử giao diện (`Seed:DuLieuMau`).

Swagger UI ở `http://localhost:5080/swagger` khi chạy Development.

## Kiểm thử đầu-cuối

```bash
cd backend
python kiem-thu-phase1.py   # 63 bước: đăng nhập, phân quyền, phiên, cài đặt, tài khoản nhận tiền
python kiem-thu-phase2.py   # 48 bước: học sinh (kèm lớp), sinh buổi, điểm danh, nhật ký, tổng quan
python kiem-thu-phase3.py   # 55 bước: đăng nhập Google, cấp quyền, đồng bộ riêng từng giáo viên
python kiem-thu-phase4.py   # 67 bước: tính học phí, thu tiền, chốt sổ, đối chiếu ngân hàng, Excel
python kiem-thu-phase5.py   # 43 bước: tự đăng ký, đăng ký bằng Google, quên/đặt lại mật khẩu
python kiem-thu-phase6.py   # 37 bước: đọc nhật ký, lọc, phân trang, chặn giáo viên xem của người khác
```

Các script chạy SQL qua **PostgreSQL** (`kiem_thu_pg.py`, thư viện `pg8000` — `python -m pip install pg8000`
nếu máy còn thiếu). Chúng nối vào database theo biến môi trường **`CM_PG`** (chuỗi kết nối kiểu Npgsql);
không đặt thì đọc `ConnectionStrings:MacDinh` trong user-secrets. Trên **database mới**, chạy
`python kiem-thu-chuan-bi.py` trước phase3/phase4 — nó tạo giáo viên thứ hai `co.ha@classmanagement.local`
và một học sinh có buổi trong tháng (phase4 cần dữ liệu của một giáo viên khác để kiểm phạm vi dữ liệu).

Hai bộ `kiem-thu-phase3.py` và `kiem-thu-phase5.py` cần API chạy ở **chế độ giả**:
`GoogleCalendar__CheDoGia=true Email__CheDoGia=true` (xem mục chế độ giả ở trên). Nhờ vậy kiểm được
trọn luồng quên mật khẩu: xin thư → đọc liên kết
trong hộp thư giả → đặt mật khẩu mới → mật khẩu cũ hết hiệu lực → dùng lại mã cũ bị chặn → phiên cũ
bị thu hồi.

`kiem-thu-phase4.py` tính lại mọi con số tiền **bằng SQL độc lập** rồi so với số API trả về, nên công
thức tính tiền sai là kiểm thử đỏ ngay; nó cũng tự dọn sổ của kỳ trước khi chạy nên chạy lại được
nhiều lần.

`kiem-thu-phase3.py` chạy ở **chế độ giả** (`GoogleCalendar:CheDoGia`, đã bật sẵn ở
`appsettings.Development.json`): backend dùng một khách Google giả nên kiểm thử được toàn bộ luồng
mà không cần tài khoản Google thật. **Phần chưa kiểm thử được** là chính việc gọi REST API của
Google (không có lời gọi mạng nào ra ngoài ở chế độ giả); muốn kiểm thì cần Client ID/Secret thật.

Hai script chạy trên API thật và dữ liệu thật, mỗi script tự tạo tài khoản/học sinh riêng nên không
làm lệch số liệu của nhau. Mật khẩu đọc từ user-secrets nên không xuất hiện trong lệnh hay trong log.

## Endpoint hiện có

| Method | Đường dẫn | Quyền | Việc |
|---|---|---|---|
| GET | `/api/health` | công khai | Trạng thái API + kết nối database (hợp đồng đã chốt với `src/api/health.ts`) |
| POST | `/api/auth/login` | công khai | Đăng nhập, trả access token và đặt cookie phiên |
| POST | `/api/auth/refresh` | công khai (cookie) | Lấy access token mới, xoay vòng refresh token |
| POST | `/api/auth/logout` | công khai (cookie) | Thu hồi phiên hiện tại |
| GET | `/api/auth/me` | đã đăng nhập | Thông tin người đang đăng nhập |
| POST | `/api/auth/doi-mat-khau` | đã đăng nhập | Đổi mật khẩu của chính mình, thu hồi các phiên khác |
| GET | `/api/teachers` | admin: tất cả · giáo viên: chỉ mình | Danh sách giáo viên kèm số học sinh đang phụ trách |
| GET | `/api/teachers/{id}` | admin hoặc chính mình | Chi tiết một giáo viên |
| POST | `/api/teachers` | admin | Tạo tài khoản giáo viên (mật khẩu đầu tiên do admin đặt) |
| PUT | `/api/teachers/{id}` | admin | Sửa hồ sơ, vai trò, trạng thái; khoá đăng nhập khi nghỉ việc |
| POST | `/api/teachers/{id}/dat-lai-mat-khau` | admin | Đặt lại mật khẩu, mở khoá tài khoản |
| GET | `/api/students` | giáo viên chỉ thấy học sinh của mình | Danh sách học sinh, lọc theo tên/giáo viên/trạng thái |
| GET | `/api/students/{id}` | như trên | Chi tiết học sinh kèm lịch học hằng tuần |
| POST | `/api/students` | giáo viên (mặc định gán cho mình) · admin (gán được cho người khác) | Thêm học sinh kèm lịch học và **lớp/nhóm học**, sinh ngay buổi học tới hết tháng sau |
| PUT | `/api/students/{id}` | chủ sở hữu hoặc admin | Sửa học sinh; đổi lịch thì sinh lại các buổi chưa dạy |
| DELETE | `/api/students/{id}` | chủ sở hữu hoặc admin | Cho nghỉ: đổi trạng thái, bỏ buổi chưa dạy, **không xoá hồ sơ** |
| GET | `/api/attendance` | giáo viên chỉ thấy buổi của mình | Buổi học trong khoảng ngày (mặc định tuần hiện tại) + tổng hợp cuối tuần; mỗi buổi có kèm `lopHocSinh` để ô lịch hiện đủ tên — giờ — lớp |
| POST | `/api/attendance/luu-hang-loat` | như trên | Lưu điểm danh cả tuần trong một request, ghi nhật ký khi sửa bản ghi đã có |
| POST | `/api/attendance/buoi-day-bu` | như trên | Thêm buổi dạy bù ngoài lịch lặp hằng tuần |
| GET | `/api/dashboard/hom-nay` | giáo viên: lịch của mình · admin: tất cả, lọc theo giáo viên | Hôm nay dạy ai |
| GET | `/api/dashboard/tuan-nay` | như trên | Tuần này dạy ai, số buổi chưa điểm danh, học phí dự kiến tháng |
| PUT | `/api/teachers/me/tai-khoan-nhan-tien` | đã đăng nhập | Giáo viên tự khai tài khoản nhận tiền của mình (không ai khai hộ) |
| GET | `/api/settings` | đã đăng nhập | Cấu hình chung (mẫu nội dung chuyển khoản, múi giờ, nhắc lịch) + số lượng giáo viên đã khai tài khoản (chỉ admin) |
| GET | `/api/nhat-ky` | admin: toàn trung tâm · giáo viên: chỉ việc do mình làm | Nhật ký thay đổi, lọc theo ngày / hành động / bảng bị tác động / người thực hiện, phân trang |
| GET | `/api/nhat-ky/danh-muc` | như trên | Danh mục hành động và bảng đã từng có, để giao diện dựng bộ lọc từ dữ liệu thật |
| PUT | `/api/settings` | admin | Sửa cấu hình chung |

## Buổi học được sinh ra thế nào

Buổi học **không phải dữ liệu nhập tay**: nó suy ra từ lịch lặp hằng tuần (`KhungGioHoc`).

- Khi thêm hoặc sửa học sinh, backend sinh buổi từ ngày bắt đầu tới **hết tháng sau**.
- Khi mở một tuần ở màn hình Điểm danh hoặc Tổng quan, backend **sinh bù** các buổi còn thiếu của
  tuần đó. Thao tác này lặp lại được: chỉ mục duy nhất trên `(HocSinhId, Ngay, GioBatDau)` bảo đảm mở
  lại bao nhiêu lần cũng không sinh thêm bản ghi, kể cả khi hai request cùng lúc.
- Tuần đã qua thì **không** sinh thêm buổi mới, để không tự nhiên mọc ra buổi "chưa dạy" trong quá khứ.
- Sửa lịch học: các buổi **chưa điểm danh** từ hôm nay được xoá và sinh lại theo lịch mới; buổi **đã
  điểm danh** giữ nguyên — đó là lịch sử dạy và là căn cứ tính tiền.
- Đổi giáo viên phụ trách cũng chỉ ảnh hưởng buổi chưa dạy; `BuoiHoc.GiaoVienId` được chụp lại lúc
  sinh buổi nên lịch sử dạy không bị viết lại.

## Lớp của học sinh

`HocSinh.Lop` là chuỗi tự do (tuỳ chọn, tối đa 100 ký tự) — ví dụ `Lớp 9`, `Toán 9A`, `IELTS 5.0`.
Nó **chỉ để nhìn**: lịch dạy và màn hình điểm danh hiện lớp ngay trên từng buổi để giáo viên biết ai
học lớp nào. Không dùng để phân quyền và **không dùng để tính tiền** — tiền chỉ tính từ điểm danh.
Backend gửi kèm trong `BuoiHocDto.LopHocSinh` nên giao diện không phải gọi thêm API.

## Bảng dữ liệu

`GiaoVien` (tài khoản đăng nhập, kế thừa Identity nhưng không dùng bảng vai trò) ·
`HocSinh` · `KhungGioHoc` (lịch học lặp hằng tuần) · `BuoiHoc` · `DiemDanh` · `HocPhi` · `PhieuThu` ·
`CaiDat` (đúng một dòng, Id = 1) · `PhienDangNhap` (refresh token đã băm) · `NhatKy` (nhật ký thao tác
nhạy cảm) và ba bảng phụ của Identity (`GiaoVienQuyen`, `GiaoVienDangNhapNgoai`, `GiaoVienToken`).

Quy đổi tên hiển thị: cột `vaiTro` lưu đúng chuỗi mà API trả về (`admin`, `giao_vien`) chứ không phải
số, để câu lệnh SQL đọc lên là hiểu. Việc quy đổi nằm ở `Common/EnumWire.cs` — cùng một nguồn với
`JsonStringEnumMemberName`, nên JSON và SQL không thể lệch nhau.

## Tài khoản: tự tạo, đăng nhập Google, quên mật khẩu

Có ba đường vào hệ thống:

1. **Admin tạo tài khoản** (màn hình Giáo viên) — dùng khi trung tâm muốn kiểm soát danh sách.
2. **Tự tạo bằng email + mật khẩu** — `POST /api/auth/dang-ky`, tạo xong là có phiên luôn.
3. **Đăng nhập/đăng ký bằng Google** — `GET /api/auth/google/duong-dan` rồi Google gọi lại
   `GET /api/auth/google/callback`.

**Tài khoản tự tạo LUÔN là giáo viên.** Mở cho tự đăng ký nhưng không mở luôn quyền quản trị: admin
đầu tiên vẫn phải sinh bằng seed ở máy chủ, và chỉ admin mới đổi được vai trò của người khác. Gửi
kèm `vaiTro: "admin"` trong yêu cầu đăng ký cũng bị bỏ qua (kiểm thử có bước kiểm đúng việc này).

### Quên mật khẩu

- `POST /api/auth/quen-mat-khau` — luôn trả **204** dù email có tài khoản hay không: trả khác nhau
  là để người ngoài dò ra email nào đã đăng ký. Việc có gửi thư hay không chỉ ghi ở log máy chủ.
- Token trong liên kết là chuỗi ngẫu nhiên 32 byte; database **chỉ lưu bản băm**, hạn 30 phút, dùng
  được **một lần**. Đặt lại mật khẩu xong là mọi liên kết cũ khác của tài khoản hết giá trị.
- Không gửi lại thư trong vòng 60 giây (tránh bấm nhiều lần thành spam).
- Đặt lại mật khẩu xong thì **thu hồi mọi phiên đang mở** của tài khoản: mật khẩu đổi nghĩa là mọi
  thiết bị phải đăng nhập lại. Có ghi nhật ký.
- Tài khoản tạo bằng Google chưa có mật khẩu; dùng quên mật khẩu để đặt mật khẩu đầu tiên, sau đó
  đăng nhập được bằng cả hai đường.

### Chế độ giả: chỉ để kiểm thử, KHÔNG bật mặc định

Máy dev **mặc định dùng đường thật**. Muốn thử luồng khi chưa có tài khoản Google / máy chủ SMTP thì
phải bật rõ ràng lúc khởi động:

```bash
GoogleCalendar__CheDoGia=true Email__CheDoGia=true dotnet run --launch-profile http
```

Khi bật, hai thứ thay đổi và cả hai đều **nói thẳng ra** để không ai nhầm là thật:

- Bấm "Đăng nhập bằng Google" **không** mở trang của Google mà hiện một trang cảnh báo
  "Đây KHÔNG phải Google thật" rồi mới cho bấm tiếp để đóng vai một tài khoản cố định.
- Trang đăng nhập và màn hình quên mật khẩu hiện băng vàng cảnh báo chế độ giả.

Giao diện biết máy chủ đang ở chế độ nào nhờ `GET /api/auth/tuy-chon-dang-nhap` (công khai, không có
gì bí mật): máy chủ đã có ClientId/Secret chưa, đã cấu hình SMTP chưa, và có đang chạy chế độ giả
không. Nhờ đó nút Google bị khoá kèm lời giải thích khi chưa cấu hình, thay vì dẫn tới lỗi.

### Cấu hình gửi thư (bắt buộc nếu muốn dùng quên mật khẩu)

Ví dụ với Gmail (cần **mật khẩu ứng dụng**, không phải mật khẩu Google):

```bash
dotnet user-secrets set "Email:SmtpHost" "smtp.gmail.com"
dotnet user-secrets set "Email:SmtpPort" "587"
dotnet user-secrets set "Email:SmtpTaiKhoan" "<địa chỉ gmail>"
dotnet user-secrets set "Email:SmtpMatKhau" "<mật khẩu ứng dụng 16 ký tự>"
dotnet user-secrets set "Email:TuDiaChi" "<địa chỉ gmail>"
```

Máy dev có sẵn `Email:CheDoGia = true`: không gửi thư thật mà lưu vào hộp thư giả đọc được ở
`GET /api/auth/gia-hop-thu` (chỉ tồn tại khi `IsDevelopment()`), nhờ vậy kiểm thử được cả luồng quên
mật khẩu mà không cần SMTP.

## Đăng nhập bằng Google

- Nút "Đăng nhập bằng Google" ở màn hình đăng nhập chạy `GET /api/auth/google/duong-dan` rồi mở
  đường dẫn cấp quyền. Google trả về `GET /api/auth/google/callback`.
- **Một lần cấp quyền làm hai việc**: xác thực người đăng nhập (quyền `openid email`) và lấy luôn
  quyền trên lịch. Đăng nhập xong là giáo viên đã có sẵn đường đồng bộ, không phải vào Cài đặt nối
  thêm lần nữa.
- **Lần đầu đăng nhập bằng Google là tự tạo tài khoản**: email Google chưa có trong hệ thống thì tạo
  một tài khoản giáo viên mới (tên lấy từ thông tin Google), rồi vào luôn. Tài khoản này chưa có mật
  khẩu — muốn có thì dùng quên mật khẩu. Mật khẩu vẫn dùng được song song như đường dự phòng.
- Danh tính lấy từ `id_token` của Google và **được xác thực chữ ký** bằng khoá công khai của Google
  (JWKS), kiểm cả nơi phát hành, đối tượng nhận và `email_verified` — không tin chuỗi do phía gọi
  tự khai.
- Sau khi đăng nhập, phiên vẫn như đăng nhập bằng mật khẩu: refresh token trong cookie `httpOnly`
  (`cm_phien`), access token để trong RAM của trình duyệt. Google không bao giờ thấy mật khẩu của
  người dùng, và hệ thống không lưu mật khẩu Google.

## Google Calendar (Phase 3)

- **Kết nối là của từng giáo viên, không phải của trung tâm**: buổi học của ai thì lên lịch Google
  của người đó. Mỗi người tự kết nối / chọn lịch / ngắt kết nối; không ai — kể cả admin — kết nối
  hộ hay đọc được refresh token của người khác. Admin chỉ thấy số liệu tổng hợp (bao nhiêu người đã
  kết nối, ai chưa) và có quyền chạy đồng bộ cho tất cả (`tatCaGiaoVien: true`).
- **Quyền xin rất hẹp**: `openid` + `email` (biết ai đang đăng nhập), `calendar.events` (đọc/ghi sự
  kiện) và `calendar.calendarlist.readonly` (để chọn lịch đích). Không xin quyền hồ sơ, Gmail, Drive
  hay đọc toàn bộ Google Calendar.
- **Client ID/Secret chỉ nằm ở user-secrets** (máy dev) hoặc biến môi trường (máy chủ) — không bao
  giờ nhập qua giao diện web, không bao giờ trả xuống frontend.
- **Refresh token được mã hoá** bằng Data Protection của ASP.NET Core trước khi lưu, chỉ backend
  giải mã được. Ngắt kết nối là xoá hẳn token đã lưu.
- **State của OAuth được ký và có hạn 10 phút**: nếu thiếu, kẻ khác có thể lừa backend đổi một mã uỷ
  quyền của tài khoản Google khác vào hệ thống này.
- **Một buổi học = một sự kiện**, không dùng sự kiện lặp hằng tuần: đơn vị nghiệp vụ là buổi (nghỉ
  một buổi, dạy bù một buổi, đổi giờ một buổi) nên sự kiện lặp sẽ phải sinh ngoại lệ cho mọi thay
  đổi và khó đối chiếu. `BuoiHoc.GoogleEventId` là mối liên hệ để cập nhật/xoá đúng sự kiện.
- Buổi ở trạng thái **nghỉ** thì không đẩy lên lịch; nếu trước đó đã đẩy thì sự kiện bị gỡ.
- **Đồng bộ một chiều**: hệ thống → Google. Sửa trên Google sẽ không quay về hệ thống (muốn vậy phải
  làm webhook nhận thông báo của Google, cần địa chỉ HTTPS công khai — để Phase sau).
- **Chế độ giả** (`GoogleCalendar:CheDoGia`, chỉ có tác dụng khi `IsDevelopment()`): dùng khách Google
  giả để thử luồng ở máy dev. Máy chạy thật luôn dùng khách thật. Giao diện có băng cảnh báo khi
  đang ở chế độ này.

### Cấu hình Google thật (làm một lần, khoảng 10 phút)

1. **Tạo project**: console.cloud.google.com → chọn project (hoặc New project), đặt tên tự chọn.
2. **Bật API**: APIs & Services → Library → tìm `Google Calendar API` → **Enable**.
   Không cần bật Gmail API, vì gửi thư dùng SMTP (xem mục cấu hình gửi thư ở trên).
3. **Màn hình đồng ý**: APIs & Services → OAuth consent screen (console mới nằm trong
   *Google Auth Platform* → Branding / Audience / Data access).
   - User type: **External** nếu dùng Gmail cá nhân; **Internal** nếu trường có Google Workspace
     (Internal tốt hơn: không cần xác minh và token không hết hạn theo chu kỳ).
   - Ba ô **App domain** (home page, privacy policy, terms of service) **không bắt buộc khi app còn ở
     Testing** — để trống vẫn dùng được. Chúng bắt buộc với app External ở production; ba trang đã viết
     sẵn cho việc đó nằm trong thư mục `website/` (xem `website/README.md`).
   - Điền tên ứng dụng, email hỗ trợ, email liên hệ.
   - Data access / Scopes — thêm đúng 4 quyền ứng dụng xin:
     `openid`, `email`, `https://www.googleapis.com/auth/calendar.events`,
     `https://www.googleapis.com/auth/calendar.calendarlist.readonly`.
   - Audience → Test users: thêm email Google của bạn và của những giáo viên sẽ dùng thử.
4. **Bấm "Publish app" để chuyển Publishing status từ Testing sang In production.** Đây là bước
   quan trọng nhất và dễ bị bỏ qua: ứng dụng đang ở **Testing** mà xin quyền nhạy cảm (calendar) thì
   Google cấp refresh token **hết hạn sau 7 ngày** — nghĩa là tuần nào giáo viên cũng phải bấm kết nối
   lại. Ở **In production** (kể cả chưa xác minh) refresh token không hết hạn theo thời gian. Chưa xác
   minh thì người dùng chỉ thấy màn hình "Google chưa xác minh ứng dụng" và tự bấm *Tiếp tục*; muốn hết
   màn hình đó mới cần Google review (với quyền calendar thường mất vài ngày tới vài tuần).
   Token cấp trước khi đổi trạng thái vẫn giữ đồng hồ 7 ngày → đổi xong phải kết nối lại một lần.
5. **Tạo OAuth client**: APIs & Services → Credentials → Create credentials → OAuth client ID →
   Application type **Web application** → Authorized redirect URIs, thêm **cả hai** (hai luồng xử lý
   ở hai controller khác nhau):
   - `http://localhost:5080/api/auth/google/callback` — đăng nhập bằng Google
   - `http://localhost:5080/api/google-calendar/callback` — kết nối lịch từ màn hình Cài đặt
   → Create, rồi copy **Client ID** và **Client secret**.
6. **Đặt bí mật vào user-secrets của máy dev** (không dán vào mã nguồn, không gửi qua chat):

```bash
# Thay cả hai chỗ trong ngoặc nhọn bằng giá trị Google vừa cấp. Dán nguyên dấu ngoặc nhọn (hay dán
# nguyên dòng lệnh này mà không thay gì) thì API coi như CHƯA cấu hình — nút Google ở màn hình đăng
# nhập bị khoá, chứ không dẫn tới lỗi 401 invalid_client của Google.
dotnet user-secrets set "GoogleCalendar:ClientId" "<client id>.apps.googleusercontent.com"
dotnet user-secrets set "GoogleCalendar:ClientSecret" "<client secret>"

# Kiểm tra đã đặt đúng chưa (in ra giá trị đang có, không in ClientSecret):
curl -s http://localhost:5080/api/auth/tuy-chon-dang-nhap
# {"googleDaCauHinh":true,...} nghĩa là đã nhận; false nghĩa là vẫn còn chỗ trống trong tài liệu.
```

7. Chạy lại API (mặc định đã dùng đường thật — đừng khởi động kèm `GoogleCalendar__CheDoGia=true`),
   rồi mở `/login`: nút Google hết bị khoá, bấm vào sẽ mở trang chọn tài khoản Google thật.
8. Kiểm tra: sau khi đồng ý, quay về giao diện là đã đăng nhập; vào **Cài đặt** thấy "đã kết nối" kèm
   email Google; vào **Lịch dạy** bấm *Đồng bộ ngay* rồi mở Google Calendar xem sự kiện đã lên chưa.

Khi đưa lên máy chủ thật: đổi hai Redirect URI (và `GoogleCalendar:FrontendUrl`) sang tên miền thật,
khai lại trong Console, và bắt buộc dùng HTTPS.

### Khi đưa lên máy chủ thật

- Đổi `GoogleCalendar:RedirectUri`, `GoogleCalendar:RedirectUriDangNhap` và `GoogleCalendar:FrontendUrl`
  sang tên miền thật, và khai lại hai Redirect URI đó trong Google Cloud Console.
- Đặt `Jwt__Key`, `Seed__Admin__MatKhau`, `GoogleCalendar__ClientId`, `GoogleCalendar__ClientSecret`
  bằng biến môi trường của máy chủ (bỏ user-secrets).
- **Khoá Data Protection phải cố định và có sao lưu** (`PersistKeysToFileSystem` hoặc khoá bí mật
  chung): mất khoá là mọi refresh token Google đã mã hoá không giải mã được, tất cả phải kết nối lại.
- Ứng dụng ở chế độ *Testing* chỉ cho tối đa 100 người thử đăng nhập; muốn mở cho mọi người phải qua
  Google xác minh (quyền `calendar.events` là quyền nhạy cảm), hoặc để *Internal* nếu dùng Google
  Workspace của trường.
- Đồng bộ nên chạy tự động theo giờ thay vì bấm tay: gọi `POST /api/google-calendar/dong-bo` với
  `tatCaGiaoVien: true` bằng một tài khoản admin (hoặc một job nội bộ).

## Học phí và thu tiền (Phase 4)

**Số buổi và thành tiền luôn ĐẾM/TÍNH TỪ ĐIỂM DANH, không có chỗ nào cho nhập tay.** Muốn đổi số tiền
thì phải sửa điểm danh — nhờ vậy sổ học phí luôn khớp với lịch dạy, tra lại được vì sao ra con số đó.

- `theo_buoi`: thành tiền = đơn giá theo buổi × (số buổi đi học + số buổi **nghỉ không phép** nếu
  cấu hình `TinhTienNghiKhongPhep` bật — mặc định bật, vì nghỉ không báo vẫn giữ chỗ).
  Buổi **nghỉ có phép** không bao giờ tính tiền.
- `theo_thang`: thu đủ học phí tháng, không phụ thuộc số buổi; số buổi vẫn đếm để đối chiếu.
- Buổi **chưa điểm danh** không tính tiền. Khi chốt sổ mà còn buổi đã qua ngày hôm nay chưa điểm
  danh thì API trả **409** kèm danh sách học sinh — chốt trên con số thiếu là tự lừa mình. Muốn chốt
  thì phải gửi `boQuaCanhBao: true`, và lần chốt đó được ghi vào nhật ký.
- Thu tiền nhiều lần được, mỗi lần một phiếu thu. Thu vượt quá số còn lại bị **chặn** (400): thu
  thừa thì phải sửa học phí trước, không ghi thừa vào sổ.
- Huỷ phiếu thu bắt buộc nêu lý do, luôn để lại vết trong nhật ký, và trả tiền đã thu về đúng phần
  còn lại.
- **Chốt sổ** khoá con số của kỳ: lần "tính học phí" sau bỏ qua các dòng đã chốt. **Mở chốt sổ** là
  việc của admin và bắt buộc nêu lý do; ảnh chụp số liệu trước khi mở được lưu vào nhật ký.
- **Đối chiếu ngân hàng không tự động ghi sổ**: `POST /api/tuition/doi-chieu/phan-tich` chỉ trả về đề
  xuất (khớp chắc / khớp một phần / chỉ khớp số tiền / đã ghép trước đó / không khớp) kèm lý do bằng
  chữ; người dùng xem rồi `POST /api/tuition/doi-chieu/xac-nhan` mới thành phiếu thu chuyển khoản có
  `MaGiaoDichNganHang`. Cùng một mã giao dịch không bị ghép hai lần.
- Backend **không tự đọc file sao kê** của ngân hàng nào (mỗi ngân hàng một định dạng): giao diện đọc
  file thành các dòng `{ngay, soTien, noiDung, maGiaoDich}` rồi gửi lên.
- **Xuất Excel** (`GET /api/tuition/xuat-excel`) tạo file .xlsx ba sheet: sổ học phí chi tiết, tổng hợp
  theo giáo viên, và danh sách phiếu thu trong kỳ.
- Giáo viên chỉ làm việc với học sinh của mình; mở dòng học phí của người khác trả **404** (không
  phải 403) để không xác nhận là dòng đó có tồn tại. Chốt sổ và tổng hợp toàn trung tâm là của admin.

## Tài khoản nhận tiền là của từng giáo viên

Học phí chảy về tài khoản của người dạy, nên tài khoản nhận tiền nằm trên **từng giáo viên**
(`GiaoVien.NganHangBin/SoTaiKhoan/ChuTaiKhoan`), không phải một tài khoản chung của trung tâm.
Hệ quả có chủ ý:

- Chỉ có endpoint `me`: **không ai khai hộ ai**, kể cả admin — không tồn tại đường nào để sửa tài khoản
  của người khác.
- Số tài khoản của giáo viên **không xuất hiện ở bất kỳ payload nào khác**: `/api/auth/me` chỉ trả tài
  khoản của chính người đang đăng nhập, `GET /api/teachers` không có trường nào về tài khoản.
- Admin chỉ thấy **số lượng**: bao nhiêu giáo viên đang làm đã khai, bao nhiêu chưa, kèm tên những
  người chưa khai để nhắc (`CaiDatDto.SoGiaoVienDaKhaiTaiKhoanNhanTien` và các trường đi kèm).
- Mã QR thu học phí (trang Học phí) sẽ dùng tài khoản của **giáo viên dạy học sinh đó**. Vì tài khoản
  chỉ người sở hữu đọc được, admin không sinh được mã QR cho học sinh của giáo viên khác — nếu sau này
  cần, phải bàn lại cách làm.

## Quyết định thiết kế đáng lưu ý

- **Access token chỉ nằm trong RAM của trình duyệt; refresh token nằm trong cookie `httpOnly`**
  giới hạn ở đường dẫn `/api/auth`. Refresh token được xoay vòng mỗi lần làm mới, database chỉ lưu
  bản băm SHA-256. Dùng lại token đã thu hồi bị coi là dấu hiệu lộ token và thu hồi sạch phiên —
  trừ trường hợp vừa xoay vòng trong 60 giây, vì đó là hai tab cùng làm mới một lúc.
- **Giờ học lưu theo giờ tường (giờ Việt Nam), không phải UTC.** Việt Nam không có giờ mùa hè nên
  giờ tường mới là sự thật của nghiệp vụ; UTC chỉ được tính ra ở ranh giới tích hợp Google Calendar
  (Phase 3) bằng `muiGio` trong Cài đặt. Đây là điểm khác với câu "mọi buổi học lưu ở UTC" trong
  bản đặc tả ban đầu, cố tình làm vậy để chỉ có một nguồn sự thật.
- **Chặn quyền làm ở backend, và trả 404 thay vì 403** khi giáo viên hỏi dữ liệu của người khác:
  trả 403 là vô tình xác nhận "dữ liệu này có tồn tại".
- **Admin cuối cùng không tự hạ quyền được** — mất hết admin thì không ai còn quyền quản lý tài khoản.
- **Không có endpoint tự đăng ký.** Admin đầu tiên sinh bằng seed khi khởi động; các tài khoản sau do
  admin tạo. Mật khẩu đầu tiên hiện do admin đặt hộ (Phase 2 sẽ thay bằng email mời).
- **Đổi mật khẩu thì thu hồi mọi phiên khác**, chỉ giữ phiên vừa dùng.
- **Tiền là `decimal(18,2)`** đặt một chỗ trong `AppDbContext`, không có cột tiền nào lưu dạng số thực.

## Bài học khi viết code với EF Core (đã vấp thật)

- **Thêm thực thể mới vào navigation của một thực thể đang được theo dõi thì EF sinh UPDATE, không
  phải INSERT.** Khung giờ học mới có `Id` sẵn (Guid sinh ở property initializer) nên EF coi là "đã
  tồn tại" và phát ra `UPDATE ... WHERE Id = ...` cho một dòng chưa hề có trong database — lỗi
  `DbUpdateConcurrencyException: expected to affect 1 row(s), but actually affected 0 row(s)`. Cách
  đúng: thêm qua `db.KhungGioHoc.AddRange(...)`, hoặc `db.Entry(x).State = EntityState.Added`.
- **Xoá rồi thêm lại cùng một loại dòng trong một lần `SaveChanges`** cũng sinh cả DELETE lẫn UPDATE
  cho cùng một khoá. Dùng `ExecuteDeleteAsync` để xoá thẳng trong database rồi thêm mới.
- Sửa học sinh được gói trong **một transaction**: đổi lịch, dọn buổi cũ và sinh buổi mới phải cùng
  thành công, nếu không sẽ có lúc học sinh mất lịch mà buổi thì đã xoá.

## Nhật ký (Phase 6)

Nhật ký đã được GHI từ Phase 1 (`NhatKy`: ai làm gì, lúc nào, ảnh chụp trước/sau dạng JSON). Phase 6
mở đường ĐỌC ra cho người dùng:

- `GET /api/nhat-ky` lọc theo `tuNgay`/`denNgay` (ngày theo **giờ trung tâm**, backend tự đổi sang UTC
  theo `CaiDat.MuiGio` — người dùng không phải nghĩ tới UTC), `hanhDong`, `doiTuong` và
  `nguoiThucHienId`; mới nhất lên đầu; phân trang như mọi danh sách khác (trần 200 dòng một trang).
- **Giáo viên chỉ đọc được dòng do chính mình thực hiện.** Nhật ký có cả ảnh chụp số tiền và hành
  động lên dữ liệu của người khác nên không mở rộng hơn. Giáo viên gửi `nguoiThucHienId` của người
  khác thì tham số đó bị bỏ qua (trả về việc của chính mình) — báo lỗi sẽ vô tình xác nhận "người đó
  có nhật ký".
- Nhật ký là **sổ ghi một chiều**: dọn tài khoản kiểm thử thì gỡ người thực hiện (`NguoiThucHienId =
  NULL`) chứ không xoá dòng, nhờ vậy vết đổi số liệu còn lại dù tài khoản đã bị xoá.
- `thoiDiemUtc` trả ra có hậu tố `Z`. Giá trị `DateTime` đọc từ SQL không mang thông tin loại giờ nên
  mặc định nó được ghi ra dạng "trông như giờ địa phương"; controller gắn nhãn UTC ngay khi trả.

## Việc còn lại

- **Webhook hai chiều với Google Calendar**: sửa sự kiện trên Google hiện KHÔNG quay về hệ thống
  (đồng bộ một chiều hệ thống → Google). Muốn nhận thông báo của Google thì cần địa chỉ HTTPS công khai.
- **Sinh type từ OpenAPI** thay cho `src/api/types.ts` chép tay, và test frontend bằng Vitest.
- **Tự động đồng bộ lịch theo giờ** thay vì bấm tay: gọi `POST /api/google-calendar/dong-bo` với
  `tatCaGiaoVien: true` bằng một tài khoản admin hoặc job nội bộ.
- **Sinh mã QR tại chỗ** (hiện phụ thuộc `img.vietqr.io`, cần mạng) nếu sau này cần chạy offline.
