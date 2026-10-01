namespace ClassManagement.Api.Entities;

/// <summary>
/// Cấu hình dùng chung cho cả trung tâm: mẫu nội dung chuyển khoản, múi giờ, nhắc lịch dạy.
/// Chỉ có đúng một dòng trong bảng, <see cref="Id"/> luôn bằng 1.
///
/// KHÔNG nằm ở đây: tài khoản nhận tiền và kết nối Google Calendar. Cả hai đều là chuyện riêng
/// của từng giáo viên (tiền chảy về tài khoản người dạy, lịch dạy nằm trên lịch Google của người
/// dạy) nên chúng nằm trong <see cref="GiaoVien"/>.
/// </summary>
public class CaiDat
{
    public const int IdDuyNhat = 1;

    public int Id { get; set; } = IdDuyNhat;

    /// <summary>
    /// Mẫu nội dung chuyển khoản, ví dụ "{tenHocSinh} - Hoc phi {thang}".
    /// Để trống thì frontend dùng mẫu mặc định.
    /// </summary>
    public string? MauNoiDungChuyenKhoan { get; set; }

    /// <summary>Vai trò khi admin tạo người dùng mới. Luôn là giáo viên, không bao giờ mặc định thành admin.</summary>
    public VaiTro VaiTroMacDinh { get; set; } = VaiTro.GiaoVien;

    /// <summary>Cảnh báo khi một giáo viên phụ trách vượt ngưỡng này.</summary>
    public int NguongCanhBaoSoHocSinh { get; set; } = 15;

    /// <summary>
    /// Buổi nghỉ KHÔNG phép có tính tiền hay không (mặc định có): học sinh nghỉ không báo vẫn giữ chỗ.
    /// Buổi nghỉ CÓ phép thì không bao giờ tính tiền, vì đã báo trước.
    /// </summary>
    public bool TinhTienNghiKhongPhep { get; set; } = true;

    public string MuiGio { get; set; } = "Asia/Ho_Chi_Minh";

    public int NhacTruocBaoLauPhut { get; set; } = 30;

    public TimeOnly GioGuiThongBaoHomNay { get; set; } = new(6, 0);

    public bool BatThongBaoHomNay { get; set; } = true;

    public string KyTuTienTe { get; set; } = "VND";

    public string DinhDangNgay { get; set; } = "dd/MM/yyyy";

    public DateTime NgayCapNhatUtc { get; set; }
}

/// <summary>Refresh token đã băm. Token thật chỉ nằm trong cookie httpOnly của trình duyệt.</summary>
public class PhienDangNhap
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid GiaoVienId { get; set; }

    public GiaoVien? GiaoVien { get; set; }

    /// <summary>SHA-256 của token. Mất database cũng không dùng lại được token của người khác.</summary>
    public required string TokenBam { get; set; }

    public DateTime NgayTaoUtc { get; set; }

    public DateTime HetHanUtc { get; set; }

    public DateTime? NgayThuHoiUtc { get; set; }

    /// <summary>Phiên mới thay thế phiên này khi làm mới token (xoay vòng token).</summary>
    public Guid? ThayTheBoiId { get; set; }

    public string? DiaChiIp { get; set; }

    public string? ThietBi { get; set; }

    public bool ConHieuLuc(DateTime bayGioUtc)
    {
        return NgayThuHoiUtc is null && HetHanUtc > bayGioUtc;
    }
}

/// <summary>
/// Yêu cầu đặt lại mật khẩu qua email. Chỉ lưu BẢN BĂM của token, không lưu token thật: đọc được bảng
/// này cũng không chiếm được tài khoản nào. Mỗi token dùng được đúng một lần và có hạn.
/// </summary>
public class YeuCauDatLaiMatKhau
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid GiaoVienId { get; set; }

    public GiaoVien? GiaoVien { get; set; }

    /// <summary>SHA-256 của token gửi trong email.</summary>
    public required string TokenBam { get; set; }

    public DateTime NgayTaoUtc { get; set; }

    public DateTime HetHanUtc { get; set; }

    /// <summary>Đã dùng rồi thì không dùng lại được nữa, dù còn hạn.</summary>
    public DateTime? NgayDungUtc { get; set; }

    public string? DiaChiIp { get; set; }
}

/// <summary>
/// Nhật ký thao tác cho những việc đổi phạm vi nhìn thấy dữ liệu hoặc đổi tiền:
/// đổi vai trò, sửa điểm danh đã lưu, mở khoá sổ tháng.
/// </summary>
public class NhatKy
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? NguoiThucHienId { get; set; }

    public GiaoVien? NguoiThucHien { get; set; }

    /// <summary>Ví dụ "doi_vai_tro", "sua_diem_danh", "mo_khoa_so".</summary>
    public required string HanhDong { get; set; }

    /// <summary>Tên bảng bị tác động: "GiaoVien", "DiemDanh", "HocPhi"…</summary>
    public required string DoiTuong { get; set; }

    public string? DoiTuongId { get; set; }

    /// <summary>Ảnh chụp trước và sau khi sửa, dạng JSON, để tra lại được đã đổi cái gì.</summary>
    public string? DuLieuTruoc { get; set; }

    public string? DuLieuSau { get; set; }

    public string? DiaChiIp { get; set; }

    public DateTime ThoiDiemUtc { get; set; }
}
