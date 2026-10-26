namespace ClassManagement.Api.Entities;

/// <summary>
/// Một tài liệu (đề bài, phiếu bài tập) giáo viên giao cho học sinh.
///
/// Tệp thật nằm trên Google Drive CỦA CHÍNH GIÁO VIÊN, dưới quyền <c>drive.file</c> — app chỉ nhìn
/// thấy những tệp do chính nó tạo. App giữ bản ghi này để biết ai được giao bài gì, gắn với buổi học
/// nào, hạn nộp khi nào; học sinh tải qua app nên tệp không cần mở công khai.
/// </summary>
public class TaiLieu
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Giáo viên giao tài liệu — cũng là chủ tài khoản Drive chứa tệp.</summary>
    public Guid GiaoVienId { get; set; }

    public GiaoVien? GiaoVien { get; set; }

    public Guid HocSinhId { get; set; }

    public HocSinh? HocSinh { get; set; }

    /// <summary>
    /// Buổi học mà tài liệu này gắn vào (bài tập của buổi đó). Bỏ trống nghĩa là tài liệu giao riêng,
    /// không thuộc buổi nào — có hạn nộp riêng.
    /// </summary>
    public Guid? BuoiHocId { get; set; }

    public BuoiHoc? BuoiHoc { get; set; }

    public required string TieuDe { get; set; }

    /// <summary>Tên tệp gốc người dùng tải lên, để học sinh biết mình đang tải cái gì.</summary>
    public required string TenTep { get; set; }

    public string? MimeType { get; set; }

    public long KichThuocByte { get; set; }

    /// <summary>Id tệp trên Drive của giáo viên. Không bao giờ trả xuống frontend.</summary>
    public required string GoogleDriveFileId { get; set; }

    /// <summary>Link xem trên Drive — chỉ để giáo viên mở nhanh, KHÔNG dùng cho học sinh tải.</summary>
    public string? GoogleDriveLink { get; set; }

    public DateOnly? HanNop { get; set; }

    public string? GhiChu { get; set; }

    /// <summary>Thu hồi thì đánh dấu đã xoá chứ không xoá dòng: nhật ký và lịch sử giao bài còn nguyên.</summary>
    public bool DaXoa { get; set; }

    public DateTime NgayTaoUtc { get; set; }

    public DateTime NgayCapNhatUtc { get; set; }
}

/// <summary>
/// Refresh token đã băm của HỌC SINH. Cố tình là bảng riêng, không dùng chung với
/// <see cref="PhienDangNhap"/> của giáo viên: hai loại tài khoản khác hẳn nhau (một bên là
/// IdentityUser với email, một bên đăng nhập bằng mã học sinh), trộn vào một bảng thì mọi câu truy
/// vấn phiên đều phải tự hỏi "dòng này của ai".
/// </summary>
public class PhienHocSinh
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid HocSinhId { get; set; }

    public HocSinh? HocSinh { get; set; }

    /// <summary>SHA-256 của token. Token thật chỉ nằm trong cookie httpOnly của trình duyệt.</summary>
    public required string TokenBam { get; set; }

    public DateTime NgayTaoUtc { get; set; }

    public DateTime HetHanUtc { get; set; }

    public DateTime? NgayThuHoiUtc { get; set; }

    public Guid? ThayTheBoiId { get; set; }

    public string? DiaChiIp { get; set; }

    public string? ThietBi { get; set; }

    public bool ConHieuLuc(DateTime bayGioUtc)
    {
        return NgayThuHoiUtc is null && HetHanUtc > bayGioUtc;
    }
}
