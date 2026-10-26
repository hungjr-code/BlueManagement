using System.ComponentModel.DataAnnotations;

namespace ClassManagement.Api.Dtos;

/// <summary>Một tài liệu đã giao, nhìn từ phía GIÁO VIÊN.</summary>
public class TaiLieuDto
{
    public Guid Id { get; set; }

    public Guid HocSinhId { get; set; }

    public required string TenHocSinh { get; set; }

    public Guid? BuoiHocId { get; set; }

    /// <summary>Ngày của buổi được giao bài. Bỏ trống với tài liệu giao riêng.</summary>
    public DateOnly? NgayBuoi { get; set; }

    public TimeOnly? GioBuoi { get; set; }

    public required string TieuDe { get; set; }

    public required string TenTep { get; set; }

    public string? MimeType { get; set; }

    public long KichThuocByte { get; set; }

    public DateOnly? HanNop { get; set; }

    public string? GhiChu { get; set; }

    /// <summary>Link xem trên Drive — chỉ để giáo viên mở nhanh; học sinh tải qua app, không qua link này.</summary>
    public string? LinkDrive { get; set; }

    public DateTime NgayTaoUtc { get; set; }
}

/// <summary>
/// Dữ liệu để gửi một tài liệu lên. Gửi dạng multipart/form-data: tệp ở ô <c>tep</c>, các thông tin
/// còn lại là trường thường.
/// </summary>
public class TaoTaiLieuRequest
{
    [Required(ErrorMessage = "Chọn tệp để gửi")]
    public IFormFile? Tep { get; set; }

    [Required(ErrorMessage = "Chọn học sinh nhận bài")]
    public Guid HocSinhId { get; set; }

    /// <summary>Gắn bài tập vào một buổi học cụ thể. Bỏ trống là giao riêng, không thuộc buổi nào.</summary>
    public Guid? BuoiHocId { get; set; }

    [MaxLength(200)]
    public string? TieuDe { get; set; }

    /// <summary>Hạn nộp bài. Bỏ trống nghĩa là không đặt hạn.</summary>
    public DateOnly? HanNop { get; set; }

    [MaxLength(1000)]
    public string? GhiChu { get; set; }
}
