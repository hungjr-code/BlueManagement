using System.Security.Cryptography;
using System.Text;
using ClassManagement.Api.Auth;
using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Email;
using ClassManagement.Api.Entities;
using ClassManagement.Api.Google;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace ClassManagement.Api.Services;

/// <summary>
/// Tự tạo tài khoản và lấy lại mật khẩu qua email.
///
/// QUYẾT ĐỊNH: tài khoản tự tạo LUÔN là giáo viên — không có đường nào tự phong mình làm admin.
/// Admin đầu tiên vẫn phải sinh bằng seed ở máy chủ. Nhờ vậy mở cho tự đăng ký vẫn không mở luôn
/// quyền quản trị cho người lạ.
/// </summary>
public class DichVuTaiKhoan(
    AppDbContext db,
    UserManager<GiaoVien> quanLyNguoiDung,
    IDichVuEmail email,
    IOptions<GoogleCalendarOptions> tuyChonGoogle,
    DichVuNhatKy nhatKy,
    ILogger<DichVuTaiKhoan> ghiLog)
{
    public const string HanhDongTuDangKy = "tu_dang_ky_tai_khoan";
    public const string HanhDongQuenMatKhau = "yeu_cau_dat_lai_mat_khau";
    public const string HanhDongDatLaiMatKhau = "dat_lai_mat_khau";

    /// <summary>Link đặt lại mật khẩu chỉ sống 30 phút — đủ để mở email, không đủ để lọt vào tay người khác lâu dài.</summary>
    private static readonly TimeSpan HanCuaYeuCau = TimeSpan.FromMinutes(30);

    /// <summary>Không gửi lại thư trong vòng một phút, tránh việc bấm nhiều lần thành spam.</summary>
    private static readonly TimeSpan GianCachGuiLai = TimeSpan.FromSeconds(60);

    private readonly string _frontendUrl = tuyChonGoogle.Value.FrontendUrl.TrimEnd('/');

    public bool CoGuiDuocEmail => email.DaCauHinh;

    /* ------------------------------- Tự đăng ký ------------------------------- */

    public async Task<GiaoVien> DangKyAsync(DangKyRequest yeuCau, string? diaChiIp, CancellationToken huyBo = default)
    {
        var emailChuan = yeuCau.Email.Trim();

        if (await quanLyNguoiDung.FindByEmailAsync(emailChuan) is not null)
        {
            throw new LoiApiException(
                "Email này đã có tài khoản",
                StatusCodes.Status409Conflict,
                "Thử đăng nhập, hoặc dùng chức năng quên mật khẩu nếu không nhớ mật khẩu.");
        }

        var nguoiDung = new GiaoVien
        {
            HoTen = yeuCau.HoTen.Trim(),
            Email = emailChuan,
            UserName = emailChuan,
            VaiTro = VaiTro.GiaoVien,
            TrangThai = TrangThaiGiaoVien.DangLam,
            NgayTaoUtc = DateTime.UtcNow,
            NgayThamGia = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        await TaoNguoiDungAsync(nguoiDung, yeuCau.MatKhau, huyBo);

        await nhatKy.GhiAsync(
            nguoiDung.Id,
            HanhDongTuDangKy,
            "GiaoVien",
            nguoiDung.Id.ToString(),
            null,
            DichVuNhatKy.Json(new { nguoiDung.HoTen, nguoiDung.Email, VaiTro = "giao_vien" }),
            huyBo);

        ghiLog.LogInformation("Tài khoản tự đăng ký: {Email}.", nguoiDung.Email);

        // Thư chào mừng: gửi hỏng cũng không được làm hỏng việc đăng ký.
        if (email.DaCauHinh)
        {
            const string noiDung = """
                <p>Chào bạn,</p>
                <p>Tài khoản ClassManagement của bạn đã được tạo với email này.</p>
                <p>Vào hệ thống để khai tài khoản nhận tiền, rồi admin sẽ gán học sinh cho bạn.</p>
                """;

            await ThuGuiKhongChanAsync(emailChuan, "Tài khoản ClassManagement của bạn đã được tạo", noiDung, huyBo);
        }

        return nguoiDung;
    }

    /// <summary>
    /// Tạo tài khoản cho lần đầu đăng nhập bằng Google. Không cần mật khẩu: tài khoản này đăng nhập
    /// bằng Google, còn muốn dùng mật khẩu thì dùng chức năng quên mật khẩu để đặt.
    /// </summary>
    public async Task<GiaoVien> TaoTaiKhoanTuGoogleAsync(
        string emailChuan,
        string? hoTen,
        string? diaChiIp,
        CancellationToken huyBo = default)
    {
        var nguoiDung = new GiaoVien
        {
            HoTen = string.IsNullOrWhiteSpace(hoTen) ? TenTuEmail(emailChuan) : hoTen.Trim(),
            Email = emailChuan,
            UserName = emailChuan,
            VaiTro = VaiTro.GiaoVien,
            TrangThai = TrangThaiGiaoVien.DangLam,
            EmailConfirmed = true,
            NgayTaoUtc = DateTime.UtcNow,
            NgayThamGia = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        await TaoNguoiDungAsync(nguoiDung, matKhau: null, huyBo);

        await nhatKy.GhiAsync(
            nguoiDung.Id,
            "tu_dang_ky_bang_google",
            "GiaoVien",
            nguoiDung.Id.ToString(),
            null,
            DichVuNhatKy.Json(new { nguoiDung.HoTen, nguoiDung.Email }),
            huyBo);

        ghiLog.LogInformation("Tài khoản tự tạo bằng Google: {Email}.", nguoiDung.Email);
        return nguoiDung;
    }

    /* ----------------------------- Quên mật khẩu ----------------------------- */

    /// <summary>
    /// Gửi thư đặt lại mật khẩu. KHÔNG bao giờ cho biết email có tài khoản hay không: người dùng nhận
    /// cùng một câu trả lời trong mọi trường hợp, còn chuyện gửi hay không thì ghi ở log máy chủ.
    /// </summary>
    public async Task GuiYeuCauDatLaiAsync(string emailNhap, string? diaChiIp, CancellationToken huyBo = default)
    {
        if (!email.DaCauHinh)
        {
            throw new LoiApiException(
                "Chưa cấu hình gửi email",
                StatusCodes.Status409Conflict,
                "Máy chủ chưa có cấu hình SMTP nên không gửi được thư. Đặt Email:SmtpHost, Email:TuDiaChi "
                + "(và Email:SmtpTaiKhoan/SmtpMatKhau nếu cần) trong user-secrets rồi thử lại.");
        }

        var nguoiDung = await quanLyNguoiDung.FindByEmailAsync(emailNhap.Trim());
        if (nguoiDung is null)
        {
            ghiLog.LogInformation("Yêu cầu quên mật khẩu cho email không có tài khoản: {Email}.", emailNhap);
            return;
        }

        if (nguoiDung.TrangThai != TrangThaiGiaoVien.DangLam)
        {
            // Tài khoản đã nghỉ thì không phát hành đường lấy lại mật khẩu nữa, nhưng vẫn trả lời
            // giống hệt trường hợp thành công.
            ghiLog.LogInformation("Yêu cầu quên mật khẩu cho tài khoản đã khoá: {Email}.", nguoiDung.Email);
            return;
        }

        var vuaGui = await db.YeuCauDatLaiMatKhau
            .Where(x => x.GiaoVienId == nguoiDung.Id && x.NgayDungUtc == null)
            .OrderByDescending(x => x.NgayTaoUtc)
            .FirstOrDefaultAsync(huyBo);

        if (vuaGui is not null && vuaGui.NgayTaoUtc > DateTime.UtcNow - GianCachGuiLai)
        {
            ghiLog.LogInformation("Bỏ qua yêu cầu quên mật khẩu vừa gửi cách đây ít giây: {Email}.", nguoiDung.Email);
            return;
        }

        // Token gửi trong email là chuỗi ngẫu nhiên; trong database chỉ giữ bản băm.
        var token = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
        var bayGio = DateTime.UtcNow;

        db.YeuCauDatLaiMatKhau.Add(new YeuCauDatLaiMatKhau
        {
            GiaoVienId = nguoiDung.Id,
            TokenBam = JwtTokenService.BamToken(token),
            NgayTaoUtc = bayGio,
            HetHanUtc = bayGio.Add(HanCuaYeuCau),
            DiaChiIp = diaChiIp,
        });

        await db.SaveChangesAsync(huyBo);

        var duongDan = $"{_frontendUrl}/dat-lai-mat-khau?token={Uri.EscapeDataString(token)}";
        var noiDung = $"""
            <p>Chào {(nguoiDung.HoTen is { Length: > 0 } ten ? ten : nguoiDung.Email)},</p>
            <p>Có yêu cầu đặt lại mật khẩu cho tài khoản ClassManagement của bạn.</p>
            <p><a href="{duongDan}">Bấm vào đây để đặt mật khẩu mới</a></p>
            <p>Liên kết chỉ dùng được một lần và hết hạn sau 30 phút. Nếu không phải bạn yêu cầu thì bỏ qua thư này.</p>
            """;

        await email.GuiAsync(nguoiDung.Email!, "Đặt lại mật khẩu ClassManagement", noiDung, huyBo);

        await nhatKy.GhiAsync(
            nguoiDung.Id,
            HanhDongQuenMatKhau,
            "GiaoVien",
            nguoiDung.Id.ToString(),
            null,
            DichVuNhatKy.Json(new { nguoiDung.Email, HetHanUtc = bayGio.Add(HanCuaYeuCau) }),
            huyBo);
    }

    public async Task<GiaoVien> DatLaiMatKhauAsync(
        string token,
        string matKhauMoi,
        string? diaChiIp,
        CancellationToken huyBo = default)
    {
        var bam = JwtTokenService.BamToken(token.Trim());
        var yeuCau = await db.YeuCauDatLaiMatKhau
            .Include(x => x.GiaoVien)
            .FirstOrDefaultAsync(x => x.TokenBam == bam, huyBo);

        if (yeuCau?.GiaoVien is null || yeuCau.NgayDungUtc is not null || yeuCau.HetHanUtc < DateTime.UtcNow)
        {
            throw LoiApiException.DuLieuSai(
                "Liên kết đặt lại mật khẩu không dùng được.",
                new Dictionary<string, string[]>
                {
                    ["token"] = ["Liên kết sai, đã dùng rồi, hoặc quá 30 phút. Xin gửi lại thư mới."],
                });
        }

        var nguoiDung = yeuCau.GiaoVien;

        // Dùng token một lần của Identity để đặt lại, vì nó cập nhật luôn SecurityStamp — đổi
        // SecurityStamp làm mọi access token cũ mất hiệu lực ngay.
        var tokenIdentity = await quanLyNguoiDung.GeneratePasswordResetTokenAsync(nguoiDung);
        var ketQua = await quanLyNguoiDung.ResetPasswordAsync(nguoiDung, tokenIdentity, matKhauMoi);

        if (!ketQua.Succeeded)
        {
            throw LoiApiException.DuLieuSai(
                "Không đặt được mật khẩu mới.",
                ketQua.Errors
                    .GroupBy(_ => nameof(DatLaiMatKhauQuaEmailRequest.MatKhauMoi))
                    .ToDictionary(nhom => nhom.Key, nhom => nhom.Select(DocLoiIdentity).ToArray()));
        }

        yeuCau.NgayDungUtc = DateTime.UtcNow;

        // Mọi yêu cầu cũ khác của tài khoản này cũng hết giá trị, để một thư cũ không mở lại được cửa.
        await db.YeuCauDatLaiMatKhau
            .Where(x => x.GiaoVienId == nguoiDung.Id && x.NgayDungUtc == null)
            .ExecuteUpdateAsync(capNhat => capNhat.SetProperty(x => x.NgayDungUtc, DateTime.UtcNow), huyBo);

        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            nguoiDung.Id,
            HanhDongDatLaiMatKhau,
            "GiaoVien",
            nguoiDung.Id.ToString(),
            null,
            DichVuNhatKy.Json(new { nguoiDung.Email }),
            huyBo);

        ghiLog.LogInformation("Đã đặt lại mật khẩu cho {Email}.", nguoiDung.Email);
        return nguoiDung;
    }

    /* --------------------------------- Nội bộ -------------------------------- */

    private async Task TaoNguoiDungAsync(GiaoVien nguoiDung, string? matKhau, CancellationToken huyBo)
    {
        var ketQua = matKhau is null
            ? await quanLyNguoiDung.CreateAsync(nguoiDung)
            : await quanLyNguoiDung.CreateAsync(nguoiDung, matKhau);

        if (ketQua.Succeeded)
        {
            return;
        }

        var loi = ketQua.Errors.ToList();

        if (loi.Any(x => x.Code == nameof(IdentityErrorDescriber.DuplicateEmail)))
        {
            throw new LoiApiException(
                "Email này đã có tài khoản",
                StatusCodes.Status409Conflict,
                "Có thể bạn đã đăng ký trước đó. Thử đăng nhập hoặc dùng chức năng quên mật khẩu.");
        }

        throw LoiApiException.DuLieuSai(
            "Không tạo được tài khoản.",
            loi.GroupBy(_ => nameof(DangKyRequest.MatKhau))
                .ToDictionary(nhom => nhom.Key, nhom => nhom.Select(DocLoiIdentity).ToArray()));
    }

    private static string DocLoiIdentity(IdentityError loi) => loi.Code switch
    {
        "PasswordTooShort" => "Mật khẩu phải từ 8 ký tự",
        "PasswordRequiresNonAlphanumeric" => "Mật khẩu phải có ít nhất một ký tự đặc biệt",
        "PasswordRequiresDigit" => "Mật khẩu phải có ít nhất một chữ số",
        "PasswordRequiresLower" => "Mật khẩu phải có ít nhất một chữ thường",
        "PasswordRequiresUpper" => "Mật khẩu phải có ít nhất một chữ hoa",
        "DuplicateUserName" or "DuplicateEmail" => "Email này đã có tài khoản",
        "InvalidEmail" => "Email không hợp lệ",
        _ => loi.Description,
    };

    private async Task ThuGuiKhongChanAsync(string den, string tieuDe, string noiDung, CancellationToken huyBo)
    {
        try
        {
            await email.GuiAsync(den, tieuDe, noiDung, huyBo);
        }
        catch (Exception loi)
        {
            ghiLog.LogWarning(loi, "Không gửi được email tới {Den}.", den);
        }
    }

    private static string TenTuEmail(string emailChuan)
    {
        var viTri = emailChuan.IndexOf('@', StringComparison.Ordinal);
        return viTri > 0 ? emailChuan[..viTri] : emailChuan;
    }
}
