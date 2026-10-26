using System.Text;

namespace ClassManagement.Api.Auth;

/// <summary>
/// Cấu hình token, đọc từ mục "Jwt". Khoá ký không bao giờ nằm trong appsettings.json: khi chạy
/// máy dev thì để trong user-secrets, khi chạy thật thì để trong biến môi trường của máy chủ.
/// </summary>
public class JwtOptions
{
    public const string TenMuc = "Jwt";

    public string Issuer { get; set; } = "ClassManagement";

    public string Audience { get; set; } = "ClassManagement.Web";

    public string? Key { get; set; }

    /// <summary>
    /// Access token sống ngắn vì nó nằm trong RAM của trình duyệt; hết hạn thì gọi /api/auth/refresh
    /// để lấy cái mới. Refresh token nằm trong cookie httpOnly và sống dài hơn.
    /// </summary>
    public int AccessTokenMinutes { get; set; } = 30;

    public int RefreshTokenDays { get; set; } = 14;

    /// <summary>
    /// Audience riêng cho token của HỌC SINH.
    ///
    /// Đây là hàng rào cứng giữa hai loại tài khoản: token học sinh mang audience này nên middleware
    /// xác thực của giáo viên từ chối thẳng, chứ không phụ thuộc vào việc từng controller có nhớ kiểm
    /// tra vai trò hay không. Đổi giá trị này là đăng xuất hết học sinh — không sao, họ đăng nhập lại
    /// bằng mã học sinh.
    /// </summary>
    public string AudienceHocSinh => Audience + ".hoc-sinh";

    /// <summary>Dừng ngay lúc khởi động nếu cấu hình thiếu, thay vì lỗi mơ hồ lúc đăng nhập.</summary>
    public void KiemTraHopLe()
    {
        if (string.IsNullOrWhiteSpace(Key) || Encoding.UTF8.GetByteCount(Key) < 32)
        {
            throw new InvalidOperationException(
                "Thiếu khoá ký JWT (Jwt:Key) hoặc khoá ngắn hơn 32 byte. Đặt bằng lệnh:\n"
                + "  dotnet user-secrets set \"Jwt:Key\" \"<chuỗi ngẫu nhiên dài ít nhất 32 ký tự>\"\n"
                + "khi chạy thật thì đặt biến môi trường Jwt__Key trên máy chủ.");
        }

        if (AccessTokenMinutes <= 0)
        {
            throw new InvalidOperationException("Jwt:AccessTokenMinutes phải lớn hơn 0.");
        }

        if (RefreshTokenDays <= 0)
        {
            throw new InvalidOperationException("Jwt:RefreshTokenDays phải lớn hơn 0.");
        }
    }
}
