namespace ClassManagement.Api.Email;

/// <summary>
/// Cấu hình gửi email. Mật khẩu SMTP CHỈ nằm ở user-secrets (máy dev) hoặc biến môi trường của máy
/// chủ — không bao giờ nhập qua giao diện web và không bao giờ trả xuống frontend.
///
/// Thiếu cấu hình thì ứng dụng vẫn chạy bình thường: chỉ riêng việc gửi email (quên mật khẩu) báo lỗi
/// rõ ràng, và cũng không ai lấy lại được mật khẩu — nên nhớ cấu hình trước khi dùng thật.
/// </summary>
public class EmailOptions
{
    public const string TenMuc = "Email";

    public string? SmtpHost { get; set; }

    public int SmtpPort { get; set; } = 587;

    /// <summary>Tài khoản đăng nhập SMTP. Để trống nếu máy chủ không cần xác thực.</summary>
    public string? SmtpTaiKhoan { get; set; }

    public string? SmtpMatKhau { get; set; }

    /// <summary>Địa chỉ hiện trên thư gửi đi.</summary>
    public string? TuDiaChi { get; set; }

    public string TenNguoiGui { get; set; } = "ClassManagement";

    public bool DungTls { get; set; } = true;

    /// <summary>
    /// Chế độ giả: không gửi thư thật mà lưu vào hộp thư giả trong bộ nhớ, để thử luồng quên mật khẩu
    /// ở máy dev. Chỉ có tác dụng ở môi trường Development.
    /// </summary>
    public bool CheDoGia { get; set; }

    public bool DaCauHinh => CheDoGia || (!string.IsNullOrWhiteSpace(SmtpHost) && !string.IsNullOrWhiteSpace(TuDiaChi));
}
