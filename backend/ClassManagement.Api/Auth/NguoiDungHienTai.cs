using System.Security.Claims;
using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Auth;

/// <summary>
/// Người dùng của request đang xử lý. Id và vai trò lấy từ token cho nhanh, nhưng mọi việc
/// quan trọng (đổi dữ liệu, xem dữ liệu người khác) đều nạp lại từ database: vai trò có thể vừa
/// bị đổi, tài khoản có thể vừa bị khoá, mà token thì vẫn còn hạn.
/// </summary>
public class NguoiDungHienTai(IHttpContextAccessor truyCap, AppDbContext db)
{
    public Guid? Id
    {
        get
        {
            var chuoi = truyCap.HttpContext?.User.FindFirstValue(JwtRegisteredClaimNames_Sub);
            return Guid.TryParse(chuoi, out var id) ? id : null;
        }
    }

    // "sub" là tên claim ngắn. Khai hằng số riêng để không phải kéo cả thư viện JWT vào đây.
    private const string JwtRegisteredClaimNames_Sub = "sub";

    public bool LaAdminTheoToken
    {
        get
        {
            var vaiTro = truyCap.HttpContext?.User.FindFirstValue(ChinhSach.ClaimVaiTro);
            return string.Equals(vaiTro, ChinhSach.VaiTroAdmin, StringComparison.Ordinal);
        }
    }

    /// <summary>Nạp người dùng từ database, trả về null nếu token không ứng với ai.</summary>
    public async Task<GiaoVien?> LayAsync(CancellationToken huyBo = default)
    {
        var id = Id;
        if (id is null)
        {
            return null;
        }

        return await db.GiaoVien.FirstOrDefaultAsync(x => x.Id == id.Value, huyBo);
    }

    /// <summary>Nạp người dùng và chặn ngay nếu tài khoản không còn dùng được.</summary>
    public async Task<GiaoVien> YeuCauAsync(CancellationToken huyBo = default)
    {
        var nguoiDung = await LayAsync(huyBo)
            ?? throw new LoiApiException("Phiên đăng nhập không hợp lệ", StatusCodes.Status401Unauthorized);

        if (nguoiDung.TrangThai != TrangThaiGiaoVien.DangLam)
        {
            throw new LoiApiException(
                "Tài khoản đã bị khoá",
                StatusCodes.Status401Unauthorized,
                "Giáo viên này đang tạm nghỉ hoặc đã nghỉ; liên hệ admin để mở lại.");
        }

        return nguoiDung;
    }

    /// <summary>Chỉ admin. Kiểm tra theo dữ liệu trong database, không tin vai trò ghi trong token.</summary>
    public async Task<GiaoVien> YeuCauAdminAsync(CancellationToken huyBo = default)
    {
        var nguoiDung = await YeuCauAsync(huyBo);
        if (nguoiDung.VaiTro != VaiTro.Admin)
        {
            throw new LoiApiException(
                "Chỉ admin được làm việc này",
                StatusCodes.Status403Forbidden,
                "Giáo viên không có quyền thay đổi cấu hình chung hay quản lý tài khoản.");
        }

        return nguoiDung;
    }
}
