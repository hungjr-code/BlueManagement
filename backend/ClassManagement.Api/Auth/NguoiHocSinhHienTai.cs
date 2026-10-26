using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Auth;

/// <summary>
/// Học sinh của request đang xử lý — bản song song của <see cref="NguoiDungHienTai"/> dành cho tài
/// khoản học sinh. Chỉ dùng ở các endpoint có <c>[Authorize(AuthenticationSchemes = ...)]</c> trỏ vào
/// lược đồ token của học sinh, nên không có chuyện lẫn với phiên giáo viên.
///
/// Luôn nạp lại học sinh từ database: em có thể vừa bị cho nghỉ học, mà token thì vẫn còn hạn.
/// </summary>
public class NguoiHocSinhHienTai(IHttpContextAccessor truyCap, AppDbContext db)
{
    private const string ClaimSub = "sub";

    public Guid? Id
    {
        get
        {
            var chuoi = truyCap.HttpContext?.User.FindFirst(ClaimSub)?.Value;
            return Guid.TryParse(chuoi, out var id) ? id : null;
        }
    }

    public async Task<HocSinh?> LayAsync(CancellationToken huyBo = default)
    {
        var id = Id;
        if (id is null)
        {
            return null;
        }

        return await db.HocSinh
            .Include(x => x.GiaoVien)
            .FirstOrDefaultAsync(x => x.Id == id.Value, huyBo);
    }

    /// <summary>Nạp học sinh và chặn ngay nếu em không còn học (đã nghỉ thì không xem bài tập nữa).</summary>
    public async Task<HocSinh> YeuCauAsync(CancellationToken huyBo = default)
    {
        var hocSinh = await LayAsync(huyBo)
            ?? throw new LoiApiException("Phiên đăng nhập không hợp lệ", StatusCodes.Status401Unauthorized);

        if (hocSinh.TrangThai != TrangThaiHocSinh.DangHoc)
        {
            throw new LoiApiException(
                "Tài khoản đang tạm nghỉ",
                StatusCodes.Status403Forbidden,
                "Liên hệ giáo viên nếu em cần mở lại tài khoản.");
        }

        return hocSinh;
    }
}
