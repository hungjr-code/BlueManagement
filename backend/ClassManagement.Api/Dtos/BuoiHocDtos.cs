using System.ComponentModel.DataAnnotations;
using ClassManagement.Api.Entities;

namespace ClassManagement.Api.Dtos;

/// <summary>
/// Một buổi học kèm trạng thái điểm danh — đúng thứ trang Điểm danh cần để vẽ một dòng.
/// </summary>
public class BuoiHocDto
{
    public Guid Id { get; set; }

    public Guid HocSinhId { get; set; }

    public required string TenHocSinh { get; set; }

    /// <summary>Lớp/nhóm học của học sinh — ô lịch hiện thẳng, không phải gọi thêm API.</summary>
    public string? LopHocSinh { get; set; }

    public Guid GiaoVienId { get; set; }

    public required string TenGiaoVien { get; set; }

    public DateOnly Ngay { get; set; }

    public TimeOnly GioBatDau { get; set; }

    public TimeOnly GioKetThuc { get; set; }

    /// <summary>Buổi thêm ngoài lịch lặp hằng tuần (dạy bù).</summary>
    public bool LaBuoiDayBu { get; set; }

    public TrangThaiDiemDanh TrangThai { get; set; }

    public LyDoNghi? LyDoNghi { get; set; }

    public string? GhiChu { get; set; }

    public bool CoTinhTien { get; set; }

    public int? ThoiLuongThucTePhut { get; set; }

    /// <summary>Ai điểm danh buổi này và lúc nào — hiện cho biết bản ghi đã được ai xác nhận.</summary>
    public string? NguoiDiemDanh { get; set; }

    public DateTime? ThoiDiemDiemDanhUtc { get; set; }

    /// <summary>Buổi này đã có sự kiện tương ứng trên Google Calendar chưa.</summary>
    public bool DaDongBoGoogle { get; set; }

    /// <summary>Lần cuối buổi này được ghi lên Google.</summary>
    public DateTime? GoogleDongBoUtc { get; set; }
}

/// <summary>Một dòng trong bảng tổng hợp cuối tuần.</summary>
public class TongHopDiemDanhDto
{
    public Guid Id { get; set; }

    public required string Ten { get; set; }

    public int SoBuoi { get; set; }

    public int SoDiHoc { get; set; }

    public int SoNghiCoPhep { get; set; }

    public int SoNghiKhongPhep { get; set; }

    public int SoChuaDiemDanh { get; set; }
}

public class DanhSachBuoiHocDto
{
    public DateOnly TuNgay { get; set; }

    public DateOnly DenNgay { get; set; }

    public required IReadOnlyList<BuoiHocDto> DuLieu { get; set; }

    /// <summary>Tổng hợp theo từng học sinh trong khoảng đang xem.</summary>
    public required IReadOnlyList<TongHopDiemDanhDto> TongHopTheoHocSinh { get; set; }

    /// <summary>Tổng hợp theo từng giáo viên — admin nhìn để biết ai còn buổi chưa điểm danh.</summary>
    public required IReadOnlyList<TongHopDiemDanhDto> TongHopTheoGiaoVien { get; set; }
}

/// <summary>Một dòng điểm danh trong lần lưu theo lô.</summary>
public class LuuDiemDanhItem
{
    [Required]
    public Guid BuoiHocId { get; set; }

    [Required(ErrorMessage = "Chọn trạng thái cho buổi học")]
    public TrangThaiDiemDanh TrangThai { get; set; }

    /// <summary>Chỉ dùng khi trạng thái là nghỉ.</summary>
    public LyDoNghi? LyDoNghi { get; set; }

    [MaxLength(1000)]
    public string? GhiChu { get; set; }

    /// <summary>
    /// Bỏ trống thì suy ra từ trạng thái: đi học thì tính tiền, nghỉ thì không. Chỉ đặt tay khi
    /// dạy bù hoặc trừ buổi.
    /// </summary>
    public bool? CoTinhTien { get; set; }

    public int? ThoiLuongThucTePhut { get; set; }
}

public class LuuDiemDanhRequest
{
    [MinLength(1, ErrorMessage = "Không có buổi nào để lưu")]
    public List<LuuDiemDanhItem> DuLieu { get; set; } = [];
}

public class KetQuaLuuDiemDanhDto
{
    public int SoBuoiDaLuu { get; set; }

    public int SoBuoiGhiNhatKy { get; set; }
}

/* --------------------------- Tổng quan --------------------------- */

public class HomNayDto
{
    public DateOnly Ngay { get; set; }

    public int SoBuoi { get; set; }

    public int SoDaDiemDanh { get; set; }

    public int SoChuaDiemDanh { get; set; }

    public required IReadOnlyList<BuoiHocDto> DuLieu { get; set; }
}

public class TuanNayDto
{
    public DateOnly TuNgay { get; set; }

    public DateOnly DenNgay { get; set; }

    public int SoBuoi { get; set; }

    public int SoDiHoc { get; set; }

    public int SoNghiCoPhep { get; set; }

    public int SoNghiKhongPhep { get; set; }

    public int SoChuaDiemDanh { get; set; }

    /// <summary>
    /// Học phí dự kiến của tháng: theo buổi thì số buổi mỗi tuần × 4 × đơn giá, theo tháng thì
    /// đúng mức học phí tháng. Đây là con số DỰ KIẾN để nhìn nhanh, không phải công nợ thật —
    /// công nợ tính từ điểm danh ở Phase 4.
    /// </summary>
    public decimal HocPhiDuKienThangNay { get; set; }

    public required IReadOnlyList<BuoiHocDto> DuLieu { get; set; }

    public required IReadOnlyList<TongHopDiemDanhDto> TongHopTheoHocSinh { get; set; }

    public required IReadOnlyList<TongHopDiemDanhDto> TongHopTheoGiaoVien { get; set; }
}
