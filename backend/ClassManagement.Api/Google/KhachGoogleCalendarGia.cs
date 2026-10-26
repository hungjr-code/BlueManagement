using ClassManagement.Api.Entities;

namespace ClassManagement.Api.Google;

/// <summary>
/// Khách Google GIẢ — chỉ dùng ở máy dev khi bật <c>GoogleCalendar:CheDoGia</c>.
///
/// Mục đích: thử được TOÀN BỘ hai chiều đồng bộ (đổi mã, làm mới token, chọn lịch, tạo/sửa/xoá sự
/// kiện, và đọc thay đổi từ Google về) mà không cần tài khoản Google thật. Nhờ nó mà logic đồng bộ
/// có kiểm thử đầu-cuối thật sự, thay vì "viết xong rồi hy vọng chạy được".
///
/// <see cref="SuKienTrenGoogle"/> đóng vai "lịch Google": kiểm thử sửa giờ hoặc huỷ một sự kiện ở đó
/// rồi gọi API kéo về để xem app có phản ứng đúng không.
///
/// KHÔNG bao giờ được dùng ở môi trường chạy thật: Program.cs chỉ đăng ký bản này khi
/// app.Environment.IsDevelopment() và CheDoGia = true.
/// </summary>
public class KhachGoogleCalendarGia(ILogger<KhachGoogleCalendarGia> ghiLog) : IKhachGoogleCalendar
{
    public static readonly List<SuKienGiaDaGui> SuKienDaGui = [];
    public static readonly List<string> SuKienDaXoa = [];

    /// <summary>Trạng thái "bên Google" của bản giả: sự kiện nào đang có, giờ nào, đã bị huỷ chưa.</summary>
    public static readonly List<SuKienGiaTrenGoogle> SuKienTrenGoogle = [];

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
            emailGia,
            string.Join(' ', GoogleCalendarOptions.QuyenCanXin)));
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

    public Task<IReadOnlyList<SuKienGoogleDaDoc>> LaySuKienThayDoiAsync(
        string accessToken,
        string calendarId,
        DateTime? tuUtc,
        CancellationToken huyBo = default)
    {
        var ketQua = SuKienTrenGoogle
            .Where(x => x.CalendarId == calendarId)
            .Where(x => tuUtc is null || x.CapNhatUtc > tuUtc)
            .Select(ThanhSuKienDaDoc)
            .ToList();

        return Task.FromResult<IReadOnlyList<SuKienGoogleDaDoc>>(ketQua);
    }

    public Task<SuKienGoogleDaDoc?> LaySuKienAsync(
        string accessToken,
        string calendarId,
        string eventId,
        CancellationToken huyBo = default)
    {
        var suKien = SuKienTrenGoogle.FirstOrDefault(x => x.Id == eventId && x.CalendarId == calendarId);
        return Task.FromResult(suKien is null ? null : ThanhSuKienDaDoc(suKien));
    }

    public Task<string> TaoSuKienAsync(
        string accessToken,
        string calendarId,
        SuKienGoogle suKien,
        CancellationToken huyBo = default)
    {
        var id = "gia-" + Guid.NewGuid().ToString("N")[..12];
        SuKienDaGui.Add(new SuKienGiaDaGui(id, calendarId, suKien, "tao"));
        SuKienTrenGoogle.Add(new SuKienGiaTrenGoogle(
            id, calendarId, suKien.TieuDe, suKien.BatDau, suKien.KetThuc, suKien.MoTa, false, DateTime.UtcNow));
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

        var cu = SuKienTrenGoogle.FirstOrDefault(x => x.Id == eventId);
        var moi = new SuKienGiaTrenGoogle(
            eventId, calendarId, suKien.TieuDe, suKien.BatDau, suKien.KetThuc, suKien.MoTa, false, DateTime.UtcNow);

        if (cu is null)
        {
            SuKienTrenGoogle.Add(moi);
        }
        else
        {
            SuKienTrenGoogle[SuKienTrenGoogle.IndexOf(cu)] = moi;
        }

        return Task.CompletedTask;
    }

    public Task XoaSuKienAsync(
        string accessToken,
        string calendarId,
        string eventId,
        CancellationToken huyBo = default)
    {
        SuKienDaXoa.Add(eventId);

        // Trên Google, xoá một sự kiện KHÔNG làm nó biến mất khỏi danh sách thay đổi: nó được đánh
        // dấu status=cancelled. Bản giả làm y như vậy để chiều kéo về thử được đúng tình huống thật.
        var cu = SuKienTrenGoogle.FirstOrDefault(x => x.Id == eventId);
        if (cu is not null)
        {
            SuKienTrenGoogle[SuKienTrenGoogle.IndexOf(cu)] = cu with { DaHuy = true, CapNhatUtc = DateTime.UtcNow };
        }

        return Task.CompletedTask;
    }

    /* ------------------------------------------------------------------ *
     * Chỉ dùng cho kiểm thử: đóng vai giáo viên sửa/huỷ buổi NGAY TRÊN GOOGLE
     * ------------------------------------------------------------------ */

    /// <summary>Đổi giờ một sự kiện ngay "trên Google" (không qua app) rồi trả về sự kiện đó.</summary>
    public static SuKienGiaTrenGoogle? SuaTrenGoogle(string eventId, DateTimeOffset batDau, DateTimeOffset ketThuc)
    {
        var cu = SuKienTrenGoogle.FirstOrDefault(x => x.Id == eventId);
        if (cu is null)
        {
            return null;
        }

        var moi = cu with { BatDau = batDau, KetThuc = ketThuc, CapNhatUtc = DateTime.UtcNow };
        SuKienTrenGoogle[SuKienTrenGoogle.IndexOf(cu)] = moi;
        return moi;
    }

    /// <summary>Huỷ một sự kiện ngay "trên Google" (không qua app).</summary>
    public static SuKienGiaTrenGoogle? HuyTrenGoogle(string eventId)
    {
        var cu = SuKienTrenGoogle.FirstOrDefault(x => x.Id == eventId);
        if (cu is null)
        {
            return null;
        }

        var moi = cu with { DaHuy = true, CapNhatUtc = DateTime.UtcNow };
        SuKienTrenGoogle[SuKienTrenGoogle.IndexOf(cu)] = moi;
        return moi;
    }

    /// <summary>Xoá sạch trạng thái giả, để lượt kiểm thử sau bắt đầu từ số 0.</summary>
    public static int XoaDauVet()
    {
        var soDong = SuKienDaGui.Count + SuKienDaXoa.Count + SuKienTrenGoogle.Count;
        SuKienDaGui.Clear();
        SuKienDaXoa.Clear();
        SuKienTrenGoogle.Clear();
        return soDong;
    }

    private static SuKienGoogleDaDoc ThanhSuKienDaDoc(SuKienGiaTrenGoogle suKien)
    {
        return new SuKienGoogleDaDoc(
            suKien.Id, suKien.DaHuy, suKien.TieuDe, suKien.BatDau, suKien.KetThuc, suKien.CapNhatUtc);
    }
}

/// <summary>Dấu vết những gì bản giả đã "gửi lên Google", để kiểm thử soi lại.</summary>
public record SuKienGiaDaGui(string Id, string CalendarId, SuKienGoogle SuKien, string HanhDong);

/// <summary>Một sự kiện đang nằm "trên lịch Google" của bản giả.</summary>
public record SuKienGiaTrenGoogle(
    string Id,
    string CalendarId,
    string TieuDe,
    DateTimeOffset BatDau,
    DateTimeOffset KetThuc,
    string? MoTa,
    bool DaHuy,
    DateTime CapNhatUtc);
