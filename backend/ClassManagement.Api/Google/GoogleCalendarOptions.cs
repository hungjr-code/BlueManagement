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
    /// Ba địa chỉ (gọi lại khi kết nối lịch, gọi lại khi đăng nhập, địa chỉ giao diện) còn nguyên chỗ
    /// trống của tài liệu. Đây là bẫy hay gặp nhất khi lên máy chủ: đã điền ClientId/ClientSecret
    /// nhưng quên đổi ba địa chỉ này, nên Google chuyển hướng về một tên miền không tồn tại và người
    /// dùng chỉ biết là "đăng nhập bằng Google không được", không biết vì sao.
    /// </summary>
    public bool DiaChiConChoTrong =>
        LaGiaTriMau(RedirectUri) || LaGiaTriMau(RedirectUriDangNhap) || LaGiaTriMau(FrontendUrl);

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

        // Chỗ trống trong appsettings.Production.json viết là "https://THAY-BANG-TEN-MIEN/...": không có
        // dấu ngoặc nhọn nào, nên phải nhận riêng, không thì nó đi lọt qua và bị coi là địa chỉ thật.
        if (giaTriDaCat.Contains("THAY-BANG", StringComparison.OrdinalIgnoreCase))
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
    /// Quyền trên Google Drive để giáo viên gửi tài liệu (đề bài, phiếu bài tập) cho học sinh.
    ///
    /// Cố tình dùng <c>drive.file</c> — hẹp nhất có thể: app CHỈ thấy được những tệp do chính nó tạo,
    /// không đọc được phần còn lại của Drive. Nhờ vậy xin quyền này không mở rộng phạm vi dữ liệu
    /// của người dùng, và tệp không cần mở công khai: học sinh tải qua app.
    /// </summary>
    public static readonly string[] QuyenDrive =
    [
        "https://www.googleapis.com/auth/drive.file",
    ];

    /// <summary>
    /// Toàn bộ quyền xin trong MỘT lần cấp quyền, dùng chung cho cả đăng nhập, kết nối lịch và gửi
    /// tài liệu: người dùng đồng ý một lần là dùng được cả ba việc.
    /// </summary>
    public static IReadOnlyList<string> QuyenCanXin { get; } = [.. QuyenDangNhap, .. QuyenLich, .. QuyenDrive];

    public static string QuyenChuoi => string.Join(' ', QuyenCanXin);

    /// <summary>
    /// Token đã cấp có quyền ghi tài liệu lên Drive chưa. Người kết nối TRƯỚC khi app bổ sung quyền
    /// này sẽ thiếu nó, và Google trả 403 khi app cố tải tệp lên — nên phải phát hiện sớm để bảo họ
    /// kết nối lại, thay vì để họ gặp một lỗi khó hiểu lúc gửi bài.
    /// </summary>
    public static bool CoQuyenDrive(string? quyenDaCap)
    {
        return !string.IsNullOrWhiteSpace(quyenDaCap)
            && quyenDaCap.Contains("drive.file", StringComparison.OrdinalIgnoreCase);
    }
}
