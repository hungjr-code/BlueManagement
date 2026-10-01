namespace ClassManagement.Api.Google;

/// <summary>
/// Cấu hình kết nối Google Calendar. Client Secret CHỈ nằm ở user-secrets (máy dev) hoặc biến môi
/// trường của máy chủ — không bao giờ nhập qua giao diện web và không bao giờ trả xuống frontend.
///
/// Thiếu cấu hình thì ứng dụng vẫn chạy bình thường: chỉ các endpoint Google báo lỗi rõ ràng,
/// vì lịch dạy, điểm danh và học phí không được phép phụ thuộc vào Google.
/// </summary>
public class GoogleCalendarOptions
{
    public const string TenMuc = "GoogleCalendar";

    public string? ClientId { get; set; }

    public string? ClientSecret { get; set; }

    /// <summary>Địa chỉ Google gọi lại khi giáo viên bấm "Kết nối Google Calendar" trong Cài đặt.</summary>
    public string RedirectUri { get; set; } = "http://localhost:5080/api/google-calendar/callback";

    /// <summary>
    /// Địa chỉ Google gọi lại khi bấm "Đăng nhập bằng Google" ở màn hình đăng nhập. Phải KHÁC địa chỉ
    /// trên vì hai luồng xử lý ở hai controller khác nhau — và cả hai đều phải khai trong Google
    /// Cloud Console.
    /// </summary>
    public string RedirectUriDangNhap { get; set; } = "http://localhost:5080/api/auth/google/callback";

    /// <summary>Địa chỉ giao diện, để sau khi cấp quyền thì đưa người dùng quay lại đúng màn hình Cài đặt.</summary>
    public string FrontendUrl { get; set; } = "http://localhost:5173";

    /// <summary>
    /// Chế độ giả: dùng khách Google giả để thử luồng đồng bộ ở máy dev mà không cần tài khoản thật.
    /// Chỉ có tác dụng ở môi trường Development — máy chạy thật luôn dùng khách thật.
    /// </summary>
    public bool CheDoGia { get; set; }

    /// <summary>
    /// Có dùng được Google thật hay không. Giá trị còn nguyên chỗ trống trong tài liệu (ví dụ
    /// <c>&lt;client id&gt;.apps.googleusercontent.com</c>) KHÔNG tính là đã cấu hình: nếu tính là đã
    /// cấu hình thì màn hình đăng nhập vẫn mở nút Google và người dùng nhận lỗi 401 invalid_client của
    /// Google, thay vì đọc được lời giải thích ngay trên giao diện.
    /// </summary>
    public bool DaCauHinh => !LaGiaTriMau(ClientId) && !LaGiaTriMau(ClientSecret);

    /// <summary>
    /// Chỗ trống trong tài liệu bị chép nguyên văn vào user-secrets là chuyện thường gặp: tài liệu ghi
    /// <c>dotnet user-secrets set "GoogleCalendar:ClientId" "&lt;client id&gt;..."</c> mà dấu ngoặc nhọn
    /// lại dễ bị dán luôn. Nhận ra chúng để báo "chưa cấu hình" cho đúng.
    /// </summary>
    private static bool LaGiaTriMau(string? giaTri)
    {
        if (string.IsNullOrWhiteSpace(giaTri))
        {
            return true;
        }

        var giaTriDaCat = giaTri.Trim();

        if (giaTriDaCat.Contains('<') || giaTriDaCat.Contains('>'))
        {
            return true;
        }

        return giaTriDaCat.Equals("client id", StringComparison.OrdinalIgnoreCase)
            || giaTriDaCat.Equals("client id.apps.googleusercontent.com", StringComparison.OrdinalIgnoreCase)
            || giaTriDaCat.Equals("client secret", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Quyền nền để biết người đang đăng nhập là ai: chỉ cần định danh và email. Không xin quyền xem
    /// hồ sơ, không xin quyền Gmail hay Drive.
    /// </summary>
    public static readonly string[] QuyenDangNhap =
    [
        "openid",
        "email",
    ];

    /// <summary>Quyền trên lịch: ghi/đọc sự kiện, và xem danh sách lịch để chọn lịch đích.</summary>
    public static readonly string[] QuyenLich =
    [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    ];

    /// <summary>
    /// Toàn bộ quyền xin trong MỘT lần cấp quyền, dùng chung cho cả đăng nhập và kết nối lịch: người
    /// dùng đồng ý một lần là vừa đăng nhập được, vừa có sẵn đường đồng bộ lịch.
    /// </summary>
    public static IReadOnlyList<string> QuyenCanXin { get; } = [.. QuyenDangNhap, .. QuyenLich];

    public static string QuyenChuoi => string.Join(' ', QuyenCanXin);
}
