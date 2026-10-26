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
/// <param name="Quyen">
/// Chuỗi quyền Google thực sự đã cấp cho lần uỷ quyền này (trường "scope" trong phản hồi đổi mã).
/// Lưu lại để biết người dùng đã cấp quyền ghi Drive chưa — thiếu thì phải kết nối lại.
/// </param>
public record TokenGoogle(
    string AccessToken,
    string? RefreshToken,
    string? IdToken,
    DateTime HetHanUtc,
    string? EmailGia = null,
    string? Quyen = null);

/// <summary>
/// Một sự kiện ĐỌC VỀ từ Google Calendar (chiều Google → app), chỉ gồm thứ cần để đối chiếu với
/// buổi học trong app: nó đã bị huỷ chưa, giờ bắt đầu/kết thúc hiện tại là gì, và Google sửa lúc nào.
/// </summary>
public record SuKienGoogleDaDoc(
    string Id,
    bool DaHuy,
    string? TieuDe,
    DateTimeOffset? BatDau,
    DateTimeOffset? KetThuc,
    DateTime? CapNhatUtc);

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

    /// <summary>
    /// Những sự kiện đã thay đổi kể từ mốc <paramref name="tuUtc"/> (kể cả sự kiện đã bị huỷ/xoá:
    /// Google trả chúng với trạng thái "cancelled"). Bỏ trống mốc thì trả về toàn bộ sự kiện app đã tạo.
    /// </summary>
    Task<IReadOnlyList<SuKienGoogleDaDoc>> LaySuKienThayDoiAsync(
        string accessToken,
        string calendarId,
        DateTime? tuUtc,
        CancellationToken huyBo = default);

    /// <summary>Đọc một sự kiện theo id. Trả null nếu sự kiện không còn (đã bị xoá hẳn).</summary>
    Task<SuKienGoogleDaDoc?> LaySuKienAsync(
        string accessToken,
        string calendarId,
        string eventId,
        CancellationToken huyBo = default);

    Task<string> TaoSuKienAsync(string accessToken, string calendarId, SuKienGoogle suKien, CancellationToken huyBo = default);

    Task CapNhatSuKienAsync(string accessToken, string calendarId, string eventId, SuKienGoogle suKien, CancellationToken huyBo = default);

    Task XoaSuKienAsync(string accessToken, string calendarId, string eventId, CancellationToken huyBo = default);
}
