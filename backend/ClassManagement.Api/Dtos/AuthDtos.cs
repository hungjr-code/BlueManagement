using System.ComponentModel.DataAnnotations;
using ClassManagement.Api.Entities;

namespace ClassManagement.Api.Dtos;

public class DangNhapRequest
{
    [Required(ErrorMessage = "Nhập email đăng nhập")]
    [EmailAddress(ErrorMessage = "Email không hợp lệ")]
    [MaxLength(256)]
    public string Email { get; set; } = "";

    [Required(ErrorMessage = "Nhập mật khẩu")]
    [MaxLength(200)]
    public string MatKhau { get; set; } = "";
}

/// <summary>Tự tạo tài khoản bằng email và mật khẩu. Tài khoản mới LUÔN là giáo viên, không bao giờ là admin.</summary>
public class DangKyRequest
{
    [Required(ErrorMessage = "Nhập tên của bạn")]
    [MaxLength(200)]
    public string HoTen { get; set; } = "";

    [Required(ErrorMessage = "Nhập email")]
    [EmailAddress(ErrorMessage = "Email không hợp lệ")]
    [MaxLength(256)]
    public string Email { get; set; } = "";

    [Required(ErrorMessage = "Nhập mật khẩu")]
    [MinLength(8, ErrorMessage = "Mật khẩu phải từ 8 ký tự")]
    [MaxLength(200)]
    public string MatKhau { get; set; } = "";
}

/// <summary>Xin gửi thư đặt lại mật khẩu.</summary>
public class QuenMatKhauRequest
{
    [Required(ErrorMessage = "Nhập email")]
    [EmailAddress(ErrorMessage = "Email không hợp lệ")]
    [MaxLength(256)]
    public string Email { get; set; } = "";
}

/// <summary>Đặt mật khẩu mới bằng token nhận được trong email (tự phục vụ, khác với admin đặt hộ).</summary>
public class DatLaiMatKhauQuaEmailRequest
{
    [Required(ErrorMessage = "Thiếu mã đặt lại mật khẩu")]
    [MaxLength(200)]
    public string Token { get; set; } = "";

    [Required(ErrorMessage = "Nhập mật khẩu mới")]
    [MinLength(8, ErrorMessage = "Mật khẩu phải từ 8 ký tự")]
    [MaxLength(200)]
    public string MatKhauMoi { get; set; } = "";
}

/// <summary>
/// Cho giao diện biết máy chủ đang có những đường đăng nhập nào THẬT. Không có gì bí mật ở đây:
/// chỉ là đã cấu hình Google/SMTP chưa, và có đang chạy chế độ giả của máy dev hay không — giao diện
/// dựa vào đó để không hiện nút dẫn tới ngõ cụt, và để nói rõ khi đang ở chế độ giả.
/// </summary>
public class TuyChonDangNhapDto
{
    /// <summary>Máy chủ đã có Client ID/Secret của Google chưa (chưa tính chế độ giả).</summary>
    public bool GoogleDaCauHinh { get; set; }

    /// <summary>Đang chạy khách Google GIẢ: bấm nút Google sẽ KHÔNG mở trang của Google.</summary>
    public bool GoogleCheDoGia { get; set; }

    /// <summary>Máy chủ đã cấu hình gửi email chưa (chưa tính chế độ giả).</summary>
    public bool EmailDaCauHinh { get; set; }

    /// <summary>Đang chạy hộp thư GIẢ: thư không đi đâu cả, chỉ nằm trong bộ nhớ của máy chủ.</summary>
    public bool EmailCheDoGia { get; set; }
}

/// <summary>Thông tin người đang đăng nhập, đủ để frontend dựng menu và chặn màn hình.</summary>
public class NguoiDungDto
{
    public Guid Id { get; set; }

    public required string HoTen { get; set; }

    public required string Email { get; set; }

    public VaiTro VaiTro { get; set; }

    public TrangThaiGiaoVien TrangThai { get; set; }

    /// <summary>
    /// Tài khoản nhận tiền của CHÍNH người đang đăng nhập. Chỉ trả cho chính chủ: số tài khoản
    /// của giáo viên là việc riêng của người đó, admin cũng không đọc được.
    /// </summary>
    public TaiKhoanNhanTienDto TaiKhoanNhanTien { get; set; } = new();
}

/// <summary>Tài khoản ngân hàng nhận học phí của một giáo viên.</summary>
public class TaiKhoanNhanTienDto
{
    public string? NganHangBin { get; set; }

    public string? SoTaiKhoan { get; set; }

    public string? ChuTaiKhoan { get; set; }

    /// <summary>Đã khai đủ ngân hàng và số tài khoản để sinh mã QR chưa.</summary>
    public bool DaCauHinh { get; set; }

    /// <summary>Đóng gói tài khoản nhận tiền của một giáo viên để trả về cho chính người đó.</summary>
    public static TaiKhoanNhanTienDto Tu(GiaoVien giaoVien)
    {
        return new TaiKhoanNhanTienDto
        {
            NganHangBin = giaoVien.NganHangBin,
            SoTaiKhoan = giaoVien.SoTaiKhoan,
            ChuTaiKhoan = giaoVien.ChuTaiKhoan,
            DaCauHinh = !string.IsNullOrWhiteSpace(giaoVien.NganHangBin)
                && !string.IsNullOrWhiteSpace(giaoVien.SoTaiKhoan),
        };
    }
}

public class TaiKhoanNhanTienRequest
{
    /// <summary>Mã BIN ngân hàng (NAPAS 247), đúng 6 chữ số. Gửi rỗng cả ba ô là xoá tài khoản đã khai.</summary>
    [MaxLength(20)]
    public string? NganHangBin { get; set; }

    [MaxLength(40)]
    public string? SoTaiKhoan { get; set; }

    [MaxLength(120)]
    public string? ChuTaiKhoan { get; set; }
}

public class DangNhapResponse
{
    /// <summary>
    /// Access token. Frontend chỉ giữ trong RAM, không lưu localStorage — XSS đọc được localStorage.
    /// Refresh token nằm trong cookie httpOnly do endpoint này đặt, không xuất hiện ở đây.
    /// </summary>
    public required string AccessToken { get; set; }

    public DateTime HetHanUtc { get; set; }

    public required NguoiDungDto NguoiDung { get; set; }
}

public class DoiMatKhauRequest
{
    [Required(ErrorMessage = "Nhập mật khẩu đang dùng")]
    public string MatKhauHienTai { get; set; } = "";

    [Required(ErrorMessage = "Nhập mật khẩu mới")]
    [MinLength(8, ErrorMessage = "Mật khẩu mới phải dài ít nhất 8 ký tự")]
    public string MatKhauMoi { get; set; } = "";
}
