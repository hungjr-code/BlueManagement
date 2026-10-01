namespace ClassManagement.Api.Entities;

/// <summary>
/// Học sinh do một giáo viên phụ trách. Ngừng dạy thì đổi <see cref="TrangThai"/>, KHÔNG xoá —
/// xoá là mất luôn lịch sử điểm danh và học phí đã ghi.
/// </summary>
public class HocSinh
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public required string HoTen { get; set; }

    /// <summary>Giáo viên phụ trách. Đây là căn cứ để chặn quyền: giáo viên chỉ thấy học sinh của mình.</summary>
    public Guid GiaoVienId { get; set; }

    public GiaoVien? GiaoVien { get; set; }

    public CachTinhHocPhi CachTinhHocPhi { get; set; }

    /// <summary>Bắt buộc khi <see cref="CachTinhHocPhi"/> là theo buổi. Đơn vị: đồng.</summary>
    public decimal? DonGiaTheoBuoi { get; set; }

    /// <summary>Bắt buộc khi <see cref="CachTinhHocPhi"/> là theo tháng. Đơn vị: đồng.</summary>
    public decimal? HocPhiTheoThang { get; set; }

    /// <summary>Tuần học mấy buổi. Phải khớp với số khung giờ khai trong <see cref="LichHoc"/>.</summary>
    public int SoBuoiMoiTuan { get; set; }

    /// <summary>
    /// Ngày trong tháng phải đóng tiền, ví dụ 5 là mùng 5 hằng tháng (1–31).
    /// Trang Học phí dựa vào đây để biết ai sắp đến hạn.
    /// </summary>
    public int NgayDenHanDongTien { get; set; }

    /// <summary>Buổi đầu tiên; hệ thống chỉ sinh buổi học từ ngày này trở đi.</summary>
    public DateOnly NgayBatDau { get; set; }

    /// <summary>Tên phụ huynh liên hệ khi cần báo nghỉ.</summary>
    public string? PhuHuynh { get; set; }

    public string? SoDienThoaiPhuHuynh { get; set; }

    /// <summary>
    /// Lớp hoặc nhóm học của học sinh, ví dụ "Lớp 9", "Toán 9A", "IELTS 5.0". Nhập tự do, chỉ để NHÌN:
    /// ô lịch hiện tên — giờ — lớp cho giáo viên biết ai học lớp nào. KHÔNG dùng để phân quyền, không
    /// dùng để tính tiền (tiền chỉ tính từ điểm danh).
    /// </summary>
    public string? Lop { get; set; }

    public string? GhiChu { get; set; }

    public TrangThaiHocSinh TrangThai { get; set; } = TrangThaiHocSinh.DangHoc;

    public DateTime NgayTaoUtc { get; set; }

    public DateTime NgayCapNhatUtc { get; set; }

    /// <summary>Các khung giờ học lặp hằng tuần, ví dụ thứ hai 18:00–19:30.</summary>
    public ICollection<KhungGioHoc> LichHoc { get; set; } = [];

    public ICollection<BuoiHoc> DanhSachBuoiHoc { get; set; } = [];

    public ICollection<HocPhi> DanhSachHocPhi { get; set; } = [];
}

/// <summary>
/// Một khung giờ học lặp hằng tuần của học sinh. Từ đây sinh ra các buổi học cụ thể và đẩy lên
/// Google Calendar (Phase 2 và Phase 3).
/// </summary>
public class KhungGioHoc
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid HocSinhId { get; set; }

    public HocSinh? HocSinh { get; set; }

    public ThuTrongTuan Thu { get; set; }

    public TimeOnly GioBatDau { get; set; }

    public TimeOnly GioKetThuc { get; set; }
}
