namespace ClassManagement.Api.Common;

/// <summary>
/// Lỗi nghiệp vụ ném ra từ tầng xử lý, được <see cref="XuLyLoiApiMiddleware"/> đổi thành
/// ProblemDetails. Nhờ vậy controller chỉ cần nói rõ sai ở đâu, không phải tự dựng JSON lỗi.
/// </summary>
public class LoiApiException : Exception
{
    public LoiApiException(
        string tieuDe,
        int maTrangThai,
        string? chiTiet = null,
        IDictionary<string, string[]>? loiTheoField = null)
        : base(tieuDe)
    {
        TieuDe = tieuDe;
        MaTrangThai = maTrangThai;
        ChiTiet = chiTiet;
        LoiTheoField = loiTheoField;
    }

    public string TieuDe { get; }

    public int MaTrangThai { get; }

    public string? ChiTiet { get; }

    /// <summary>Lỗi theo từng field, khớp với error.fieldMessages ở frontend.</summary>
    public IDictionary<string, string[]>? LoiTheoField { get; }

    public static LoiApiException KhongTimThay(string doiTuong)
    {
        return new LoiApiException($"Không tìm thấy {doiTuong}", StatusCodes.Status404NotFound);
    }

    /// <summary>
    /// Dùng cho dữ liệu của người khác. Cố tình trả 404 chứ không 403: trả 403 là vô tình xác nhận
    /// "dữ liệu này có tồn tại", đủ để dò ra học sinh của giáo viên khác.
    /// </summary>
    public static LoiApiException NgoaiPhamVi(string doiTuong)
    {
        return new LoiApiException($"Không tìm thấy {doiTuong}", StatusCodes.Status404NotFound);
    }

    /// <summary>Dùng khi người dùng có quyền vào màn hình nhưng không được làm việc cụ thể này.</summary>
    public static LoiApiException KhongDuocPhep(string? chiTiet = null)
    {
        return new LoiApiException("Không đủ quyền", StatusCodes.Status403Forbidden, chiTiet);
    }

    public static LoiApiException DuLieuSai(string chiTiet, IDictionary<string, string[]>? loiTheoField = null)
    {
        return new LoiApiException("Dữ liệu không hợp lệ", StatusCodes.Status400BadRequest, chiTiet, loiTheoField);
    }
}
