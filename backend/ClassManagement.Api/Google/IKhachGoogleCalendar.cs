namespace ClassManagement.Api.Google;

/// <summary>Một lịch trong tài khoản Google của người dùng.</summary>
public record LichGoogle(string Id, string Ten, bool LaLichChinh);

/// <summary>
/// Token Google trả về sau khi đổi mã uỷ quyền.
/// </summary>
/// <param name="IdToken">
/// Token định danh Google trả về khi xin quyền openid email. Backend PHẢI xác thực chữ ký và nơi
/// phát hành của nó rồi mới tin email bên trong — không tin một chuỗi do phía gọi tự khai.
/// </param>
/// <param name="EmailGia">
/// Chỉ bản khách GIẢ ở máy dev mới đặt: email thay cho id_token, để thử được luồng đăng nhập khi
/// không có tài khoản Google thật. Bản chạy thật luôn để null.
/// </param>
public record TokenGoogle(
    string AccessToken,
    string? RefreshToken,
    string? IdToken,
    DateTime HetHanUtc,
    string? EmailGia = null);

/// <summary>Sự kiện gửi lên Google.</summary>
public record SuKienGoogle(
    string TieuDe,
    string? MoTa,
    DateTimeOffset BatDau,
    DateTimeOffset KetThuc,
    string MuiGio,
    int? NhacTruocPhut);

/// <summary>
/// Khách gọi Google Calendar. Có hai bản cài: bản thật gọi REST API của Google, bản giả chỉ chạy ở
/// máy dev để thử luồng đồng bộ khi chưa có tài khoản Google. Mọi thứ phía trên đều nói chuyện qua
/// giao diện này nên logic đồng bộ kiểm thử được mà không cần mạng.
/// </summary>
public interface IKhachGoogleCalendar
{
    Task<TokenGoogle> DoiMaUyQuyenAsync(string maUyQuyen, CancellationToken huyBo = default);

    Task<string> LamMoiAccessTokenAsync(string refreshToken, CancellationToken huyBo = default);

    Task<IReadOnlyList<LichGoogle>> LayDanhSachLichAsync(string accessToken, CancellationToken huyBo = default);

    Task<string> TaoSuKienAsync(string accessToken, string calendarId, SuKienGoogle suKien, CancellationToken huyBo = default);

    Task CapNhatSuKienAsync(string accessToken, string calendarId, string eventId, SuKienGoogle suKien, CancellationToken huyBo = default);

    Task XoaSuKienAsync(string accessToken, string calendarId, string eventId, CancellationToken huyBo = default);
}
