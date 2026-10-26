using ClassManagement.Api.Auth;
using ClassManagement.Api.Common;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace ClassManagement.Api.Controllers;

/// <summary>
/// Đăng nhập của HỌC SINH: mã học sinh + mật khẩu.
///
/// Cùng cách làm với đăng nhập của giáo viên: access token trả trong body (giao diện giữ trong RAM),
/// refresh token nằm trong cookie httpOnly RIÊNG của học sinh (cm_phien_hs) và chỉ gửi tới
/// /api/hoc-sinh/auth. Token của học sinh mang audience riêng nên không dùng được cho API giáo viên.
/// </summary>
[ApiController]
[Route("api/hoc-sinh/auth")]
public class HocSinhAuthController(
    DichVuTaiKhoanHocSinh dichVuTaiKhoan,
    NguoiHocSinhHienTai nguoiHocSinhHienTai,
    IOptions<JwtOptions> tuyChonJwt) : ControllerBase
{
    private readonly JwtOptions _tuyChonJwt = tuyChonJwt.Value;

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<KetQuaDangNhapHocSinh>> DangNhap(
        DangNhapHocSinhRequest yeuCau,
        CancellationToken huyBo)
    {
        var ketQua = await dichVuTaiKhoan.DangNhapAsync(
            yeuCau.MaHocSinh,
            yeuCau.MatKhau,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            LayThietBi(),
            huyBo);

        DatCookiePhien(ketQua);
        return Ok(KetQuaTraVe(ketQua));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<KetQuaDangNhapHocSinh>> LamMoi(CancellationToken huyBo)
    {
        var token = Request.Cookies[ChinhSach.TenCookiePhienHocSinh];
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new LoiApiException(
                "Chưa đăng nhập",
                StatusCodes.Status401Unauthorized,
                "Đăng nhập bằng mã học sinh và mật khẩu.");
        }

        var ketQua = await dichVuTaiKhoan.LamMoiPhienAsync(
            token,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            LayThietBi(),
            huyBo);

        if (ketQua is null)
        {
            XoaCookiePhien();
            throw new LoiApiException("Phiên đăng nhập không hợp lệ", StatusCodes.Status401Unauthorized);
        }

        DatCookiePhien(ketQua);
        return Ok(KetQuaTraVe(ketQua));
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> DangXuat(CancellationToken huyBo)
    {
        var token = Request.Cookies[ChinhSach.TenCookiePhienHocSinh];
        if (!string.IsNullOrWhiteSpace(token))
        {
            await dichVuTaiKhoan.DangXuatAsync(token, huyBo);
        }

        XoaCookiePhien();
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize(AuthenticationSchemes = ChinhSach.LuocDoTokenHocSinh)]
    public async Task<ActionResult<HocSinhToiDto>> ToiLaAi(CancellationToken huyBo)
    {
        var hocSinh = await nguoiHocSinhHienTai.YeuCauAsync(huyBo);
        return Ok(DichVuTaiKhoanHocSinh.TaoDto(hocSinh));
    }

    /// <summary>
    /// Học sinh tự đổi mật khẩu. Giữ lại phiên đang dùng, cắt các phiên còn lại — đổi mật khẩu là để
    /// người khác không vào được nữa, kể cả khi họ đang mở sẵn.
    /// </summary>
    [HttpPost("doi-mat-khau")]
    [Authorize(AuthenticationSchemes = ChinhSach.LuocDoTokenHocSinh)]
    public async Task<IActionResult> DoiMatKhau(DoiMatKhauHocSinhRequest yeuCau, CancellationToken huyBo)
    {
        var hocSinh = await nguoiHocSinhHienTai.YeuCauAsync(huyBo);

        var maPhienHienTai = Request.Cookies[ChinhSach.TenCookiePhienHocSinh];
        var bamPhienHienTai = string.IsNullOrWhiteSpace(maPhienHienTai)
            ? null
            : JwtTokenService.BamToken(maPhienHienTai);

        await dichVuTaiKhoan.DoiMatKhauAsync(
            hocSinh,
            yeuCau.MatKhauHienTai,
            yeuCau.MatKhauMoi,
            bamPhienHienTai,
            huyBo);

        return NoContent();
    }

    /* ------------------------------------------------------------------ */

    private static KetQuaDangNhapHocSinh KetQuaTraVe(KetQuaDangNhapHocSinh ketQua)
    {
        // Không để refresh token lọt ra JSON dù nó nằm trong đối tượng trả về.
        ketQua.RefreshTokenNoiBo = null;
        ketQua.RefreshHetHanUtcNoiBo = default;
        return ketQua;
    }

    private void DatCookiePhien(KetQuaDangNhapHocSinh ketQua)
    {
        if (string.IsNullOrWhiteSpace(ketQua.RefreshTokenNoiBo))
        {
            return;
        }

        Response.Cookies.Append(
            ChinhSach.TenCookiePhienHocSinh,
            ketQua.RefreshTokenNoiBo,
            new CookieOptions
            {
                HttpOnly = true,
                // Máy dev chạy http qua proxy của Vite nên không đặt Secure cứng; chạy thật HTTPS thì tự bật.
                Secure = Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                Path = ChinhSach.DuongDanCookieHocSinh,
                Expires = new DateTimeOffset(ketQua.RefreshHetHanUtcNoiBo),
            });
    }

    private void XoaCookiePhien()
    {
        Response.Cookies.Delete(ChinhSach.TenCookiePhienHocSinh, new CookieOptions
        {
            Path = ChinhSach.DuongDanCookieHocSinh,
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = Request.IsHttps,
        });
    }

    private string? LayThietBi()
    {
        var thietBi = Request.Headers.UserAgent.ToString();
        return string.IsNullOrWhiteSpace(thietBi) ? null : thietBi;
    }
}
