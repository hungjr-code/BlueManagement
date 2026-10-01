# ClassManagement — Frontend

Giao diện quản lý dạy kèm cho **nhiều giáo viên**: mỗi giáo viên quản lý học sinh của mình,
chủ (admin) quản lý tất cả. Gồm lịch dạy đồng bộ Google Calendar, nhập liệu học sinh và học phí,
điểm danh từng buổi, và thu tiền bằng mã QR.

Vite + React 19 + TypeScript, UI bằng Ant Design 6.

Trạng thái: **Phase 1 → 6 xong** — mọi màn hình nghiệp vụ đã nối API thật (không còn màn hình khung),
backend ở `backend/ClassManagement.Api` (ASP.NET Core 9 + SQL Server Express). Chưa có test tự động ở
phía frontend (chỉ `typecheck` và `lint`); nghiệp vụ được kiểm bằng các bộ `backend/kiem-thu-phase*.py`
chạy trên API thật.

## Chạy dự án

Cần chạy **cả hai** phía:

```bash
# 1. Backend (xem backend/README.md để cấu hình lần đầu)
cd backend/ClassManagement.Api && dotnet run --launch-profile http   # http://localhost:5080

# 2. Frontend
cd frontend
npm install
npm run dev            # http://localhost:5173
npm run dev -- --host  # thêm nếu muốn mở từ máy khác trong LAN
```

Các lệnh khác:

```bash
npm run typecheck    # tsc -b — kiểm tra kiểu, không phát sinh file
npm run lint         # oxlint
npm run build        # typecheck + build ra dist/
npm run preview      # chạy thử bản build
```

Đăng nhập bằng tài khoản admin do backend tạo lúc chạy lần đầu: email ở `Seed:Admin:Email`
trong `backend/ClassManagement.Api/appsettings.json`, mật khẩu ở user-secrets
(`dotnet user-secrets list` trong thư mục backend để xem).

## Đăng nhập và phiên làm việc (Phase 1)

- **Access token chỉ nằm trong RAM** (`src/api/http.ts`), không lưu localStorage — XSS đọc được
  localStorage là mất token. F5 là mất token, nên khi mở lại trang app gọi
  `POST /api/auth/refresh` để dựng lại phiên từ cookie.
- **Refresh token nằm trong cookie `httpOnly`** do backend đặt, giới hạn ở đường dẫn `/api/auth`;
  JavaScript không đọc được, trình duyệt tự gửi kèm nhờ `withCredentials`.
- Gặp 401 thì interceptor tự gọi `/api/auth/refresh` **đúng một lần** rồi chạy lại request cũ.
  Các lời gọi làm mới được gộp thành một (`lamMoiPhienMotLan`) vì backend xoay vòng refresh token:
  hai request làm mới song song sẽ bị coi là token bị lộ và đăng xuất cả tài khoản.
- `RequireAuth` (`src/app/session.tsx`) chặn mọi màn hình nghiệp vụ; đang khôi phục phiên thì hiện
  vòng xoay chứ không nháy trang đăng nhập. Hết phiên ở bất kỳ request nào cũng tự đưa về `/login`
  vì `tokenStore` báo cho provider khi token bị xoá.
- **Giấu menu không phải là phân quyền.** Mục "Giáo viên" chỉ hiện với admin, nhưng mọi kiểm tra
  quyền thật đều nằm ở backend: giáo viên gọi thẳng API của người khác vẫn bị chặn (404/403).

## Yêu cầu → trang nào

| Yêu cầu | Trang | Route | Trạng thái |
|---|---|---|---|
| Xem tên và lịch học sinh dạy trong tuần này, thông báo **hôm nay dạy ai** | Tổng quan | `/` | đã nối API |
| Lịch liên kết **Google Calendar** để xem lịch xếp của học sinh | Lịch dạy | `/schedule` | đã nối API — ô lịch tuần/tháng |
| **Nhập liệu** tên học sinh, giáo viên phụ trách, tiền từng buổi (hoặc tháng), tuần học mấy buổi | Học sinh | `/students` | đã nối API |
| Nút đánh dấu đúng ngày học là **đi học hay nghỉ**, kèm **ghi chú** | Điểm danh | `/attendance` | đã nối API — ô lịch tuần/tháng |
| **Ai sắp đến hạn đóng tiền**, tổng hợp từng buổi đi học/nghỉ, bấm **Tính tiền → mã QR kèm số tiền** | Học phí | `/tuition` | đã nối API |
| Nhiều giáo viên, vai trò admin / giáo viên, số học sinh mỗi người phụ trách | Giáo viên | `/teachers` | đã nối API |
| Tra lại **ai đổi số liệu gì, lúc nào, từ giá trị nào sang giá trị nào** | Nhật ký | `/nhat-ky` | đã nối API |
| Tài khoản nhận tiền cho mã QR (của từng giáo viên), OAuth Google, múi giờ, nhắc trước buổi học | Cài đặt | `/settings` | đã nối API |

Ngoài `/login` còn ba màn hình công khai cho việc tài khoản: `/dang-ky` (tự tạo tài khoản hoặc đăng ký
bằng Google), `/quen-mat-khau` (xin thư đặt lại mật khẩu), `/dat-lai-mat-khau?token=…` (đặt mật khẩu mới
bằng liên kết trong thư). Tài khoản tự tạo luôn là giáo viên — không có đường tự phong admin.

## Phân quyền

Hai vai trò: **admin (chủ)** và **giáo viên**. Bảng đối chiếu đầy đủ nằm ngay trong trang Giáo viên.

Nguyên tắc bắt buộc: giáo viên chỉ thấy học sinh có `giaoVienId` là mình. Việc ẩn nút ở frontend chỉ để
gọn mắt — **mọi kiểm tra quyền phải chặn ở backend**, vì gọi thẳng API của người khác vẫn phải bị từ chối.
Admin đầu tiên phải tạo bằng seed hoặc công cụ dòng lệnh, không cho tự đăng ký thành admin qua web.

## Giao diện ô lịch (Lịch dạy + Điểm danh)

Hai màn hình dùng chung một lưới lịch, không dùng component lịch của Ant Design (lịch có sẵn chỉ nhận
một nhãn ngắn mỗi ngày, ở đây mỗi ô phải chứa nhiều thẻ học sinh):

| Thành phần | Việc |
|---|---|
| `src/components/lich/LuoiLich.tsx` | Lưới 7 cột (T2 → CN), mỗi ô một ngày; tô nhạt ô hôm nay và cuối tuần |
| `src/components/lich/TheBuoi.tsx` | Thẻ một buổi: **giờ — tên học sinh — lớp**, nhãn “bù”, chấm trạng thái điểm danh |
| `src/components/lich/khoangXem.ts` | Tính khoảng đang xem (tuần hoặc tháng) và mốc sau khi lùi/tiến — hai màn hình dùng chung để không lệch ngày |
| `src/config/mauHocSinh.ts` | Bảng 12 màu nhạt, **mỗi học sinh một màu cố định** (băm id) trên mọi ô |

- Chế độ **Tuần** hoặc **Tháng**; tháng được căn đủ tuần ở cả hai đầu nên cột nào cũng đúng thứ.
- Màn hình Lịch dạy: bấm thẻ mở ngăn chi tiết (giáo viên, ghi chú, trạng thái Google Calendar).
- Màn hình Điểm danh: bấm thẻ mở hộp đánh dấu — Đi học / Nghỉ (có phép · không phép), ghi chú, và
  nói trước nếu lần lưu này sẽ ghi nhật ký; thanh dưới cùng đếm số buổi chưa lưu và giữ nút Lưu.
- Ba trạng thái phân biệt bằng mắt: chưa điểm danh (vòng rỗng xám) · đi học (chấm xanh) · nghỉ (vòng
  rỗng đỏ). Bỏ trống KHÔNG phải là nghỉ nên hai thứ này không được giống nhau.
- Phong cách tối giản: giao diện gần như đơn sắc (mực đen `#111827` + xám rất nhạt + viền mảnh), màu
  sắc để dành cho dữ liệu. Token theme nằm ở `src/main.tsx`, quy ước ô lịch ở `src/index.css`.

## Thu tiền bằng mã QR

Trang Học phí có nút **Tính tiền** trên từng dòng; bấm vào mở hộp thoại chứa mã QR VietQR (NAPAS 247)
kèm đúng số tiền và nội dung chuyển khoản, kèm nút sao chép nội dung và nút "Đã nhận tiền".

Mã QR lấy từ `img.vietqr.io` theo tài khoản khai ở Cài đặt, thay vì tự dựng chuỗi EMVCo: định dạng đó
có CRC và nhiều trường bắt buộc, tự viết mà không quét thử được thì rủi ro sai mã. Đổi lại cần mạng để
tải ảnh; hộp thoại có trạng thái lỗi riêng và nút thử lại. Phase 4 nếu cần chạy offline mới cân nhắc
sinh mã tại chỗ.

**Tài khoản nhận tiền là của từng giáo viên, không phải của trung tâm.** Mỗi người tự khai tài khoản
của mình ở Cài đặt (`PUT /api/teachers/me/tai-khoan-nhan-tien`) vì học phí chảy về tài khoản người dạy:

- Không ai khai hộ ai — không có endpoint nào sửa tài khoản của người khác, kể cả admin.
- Số tài khoản chỉ đi kèm phiên đăng nhập của chính người đó (`nguoiDung.taiKhoanNhanTien`), không
  hiện ở màn hình nào khác.
- Admin chỉ thấy **số lượng**: bao nhiêu giáo viên đã khai, chưa khai, và tên những người còn thiếu.
- Hộp thoại thu tiền nhận tài khoản qua prop `taiKhoan`; luồng thật ở Phase 4 sẽ truyền tài khoản của
  giáo viên dạy học sinh đó vào.

Mẫu nội dung chuyển khoản vẫn là cấu hình chung (`GET/PUT /api/settings`, admin sửa), chỗ chèn là
`{tenHocSinh}` và `{thang}`.

## Hợp đồng với backend

Frontend gọi API qua đường dẫn tương đối `/api`; Vite proxy chuyển tiếp sang
`VITE_PROXY_TARGET` (mặc định `http://localhost:5080`). Nhờ đi qua proxy:

- Backend **không cần** bật CORS ở môi trường dev.
- Trình duyệt thấy FE và BE cùng origin, nên cookie `httpOnly` (refresh token) hoạt động đúng.

Endpoint đang được gọi:

| Nhóm | Endpoint | Màn hình dùng |
|---|---|---|
| Sức khoẻ | `GET /api/health` | Tổng quan (widget Kết nối backend) |
| Đăng nhập | `POST /api/auth/login`, `/refresh`, `/logout`, `GET /api/auth/me`, `POST /api/auth/doi-mat-khau` | Trang đăng nhập, header |
| Giáo viên | `GET/POST/PUT /api/teachers` | (Phase 2) |
| Học sinh | `GET /api/students` | (Phase 2) |
| Cài đặt | `GET/PUT /api/settings` | Cài đặt (cấu hình chung) |
| Tài khoản nhận tiền | `PUT /api/teachers/me/tai-khoan-nhan-tien` | Cài đặt (mỗi giáo viên khai của mình) |

Các endpoint còn lại mà từng màn hình đang chờ, ghi ngay trên màn hình đó:

| Trang | Endpoint |
|---|---|
| Tổng quan | `/api/dashboard/hom-nay`, `/api/dashboard/tuan-nay` |
| Lịch dạy | `/api/schedule`, `/api/google-calendar/*` |
| Học sinh | `POST/PUT/DELETE /api/students` |
| Điểm danh | `GET/POST /api/attendance` |
| Học phí | `GET /api/tuition?thang=&nam=`, `POST /api/tuition/{id}/thanh-toan` |
| Cài đặt | `GET /api/google-calendar/status` |
| Nhật ký | `GET /api/nhat-ky`, `GET /api/nhat-ky/danh-muc` |

Muốn đổi cổng backend: sửa `VITE_PROXY_TARGET` trong `.env.local` (đừng sửa `.env.development`,
file đó dùng chung cho cả nhóm) và cho API listen đúng cổng 5080.

## Cấu trúc thư mục

```
src/
├─ api/          http.ts (axios + ApiError + token + tự làm mới phiên), auth.ts, settings.ts,
│                types.ts (kiểu dùng chung), health.ts, queryClient.ts
├─ app/          router.tsx (khai báo route + RequireAuth), AppLayout.tsx (menu + header)
│                session.tsx (SessionProvider, usePhien, RequireAuth)
├─ components/   page.tsx (PageHeader + ScaffoldPage + bảng Trường dữ liệu)
│                PaymentQrModal.tsx (hộp thoại thu tiền bằng mã QR)
│                BackendStatus.tsx (widget kiểm tra kết nối API)
├─ config/       env.ts (nơi DUY NHẤT đọc import.meta.env)
│                nganHang.ts (danh sách ngân hàng + sinh URL mã QR, không lưu gì)
├─ lib/          money.ts (định dạng tiền VN)
├─ features/     auth (đăng nhập, đổi mật khẩu), dashboard, schedule, students, attendance,
│                tuition, teachers, settings, errors
├─ env.d.ts      khai báo kiểu cho biến môi trường
├─ index.css     reset tối thiểu
└─ main.tsx      providers: ConfigProvider → AntApp → React Query → SessionProvider → Router
```

Thêm một màn hình mới gồm 2 bước:

1. Tạo `src/features/<tên>/<Tên>Page.tsx`, dùng `ScaffoldPage` và khai báo `fields` + `checklist`
   (thêm `daNoiApi` khi màn hình đã dùng API thật).
2. Thêm route trong `src/app/router.tsx` **và** một mục trong `navItems` của `AppLayout.tsx`.

`key` của mục menu phải trùng `path` của route — nhờ vậy menu và router không lệch nhau.

## Quy ước đã chốt

- **Mỗi màn hình tự khai báo trường dữ liệu** qua prop `fields` của `ScaffoldPage`. Bảng này vừa hiển thị
  cho người xem, vừa là đặc tả để viết entity và DTO ở backend — chốt trước khi code API.
- **Không hiển thị số liệu giả.** Chưa có API thì để `—` hoặc trạng thái rỗng kèm ghi chú, không để số 0.
- **Số buổi đi học / nghỉ không bao giờ nhập tay** — luôn đếm từ bảng điểm danh.
- **Buổi chưa điểm danh khác với nghỉ.** Bỏ trống mà coi là nghỉ thì học phí sẽ tính sai.
- **Access token chỉ nằm trong RAM**, không dùng `localStorage` (XSS đọc được). Refresh token nằm trong
  cookie `httpOnly` do backend set.
- **Không gọi static method của Ant Design** (`message.success(...)`). Dùng hook qua `App.useApp()` để
  nhận đúng theme và locale tiếng Việt.
- **Mọi lỗi API đi qua `ApiError`** (`src/api/http.ts`): đọc `error.status`, `error.isNetworkError`,
  `error.fieldMessages` thay vì tự bóc `axios` error ở từng màn hình.
- **Enum giữa hai phía là chuỗi có nghĩa** (`admin`, `theo_buoi`…), khai một chỗ ở `src/api/types.ts`
  và phải khớp `backend/ClassManagement.Api/Entities/Enums.cs`.
- **Màn hình tách gói theo route** (`lazy` trong `router.tsx`); Tổng quan giữ eager.
- Ngày tháng hiển thị bằng `dayjs` đã set locale `vi` (dd/MM/yyyy); tuần tính từ **thứ 2 đến chủ nhật**.
- Biến môi trường phải khai báo kiểu trong `src/env.d.ts`, nếu không `npm run typecheck` sẽ không bắt được
  lỗi gõ sai tên.
- **Client Secret của Google không bao giờ đi qua giao diện web** — chỉ nằm ở biến môi trường backend.

## Các phase

- **Phase 1 — xong**: backend ASP.NET Core 9 trên SQL Server Express, đăng nhập hai vai trò, chặn
  quyền theo `giaoVienId`, `/api/health`, cấu hình chung qua `/api/settings`, trang đăng nhập.
- **Phase 2 — xong**: form nhập/sửa học sinh, sinh buổi học lặp hằng tuần, điểm danh Đi học/Nghỉ kèm
  ghi chú và nhật ký sửa đổi, khối "hôm nay dạy ai", lọc theo giáo viên, quản lý tài khoản giáo viên.
- **Phase 3 — xong**: OAuth 2.0 ở backend, mỗi giáo viên nối lịch riêng, tạo/cập nhật/xoá sự kiện theo
  buổi học, chọn lịch đích. Còn thiếu webhook đồng bộ hai chiều (cần HTTPS công khai).
- **Phase 4 — xong**: danh sách sắp đến hạn, tổng hợp điểm danh thành tiền, phiếu thu + QR, đối chiếu
  giao dịch ngân hàng, chốt sổ, xuất Excel.
- **Phase 5 — xong**: tự đăng ký, đăng ký/đăng nhập bằng Google, quên và đặt lại mật khẩu qua email.
- **Phase 6 — xong**: màn hình Nhật ký đọc lại thay đổi (admin thấy tất cả, giáo viên chỉ thấy việc
  của mình).
- **Kỹ thuật còn lại**: sinh type từ OpenAPI thay cho type chép tay trong `src/api/types.ts`; tách
  vendor chunk (`auth-*.js` đang ~744 kB, gzip ~243 kB vì gói cả antd); test frontend bằng Vitest.
