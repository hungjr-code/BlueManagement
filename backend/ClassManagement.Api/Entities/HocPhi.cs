namespace ClassManagement.Api.Entities;

/// <summary>
/// Học phí của một học sinh trong một tháng. Số buổi và thành tiền đều đếm/ tính tự động từ
/// Điểm danh — không bao giờ cho nhập tay, nhập tay là mất tính đúng đắn.
/// </summary>
public class HocPhi
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid HocSinhId { get; set; }

    public HocSinh? HocSinh { get; set; }

    /// <summary>Giáo viên phụ trách của kỳ này, giữ lại để đối chiếu doanh thu theo giáo viên.</summary>
    public Guid GiaoVienId { get; set; }

    public GiaoVien? GiaoVien { get; set; }

    public int Thang { get; set; }

    public int Nam { get; set; }

    public DateOnly HanDongTien { get; set; }

    public int SoBuoiDiHoc { get; set; }

    public int SoBuoiNghiCoPhep { get; set; }

    public int SoBuoiNghiKhongPhep { get; set; }

    /// <summary>Đơn giá áp dụng: đơn giá theo buổi hoặc học phí theo tháng của học sinh.</summary>
    public decimal DonGiaApDung { get; set; }

    public decimal ThanhTien { get; set; }

    public decimal SoTienDaThu { get; set; }

    public TrangThaiThanhToan TrangThaiThanhToan { get; set; } = TrangThaiThanhToan.ChuaThu;

    public bool DaChotSo { get; set; }

    public DateTime? NgayChotUtc { get; set; }

    public DateTime NgayTaoUtc { get; set; }

    public ICollection<PhieuThu> DanhSachPhieuThu { get; set; } = [];

    /// <summary>Còn phải thu. Tính ra, không lưu trong database để không bao giờ lệch sổ.</summary>
    public decimal ConLai => ThanhTien - SoTienDaThu;
}

/// <summary>Một lần thu tiền. Thu nhiều lần được, mỗi lần một phiếu thu.</summary>
public class PhieuThu
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid HocPhiId { get; set; }

    public HocPhi? HocPhi { get; set; }

    public decimal SoTien { get; set; }

    public DateOnly NgayThu { get; set; }

    public HinhThucThanhToan HinhThuc { get; set; }

    /// <summary>
    /// Mã giao dịch ngân hàng, ghi khi đối chiếu được tiền chuyển khoản từ mã QR.
    /// Có mã này mới chắc là tiền đã về.
    /// </summary>
    public string? MaGiaoDichNganHang { get; set; }

    public Guid? NguoiThuId { get; set; }

    public GiaoVien? NguoiThu { get; set; }

    public string? GhiChu { get; set; }

    public DateTime NgayTaoUtc { get; set; }
}
