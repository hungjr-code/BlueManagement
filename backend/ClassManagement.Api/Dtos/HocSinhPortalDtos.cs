using System.ComponentModel.DataAnnotations;
using ClassManagement.Api.Entities;

namespace ClassManagement.Api.Dtos;

/// <summary>Đăng nhập của học sinh: mã học sinh (giáo viên đọc cho) và mật khẩu.</summary>
public class DangNhapHocSinhRequest
{
    [Required(ErrorMessage = "Nhập mã học sinh")]
    [MaxLength(20)]
    public string MaHocSinh { get; set; } = "";

    [Required(ErrorMessage = "Nhập mật khẩu")]
    [MaxLength(100)]
    public string MatKhau { get; set; } = "";
}

/// <summary>Thông tin tối thiểu của học sinh đang đăng nhập — không kèm học phí hay hồ sơ phụ huynh.</summary>
public class HocSinhToiDto
{
    public Guid Id { get; set; }

    public required string HoTen { get; set; }

    public string? MaHocSinh { get; set; }

    public string? Lop { get; set; }

    public Guid GiaoVienId { get; set; }

    public required string TenGiaoVien { get; set; }
}

/// <summary>
/// Kết quả đăng nhập của học sinh. Cùng khuôn với kết quả đăng nhập của giáo viên: access token nằm
/// trong body (giao diện giữ trong RAM), refresh token nằm trong cookie httpOnly riêng của học sinh.
/// </summary>
public class KetQuaDangNhapHocSinh
{
    public required string AccessToken { get; set; }

    public DateTime HetHanUtc { get; set; }

    public required HocSinhToiDto HocSinh { get; set; }

    /// <summary>
    /// Refresh token để controller đặt vào cookie httpOnly. Cố tình KHÔNG đi ra JSON: nếu lọt vào
    /// body thì JavaScript đọc được, và cả ý nghĩa của cookie httpOnly bị vô hiệu.
    /// </summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public string? RefreshTokenNoiBo { get; set; }

    /// <summary>Hạn của refresh token, để controller đặt đúng hạn cho cookie.</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public DateTime RefreshHetHanUtcNoiBo { get; set; }
}

public class DoiMatKhauHocSinhRequest
{
    [Required(ErrorMessage = "Nhập mật khẩu đang dùng")]
    [MaxLength(100)]
    public string MatKhauHienTai { get; set; } = "";

    [Required(ErrorMessage = "Nhập mật khẩu mới")]
    [MaxLength(100)]
    public string MatKhauMoi { get; set; } = "";
}

/// <summary>
/// Một buổi học nhìn từ phía học sinh: giờ học, tình trạng đi học của chính em, và số bài tập kèm theo.
/// </summary>
public class BuoiHocCuaHocSinhDto
{
    public Guid Id { get; set; }

    public DateOnly Ngay { get; set; }

    public TimeOnly GioBatDau { get; set; }

    public TimeOnly GioKetThuc { get; set; }

    public bool LaBuoiDayBu { get; set; }

    public TrangThaiDiemDanh TrangThai { get; set; }

    public LyDoNghi? LyDoNghi { get; set; }

    public string? GhiChuDiemDanh { get; set; }

    public string? Lop { get; set; }

    public required string TenGiaoVien { get; set; }

    /// <summary>Số tài liệu giáo viên đã gửi cho buổi này.</summary>
    public int SoTaiLieu { get; set; }

    /// <summary>Buổi đã qua chưa (so với hôm nay) — để giao diện tách "sắp tới" và "đã học".</summary>
    public bool DaQua { get; set; }
}

/// <summary>Một bài tập giáo viên đã giao cho học sinh, kèm đủ thứ để em tải về làm.</summary>
public class BaiTapCuaHocSinhDto
{
    public Guid Id { get; set; }

    public required string TieuDe { get; set; }

    public required string TenTep { get; set; }

    public string? MimeType { get; set; }

    public long KichThuocByte { get; set; }

    public DateOnly? HanNop { get; set; }

    public string? GhiChu { get; set; }

    public required string TenGiaoVien { get; set; }

    public Guid? BuoiHocId { get; set; }

    /// <summary>Ngày và giờ của buổi gắn với bài tập này; bỏ trống với bài giao riêng.</summary>
    public DateOnly? NgayBuoi { get; set; }

    public TimeOnly? GioBuoi { get; set; }

    /// <summary>Đã quá hạn nộp chưa. Chỉ để hiển thị — nộp muộn vẫn tải được.</summary>
    public bool QuaHan { get; set; }

    public DateTime NgayTaoUtc { get; set; }
}

/// <summary>
/// Trạng thái tài khoản của MỘT học sinh, dành cho giáo viên: đã cấp mã + mật khẩu chưa, và lần cuối
/// em đăng nhập là khi nào.
/// </summary>
public class TaiKhoanHocSinhDto
{
    public Guid HocSinhId { get; set; }

    public required string HoTen { get; set; }

    /// <summary>Mã đăng nhập. Trả về cả khi chưa cấp mật khẩu, để giáo viên đọc trước cho học sinh.</summary>
    public string? MaHocSinh { get; set; }

    public bool CoMatKhau { get; set; }

    public DateTime? LanDangNhapCuoiUtc { get; set; }

    public int SoPhienDangMo { get; set; }
}

/// <summary>
/// Kết quả cấp/đặt lại tài khoản học sinh. <see cref="MatKhauTam"/> CHỈ có ở phản hồi này và không
/// bao giờ đọc lại được — giáo viên phải đọc ngay cho học sinh.
/// </summary>
public class CapTaiKhoanHocSinhDto
{
    public Guid HocSinhId { get; set; }

    public required string HoTen { get; set; }

    public required string MaHocSinh { get; set; }

    public required string MatKhauTam { get; set; }

    /// <summary>Nói rõ vì sao có mật khẩu tạm này, để giáo viên biết cần làm gì tiếp.</summary>
    public required string GhiChu { get; set; }
}

/// <summary>Dữ liệu để cấp hoặc đặt lại tài khoản cho một học sinh.</summary>
public class DatLaiMatKhauHocSinhRequest
{
    /// <summary>Bỏ trống thì hệ thống tự sinh một mật khẩu dễ đọc và trả về một lần.</summary>
    [MaxLength(100)]
    public string? MatKhauMoi { get; set; }

    /// <summary>Mã học sinh tuỳ chọn. Bỏ trống thì dùng mã hiện có, chưa có thì hệ thống tự sinh.</summary>
    [MaxLength(20)]
    public string? MaHocSinh { get; set; }
}
