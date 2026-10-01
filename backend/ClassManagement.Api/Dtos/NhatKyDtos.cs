namespace ClassManagement.Api.Dtos;

/// <summary>
/// Một dòng nhật ký thay đổi: ai làm gì, lúc nào, và ảnh chụp trước/sau.
///
/// <c>DuLieuTruoc</c> và <c>DuLieuSau</c> giữ nguyên chuỗi JSON mà backend đã ghi (không bóc thành
/// object) vì mỗi hành động có một bộ trường khác nhau — bóc ra thành kiểu chung là bịa ra một
/// khuôn không tồn tại. Giao diện in ra và tự định dạng lại.
/// </summary>
public class NhatKyDto
{
    public Guid Id { get; set; }

    /// <summary>Thời điểm thao tác, theo UTC. Giao diện đổi sang giờ trung tâm khi hiển thị.</summary>
    public DateTime ThoiDiemUtc { get; set; }

    /// <summary>Ví dụ "sua_diem_danh", "cho_hoc_sinh_nghi", "mo_khoa_so".</summary>
    public string HanhDong { get; set; } = string.Empty;

    /// <summary>Tên bảng bị tác động: "DiemDanh", "HocSinh", "HocPhi"…</summary>
    public string DoiTuong { get; set; } = string.Empty;

    public string? DoiTuongId { get; set; }

    /// <summary>Tên người thực hiện; để trống khi hệ thống tự làm (seed, đồng bộ tự động).</summary>
    public string? NguoiThucHien { get; set; }

    public string? DuLieuTruoc { get; set; }

    public string? DuLieuSau { get; set; }

    public string? DiaChiIp { get; set; }
}

/// <summary>Danh mục hành động và đối tượng ĐÃ TỪNG xảy ra, để giao diện dựng bộ lọc từ dữ liệu thật.</summary>
public class DanhMucNhatKyDto
{
    public required IReadOnlyList<string> HanhDong { get; set; }

    public required IReadOnlyList<string> DoiTuong { get; set; }
}
