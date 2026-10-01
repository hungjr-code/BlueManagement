using ClassManagement.Api.Entities;

namespace ClassManagement.Api.Google;

/// <summary>
/// Khách Google GIẢ — chỉ dùng ở máy dev khi bật <c>GoogleCalendar:CheDoGia</c>.
///
/// Mục đích: thử được toàn bộ luồng đồng bộ (đổi mã, làm mới token, chọn lịch, tạo/sửa/xoá sự kiện)
/// mà không cần tài khoản Google thật. Nhờ nó mà logic đồng bộ có kiểm thử đầu-cuối thật sự, thay vì
/// "viết xong rồi hy vọng chạy được".
///
/// KHÔNG bao giờ được dùng ở môi trường chạy thật: Program.cs chỉ đăng ký bản này khi
/// app.Environment.IsDevelopment() và CheDoGia = true.
/// </summary>
public class KhachGoogleCalendarGia(ILogger<KhachGoogleCalendarGia> ghiLog) : IKhachGoogleCalendar
{
    public static readonly List<SuKienGiaDaGui> SuKienDaGui = [];
    public static readonly List<string> SuKienDaXoa = [];

    /// <summary>Tiền tố mã uỷ quyền giả cho luồng đăng nhập; phần còn lại là email của tài khoản giả.</summary>
    public const string TienToDangNhap = "dang-nhap|";

    /// <summary>Tiền tố mã uỷ quyền giả cho luồng kết nối lịch.</summary>
    public const string TienToKetNoi = "ket-noi|";

    public Task<TokenGoogle> DoiMaUyQuyenAsync(string maUyQuyen, CancellationToken huyBo = default)
    {
        // Email lấy từ chính mã uỷ quyền giả: màn hình đồng ý giả nhét email vào đó, đóng vai trò của
        // id_token mà Google thật sẽ trả về.
        var viTri = maUyQuyen.IndexOf('|', StringComparison.Ordinal);
        var emailGia = viTri >= 0 ? maUyQuyen[(viTri + 1)..] : null;

        ghiLog.LogInformation("[Google giả] đổi mã uỷ quyền {Ma} thành refresh token", maUyQuyen);
        return Task.FromResult(new TokenGoogle(
            "access-gia",
            "refresh-gia-" + maUyQuyen,
            "id-token-gia",
            DateTime.UtcNow.AddHours(1),
            emailGia));
    }

    public Task<string> LamMoiAccessTokenAsync(string refreshToken, CancellationToken huyBo = default)
    {
        return Task.FromResult("access-gia-" + refreshToken[^6..]);
    }

    public Task<IReadOnlyList<LichGoogle>> LayDanhSachLichAsync(string accessToken, CancellationToken huyBo = default)
    {
        IReadOnlyList<LichGoogle> lich =
        [
            new("giao.vien.gia@classmanagement.local", "Giáo viên giả", true),
            new("lich-day-kem@group.calendar.google.com", "Dạy kèm", false),
        ];

        return Task.FromResult(lich);
    }

    public Task<string> TaoSuKienAsync(
        string accessToken,
        string calendarId,
        SuKienGoogle suKien,
        CancellationToken huyBo = default)
    {
        var id = "gia-" + Guid.NewGuid().ToString("N")[..12];
        SuKienDaGui.Add(new SuKienGiaDaGui(id, calendarId, suKien, "tao"));
        return Task.FromResult(id);
    }

    public Task CapNhatSuKienAsync(
        string accessToken,
        string calendarId,
        string eventId,
        SuKienGoogle suKien,
        CancellationToken huyBo = default)
    {
        SuKienDaGui.Add(new SuKienGiaDaGui(eventId, calendarId, suKien, "cap-nhat"));
        return Task.CompletedTask;
    }

    public Task XoaSuKienAsync(
        string accessToken,
        string calendarId,
        string eventId,
        CancellationToken huyBo = default)
    {
        SuKienDaXoa.Add(eventId);
        return Task.CompletedTask;
    }
}

/// <summary>Dấu vết những gì bản giả đã "gửi lên Google", để kiểm thử soi lại.</summary>
public record SuKienGiaDaGui(string Id, string CalendarId, SuKienGoogle SuKien, string HanhDong);
