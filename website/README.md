# Trang web cho Google OAuth: trang chủ + quyền riêng tư + điều khoản

Thư mục này chứa **3 trang tĩnh** đúng những gì Google yêu cầu khai trong màn hình đồng ý
(Google Auth Platform → **Branding → App domain**):

| Tệp | Khai vào ô nào của Google |
|---|---|
| `index.html` | **Application home page** — trang giới thiệu ứng dụng, có nút **Đăng nhập** dẫn sang `/login` của ứng dụng |
| `quyen-rieng-tu.html` | **Application privacy policy link** |
| `dieu-khoan.html` | **Application terms of service link** |

Google yêu cầu: trang chủ phải mô tả được ứng dụng (không được chỉ là một trang đăng nhập), và
**chính sách quyền riêng tư phải nằm cùng tên miền với trang chủ**. Ba trang này đã đáp ứng sẵn, chỉ
cần sửa các chỗ trong ngoặc vuông rồi đưa lên mạng.

## 1. Sửa các chỗ cần điền

Các chỗ cần thay đều viết trong ngoặc vuông, tìm là thấy: `[TÊN TRUNG TÂM]`, `[EMAIL LIÊN HỆ]`,
`[NGƯỜI PHỤ TRÁCH]`, `[ĐỊA CHỈ LIÊN HỆ]`, `[NƠI ĐẶT MÁY CHỦ]`, `[NGÀY CẬP NHẬT]`, `[NĂM]`,
`[ĐỊA CHỈ TRANG WEB NÀY]` (địa chỉ sẽ deploy, ví dụ `https://trungtam.vn`), và
`[ĐỊA CHỈ ỨNG DỤNG]` (địa chỉ ứng dụng, ví dụ `https://trungtam.vn` hoặc `http://localhost:5173`
khi chạy ở máy).

Thay nhanh bằng PowerShell (sửa giá trị rồi chạy một lần, đứng trong thư mục `website`):

```powershell
$ten = "Trung tâm dạy kèm ABC"
$email = "lienhe@trungtam.vn"
$web = "https://trungtam.vn"
$ungdung = "https://trungtam.vn"
$nguoi = "Nguyễn Văn A"
$ngay = "01/10/2026"
Get-ChildItem *.html | ForEach-Object {
  $n = Get-Content -Raw -Encoding UTF8 $_.FullName
  $n = $n -replace '\[TÊN TRUNG TÂM\]', $ten -replace '\[EMAIL LIÊN HỆ\]', $email
  $n = $n -replace '\[ĐỊA CHỈ TRANG WEB NÀY\]', $web -replace '\[ĐỊA CHỈ ỨNG DỤNG\]', $ungdung
  $n = $n -replace '\[NGƯỜI PHỤ TRÁCH\]', $nguoi -replace '\[NGÀY CẬP NHẬT\]', $ngay
  $n = $n -replace '\[NĂM\]', "2026" -replace '\[NƠI ĐẶT MÁY CHỦ\]', "máy chủ của trung tâm"
  $n = $n -replace '\[ĐỊA CHỈ LIÊN HỆ\]', "địa chỉ của trung tâm"
  Set-Content -Encoding UTF8 $_.FullName $n
}
```

Kiểm tra lại bằng cách mở `index.html` trong trình duyệt, hoặc xem trước bằng web server tạm:

```powershell
cd C:\Joel_vh\ClassManagement\website
python -m http.server 8099
# rồi mở http://localhost:8099
```

## 2. Đưa lên mạng

**Cách A — có tên miền riêng (khuyến nghị, đi được tới cùng):** copy 4 tệp
(`index.html`, `quyen-rieng-tu.html`, `dieu-khoan.html`, `style.css`) lên hosting của trung tâm, ví dụ
`https://trungtam.vn/classmanagement/` hoặc đưa thẳng lên thư mục gốc. Sau đó khai tên miền
`trungtam.vn` vào ô **Authorized domains**. Đây là cách duy nhất đi trọn được tới bước Google xác minh
(Google còn yêu cầu xác minh quyền sở hữu tên miền qua Search Console).

**Cách B — deploy nhanh để thử (miễn phí):** kéo–thả cả thư mục `website` vào
[app.netlify.com/drop](https://app.netlify.com/drop), hoặc dùng Cloudflare Pages / Vercel / GitHub
Pages. Bạn sẽ có ngay một địa chỉ kiểu `https://ten-ngau-nhien.netlify.app` để khai vào Google và
kiểm tra giao diện.
**Lưu ý quan trọng:** với tên miền miễn phí dạng `*.netlify.app` / `*.github.io`, Google thường
không cho khai vào **Authorized domains** (vì bạn không sở hữu tên miền đó) — nên cách B chỉ để xem
trước/khai tạm, còn khi cần chạy thật và xác minh thì nên có tên miền riêng (khoảng vài trăm nghìn
đồng một năm).

## 3. Dán vào Google Cloud Console

Vào **Google Auth Platform → Branding → App domain** và điền:

- **Application home page**: `https://<tên miền>/` (ví dụ `https://trungtam.vn/`)
- **Application privacy policy link**: `https://<tên miền>/quyen-rieng-tu.html`
- **Application terms of service link**: `https://<tên miền>/dieu-khoan.html`

Rồi xuống mục **Authorized domains**, thêm đúng tên miền đó (ví dụ `trungtam.vn`).
Link privacy policy ở đây **phải trùng** với link khai trong màn hình đồng ý — Google kiểm tra việc này.

## 4. Nút “Đăng nhập” trên trang chủ

Trang chủ có nút **Đăng nhập vào ứng dụng** trỏ tới `[ĐỊA CHỈ ỨNG DỤNG]/login`. Khi chạy ở máy thì
để `http://localhost:5173`, khi deploy thật thì để địa chỉ thật của ứng dụng. Nếu ứng dụng và trang
web này cùng một tên miền (ví dụ trang chủ ở `/` và ứng dụng ở `/login`), Google coi như một sản phẩm
duy nhất với người dùng.
