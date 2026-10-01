namespace ClassManagement.Api.Entities;

/// <summary>
/// Một buổi học cụ thể của một học sinh, sinh ra từ lịch học lặp hằng tuần.
///
/// Giờ lưu theo giờ tường (giờ Việt Nam), không phải UTC — xem ghi chú trong README backend:
/// Việt Nam không có giờ mùa hè nên giờ tường mới là sự thật của nghiệp vụ, còn UTC chỉ được
/// tính ra ở ranh giới tích hợp Google Calendar.
/// </summary>
public class BuoiHoc
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid HocSinhId { get; set; }

    public HocSinh? HocSinh { get; set; }

    /// <summary>
    /// Giáo viên dạy buổi này, chụp lại lúc sinh buổi. Có thể khác giáo viên hiện tại của học sinh
    /// nếu học sinh được chuyển sang giáo viên khác — nhờ vậy lịch sử dạy và học phí không bị viết lại.
    /// </summary>
    public Guid GiaoVienId { get; set; }

    public GiaoVien? GiaoVien { get; set; }

    public DateOnly Ngay { get; set; }

    public TimeOnly GioBatDau { get; set; }

    public TimeOnly GioKetThuc { get; set; }

    /// <summary>Buổi thêm ngoài lịch lặp, không sinh thêm buổi hằng tuần.</summary>
    public bool LaBuoiDayBu { get; set; }

    public DateTime NgayTaoUtc { get; set; }

    /// <summary>
    /// Id sự kiện tương ứng trên Google Calendar, rỗng nghĩa là buổi này chưa được đẩy lên lịch.
    /// Có nó thì mới cập nhật/xoá đúng sự kiện thay vì tạo trùng.
    /// </summary>
    public string? GoogleEventId { get; set; }

    /// <summary>Lần cuối buổi này được ghi lên Google — dùng để biết khi nào cần cập nhật lại.</summary>
    public DateTime? GoogleDongBoUtc { get; set; }

    public DiemDanh? DiemDanh { get; set; }
}

/// <summary>
/// Ghi nhận của một buổi: đi học hay nghỉ, kèm ghi chú. Tách khỏi <see cref="BuoiHoc"/> vì
/// buổi học là lịch, còn điểm danh là việc giáo viên làm và có thể bị sửa (có ghi nhật ký).
/// </summary>
public class DiemDanh
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BuoiHocId { get; set; }

    public BuoiHoc? BuoiHoc { get; set; }

    /// <summary>
    /// Mặc định là chưa điểm danh. Bỏ trống KHÔNG đồng nghĩa với nghỉ — nếu coi bỏ trống là nghỉ
    /// thì học phí sẽ tính sai.
    /// </summary>
    public TrangThaiDiemDanh TrangThai { get; set; } = TrangThaiDiemDanh.ChuaDiemDanh;

    /// <summary>Chỉ dùng khi trạng thái là nghỉ.</summary>
    public LyDoNghi? LyDoNghi { get; set; }

    public string? GhiChu { get; set; }

    /// <summary>
    /// Mặc định đi học thì tính tiền, nghỉ thì không. Cờ này cho sửa tay khi dạy bù hoặc trừ buổi,
    /// và là cầu nối duy nhất giữa Điểm danh và Học phí.
    /// </summary>
    public bool CoTinhTien { get; set; }

    /// <summary>Ghi khi buổi học lệch giờ kế hoạch, phục vụ tính tiền theo giờ sau này.</summary>
    public int? ThoiLuongThucTePhut { get; set; }

    public Guid? NguoiDiemDanhId { get; set; }

    public GiaoVien? NguoiDiemDanh { get; set; }

    public DateTime? ThoiDiemDiemDanhUtc { get; set; }

    public DateTime NgayCapNhatUtc { get; set; }
}
