using ClassManagement.Api.Auth;
using ClassManagement.Api.Common;
using ClassManagement.Api.Google;
using ClassManagement.Api.Services;
using ClassManagement.Api.Data;
using ClassManagement.Api.Email;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ClassManagement.Api.Controllers;

/// <summary>
/// Đăng nhập và quản lý phiên. Access token trả trong body (frontend giữ trong RAM), refresh token
/// nằm trong cookie httpOnly chỉ gửi tới /api/auth — JavaScript không đọc được, nên một lỗ hổng XSS
/// cũng không lấy được phiên dài hạn.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController(
    AppDbContext db,
    UserManager<GiaoVien> quanLyNguoiDung,
    JwtTokenService dichVuToken,
    NguoiDungHienTai nguoiDungHienTai,
    DichVuGoogleCalendar google,
    IOptions<JwtOptions> tuyChonJwt,
    DichVuTaiKhoan taiKhoan,
    IOptions<GoogleCalendarOptions> tuyChonGoogle,
    IOptions<EmailOptions> tuyChonEmail,
    IHostEnvironment moiTruong,
    ILogger<AuthController> ghiLog) : ControllerBase
{
    private readonly JwtOptions _tuyChonJwt = tuyChonJwt.Value;
    private readonly GoogleCalendarOptions _tuyChonGoogle = tuyChonGoogle.Value;
    private readonly EmailOptions _tuyChonEmail = tuyChonEmail.Value;

    /// <summary>
    /// Khoảng thời gian coi việc dùng lại refresh token là do hai nơi cùng làm mới một lúc,
    /// chứ không phải token bị lộ. Đủ ngắn để kẻ trộm token không lợi dụng được.
    /// </summary>
    private static readonly TimeSpan ThoiGianAnHanKhiXoayVong = TimeSpan.FromSeconds(60);

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<DangNhapResponse>> DangNhap(DangNhapRequest yeuCau, CancellationToken huyBo)
    {
        var nguoiDung = await quanLyNguoiDung.FindByEmailAsync(yeuCau.Email.Trim());
        if (nguoiDung is null)
        {
            // Cùng một thông báo cho email sai và mật khẩu sai: khác nhau là đủ để dò xem email nào có tài khoản.
            throw SaiThongTinDangNhap();
        }

        // Xét trạng thái trước khi xét khoá: tài khoản đã nghỉ cũng bị khoá đăng nhập,
        // nhưng phải báo đúng lý do chứ không nói nhầm là do gõ sai mật khẩu.
        if (nguoiDung.TrangThai != TrangThaiGiaoVien.DangLam)
        {
            throw new LoiApiException(
                "Tài khoản đã bị khoá",
                StatusCodes.Status403Forbidden,
                "Giáo viên này đang tạm nghỉ hoặc đã nghỉ nên không đăng nhập được.");
        }

        if (await quanLyNguoiDung.IsLockedOutAsync(nguoiDung))
        {
            throw new LoiApiException(
                "Tài khoản đang tạm khoá",
                StatusCodes.Status423Locked,
                "Sai mật khẩu quá nhiều lần. Thử lại sau ít phút hoặc nhờ admin đặt lại mật khẩu.");
        }

        var dungMatKhau = await quanLyNguoiDung.CheckPasswordAsync(nguoiDung, yeuCau.MatKhau);
        if (!dungMatKhau)
        {
            await quanLyNguoiDung.AccessFailedAsync(nguoiDung);
            throw SaiThongTinDangNhap();
        }

        await quanLyNguoiDung.ResetAccessFailedCountAsync(nguoiDung);
        return Ok(await TaoPhienMoiAsync(nguoiDung, huyBo));
    }

    /// <summary>Lấy access token mới từ refresh token trong cookie. Token cũ bị thu hồi ngay (xoay vòng).</summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<DangNhapResponse>> LamMoiPhien(CancellationToken huyBo)
    {
        var token = Request.Cookies[ChinhSach.TenCookiePhien];
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new LoiApiException("Chưa đăng nhập", StatusCodes.Status401Unauthorized);
        }

        var bam = JwtTokenService.BamToken(token);
        var phien = await db.PhienDangNhap
            .Include(x => x.GiaoVien)
            .FirstOrDefaultAsync(x => x.TokenBam == bam, huyBo);

        if (phien is null)
        {
            XoaCookiePhien();
            throw new LoiApiException("Phiên đăng nhập không hợp lệ", StatusCodes.Status401Unauthorized);
        }

        var nguoiDung = phien.GiaoVien!;

        if (!phien.ConHieuLuc(DateTime.UtcNow))
        {
            // Hai tab (hoặc hai cửa sổ) cùng hỏi làm mới một lúc là chuyện bình thường: tab thứ hai
            // cầm đúng token mà tab thứ nhất vừa xoay vòng. Nếu vẫn thu hồi cả họ phiên thì người
            // dùng thật bị đăng xuất oan chỉ vì mở thêm một tab.
            var vuaBiXoayVong = phien.ThayTheBoiId is not null
                && phien.NgayThuHoiUtc is { } lucThuHoi
                && DateTime.UtcNow - lucThuHoi < ThoiGianAnHanKhiXoayVong;

            if (vuaBiXoayVong)
            {
                // Không đụng tới cookie: cookie hiện tại trong trình duyệt đã là bản mới của tab kia.
                ghiLog.LogInformation(
                    "Refresh token của {Email} vừa được xoay vòng ở nơi khác — tab này phải tải lại.",
                    nguoiDung.Email);

                throw new LoiApiException(
                    "Phiên vừa được làm mới ở nơi khác",
                    StatusCodes.Status401Unauthorized,
                    "Tải lại trang là dùng được phiên mới nhất; các phiên khác không bị ảnh hưởng.");
            }

            // Còn lại: token đã bị thu hồi từ lâu, hoặc đã bị thu hồi vì đăng xuất / đổi mật khẩu.
            // Đem token đó ra dùng tiếp là dấu hiệu token bị lộ — thu hồi sạch phiên của tài khoản.
            ghiLog.LogWarning("Refresh token đã thu hồi của {Email} bị dùng lại — thu hồi mọi phiên.", nguoiDung.Email);
            await ThuHoiMoiPhienAsync(nguoiDung.Id, huyBo);
            XoaCookiePhien();
            throw new LoiApiException(
                "Phiên đã hết hiệu lực",
                StatusCodes.Status401Unauthorized,
                "Vì an toàn, mọi phiên của tài khoản đã bị đăng xuất. Đăng nhập lại giúp em.");
        }

        if (nguoiDung.TrangThai != TrangThaiGiaoVien.DangLam)
        {
            await ThuHoiMoiPhienAsync(nguoiDung.Id, huyBo);
            XoaCookiePhien();
            throw new LoiApiException("Tài khoản đã bị khoá", StatusCodes.Status403Forbidden);
        }

        return Ok(await TaoPhienMoiAsync(nguoiDung, huyBo, phien));
    }

    /// <summary>
    /// Máy chủ đang có những đường đăng nhập thật nào. Giao diện gọi lúc mở trang đăng nhập để biết
    /// có nên hiện nút Google hay không, và để cảnh báo khi đang ở chế độ giả của máy dev.
    /// </summary>
    [HttpGet("tuy-chon-dang-nhap")]
    [AllowAnonymous]
    public ActionResult<TuyChonDangNhapDto> TuyChonDangNhap()
    {
        return Ok(new TuyChonDangNhapDto
        {
            GoogleDaCauHinh = _tuyChonGoogle.DaCauHinh,
            GoogleCheDoGia = _tuyChonGoogle.CheDoGia && moiTruong.IsDevelopment(),
            EmailDaCauHinh = _tuyChonEmail.DaCauHinh,
            EmailCheDoGia = _tuyChonEmail.CheDoGia && moiTruong.IsDevelopment(),
        });
    }

    /// <summary>
    /// Đường dẫn để bấm "Đăng nhập bằng Google". Xin MỘT lần cả quyền định danh lẫn quyền lịch, nên
    /// đăng nhập xong là đã có sẵn đường đồng bộ lịch dạy.
    /// </summary>
    [HttpGet("google/duong-dan")]
    [AllowAnonymous]
    public ActionResult<DuongDanUyQuyenDto> DuongDanDangNhapGoogle(CancellationToken huyBo)
    {
        var yeuCau = google.TaoYeuCauUyQuyen(MucDichUyQuyen.DangNhap, null);

        return Ok(new DuongDanUyQuyenDto
        {
            Url = google.CheDoGia
                ? "/api/auth/gia-dang-nhap?state=" + Uri.EscapeDataString(yeuCau.State)
                : yeuCau.Url,
            Quyen = GoogleCalendarOptions.QuyenCanXin,
            CheDoGia = google.CheDoGia,
        });
    }

    /// <summary>
    /// Google gọi lại địa chỉ này sau khi người dùng đồng ý. Xác thực danh tính xong mới tạo phiên;
    /// hệ thống KHÔNG tự tạo tài khoản cho một email Google lạ.
    /// </summary>
    [HttpGet("google/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleCallback(
        [FromQuery] string? code,
        [FromQuery] string? state,
        [FromQuery] string? error,
        CancellationToken huyBo)
    {
        if (!string.IsNullOrWhiteSpace(error))
        {
            return QuayVeDangNhap("loi", "Google báo: " + error);
        }

        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
        {
            return QuayVeDangNhap("loi", "Google không trả mã uỷ quyền.");
        }

        try
        {
            var noiDung = google.KiemTraState(state);
            if (noiDung.MucDich != MucDichUyQuyen.DangNhap)
            {
                return QuayVeDangNhap("loi", "Yêu cầu này không phải để đăng nhập.");
            }

            var nguoiDung = await google.DangNhapBangGoogleAsync(code, huyBo);

            // Tạo phiên y như đăng nhập bằng mật khẩu: refresh token nằm trong cookie httpOnly,
            // access token thì frontend tự lấy bằng POST /api/auth/refresh khi mở lại ứng dụng.
            await TaoPhienMoiAsync(nguoiDung, huyBo);

            return Redirect(_tuyChonGoogle.FrontendUrl.TrimEnd('/') + "/?google=dang-nhap-thanh-cong");
        }
        catch (LoiApiException loi)
        {
            ghiLog.LogWarning("Đăng nhập bằng Google thất bại: {TieuDe} — {ChiTiet}", loi.TieuDe, loi.ChiTiet);
            return QuayVeDangNhap("loi", loi.ChiTiet ?? loi.TieuDe);
        }
    }

    /// <summary>
    /// Chỉ ở chế độ giả trên máy dev: đóng vai màn hình đồng ý của Google bằng cách chuyển hướng về
    /// đúng địa chỉ callback thật. Tham số email dùng để thử cả trường hợp email chưa có tài khoản.
    /// </summary>
    [HttpGet("gia-dang-nhap")]
    [AllowAnonymous]
    public IActionResult GiaDangNhap([FromQuery] string state, [FromQuery] string? email)
    {
        if (!_tuyChonGoogle.CheDoGia || !moiTruong.IsDevelopment())
        {
            return NotFound();
        }

        var taiKhoanGia = string.IsNullOrWhiteSpace(email)
            ? "giao.vien.mau@classmanagement.local"
            : email;

        var duongDan = "/api/auth/google/callback?code="
            + Uri.EscapeDataString(KhachGoogleCalendarGia.TienToDangNhap + taiKhoanGia)
            + "&state=" + Uri.EscapeDataString(state);

        // KHÔNG tự chuyển hướng thẳng: hiện một trang nói rõ đang đóng vai ai, để không ai nhầm
        // đây là việc đăng nhập thật bằng Google. Máy chạy thật không bao giờ có màn hình này.
        return Content(TrangDongYGia("đăng nhập", taiKhoanGia, duongDan), "text/html; charset=utf-8");
    }

    /// <summary>
    /// Tự tạo tài khoản bằng email và mật khẩu, rồi đăng nhập luôn. Tài khoản mới luôn là giáo viên:
    /// mở cho tự đăng ký nhưng không mở luôn quyền quản trị cho người lạ.
    /// </summary>
    [HttpPost("dang-ky")]
    [AllowAnonymous]
    public async Task<ActionResult<DangNhapResponse>> DangKy(DangKyRequest yeuCau, CancellationToken huyBo)
    {
        var nguoiDung = await taiKhoan.DangKyAsync(yeuCau, HttpContext.Connection.RemoteIpAddress?.ToString(), huyBo);
        return Ok(await TaoPhienMoiAsync(nguoiDung, huyBo));
    }

    /// <summary>
    /// Xin thư đặt lại mật khẩu. Luôn trả về cùng một kết quả dù email có tài khoản hay không — nếu
    /// khác nhau thì người ngoài dò được email nào đã đăng ký.
    /// </summary>
    [HttpPost("quen-mat-khau")]
    [AllowAnonymous]
    public async Task<IActionResult> QuenMatKhau(QuenMatKhauRequest yeuCau, CancellationToken huyBo)
    {
        await taiKhoan.GuiYeuCauDatLaiAsync(yeuCau.Email, HttpContext.Connection.RemoteIpAddress?.ToString(), huyBo);
        return NoContent();
    }

    /// <summary>
    /// Đặt mật khẩu mới bằng token trong thư. Đổi xong thì thu hồi MỌI phiên đang mở: mật khẩu đổi
    /// nghĩa là mọi thiết bị phải đăng nhập lại.
    /// </summary>
    [HttpPost("dat-lai-mat-khau")]
    [AllowAnonymous]
    public async Task<IActionResult> DatLaiMatKhau(DatLaiMatKhauQuaEmailRequest yeuCau, CancellationToken huyBo)
    {
        var nguoiDung = await taiKhoan.DatLaiMatKhauAsync(
            yeuCau.Token, yeuCau.MatKhauMoi, HttpContext.Connection.RemoteIpAddress?.ToString(), huyBo);

        await ThuHoiMoiPhienAsync(nguoiDung.Id, huyBo);
        XoaCookiePhien();
        return NoContent();
    }

    /// <summary>
    /// Chỉ ở chế độ giả trên máy dev: đọc lại những thư mà "máy chủ email" đã nhận, để thử luồng quên
    /// mật khẩu mà không cần SMTP thật.
    /// </summary>
    [HttpGet("gia-hop-thu")]
    [AllowAnonymous]
    public ActionResult<IReadOnlyList<EmailGiaDaGui>> GiaHopThu()
    {
        if (!_tuyChonEmail.CheDoGia || !moiTruong.IsDevelopment())
        {
            return NotFound();
        }

        return Ok(DichVuEmailGia.HopThu.ToList());
    }

    /// <summary>Chỉ ở chế độ giả: dọn hộp thư giả để lần kiểm thử sau bắt đầu sạch.</summary>
    [HttpPost("gia-xoa-hop-thu")]
    [AllowAnonymous]
    public ActionResult<int> GiaXoaHopThu()
    {
        if (!_tuyChonEmail.CheDoGia || !moiTruong.IsDevelopment())
        {
            return NotFound();
        }

        var soThu = DichVuEmailGia.HopThu.Count;
        DichVuEmailGia.HopThu.Clear();
        return Ok(soThu);
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> DangXuat(CancellationToken huyBo)
    {
        var token = Request.Cookies[ChinhSach.TenCookiePhien];
        if (!string.IsNullOrWhiteSpace(token))
        {
            var bam = JwtTokenService.BamToken(token);
            var phien = await db.PhienDangNhap.FirstOrDefaultAsync(x => x.TokenBam == bam, huyBo);
            if (phien is { NgayThuHoiUtc: null })
            {
                phien.NgayThuHoiUtc = DateTime.UtcNow;
                await db.SaveChangesAsync(huyBo);
            }
        }

        XoaCookiePhien();
        return NoContent();
    }

    /// <summary>Thông tin người đang đăng nhập, đọc từ database để vai trò và trạng thái luôn là mới nhất.</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<NguoiDungDto>> ToiLaAi(CancellationToken huyBo)
    {
        var nguoiDung = await nguoiDungHienTai.YeuCauAsync(huyBo);
        return Ok(TaoNguoiDungDto(nguoiDung));
    }

    [HttpPost("doi-mat-khau")]
    [Authorize]
    public async Task<IActionResult> DoiMatKhau(DoiMatKhauRequest yeuCau, CancellationToken huyBo)
    {
        var nguoiDung = await nguoiDungHienTai.YeuCauAsync(huyBo);

        var ketQua = await quanLyNguoiDung.ChangePasswordAsync(nguoiDung, yeuCau.MatKhauHienTai, yeuCau.MatKhauMoi);
        if (!ketQua.Succeeded)
        {
            throw LoiApiException.DuLieuSai(
                "Không đổi được mật khẩu.",
                ketQua.Errors
                    .GroupBy(x => x.Code.Contains("Password", StringComparison.OrdinalIgnoreCase) ? nameof(yeuCau.MatKhauMoi) : nameof(yeuCau.MatKhauHienTai))
                    .ToDictionary(
                        nhom => nhom.Key,
                        nhom => nhom.Select(DocLoiIdentity).ToArray()));
        }

        // Đổi mật khẩu thì đăng xuất mọi phiên khác, chỉ giữ phiên vừa dùng để không bị văng ngay.
        var maPhienHienTai = Request.Cookies[ChinhSach.TenCookiePhien];
        var bamHienTai = string.IsNullOrWhiteSpace(maPhienHienTai) ? null : JwtTokenService.BamToken(maPhienHienTai);

        await db.PhienDangNhap
            .Where(x => x.GiaoVienId == nguoiDung.Id && x.NgayThuHoiUtc == null && (bamHienTai == null || x.TokenBam != bamHienTai))
            .ExecuteUpdateAsync(capNhat => capNhat.SetProperty(x => x.NgayThuHoiUtc, DateTime.UtcNow), huyBo);

        return NoContent();
    }

    /* ------------------------------------------------------------------ */

    /// <summary>
    /// Trang HTML của màn hình đồng ý GIẢ (chỉ máy dev). Có nút phải bấm mới đi tiếp, và nói thẳng
    /// đang đóng vai ai — đây là thứ thay cho trang accounts.google.com khi chưa có tài khoản thật.
    /// </summary>
    private static string TrangDongYGia(string viec, string taiKhoan, string duongDan)
    {
        Func<string, string> maHoa = chuoi => System.Net.WebUtility.HtmlEncode(chuoi);
        return $"""
            <!doctype html>
            <html lang="vi"><head><meta charset="utf-8"><title>Màn hình đồng ý GIẢ (máy dev)</title></head>
            <body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 16px; line-height: 1.6">
              <h1 style="color:#b45309">Đây KHÔNG phải Google thật</h1>
              <p>Máy chủ đang chạy <strong>chế độ giả</strong> (GoogleCalendar:CheDoGia), dùng cho việc thử
              nghiệm ở máy dev. Bấm nút dưới đây nghĩa là tự nhận mình là <strong>{maHoa(taiKhoan)}</strong>,
              không có mật khẩu và không có xác thực nào cả.</p>
              <p>Muốn {maHoa(viec)} bằng Google thật thì phải đặt GoogleCalendar:ClientId và ClientSecret,
              rồi tắt GoogleCalendar:CheDoGia — xem README backend.</p>
              <p><a href="{maHoa(duongDan)}"
                    style="display:inline-block;padding:10px 18px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none">
                Vẫn tiếp tục với vai {maHoa(taiKhoan)}
              </a></p>
            </body></html>
            """;
    }

    /// <summary>Đưa người dùng về màn hình đăng nhập kèm lý do, thay vì trả JSON cho một lượt chuyển hướng.</summary>
    private IActionResult QuayVeDangNhap(string ketQua, string? thongBao)
    {
        var dia = _tuyChonGoogle.FrontendUrl.TrimEnd('/') + "/login?google=" + Uri.EscapeDataString(ketQua);

        if (!string.IsNullOrWhiteSpace(thongBao))
        {
            dia += "&thongBao=" + Uri.EscapeDataString(thongBao);
        }

        return Redirect(dia);
    }

    private static LoiApiException SaiThongTinDangNhap()
    {
        return new LoiApiException(
            "Email hoặc mật khẩu không đúng",
            StatusCodes.Status401Unauthorized,
            "Kiểm tra lại email đăng nhập và mật khẩu.");
    }

    /// <summary>Xoá phiên cũ (nếu có) rồi tạo phiên mới, đặt cookie và trả access token.</summary>
    private async Task<DangNhapResponse> TaoPhienMoiAsync(
        GiaoVien nguoiDung,
        CancellationToken huyBo,
        PhienDangNhap? phienCu = null)
    {
        var tokenMoi = JwtTokenService.TaoRefreshToken();
        var phienMoi = new PhienDangNhap
        {
            GiaoVienId = nguoiDung.Id,
            TokenBam = JwtTokenService.BamToken(tokenMoi),
            NgayTaoUtc = DateTime.UtcNow,
            HetHanUtc = DateTime.UtcNow.AddDays(_tuyChonJwt.RefreshTokenDays),
            DiaChiIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
            ThietBi = LayThietBi(),
        };

        if (phienCu is not null)
        {
            phienCu.NgayThuHoiUtc = DateTime.UtcNow;
            phienMoi.ThayTheBoiId = null;
            db.PhienDangNhap.Add(phienMoi);
            await db.SaveChangesAsync(huyBo);
            phienCu.ThayTheBoiId = phienMoi.Id;
            await db.SaveChangesAsync(huyBo);
        }
        else
        {
            db.PhienDangNhap.Add(phienMoi);
            await db.SaveChangesAsync(huyBo);
        }

        var (accessToken, hetHanUtc) = dichVuToken.TaoAccessToken(nguoiDung);
        DatCookiePhien(tokenMoi, phienMoi.HetHanUtc);

        return new DangNhapResponse
        {
            AccessToken = accessToken,
            HetHanUtc = hetHanUtc,
            NguoiDung = TaoNguoiDungDto(nguoiDung),
        };
    }

    private async Task ThuHoiMoiPhienAsync(Guid giaoVienId, CancellationToken huyBo)
    {
        await db.PhienDangNhap
            .Where(x => x.GiaoVienId == giaoVienId && x.NgayThuHoiUtc == null)
            .ExecuteUpdateAsync(capNhat => capNhat.SetProperty(x => x.NgayThuHoiUtc, DateTime.UtcNow), huyBo);
    }

    private static NguoiDungDto TaoNguoiDungDto(GiaoVien nguoiDung)
    {
        return new NguoiDungDto
        {
            Id = nguoiDung.Id,
            HoTen = nguoiDung.HoTen,
            Email = nguoiDung.Email ?? "",
            VaiTro = nguoiDung.VaiTro,
            TrangThai = nguoiDung.TrangThai,
            TaiKhoanNhanTien = TaiKhoanNhanTienDto.Tu(nguoiDung),
        };
    }

    private static string DocLoiIdentity(IdentityError loi)
    {
        // Mã lỗi tiếng Anh của Identity không hữu ích với người dùng Việt Nam.
        return loi.Code switch
        {
            "PasswordMismatch" => "Mật khẩu đang dùng không đúng",
            "PasswordTooShort" => "Mật khẩu mới phải dài ít nhất 8 ký tự",
            "PasswordRequiresDigit" => "Mật khẩu mới phải có ít nhất một chữ số",
            "PasswordRequiresLower" => "Mật khẩu mới phải có ít nhất một chữ thường",
            "PasswordRequiresUpper" => "Mật khẩu mới phải có ít nhất một chữ hoa",
            "PasswordRequiresNonAlphanumeric" => "Mật khẩu mới phải có ít nhất một ký tự đặc biệt",
            _ => loi.Description,
        };
    }

    private string? LayThietBi()
    {
        var thietBi = Request.Headers.UserAgent.ToString();
        return string.IsNullOrWhiteSpace(thietBi) ? null : thietBi[..Math.Min(thietBi.Length, 300)];
    }

    private void DatCookiePhien(string token, DateTime hetHanUtc)
    {
        Response.Cookies.Append(ChinhSach.TenCookiePhien, token, TaoTuyChonCookie(hetHanUtc));
    }

    private void XoaCookiePhien()
    {
        Response.Cookies.Delete(ChinhSach.TenCookiePhien, new CookieOptions
        {
            Path = ChinhSach.DuongDanCookie,
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = Request.IsHttps,
        });
    }

    private CookieOptions TaoTuyChonCookie(DateTime hetHanUtc)
    {
        return new CookieOptions
        {
            HttpOnly = true,
            // Máy dev chạy http qua proxy của Vite nên không đặt Secure cứng; chạy thật có HTTPS thì tự bật.
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            // Chỉ gửi kèm cookie tới các endpoint đăng nhập, không gửi loang ra mọi API.
            Path = ChinhSach.DuongDanCookie,
            Expires = new DateTimeOffset(hetHanUtc),
        };
    }
}
