using ClassManagement.Api.Entities;

namespace ClassManagement.Api.Dtos;

/// <summary>
/// Cấu hình trả xuống frontend. KHÔNG bao giờ chứa refresh token Google hay Client Secret: thứ gì
/// backend không cần frontend biết thì không đi qua đường này.
///
/// Kết nối Google Calendar cũng KHÔNG nằm ở đây: nó là chuyện của từng giáo viên, xem
/// /api/google-calendar/trang-thai.
/// </summary>
public class CaiDatDto
{
    public string? MauNoiDungChuyenKhoan { get; set; }

    public VaiTro VaiTroMacDinh { get; set; }

    public int NguongCanhBaoSoHocSinh { get; set; }

    /// <summary>Buổi nghỉ không phép có bị tính tiền hay không.</summary>
    public bool TinhTienNghiKhongPhep { get; set; }

    public string MuiGio { get; set; } = "Asia/Ho_Chi_Minh";

    public int NhacTruocBaoLauPhut { get; set; }

    public TimeOnly GioGuiThongBaoHomNay { get; set; }

    public bool BatThongBaoHomNay { get; set; }

    public string KyTuTienTe { get; set; } = "VND";

    public string DinhDangNgay { get; set; } = "dd/MM/yyyy";

    /// <summary>Số giáo viên đang làm đã khai tài khoản nhận tiền. Chỉ admin thấy.</summary>
    public int? SoGiaoVienDaKhaiTaiKhoanNhanTien { get; set; }

    /// <summary>Số giáo viên đang làm chưa khai tài khoản nhận tiền. Chỉ admin thấy.</summary>
    public int? SoGiaoVienChuaKhaiTaiKhoanNhanTien { get; set; }

    /// <summary>
    /// Tên những giáo viên chưa khai, để admin biết nhắc ai. Cố tình chỉ có tên — không kèm
    /// số tài khoản của bất kỳ ai, vì đó là việc riêng của từng giáo viên.
    /// </summary>
    public IReadOnlyList<string>? TenGiaoVienChuaKhaiTaiKhoanNhanTien { get; set; }

    public DateTime NgayCapNhatUtc { get; set; }
}

public class SuaCaiDatRequest
{
    public string? MauNoiDungChuyenKhoan { get; set; }

    public int? NguongCanhBaoSoHocSinh { get; set; }

    public bool? TinhTienNghiKhongPhep { get; set; }

    public string? MuiGio { get; set; }

    public int? NhacTruocBaoLauPhut { get; set; }

    public TimeOnly? GioGuiThongBaoHomNay { get; set; }

    public bool? BatThongBaoHomNay { get; set; }

    public string? KyTuTienTe { get; set; }

    public string? DinhDangNgay { get; set; }
}
