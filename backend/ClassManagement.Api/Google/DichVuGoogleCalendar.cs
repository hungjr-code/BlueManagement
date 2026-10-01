using System.Security.Cryptography;
using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Entities;
using ClassManagement.Api.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace ClassManagement.Api.Google;

/// <summary>Luồng nào đang xin quyền: đăng nhập bằng Google, hay kết nối lịch từ màn hình Cài đặt.</summary>
public enum MucDichUyQuyen
{
    DangNhap,
    KetNoi,
}

/// <summary>Đường dẫn xin quyền kèm state đã ký, để chế độ giả dựng được đường dẫn thay thế.</summary>
public record YeuCauUyQuyen(string Url, string State, MucDichUyQuyen MucDich);

/// <summary>Danh tính người đăng nhập theo Google: email để tìm/ tạo tài khoản, tên để đặt cho tài khoản mới.</summary>
public record ThongTinGoogle(string Email, string? HoTen);

/// <summary>Nội dung đọc ra từ state đã ký.</summary>
public record NoiDungUyQuyen(MucDichUyQuyen MucDich, Guid? GiaoVienId);

/// <summary>
/// Kết nối Google: tạo đường dẫn xin quyền, nhận mã uỷ quyền, xác thực danh tính người đăng nhập, lưu
/// refresh token (đã mã hoá) và cấp access token cho việc đồng bộ.
///
/// Kết nối Google là chuyện của TỪNG GIÁO VIÊN, không phải của trung tâm: buổi học của ai thì nằm
/// trên lịch Google của người đó. Refresh token của mỗi người được mã hoá riêng bằng Data Protection
/// và không bao giờ đi ra khỏi backend — kể cả admin cũng không đọc được token của người khác.
/// </summary>
public class DichVuGoogleCalendar(
    AppDbContext db,
    IKhachGoogleCalendar khach,
    UserManager<GiaoVien> quanLyNguoiDung,
    DichVuTaiKhoan taiKhoan,
    IDataProtectionProvider baoVe,
    IOptions<GoogleCalendarOptions> tuyChon,
    ILogger<DichVuGoogleCalendar> ghiLog)
{
    private const string MucDichMaHoaToken = "ClassManagement.GoogleRefreshToken";
    private const string MucDichMaHoaState = "ClassManagement.GoogleOAuthState";

    /// <summary>
    /// Bộ đọc khoá công khai của Google (JWKS), có sẵn cơ chế nhớ đệm và tự lấy lại khi Google xoay
    /// khoá. Đặt static để không phải tải lại khoá cho mỗi lần đăng nhập.
    /// </summary>
    private static readonly ConfigurationManager<OpenIdConnectConfiguration> CauHinhGoogle = new(
        "https://accounts.google.com/.well-known/openid-configuration",
        new OpenIdConnectConfigurationRetriever(),
        new HttpDocumentRetriever { RequireHttps = true });

    private readonly GoogleCalendarOptions _tuyChon = tuyChon.Value;
    private readonly IDataProtector _baoVeToken = baoVe.CreateProtector(MucDichMaHoaToken);
    private readonly IDataProtector _baoVeState = baoVe.CreateProtector(MucDichMaHoaState);

    public bool CheDoGia => _tuyChon.CheDoGia;

    public bool DaCauHinh => _tuyChon.DaCauHinh || _tuyChon.CheDoGia;

    /// <summary>
    /// Đường dẫn cho người dùng bấm vào để cấp quyền. State được ký và có hạn 10 phút: nếu không có
    /// nó, kẻ khác có thể lừa backend đổi một mã uỷ quyền của tài khoản Google khác vào hệ thống này.
    /// </summary>
    public YeuCauUyQuyen TaoYeuCauUyQuyen(MucDichUyQuyen mucDich, Guid? giaoVienId)
    {
        if (!DaCauHinh)
        {
            throw new LoiApiException(
                "Chưa cấu hình Google",
                StatusCodes.Status409Conflict,
                "Đặt GoogleCalendar:ClientId và GoogleCalendar:ClientSecret trong user-secrets của backend.");
        }

        var hanUtc = DateTime.UtcNow.AddMinutes(10);
        var state = _baoVeState.Protect(
            string.Join('|', mucDich.ToString(), giaoVienId?.ToString() ?? "-", hanUtc.Ticks));

        var thamSo = new Dictionary<string, string>
        {
            ["client_id"] = _tuyChon.ClientId ?? "che-do-gia",
            ["redirect_uri"] = mucDich == MucDichUyQuyen.DangNhap ? _tuyChon.RedirectUriDangNhap : _tuyChon.RedirectUri,
            ["response_type"] = "code",
            ["scope"] = GoogleCalendarOptions.QuyenChuoi,
            // access_type=offline + prompt=consent là cách duy nhất để Google trả refresh token.
            ["access_type"] = "offline",
            ["prompt"] = "consent",
            ["include_granted_scopes"] = "true",
            ["state"] = state,
        };

        var truyVan = string.Join('&', thamSo.Select(cap =>
            Uri.EscapeDataString(cap.Key) + "=" + Uri.EscapeDataString(cap.Value)));

        return new YeuCauUyQuyen("https://accounts.google.com/o/oauth2/v2/auth?" + truyVan, state, mucDich);
    }

    public NoiDungUyQuyen KiemTraState(string state)
    {
        string noiDung;
        try
        {
            noiDung = _baoVeState.Unprotect(state);
        }
        catch (CryptographicException)
        {
            throw LoiApiException.DuLieuSai(
                "Yêu cầu cấp quyền Google không hợp lệ hoặc đã quá hạn.",
                new Dictionary<string, string[]> { ["state"] = ["Bấm lại từ đầu"] });
        }

        var phan = noiDung.Split('|');
        if (phan.Length != 3
            || !Enum.TryParse<MucDichUyQuyen>(phan[0], out var mucDich)
            || !long.TryParse(phan[2], out var ticks))
        {
            throw LoiApiException.DuLieuSai("Yêu cầu cấp quyền Google không hợp lệ.");
        }

        if (new DateTime(ticks, DateTimeKind.Utc) < DateTime.UtcNow)
        {
            throw LoiApiException.DuLieuSai(
                "Yêu cầu cấp quyền Google đã quá hạn.",
                new Dictionary<string, string[]> { ["state"] = ["Yêu cầu chỉ có hiệu lực 10 phút, bấm lại từ đầu"] });
        }

        Guid? giaoVienId = phan[1] == "-" ? null : Guid.Parse(phan[1]);
        return new NoiDungUyQuyen(mucDich, giaoVienId);
    }

    /// <summary>Kết nối lịch Google cho một giáo viên (từ màn hình Cài đặt).</summary>
    public async Task KetNoiAsync(GiaoVien giaoVien, string maUyQuyen, CancellationToken huyBo = default)
    {
        var token = await khach.DoiMaUyQuyenAsync(maUyQuyen, huyBo);
        var email = (await LayThongTinAsync(token, huyBo)).Email;

        if (string.IsNullOrWhiteSpace(token.RefreshToken))
        {
            throw new LoiApiException(
                "Google không trả refresh token",
                StatusCodes.Status502BadGateway,
                "Thường là do tài khoản đã từng cấp quyền trước đó. Vào myaccount.google.com/permissions xoá quyền cũ rồi kết nối lại.");
        }

        giaoVien.GoogleTaiKhoan = email;
        giaoVien.GoogleRefreshTokenMaHoa = _baoVeToken.Protect(token.RefreshToken);
        giaoVien.GoogleCalendarId = string.IsNullOrWhiteSpace(giaoVien.GoogleCalendarId)
            ? email
            : giaoVien.GoogleCalendarId;

        await db.SaveChangesAsync(huyBo);
        ghiLog.LogInformation("Giáo viên {Ten} đã kết nối Google Calendar ({TaiKhoan}).", giaoVien.HoTen, email);
    }

    /// <summary>
    /// Đăng nhập bằng Google: xác thực danh tính, tìm tài khoản đã được admin tạo sẵn theo email, và
    /// nhân đó lưu luôn quyền truy cập lịch. Không tự tạo tài khoản mới — có Gmail không có nghĩa là
    /// được vào hệ thống.
    /// </summary>
    public async Task<GiaoVien> DangNhapBangGoogleAsync(string maUyQuyen, CancellationToken huyBo = default)
    {
        var token = await khach.DoiMaUyQuyenAsync(maUyQuyen, huyBo);
        var thongTin = await LayThongTinAsync(token, huyBo);
        var email = thongTin.Email;

        // Lần đầu đăng nhập bằng Google thì tạo luôn tài khoản giáo viên. Không tự phong admin: quyền
        // quản trị chỉ có được do một admin khác đặt, hoặc do seed ở máy chủ.
        var nguoiDung = await quanLyNguoiDung.FindByEmailAsync(email)
            ?? await taiKhoan.TaoTaiKhoanTuGoogleAsync(email, thongTin.HoTen, null, huyBo);

        if (nguoiDung.TrangThai != TrangThaiGiaoVien.DangLam)
        {
            throw new LoiApiException(
                "Tài khoản đã bị khoá",
                StatusCodes.Status403Forbidden,
                "Giáo viên này đang tạm nghỉ hoặc đã nghỉ nên không đăng nhập được.");
        }

        nguoiDung.GoogleTaiKhoan = email;

        if (!string.IsNullOrWhiteSpace(token.RefreshToken))
        {
            nguoiDung.GoogleRefreshTokenMaHoa = _baoVeToken.Protect(token.RefreshToken);
        }

        nguoiDung.GoogleCalendarId ??= email;

        await db.SaveChangesAsync(huyBo);
        ghiLog.LogInformation("{Email} đăng nhập bằng Google.", email);
        return nguoiDung;
    }

    /// <summary>Ngắt kết nối: xoá refresh token đã lưu, không giữ lại bản sao nào.</summary>
    public async Task NgatKetNoiAsync(GiaoVien giaoVien, CancellationToken huyBo = default)
    {
        giaoVien.GoogleRefreshTokenMaHoa = null;
        giaoVien.GoogleTaiKhoan = null;
        giaoVien.GoogleCalendarId = null;

        await db.SaveChangesAsync(huyBo);
    }

    public async Task<IReadOnlyList<LichGoogle>> LayDanhSachLichAsync(GiaoVien giaoVien, CancellationToken huyBo = default)
    {
        var accessToken = await LayAccessTokenAsync(giaoVien, huyBo);
        return await khach.LayDanhSachLichAsync(accessToken, huyBo);
    }

    public async Task ChonLichAsync(GiaoVien giaoVien, string calendarId, CancellationToken huyBo = default)
    {
        if (string.IsNullOrWhiteSpace(calendarId))
        {
            throw LoiApiException.DuLieuSai(
                "Chưa chọn lịch đích.",
                new Dictionary<string, string[]> { ["calendarId"] = ["Chọn một lịch trong danh sách"] });
        }

        giaoVien.GoogleCalendarId = calendarId.Trim();
        await db.SaveChangesAsync(huyBo);
    }

    /// <summary>
    /// Access token dùng cho lần đồng bộ này, lấy từ refresh token đã lưu (giải mã trong bộ nhớ).
    /// Google chỉ cấp access token mới nên không có chuyện dùng token cũ đã hết hạn.
    /// </summary>
    public async Task<string> LayAccessTokenAsync(GiaoVien giaoVien, CancellationToken huyBo = default)
    {
        if (string.IsNullOrWhiteSpace(giaoVien.GoogleRefreshTokenMaHoa))
        {
            throw new LoiApiException(
                "Chưa kết nối Google Calendar",
                StatusCodes.Status409Conflict,
                $"{giaoVien.HoTen} chưa kết nối Google Calendar. Vào Cài đặt để kết nối.");
        }

        string refreshToken;
        try
        {
            refreshToken = _baoVeToken.Unprotect(giaoVien.GoogleRefreshTokenMaHoa);
        }
        catch (CryptographicException)
        {
            throw new LoiApiException(
                "Không giải mã được token Google đã lưu",
                StatusCodes.Status409Conflict,
                "Token lưu từ máy khác hoặc khoá bảo vệ đã đổi. Ngắt kết nối rồi kết nối lại.");
        }

        return await khach.LamMoiAccessTokenAsync(refreshToken, huyBo);
    }

    /// <summary>Cấu hình chung của trung tâm (múi giờ, nhắc trước bao lâu) — vẫn cần cho việc đồng bộ.</summary>
    public async Task<CaiDat> LayCaiDatAsync(CancellationToken huyBo = default)
    {
        return await db.CaiDat.FirstOrDefaultAsync(x => x.Id == CaiDat.IdDuyNhat, huyBo)
            ?? throw new LoiApiException(
                "Chưa có dòng cấu hình",
                StatusCodes.Status500InternalServerError,
                "Bảng CaiDat chưa có dữ liệu. Khởi động lại API để seed lại.");
    }

    /// <summary>
    /// Lấy email người đăng nhập. Ở chế độ giả thì dùng email do khách giả đưa (chỉ có ở máy dev);
    /// chạy thật thì BẮT BUỘC xác thực chữ ký id_token của Google rồi mới đọc email bên trong.
    /// </summary>
    private async Task<ThongTinGoogle> LayThongTinAsync(TokenGoogle token, CancellationToken huyBo)
    {
        if (CheDoGia && !string.IsNullOrWhiteSpace(token.EmailGia))
        {
            ghiLog.LogWarning(
                "[Google giả] BỎ QUA xác thực id_token, dùng email {Email} do khách giả cung cấp.", token.EmailGia);
            return new ThongTinGoogle(token.EmailGia, null);
        }

        if (string.IsNullOrWhiteSpace(token.IdToken))
        {
            throw new LoiApiException(
                "Google không trả thông tin tài khoản",
                StatusCodes.Status502BadGateway,
                "Kiểm tra lại quyền openid và email của ứng dụng Google.");
        }

        return await LayThongTinTuIdTokenAsync(token.IdToken, huyBo);
    }

    private async Task<ThongTinGoogle> LayThongTinTuIdTokenAsync(string idToken, CancellationToken huyBo)
    {
        var cauHinh = await CauHinhGoogle.GetConfigurationAsync(huyBo);
        var ketQua = await new JsonWebTokenHandler().ValidateTokenAsync(idToken, new TokenValidationParameters
        {
            ValidIssuer = cauHinh.Issuer,
            ValidIssuers = ["https://accounts.google.com", "accounts.google.com"],
            ValidateIssuer = true,
            IssuerSigningKeys = cauHinh.SigningKeys,
            ValidateIssuerSigningKey = true,
            ValidAudience = _tuyChon.ClientId,
            ValidateAudience = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
        });

        if (!ketQua.IsValid)
        {
            ghiLog.LogWarning(ketQua.Exception, "id_token của Google không hợp lệ.");
            throw new LoiApiException(
                "Đăng nhập bằng Google không hợp lệ",
                StatusCodes.Status401Unauthorized,
                "Token do Google cấp không xác thực được. Thử đăng nhập lại.");
        }

        ketQua.Claims.TryGetValue("email_verified", out var daXacThuc);
        if (daXacThuc is not true)
        {
            throw new LoiApiException(
                "Email Google chưa được xác thực",
                StatusCodes.Status403Forbidden,
                "Tài khoản Google này chưa xác thực email nên không dùng để đăng nhập được.");
        }

        ketQua.Claims.TryGetValue("email", out var giaTriEmail);
        if (giaTriEmail is not string email || string.IsNullOrWhiteSpace(email))
        {
            throw new LoiApiException(
                "Google không trả email",
                StatusCodes.Status502BadGateway,
                "Ứng dụng chưa xin quyền email.");
        }

        ketQua.Claims.TryGetValue("name", out var giaTriTen);
        return new ThongTinGoogle(email, giaTriTen as string);
    }
}
