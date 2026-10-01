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
