using System.ComponentModel.DataAnnotations;
using ClassManagement.Api.Entities;

namespace ClassManagement.Api.Dtos;

public class GiaoVienDto
{
    public Guid Id { get; set; }

    public required string HoTen { get; set; }

    public required string Email { get; set; }

    public string? SoDienThoai { get; set; }

    public VaiTro VaiTro { get; set; }

    public TrangThaiGiaoVien TrangThai { get; set; }

    public DateOnly NgayThamGia { get; set; }

    public string? GhiChu { get; set; }

    /// <summary>Đếm từ học sinh trỏ tới giáo viên này. Không nhập tay, không lưu trong database.</summary>
    public int SoHocSinhDangPhuTrach { get; set; }

    /// <summary>
    /// Số buổi đã dạy trong tháng hiện tại, đếm từ bảng điểm danh (chỉ tính buổi "đi học").
    /// Không nhập tay — con số dùng để tính lương sau này không được phép gõ sai.
    /// </summary>
    public int SoBuoiDayTrongThang { get; set; }
}

public class TaoGiaoVienRequest
{
    [Required(ErrorMessage = "Nhập tên giáo viên")]
    [MinLength(2, ErrorMessage = "Tên giáo viên phải dài ít nhất 2 ký tự")]
    [MaxLength(200)]
    public string HoTen { get; set; } = "";

    [Required(ErrorMessage = "Nhập email đăng nhập")]
    [EmailAddress(ErrorMessage = "Email không hợp lệ")]
    [MaxLength(256)]
    public string Email { get; set; } = "";

    [MaxLength(30)]
    public string? SoDienThoai { get; set; }

    /// <summary>
    /// Bỏ trống thì lấy vai trò mặc định trong Cài đặt, và vai trò đó luôn là giáo viên.
    /// Không bao giờ tự mặc định thành admin.
    /// </summary>
    public VaiTro? VaiTro { get; set; }

    /// <summary>
    /// Mật khẩu đầu tiên do admin đặt. Phase 2 sẽ thay bằng email mời để giáo viên tự đặt mật khẩu:
    /// hiện tại chưa có kênh gửi email nên đành đặt hộ, và bắt buộc đổi ở lần đăng nhập đầu.
    /// </summary>
    [Required(ErrorMessage = "Nhập mật khẩu đầu tiên cho giáo viên")]
    [MinLength(8, ErrorMessage = "Mật khẩu phải dài ít nhất 8 ký tự")]
    public string MatKhauTamThoi { get; set; } = "";

    public DateOnly? NgayThamGia { get; set; }

    [MaxLength(1000)]
    public string? GhiChu { get; set; }
}

public class SuaGiaoVienRequest
{
    [Required(ErrorMessage = "Nhập tên giáo viên")]
    [MinLength(2, ErrorMessage = "Tên giáo viên phải dài ít nhất 2 ký tự")]
    [MaxLength(200)]
    public string HoTen { get; set; } = "";

    [MaxLength(30)]
    public string? SoDienThoai { get; set; }

    [Required(ErrorMessage = "Chọn vai trò")]
    public VaiTro VaiTro { get; set; }

    [Required(ErrorMessage = "Chọn trạng thái")]
    public TrangThaiGiaoVien TrangThai { get; set; }

    public DateOnly? NgayThamGia { get; set; }

    [MaxLength(1000)]
    public string? GhiChu { get; set; }
}

public class DatLaiMatKhauRequest
{
    [Required(ErrorMessage = "Nhập mật khẩu mới")]
    [MinLength(8, ErrorMessage = "Mật khẩu phải dài ít nhất 8 ký tự")]
    public string MatKhauMoi { get; set; } = "";
}
