using Microsoft.AspNetCore.Identity;

namespace ClassManagement.Api.Entities;

/// <summary>
/// Giáo viên — đồng thời là tài khoản đăng nhập (bảng GiaoVien). Kế thừa <see cref="IdentityUser{TKey}"/>
/// để dùng sẵn hàm băm mật khẩu, chuẩn hoá email và khoá tài khoản của ASP.NET Core Identity.
///
/// <see cref="VaiTro"/> là một cột thật chứ không dùng bảng vai trò của Identity: nghiệp vụ chỉ có
/// đúng hai vai trò cố định, thêm bảng vai trò chỉ làm phức tạp câu truy vấn mà không thêm khả năng gì.
/// </summary>
public class GiaoVien : IdentityUser<Guid>
{
    public required string HoTen { get; set; }

    public VaiTro VaiTro { get; set; } = VaiTro.GiaoVien;

    public TrangThaiGiaoVien TrangThai { get; set; } = TrangThaiGiaoVien.DangLam;

    /// <summary>Ngày bắt đầu làm việc, dùng để lọc giáo viên theo thời gian làm việc.</summary>
    public DateOnly NgayThamGia { get; set; }

    public string? GhiChu { get; set; }

    /// <summary>
    /// Email Google đã liên kết của CHÍNH giáo viên này, có được ngay khi họ đăng nhập bằng Google.
    /// Buổi học của ai thì đẩy lên lịch Google của người đó.
    /// </summary>
    public string? GoogleTaiKhoan { get; set; }

    /// <summary>Lịch đích để ghi sự kiện. Mặc định là lịch chính của tài khoản Google.</summary>
    public string? GoogleCalendarId { get; set; }

    /// <summary>
    /// Refresh token Google của giáo viên này, ĐÃ MÃ HOÁ bằng Data Protection.
    /// Chỉ backend giải mã được; không bao giờ trả xuống frontend.
    /// </summary>
    public string? GoogleRefreshTokenMaHoa { get; set; }

    /// <summary>
    /// Tài khoản ngân hàng của CHÍNH giáo viên này, dùng để sinh mã QR thu học phí cho học sinh
    /// mình dạy. Mỗi người tự khai tài khoản của mình; không ai — kể cả admin — sửa hộ hay đọc
    /// số tài khoản của người khác. Admin chỉ thấy số lượng đã khai.
    /// </summary>
    public string? NganHangBin { get; set; }

    public string? SoTaiKhoan { get; set; }

    public string? ChuTaiKhoan { get; set; }

    public DateTime NgayTaoUtc { get; set; }

    public ICollection<HocSinh> HocSinhPhuTrach { get; set; } = [];

    public ICollection<PhienDangNhap> PhienDangNhap { get; set; } = [];
}
