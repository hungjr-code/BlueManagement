namespace ClassManagement.Api.Dtos;

/// <summary>Kết quả một lần đồng bộ lịch dạy lên Google Calendar.</summary>
public class KetQuaDongBoDto
{
    public int SoTao { get; set; }

    public int SoCapNhat { get; set; }

    public int SoXoa { get; set; }

    /// <summary>Buổi bị bỏ qua vì đang là nghỉ — không đẩy buổi đã nghỉ lên lịch.</summary>
    public int SoBoQua { get; set; }

    public DateTime ThoiDiemUtc { get; set; }

    /// <summary>Lỗi khi đồng bộ nhiều giáo viên: một người lỗi không làm hỏng cả lượt đồng bộ.</summary>
    public string? Loi { get; set; }
}

/// <summary>
/// Kết quả một lần KÉO thay đổi từ Google Calendar về app (chiều Google → app): giáo viên sửa giờ
/// hay huỷ buổi ngay trên Google thì lần kéo này đưa những thay đổi đó vào app.
/// </summary>
public class KetQuaDongBoVeDto
{
    /// <summary>true = không gọi Google lần này vì lần trước vừa đồng bộ xong.</summary>
    public bool BoQua { get; set; }

    public string? LyDoBoQua { get; set; }

    /// <summary>Số buổi đã đối chiếu với Google trong lần này.</summary>
    public int SoDaXet { get; set; }

    /// <summary>Số buổi được cập nhật lại giờ theo Google.</summary>
    public int SoDoiGio { get; set; }

    /// <summary>Số buổi được đánh dấu nghỉ vì sự kiện đã bị huỷ trên Google.</summary>
    public int SoDanhDauNghi { get; set; }

    /// <summary>Số trường hợp lệch mà hệ thống KHÔNG tự sửa — giao diện phải hiện lên cho giáo viên.</summary>
    public int SoCanhBao { get; set; }

    /// <summary>Số buổi không có gì thay đổi.</summary>
    public int SoBoQua { get; set; }

    public DateTime ThoiDiemUtc { get; set; }

    /// <summary>Mốc đồng bộ về lần trước, để giao diện nói được "vừa đồng bộ lúc nào".</summary>
    public DateTime? ThoiDiemDongBoCuoi { get; set; }

    public string? Loi { get; set; }
}

/// <summary>Trạng thái kết nối Google của CHÍNH người đang đăng nhập.</summary>
public class TrangThaiGoogleDto
{
    /// <summary>Backend đã có Client ID/Secret (hoặc đang chạy chế độ giả) chưa.</summary>
    public bool DaCauHinh { get; set; }

    /// <summary>true = dùng khách Google giả, chỉ có ở máy dev, KHÔNG gọi Google thật.</summary>
    public bool CheDoGia { get; set; }

    public bool DaKetNoi { get; set; }

    /// <summary>Email Google đang liên kết của chính người đang đăng nhập. Không phải bí mật.</summary>
    public string? TaiKhoan { get; set; }

    public string? CalendarId { get; set; }

    /// <summary>Quyền backend sẽ xin — hiện cho người dùng biết trước khi bấm kết nối.</summary>
    public required IReadOnlyList<string> Quyen { get; set; }

    public KetQuaDongBoDto? LanDongBoCuoi { get; set; }

    /// <summary>Lần cuối KÉO thay đổi từ Google về (chiều ngược lại với <see cref="LanDongBoCuoi"/>).</summary>
    public KetQuaDongBoVeDto? LanDongBoVeCuoi { get; set; }

    /// <summary>Bật thì mở màn Lịch dạy là tự kéo thay đổi từ Google về (cách nhau ít nhất 10 phút).</summary>
    public bool TuDongDongBo { get; set; }

    /// <summary>
    /// Token đang lưu đã có quyền ghi tài liệu lên Drive chưa. false nghĩa là phải kết nối lại Google
    /// mới gửi được tài liệu.
    /// </summary>
    public bool CoQuyenDrive { get; set; }
}

/// <summary>Số liệu tổng hợp cho admin. KHÔNG kèm email Google hay token của ai — admin chỉ quan sát.</summary>
public class TongHopGoogleDto
{
    public int SoGiaoVienDangLam { get; set; }

    public int SoDaKetNoi { get; set; }

    public int SoChuaKetNoi { get; set; }

    /// <summary>Tên những người chưa kết nối, để admin nhắc.</summary>
    public required IReadOnlyList<string> TenChuaKetNoi { get; set; }
}

public class DuongDanUyQuyenDto
{
    public required string Url { get; set; }

    public required IReadOnlyList<string> Quyen { get; set; }

    public bool CheDoGia { get; set; }
}

public class LichGoogleDto
{
    public required string Id { get; set; }

    public required string Ten { get; set; }

    public bool LaLichChinh { get; set; }
}

public class ChonLichRequest
{
    public string? CalendarId { get; set; }
}

public class NgatKetNoiRequest
{
    /// <summary>Người dùng chọn xoá luôn các sự kiện đã tạo trên Google hay giữ lại.</summary>
    public bool XoaSuKienDaTao { get; set; }
}

public class DongBoRequest
{
    /// <summary>Bỏ trống thì đồng bộ từ hôm nay tới hết tháng sau.</summary>
    public DateOnly? TuNgay { get; set; }

    public DateOnly? DenNgay { get; set; }

    /// <summary>
    /// Chỉ admin được đặt true: đồng bộ cho TẤT CẢ giáo viên đã kết nối, mỗi người lên lịch Google
    /// của chính họ. Bỏ trống/false thì chỉ đồng bộ lịch của người đang đăng nhập.
    /// </summary>
    public bool TatCaGiaoVien { get; set; }
}

/// <summary>Yêu cầu kéo thay đổi từ Google Calendar về app.</summary>
public class DongBoVeRequest
{
    public DateOnly? TuNgay { get; set; }

    public DateOnly? DenNgay { get; set; }

    /// <summary>
    /// true = chỉ chạy nếu lần đồng bộ trước đã quá 10 phút (dùng cho việc tự đồng bộ khi mở màn
    /// Lịch dạy, để F5 liên tục không gọi Google liên tục). false = chạy ngay (nút "Đồng bộ lại").
    /// </summary>
    public bool ChiKhiQuaHan { get; set; }
}

/// <summary>Bật/tắt tự kéo thay đổi từ Google về khi mở màn Lịch dạy (của chính người đang đăng nhập).</summary>
public class BatTuDongDongBoRequest
{
    public bool Bat { get; set; }
}

/// <summary>Dữ liệu để kiểm thử đóng vai giáo viên sửa/huỷ một sự kiện NGAY TRÊN GOOGLE (chỉ chế độ giả).</summary>
public class GiaSuaSuKienRequest
{
    public required string EventId { get; set; }

    public DateTimeOffset? BatDau { get; set; }

    public DateTimeOffset? KetThuc { get; set; }

    /// <summary>true = huỷ sự kiện trên Google (giống giáo viên bấm xoá trên lịch của mình).</summary>
    public bool Huy { get; set; }
}
