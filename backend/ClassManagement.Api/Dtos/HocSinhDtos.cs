using System.ComponentModel.DataAnnotations;
using ClassManagement.Api.Entities;

namespace ClassManagement.Api.Dtos;

public class KhungGioHocDto
{
    public Guid Id { get; set; }

    public ThuTrongTuan Thu { get; set; }

    public TimeOnly GioBatDau { get; set; }

    public TimeOnly GioKetThuc { get; set; }
}

public class HocSinhDto
{
    public Guid Id { get; set; }

    public required string HoTen { get; set; }

    public Guid GiaoVienId { get; set; }

    /// <summary>Tên giáo viên, để bảng hiện tên chứ không bắt người dùng tra id.</summary>
    public required string TenGiaoVien { get; set; }

    public CachTinhHocPhi CachTinhHocPhi { get; set; }

    public decimal? DonGiaTheoBuoi { get; set; }

    public decimal? HocPhiTheoThang { get; set; }

    public int SoBuoiMoiTuan { get; set; }

    public int NgayDenHanDongTien { get; set; }

    public DateOnly NgayBatDau { get; set; }

    public string? PhuHuynh { get; set; }

    public string? SoDienThoaiPhuHuynh { get; set; }

    /// <summary>Lớp/nhóm học, để lịch dạy hiện đủ tên — giờ — lớp.</summary>
    public string? Lop { get; set; }

    public string? GhiChu { get; set; }

    public TrangThaiHocSinh TrangThai { get; set; }

    public IReadOnlyList<KhungGioHocDto> LichHoc { get; set; } = [];

    public DateTime NgayCapNhatUtc { get; set; }
}

/// <summary>Một khung giờ học lặp hằng tuần do người dùng khai.</summary>
public class KhungGioHocRequest
{
    public ThuTrongTuan Thu { get; set; }

    public TimeOnly GioBatDau { get; set; }

    public TimeOnly GioKetThuc { get; set; }
}

/// <summary>Dữ liệu để thêm học sinh.</summary>
public class TaoHocSinhRequest
{
    [Required(ErrorMessage = "Nhập tên học sinh")]
    [MinLength(2, ErrorMessage = "Tên học sinh phải dài ít nhất 2 ký tự")]
    [MaxLength(200)]
    public string HoTen { get; set; } = "";

    /// <summary>
    /// Giáo viên phụ trách. Bỏ trống thì mặc định là chính người tạo; giáo viên không được
    /// gán học sinh cho người khác, chỉ admin đổi được.
    /// </summary>
    public Guid? GiaoVienId { get; set; }

    [Required(ErrorMessage = "Chọn cách tính học phí")]
    public CachTinhHocPhi CachTinhHocPhi { get; set; }

    /// <summary>Bắt buộc khi tính theo buổi. Đơn vị: đồng.</summary>
    public decimal? DonGiaTheoBuoi { get; set; }

    /// <summary>Bắt buộc khi tính theo tháng. Đơn vị: đồng.</summary>
    public decimal? HocPhiTheoThang { get; set; }

    /// <summary>Tuần học mấy buổi — phải khớp đúng số khung giờ khai trong <see cref="LichHoc"/>.</summary>
    [Range(1, 7, ErrorMessage = "Số buổi mỗi tuần phải từ 1 đến 7")]
    public int SoBuoiMoiTuan { get; set; }

    [MinLength(1, ErrorMessage = "Khai ít nhất một khung giờ học trong tuần")]
    public List<KhungGioHocRequest> LichHoc { get; set; } = [];

    /// <summary>Ngày trong tháng phải đóng tiền, 1–31.</summary>
    [Range(1, 31, ErrorMessage = "Ngày đến hạn đóng tiền phải từ 1 đến 31")]
    public int NgayDenHanDongTien { get; set; }

    /// <summary>Buổi đầu tiên; hệ thống chỉ sinh buổi học từ ngày này trở đi.</summary>
    [Required(ErrorMessage = "Chọn ngày bắt đầu học")]
    public DateOnly NgayBatDau { get; set; }

    [MaxLength(200)]
    public string? PhuHuynh { get; set; }

    [MaxLength(30)]
    public string? SoDienThoaiPhuHuynh { get; set; }

    [MaxLength(100)]
    public string? Lop { get; set; }

    [MaxLength(1000)]
    public string? GhiChu { get; set; }

    public TrangThaiHocSinh TrangThai { get; set; } = TrangThaiHocSinh.DangHoc;

    /// <summary>
    /// Trùng tên là cảnh báo chứ không chặn cứng — học sinh thật có thể trùng tên. Lần gửi đầu
    /// gặp trùng tên sẽ nhận 409 để hỏi lại; gửi lại với cờ này = người dùng đã xác nhận.
    /// </summary>
    public bool BoQuaCanhBaoTrungTen { get; set; }
}

/// <summary>Dữ liệu để sửa học sinh. Không có cờ bỏ qua cảnh báo trùng tên vì đã tạo rồi.</summary>
public class SuaHocSinhRequest
{
    [Required(ErrorMessage = "Nhập tên học sinh")]
    [MinLength(2, ErrorMessage = "Tên học sinh phải dài ít nhất 2 ký tự")]
    [MaxLength(200)]
    public string HoTen { get; set; } = "";

    /// <summary>Chỉ admin đổi được giáo viên phụ trách; giáo viên gửi lên sẽ bị bỏ qua.</summary>
    public Guid? GiaoVienId { get; set; }

    [Required(ErrorMessage = "Chọn cách tính học phí")]
    public CachTinhHocPhi CachTinhHocPhi { get; set; }

    public decimal? DonGiaTheoBuoi { get; set; }

    public decimal? HocPhiTheoThang { get; set; }

    [Range(1, 7, ErrorMessage = "Số buổi mỗi tuần phải từ 1 đến 7")]
    public int SoBuoiMoiTuan { get; set; }

    [MinLength(1, ErrorMessage = "Khai ít nhất một khung giờ học trong tuần")]
    public List<KhungGioHocRequest> LichHoc { get; set; } = [];

    [Range(1, 31, ErrorMessage = "Ngày đến hạn đóng tiền phải từ 1 đến 31")]
    public int NgayDenHanDongTien { get; set; }

    [Required(ErrorMessage = "Chọn ngày bắt đầu học")]
    public DateOnly NgayBatDau { get; set; }

    [MaxLength(200)]
    public string? PhuHuynh { get; set; }

    [MaxLength(30)]
    public string? SoDienThoaiPhuHuynh { get; set; }

    [MaxLength(100)]
    public string? Lop { get; set; }

    [MaxLength(1000)]
    public string? GhiChu { get; set; }

    public TrangThaiHocSinh TrangThai { get; set; } = TrangThaiHocSinh.DangHoc;
}

/// <summary>Dữ liệu để thêm một buổi dạy bù ngoài lịch lặp hằng tuần.</summary>
public class BuoiDayBuRequest
{
    [Required(ErrorMessage = "Chọn học sinh")]
    public Guid HocSinhId { get; set; }

    [Required(ErrorMessage = "Chọn ngày dạy bù")]
    public DateOnly Ngay { get; set; }

    [Required(ErrorMessage = "Chọn giờ bắt đầu")]
    public TimeOnly GioBatDau { get; set; }

    [Required(ErrorMessage = "Chọn giờ kết thúc")]
    public TimeOnly GioKetThuc { get; set; }

    [MaxLength(1000)]
    public string? GhiChu { get; set; }
}

/// <summary>Kết quả phân trang dùng chung cho mọi danh sách.</summary>
public class KetQuaPhanTrang<T>
{
    public required IReadOnlyList<T> DuLieu { get; set; }

    public int TongSo { get; set; }

    public int Trang { get; set; }

    public int KichThuoc { get; set; }
}
