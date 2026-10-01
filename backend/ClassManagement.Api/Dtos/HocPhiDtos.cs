namespace ClassManagement.Api.Dtos;

using ClassManagement.Api.Entities;

/// <summary>Một dòng học phí của học sinh trong kỳ: số buổi đếm từ điểm danh, thành tiền tính từ đó.</summary>
public class HocPhiDto
{
    public required Guid Id { get; set; }

    public required Guid HocSinhId { get; set; }

    public required string TenHocSinh { get; set; }

    public required Guid GiaoVienId { get; set; }

    public required string TenGiaoVien { get; set; }

    public int Thang { get; set; }

    public int Nam { get; set; }

    public DateOnly HanDongTien { get; set; }

    public int SoBuoiDiHoc { get; set; }

    public int SoBuoiNghiCoPhep { get; set; }

    public int SoBuoiNghiKhongPhep { get; set; }

    /// <summary>Buổi chưa điểm danh trong kỳ. Khác 0 thì con số thành tiền còn có thể thay đổi.</summary>
    public int SoBuoiChuaDiemDanh { get; set; }

    public CachTinhHocPhi CachTinhHocPhi { get; set; }

    public decimal DonGiaApDung { get; set; }

    public decimal ThanhTien { get; set; }

    public decimal SoTienDaThu { get; set; }

    public decimal ConLai { get; set; }

    public TrangThaiThanhToan TrangThaiThanhToan { get; set; }

    public bool DaChotSo { get; set; }

    public DateTime? NgayChotUtc { get; set; }
}

public class PhieuThuDto
{
    public required Guid Id { get; set; }

    public decimal SoTien { get; set; }

    public DateOnly NgayThu { get; set; }

    public HinhThucThanhToan HinhThuc { get; set; }

    public string? MaGiaoDichNganHang { get; set; }

    public string? TenNguoiThu { get; set; }

    public string? GhiChu { get; set; }

    public DateTime NgayTaoUtc { get; set; }
}

public class BuoiTrongKyDto
{
    public required Guid Id { get; set; }

    public DateOnly Ngay { get; set; }

    public string Gio { get; set; } = string.Empty;

    public bool LaBuoiDayBu { get; set; }

    public TrangThaiDiemDanh TrangThai { get; set; }

    public LyDoNghi? LyDoNghi { get; set; }

    public string? GhiChu { get; set; }
}

/// <summary>Chi tiết một dòng học phí: kèm các buổi đã đếm và các phiếu thu, để đối chiếu bằng mắt.</summary>
public class HocPhiChiTietDto
{
    public required HocPhiDto HocPhi { get; set; }

    public required IReadOnlyList<BuoiTrongKyDto> DanhSachBuoi { get; set; }

    public required IReadOnlyList<PhieuThuDto> DanhSachPhieuThu { get; set; }
}

public class KyHocPhiRequest
{
    public int Thang { get; set; }

    public int Nam { get; set; }

    /// <summary>Chỉ admin dùng: tính cho một giáo viên. Bỏ trống là cả trung tâm.</summary>
    public Guid? GiaoVienId { get; set; }
}

public class KetQuaTinhKyDto
{
    public int Thang { get; set; }

    public int Nam { get; set; }

    public int SoTao { get; set; }

    public int SoCapNhat { get; set; }

    /// <summary>Dòng đã chốt sổ nên không tính lại — giữ nguyên con số đã chốt.</summary>
    public int SoBoQuaDaChot { get; set; }

    public decimal TongThanhTien { get; set; }

    public string? Loi { get; set; }
}

/// <summary>Ai sắp đến hạn đóng tiền, ai đã quá hạn mà chưa thu đủ.</summary>
public class SapDenHanDto
{
    public required IReadOnlyList<HocPhiDto> SapDenHan { get; set; }

    public required IReadOnlyList<HocPhiDto> QuaHan { get; set; }

    public decimal TongConLai { get; set; }
}

public class TongHopTheoGiaoVienDto
{
    public required Guid GiaoVienId { get; set; }

    public required string TenGiaoVien { get; set; }

    public int SoHocSinh { get; set; }

    public decimal PhaiThu { get; set; }

    public decimal DaThu { get; set; }

    public decimal ConLai { get; set; }
}

public class ThuTienRequest
{
    public decimal SoTien { get; set; }

    public DateOnly? NgayThu { get; set; }

    public HinhThucThanhToan HinhThuc { get; set; } = HinhThucThanhToan.TienMat;

    public string? GhiChu { get; set; }
}

public class HuyPhieuThuRequest
{
    /// <summary>Bắt buộc: huỷ một lần thu tiền là việc phải giải thích được về sau.</summary>
    public string? LyDo { get; set; }
}

public class CanhBaoChotSoDto
{
    public int Thang { get; set; }

    public int Nam { get; set; }

    public int SoDongHocPhi { get; set; }

    public decimal TongPhaiThu { get; set; }

    public decimal TongDaThu { get; set; }

    public decimal TongConLai { get; set; }

    /// <summary>Buổi đã qua ngày hôm nay mà chưa điểm danh — chốt sổ lúc này là chốt trên con số thiếu.</summary>
    public required IReadOnlyList<CanhBaoChuaDiemDanhDto> ChuaDiemDanh { get; set; }

    /// <summary>Số dòng học phí chưa được tính trong kỳ.</summary>
    public int SoHocSinhChuaTinhTien { get; set; }

    public bool CoCanhBao => ChuaDiemDanh.Count > 0 || SoHocSinhChuaTinhTien > 0;
}

public class CanhBaoChuaDiemDanhDto
{
    public required string TenHocSinh { get; set; }

    public int SoBuoiChuaDiemDanh { get; set; }
}

public class ChotSoRequest
{
    public int Thang { get; set; }

    public int Nam { get; set; }

    /// <summary>Đặt true để chốt dù vẫn còn buổi chưa điểm danh (sẽ ghi lại vào nhật ký).</summary>
    public bool BoQuaCanhBao { get; set; }
}

public class MoChotSoRequest
{
    public int Thang { get; set; }

    public int Nam { get; set; }

    /// <summary>Bắt buộc: mở lại sổ đã chốt thì phải nói vì sao.</summary>
    public string? LyDo { get; set; }
}

public class KetQuaChotSoDto
{
    public int Thang { get; set; }

    public int Nam { get; set; }

    public int SoDong { get; set; }

    public decimal TongPhaiThu { get; set; }

    public decimal TongDaThu { get; set; }
}

/* ------------------------- Đối chiếu giao dịch ngân hàng ------------------------- */

/// <summary>
/// Một dòng giao dịch ngân hàng do người dùng đọc từ file sao kê. Backend cố tình KHÔNG tự đọc file
/// của ngân hàng nào: mỗi ngân hàng một định dạng, mà giao diện đã có sẵn dữ liệu trên màn hình.
/// </summary>
public class GiaoDichNganHangDto
{
    public DateOnly Ngay { get; set; }

    public decimal SoTien { get; set; }

    public string? NoiDung { get; set; }

    public string? MaGiaoDich { get; set; }
}

public enum MucDoKhop
{
    [System.Text.Json.Serialization.JsonStringEnumMemberName("khop_chac")] KhopChac,

    [System.Text.Json.Serialization.JsonStringEnumMemberName("khop_mot_phan")] KhopMotPhan,

    [System.Text.Json.Serialization.JsonStringEnumMemberName("chi_khop_so_tien")] ChiKhopSoTien,

    [System.Text.Json.Serialization.JsonStringEnumMemberName("da_ghep_truoc_do")] DaGhepTruocDo,

    [System.Text.Json.Serialization.JsonStringEnumMemberName("khong_khop")] KhongKhop,
}

/// <summary>Đề xuất ghép một giao dịch ngân hàng vào một dòng học phí. Chỉ là đề xuất, chưa ghi gì.</summary>
public class DeXuatDoiChieuDto
{
    public required GiaoDichNganHangDto GiaoDich { get; set; }

    public required MucDoKhop MucDoKhop { get; set; }

    public required string LyDo { get; set; }

    public Guid? HocPhiId { get; set; }

    public string? TenHocSinh { get; set; }

    public decimal? ConLai { get; set; }
}

public class CapDoiChieuRequest
{
    public required Guid HocPhiId { get; set; }

    public decimal SoTien { get; set; }

    public DateOnly NgayThu { get; set; }

    public string? MaGiaoDichNganHang { get; set; }

    /// <summary>Giao dịch đã có mã này rồi thì phải xác nhận lại mới ghi thêm.</summary>
    public bool BoQuaTrungMaGiaoDich { get; set; }
}

public class XacNhanDoiChieuRequest
{
    public required IReadOnlyList<CapDoiChieuRequest> CacCap { get; set; }
}

public class KetQuaDoiChieuDto
{
    public int SoDaGhi { get; set; }

    public decimal TongDaGhi { get; set; }

    /// <summary>Những cặp không ghi được, kèm lý do — không im lặng bỏ qua.</summary>
    public required IReadOnlyList<string> BoQua { get; set; }
}
