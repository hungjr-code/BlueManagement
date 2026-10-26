using System.Security.Cryptography;
using ClassManagement.Api.Auth;
using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ClassManagement.Api.Services;

/// <summary>
/// Tài khoản của HỌC SINH: cấp mã + mật khẩu, đăng nhập, làm mới phiên, đổi mật khẩu.
///
/// Vì sao là tài khoản riêng chứ không dùng chung bảng GiaoVien: học sinh đăng nhập bằng MÃ (HS-0007)
/// chứ không bằng email, và tuyệt đối không được lẫn với tài khoản giáo viên — token của học sinh
/// mang audience riêng nên không dùng được cho API của giáo viên.
///
/// Băm mật khẩu bằng đúng PasswordHasher của ASP.NET Core Identity, không tự viết hàm băm.
/// </summary>
public class DichVuTaiKhoanHocSinh(
    AppDbContext db,
    JwtTokenService dichVuToken,
    DichVuNhatKy nhatKy,
    IOptions<JwtOptions> tuyChonJwt,
    ILogger<DichVuTaiKhoanHocSinh> ghiLog)
{
    private static readonly PasswordHasher<HocSinh> BamMatKhau = new();

    private static readonly TimeSpan ThoiGianAnHanKhiXoayVong = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan ThoiGianKhoa = TimeSpan.FromMinutes(15);
    private const int SoLanSaiToiDa = 5;

    public const string HanhDongCapTaiKhoan = "cap_tai_khoan_hoc_sinh";
    public const string HanhDongThuHoiTaiKhoan = "thu_hoi_tai_khoan_hoc_sinh";
    public const string HanhDongDoiMatKhauHocSinh = "doi_mat_khau_hoc_sinh";

    /// <summary>
    /// Bảng chữ cái để sinh mật khẩu tạm: bỏ các ký tự dễ đọc nhầm (0/O, 1/l/I) vì giáo viên sẽ đọc
    /// mật khẩu này cho học sinh nhỏ nghe và gõ lại.
    /// </summary>
    private const string ChuCaiDeDoc = "abcdefghjkmnpqrstuvwxyz";
    private const string ChuSoDeDoc = "23456789";

    /* ------------------------------------------------------------------ *
     * Chuẩn hoá dữ liệu
     * ------------------------------------------------------------------ */

    /// <summary>Chuẩn hoá mã học sinh: bỏ khoảng trắng, viết hoa, để "hs-7" và "HS-0007" không thành hai người.</summary>
    public static string ChuanHoaMa(string ma)
    {
        return ma.Trim().ToUpperInvariant();
    }

    /// <summary>Mật khẩu của học sinh: ngắn hơn giáo viên nhưng vẫn phải có chữ và số.</summary>
    public static bool MatKhauHopLe(string? matKhau, out string loi)
    {
        if (string.IsNullOrWhiteSpace(matKhau) || matKhau.Length < 6)
        {
            loi = "Mật khẩu phải dài ít nhất 6 ký tự";
            return false;
        }

        if (!matKhau.Any(char.IsDigit) || !matKhau.Any(char.IsLetter))
        {
            loi = "Mật khẩu phải có cả chữ và số";
            return false;
        }

        loi = string.Empty;
        return true;
    }

    /// <summary>Mật khẩu tạm 8 ký tự luôn có cả chữ và số, đọc lên là gõ được.</summary>
    public static string SinhMatKhauTam()
    {
        Span<char> kyTu = stackalloc char[8];

        for (var i = 0; i < 6; i++)
        {
            kyTu[i] = ChuCaiDeDoc[RandomNumberGenerator.GetInt32(ChuCaiDeDoc.Length)];
        }

        kyTu[6] = ChuSoDeDoc[RandomNumberGenerator.GetInt32(ChuSoDeDoc.Length)];
        kyTu[7] = ChuSoDeDoc[RandomNumberGenerator.GetInt32(ChuSoDeDoc.Length)];

        // Trộn vị trí để chữ số không luôn nằm ở cuối (nhìn là đoán được quy luật).
        for (var i = kyTu.Length - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (kyTu[i], kyTu[j]) = (kyTu[j], kyTu[i]);
        }

        return new string(kyTu);
    }

    /// <summary>Sinh mã học sinh kế tiếp dạng HS-0007, nhảy qua mã đã dùng.</summary>
    public async Task<string> TaoMaHocSinhAsync(CancellationToken huyBo = default)
    {
        var daCo = await db.HocSinh
            .AsNoTracking()
            .Where(x => x.MaHocSinh != null)
            .Select(x => x.MaHocSinh!)
            .ToListAsync(huyBo);

        var soLonNhat = 0;
        foreach (var ma in daCo)
        {
            var phan = ma.Split('-');
            if (phan.Length == 2 && int.TryParse(phan[1], out var so) && so > soLonNhat)
            {
                soLonNhat = so;
            }
        }

        for (var i = soLonNhat + 1; i < soLonNhat + 1000; i++)
        {
            var ma = "HS-" + i.ToString("D4");
            if (!daCo.Contains(ma, StringComparer.Ordinal))
            {
                return ma;
            }
        }

        // Hết cách đặt tên tuần tự thì vẫn phải trả về một mã duy nhất.
        return "HS-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
    }

    /* ------------------------------------------------------------------ *
     * Cấp / thu hồi tài khoản (giáo viên làm)
     * ------------------------------------------------------------------ */

    /// <summary>
    /// Cấp hoặc đặt lại tài khoản cho một học sinh. Trả về mật khẩu tạm ĐÚNG MỘT LẦN: cơ sở dữ liệu
    /// chỉ giữ bản băm nên sau phản hồi này không ai đọc lại được mật khẩu.
    /// </summary>
    public async Task<CapTaiKhoanHocSinhDto> CapTaiKhoanAsync(
        HocSinh hocSinh,
        string? maMongMuon,
        string? matKhauMongMuon,
        Guid? nguoiThucHienId,
        CancellationToken huyBo = default)
    {
        var ma = string.IsNullOrWhiteSpace(maMongMuon)
            ? hocSinh.MaHocSinh ?? await TaoMaHocSinhAsync(huyBo)
            : ChuanHoaMa(maMongMuon);

        if (ma.Length > 20 || !ma.All(kyTu => char.IsLetterOrDigit(kyTu) || kyTu is '-' or '_' or '.'))
        {
            throw LoiApiException.DuLieuSai(
                "Mã học sinh không hợp lệ.",
                new Dictionary<string, string[]>
                {
                    [nameof(DatLaiMatKhauHocSinhRequest.MaHocSinh)] =
                        ["Mã chỉ gồm chữ, số và các dấu - _ . (tối đa 20 ký tự)"],
                });
        }

        var trungMa = await db.HocSinh.AnyAsync(x => x.Id != hocSinh.Id && x.MaHocSinh == ma, huyBo);
        if (trungMa)
        {
            throw LoiApiException.DuLieuSai(
                "Mã học sinh đã có người dùng.",
                new Dictionary<string, string[]>
                {
                    [nameof(DatLaiMatKhauHocSinhRequest.MaHocSinh)] = ["Chọn mã khác, ví dụ " + ma + "2"],
                });
        }

        var matKhau = string.IsNullOrWhiteSpace(matKhauMongMuon) ? SinhMatKhauTam() : matKhauMongMuon.Trim();
        if (!MatKhauHopLe(matKhau, out var loiMatKhau))
        {
            throw LoiApiException.DuLieuSai(
                "Mật khẩu không hợp lệ.",
                new Dictionary<string, string[]>
                {
                    [nameof(DatLaiMatKhauHocSinhRequest.MatKhauMoi)] = [loiMatKhau],
                });
        }

        var doiMa = hocSinh.MaHocSinh != ma;

        hocSinh.MaHocSinh = ma;
        hocSinh.MatKhauBam = BamMatKhau.HashPassword(hocSinh, matKhau);
        hocSinh.SoLanSaiMatKhau = 0;
        hocSinh.KhoaDenLuc = null;
        hocSinh.NgayCapNhatUtc = DateTime.UtcNow;

        // Cấp mật khẩu mới là cắt mọi phiên đang mở: nếu không, một phiên cũ vẫn xem được bài tập
        // của học sinh dù mật khẩu đã đổi.
        await ThuHoiPhienAsync(hocSinh.Id, null, huyBo);
        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            nguoiThucHienId,
            HanhDongCapTaiKhoan,
            "HocSinh",
            hocSinh.Id.ToString(),
            null,
            DichVuNhatKy.Json(new { hocSinh.HoTen, MaHocSinh = ma, DoiMa = doiMa, DatMatKhauMoi = true }),
            huyBo);

        ghiLog.LogInformation("Đã cấp tài khoản học sinh {Ma} cho {Ten}.", ma, hocSinh.HoTen);

        return new CapTaiKhoanHocSinhDto
        {
            HocSinhId = hocSinh.Id,
            HoTen = hocSinh.HoTen,
            MaHocSinh = ma,
            MatKhauTam = matKhau,
            GhiChu = "Đây là mật khẩu duy nhất hiển thị một lần — hãy đọc cho học sinh ngay. "
                + "Quên thì đặt lại, không xem lại được.",
        };
    }

    /// <summary>Thu hồi tài khoản: xoá mật khẩu và cắt mọi phiên. Học sinh không đăng nhập được nữa.</summary>
    public async Task ThuHoiTaiKhoanAsync(HocSinh hocSinh, Guid? nguoiThucHienId, CancellationToken huyBo = default)
    {
        hocSinh.MatKhauBam = null;
        hocSinh.SoLanSaiMatKhau = 0;
        hocSinh.KhoaDenLuc = null;
        hocSinh.NgayCapNhatUtc = DateTime.UtcNow;

        await ThuHoiPhienAsync(hocSinh.Id, null, huyBo);
        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            nguoiThucHienId,
            HanhDongThuHoiTaiKhoan,
            "HocSinh",
            hocSinh.Id.ToString(),
            null,
            DichVuNhatKy.Json(new { hocSinh.HoTen, hocSinh.MaHocSinh }),
            huyBo);

        ghiLog.LogInformation("Đã thu hồi tài khoản của học sinh {Ten}.", hocSinh.HoTen);
    }

    /// <summary>Trạng thái tài khoản của một học sinh, cho màn hình Học sinh của giáo viên.</summary>
    public async Task<TaiKhoanHocSinhDto> LayTrangThaiTaiKhoanAsync(HocSinh hocSinh, CancellationToken huyBo = default)
    {
        var bayGio = DateTime.UtcNow;

        return new TaiKhoanHocSinhDto
        {
            HocSinhId = hocSinh.Id,
            HoTen = hocSinh.HoTen,
            MaHocSinh = hocSinh.MaHocSinh,
            CoMatKhau = !string.IsNullOrWhiteSpace(hocSinh.MatKhauBam),
            LanDangNhapCuoiUtc = hocSinh.LanDangNhapCuoiUtc,
            SoPhienDangMo = await db.PhienHocSinh
                .CountAsync(x => x.HocSinhId == hocSinh.Id && x.NgayThuHoiUtc == null && x.HetHanUtc > bayGio, huyBo),
        };
    }

    /* ------------------------------------------------------------------ *
     * Đăng nhập (học sinh làm)
     * ------------------------------------------------------------------ */

    public async Task<KetQuaDangNhapHocSinh> DangNhapAsync(
        string maHocSinh,
        string matKhau,
        string? diaChiIp,
        string? thietBi,
        CancellationToken huyBo = default)
    {
        var ma = ChuanHoaMa(maHocSinh);
        var hocSinh = await db.HocSinh
            .Include(x => x.GiaoVien)
            .FirstOrDefaultAsync(x => x.MaHocSinh == ma, huyBo);

        // Mã sai và mật khẩu sai trả về CÙNG một thông báo: khác nhau là đủ để dò xem mã nào có thật.
        if (hocSinh is null)
        {
            throw SaiThongTinDangNhap();
        }

        if (string.IsNullOrWhiteSpace(hocSinh.MatKhauBam))
        {
            throw new LoiApiException(
                "Tài khoản chưa có mật khẩu",
                StatusCodes.Status409Conflict,
                "Giáo viên cần cấp mật khẩu cho tài khoản này trước (màn Học sinh → Cấp tài khoản).");
        }

        if (hocSinh.TrangThai != TrangThaiHocSinh.DangHoc)
        {
            throw new LoiApiException(
                "Tài khoản đang tạm nghỉ",
                StatusCodes.Status403Forbidden,
                "Em đang tạm nghỉ học nên chưa vào xem bài được. Liên hệ giáo viên nếu cần.");
        }

        if (hocSinh.KhoaDenLuc is { } khoaDen && khoaDen > DateTime.UtcNow)
        {
            throw new LoiApiException(
                "Tài khoản đang tạm khoá",
                StatusCodes.Status423Locked,
                "Sai mật khẩu quá nhiều lần. Thử lại sau ít phút hoặc nhờ giáo viên đặt lại mật khẩu.");
        }

        var ketQuaBam = BamMatKhau.VerifyHashedPassword(hocSinh, hocSinh.MatKhauBam, matKhau);

        if (ketQuaBam == PasswordVerificationResult.Failed)
        {
            hocSinh.SoLanSaiMatKhau++;

            if (hocSinh.SoLanSaiMatKhau >= SoLanSaiToiDa)
            {
                hocSinh.KhoaDenLuc = DateTime.UtcNow.Add(ThoiGianKhoa);
                hocSinh.SoLanSaiMatKhau = 0;
            }

            await db.SaveChangesAsync(huyBo);
            throw SaiThongTinDangNhap();
        }

        // Bản băm cũ (thuật toán đời trước) thì nâng cấp luôn, nhân lúc đã có mật khẩu trong tay.
        if (ketQuaBam == PasswordVerificationResult.SuccessRehashNeeded)
        {
            hocSinh.MatKhauBam = BamMatKhau.HashPassword(hocSinh, matKhau);
        }

        hocSinh.SoLanSaiMatKhau = 0;
        hocSinh.KhoaDenLuc = null;
        hocSinh.LanDangNhapCuoiUtc = DateTime.UtcNow;

        return await TaoPhienMoiAsync(hocSinh, diaChiIp, thietBi, null, huyBo);
    }

    /// <summary>Làm mới phiên bằng refresh token trong cookie. Trả về null nếu token không ứng với phiên nào.</summary>
    public async Task<KetQuaDangNhapHocSinh?> LamMoiPhienAsync(
        string refreshToken,
        string? diaChiIp,
        string? thietBi,
        CancellationToken huyBo = default)
    {
        var bam = JwtTokenService.BamToken(refreshToken);
        var phien = await db.PhienHocSinh
            .Include(x => x.HocSinh)!
            .ThenInclude(x => x!.GiaoVien)
            .FirstOrDefaultAsync(x => x.TokenBam == bam, huyBo);

        if (phien?.HocSinh is null)
        {
            return null;
        }

        var hocSinh = phien.HocSinh;

        if (!phien.ConHieuLuc(DateTime.UtcNow))
        {
            // Mở hai tab là chuyện bình thường: tab thứ hai cầm đúng token mà tab thứ nhất vừa xoay
            // vòng. Trong vài chục giây đầu thì tha, quá lâu mới coi là token bị lộ.
            var vuaBiXoayVong = phien.ThayTheBoiId is not null
                && phien.NgayThuHoiUtc is { } lucThuHoi
                && DateTime.UtcNow - lucThuHoi < ThoiGianAnHanKhiXoayVong;

            if (!vuaBiXoayVong)
            {
                ghiLog.LogWarning(
                    "Refresh token đã thu hồi của học sinh {Ma} bị dùng lại — thu hồi mọi phiên.",
                    hocSinh.MaHocSinh);
                await ThuHoiPhienAsync(hocSinh.Id, null, huyBo);
            }

            throw new LoiApiException(
                "Phiên đăng nhập đã hết hiệu lực",
                StatusCodes.Status401Unauthorized,
                "Đăng nhập lại bằng mã học sinh và mật khẩu giúp em.");
        }

        if (hocSinh.TrangThai != TrangThaiHocSinh.DangHoc)
        {
            await ThuHoiPhienAsync(hocSinh.Id, null, huyBo);
            throw new LoiApiException("Tài khoản đang tạm nghỉ", StatusCodes.Status403Forbidden);
        }

        return await TaoPhienMoiAsync(hocSinh, diaChiIp, thietBi, phien, huyBo);
    }

    public async Task DangXuatAsync(string refreshToken, CancellationToken huyBo = default)
    {
        var bam = JwtTokenService.BamToken(refreshToken);
        var phien = await db.PhienHocSinh.FirstOrDefaultAsync(x => x.TokenBam == bam, huyBo);

        if (phien is { NgayThuHoiUtc: null })
        {
            phien.NgayThuHoiUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(huyBo);
        }
    }

    /// <summary>Học sinh tự đổi mật khẩu. Đổi xong thì mọi phiên KHÁC bị cắt.</summary>
    public async Task DoiMatKhauAsync(
        HocSinh hocSinh,
        string matKhauHienTai,
        string matKhauMoi,
        string? maPhienHienTai,
        CancellationToken huyBo = default)
    {
        if (string.IsNullOrWhiteSpace(hocSinh.MatKhauBam))
        {
            throw new LoiApiException(
                "Tài khoản chưa có mật khẩu",
                StatusCodes.Status409Conflict,
                "Nhờ giáo viên cấp mật khẩu cho tài khoản này trước.");
        }

        if (BamMatKhau.VerifyHashedPassword(hocSinh, hocSinh.MatKhauBam, matKhauHienTai)
            == PasswordVerificationResult.Failed)
        {
            throw LoiApiException.DuLieuSai(
                "Mật khẩu hiện tại không đúng.",
                new Dictionary<string, string[]>
                {
                    [nameof(DoiMatKhauHocSinhRequest.MatKhauHienTai)] = ["Kiểm tra lại mật khẩu đang dùng"],
                });
        }

        if (!MatKhauHopLe(matKhauMoi, out var loiMatKhau))
        {
            throw LoiApiException.DuLieuSai(
                "Mật khẩu mới không hợp lệ.",
                new Dictionary<string, string[]>
                {
                    [nameof(DoiMatKhauHocSinhRequest.MatKhauMoi)] = [loiMatKhau],
                });
        }

        hocSinh.MatKhauBam = BamMatKhau.HashPassword(hocSinh, matKhauMoi);
        hocSinh.NgayCapNhatUtc = DateTime.UtcNow;

        // Giữ lại đúng phiên đang dùng, cắt các phiên còn lại.
        await ThuHoiPhienAsync(hocSinh.Id, maPhienHienTai, huyBo);
        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            null,
            HanhDongDoiMatKhauHocSinh,
            "HocSinh",
            hocSinh.Id.ToString(),
            null,
            DichVuNhatKy.Json(new { hocSinh.HoTen, hocSinh.MaHocSinh }),
            huyBo);
    }

    public static HocSinhToiDto TaoDto(HocSinh hocSinh)
    {
        return new HocSinhToiDto
        {
            Id = hocSinh.Id,
            HoTen = hocSinh.HoTen,
            MaHocSinh = hocSinh.MaHocSinh,
            Lop = hocSinh.Lop,
            GiaoVienId = hocSinh.GiaoVienId,
            TenGiaoVien = hocSinh.GiaoVien?.HoTen ?? "—",
        };
    }

    /* ------------------------------------------------------------------ */

    private async Task<KetQuaDangNhapHocSinh> TaoPhienMoiAsync(
        HocSinh hocSinh,
        string? diaChiIp,
        string? thietBi,
        PhienHocSinh? phienCu,
        CancellationToken huyBo)
    {
        var tokenMoi = JwtTokenService.TaoRefreshToken();
        var phienMoi = new PhienHocSinh
        {
            HocSinhId = hocSinh.Id,
            TokenBam = JwtTokenService.BamToken(tokenMoi),
            NgayTaoUtc = DateTime.UtcNow,
            HetHanUtc = DateTime.UtcNow.AddDays(tuyChonJwt.Value.RefreshTokenDays),
            DiaChiIp = diaChiIp,
            ThietBi = thietBi is null ? null : thietBi[..Math.Min(thietBi.Length, 300)],
        };

        if (phienCu is not null)
        {
            phienCu.NgayThuHoiUtc = DateTime.UtcNow;
            db.PhienHocSinh.Add(phienMoi);
            await db.SaveChangesAsync(huyBo);
            phienCu.ThayTheBoiId = phienMoi.Id;
            await db.SaveChangesAsync(huyBo);
        }
        else
        {
            db.PhienHocSinh.Add(phienMoi);
            await db.SaveChangesAsync(huyBo);
        }

        var (accessToken, hetHanUtc) = dichVuToken.TaoAccessToken(hocSinh);

        return new KetQuaDangNhapHocSinh
        {
            AccessToken = accessToken,
            HetHanUtc = hetHanUtc,
            HocSinh = TaoDto(hocSinh),
            // Refresh token trả về cho controller đặt cookie — nó không bao giờ đi trong body JSON
            // dành cho JavaScript. Dùng trường nội bộ bên dưới.
            RefreshTokenNoiBo = tokenMoi,
            RefreshHetHanUtcNoiBo = phienMoi.HetHanUtc,
        };
    }

    /// <summary>Thu hồi mọi phiên đang mở của một học sinh (trừ phiên đang dùng nếu có).</summary>
    private async Task ThuHoiPhienAsync(Guid hocSinhId, string? bamPhienGiuLai, CancellationToken huyBo)
    {
        await db.PhienHocSinh
            .Where(x => x.HocSinhId == hocSinhId
                && x.NgayThuHoiUtc == null
                && (bamPhienGiuLai == null || x.TokenBam != bamPhienGiuLai))
            .ExecuteUpdateAsync(capNhat => capNhat.SetProperty(x => x.NgayThuHoiUtc, DateTime.UtcNow), huyBo);
    }

    private static LoiApiException SaiThongTinDangNhap()
    {
        return new LoiApiException(
            "Mã học sinh hoặc mật khẩu không đúng",
            StatusCodes.Status401Unauthorized,
            "Kiểm tra lại mã học sinh (ví dụ HS-0007) và mật khẩu giáo viên đã đọc.");
    }
}
