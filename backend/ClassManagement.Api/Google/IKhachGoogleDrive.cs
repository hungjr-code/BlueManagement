namespace ClassManagement.Api.Google;

/// <summary>Một tệp trên Drive của giáo viên, sau khi app tải lên.</summary>
public record TepDrive(string Id, string Ten, string? MimeType, long KichThuocByte, string? LinkXem);

/// <summary>
/// Khách gọi Google Drive để gửi tài liệu cho học sinh.
///
/// Dùng đúng quyền <c>drive.file</c>: app chỉ nhìn thấy những tệp do CHÍNH NÓ tạo. Không đọc được
/// phần còn lại của Drive, không đụng tới tệp của người dùng — và vì thế cũng không cần mở tệp
/// công khai: học sinh tải qua app, app đọc hộ tệp bằng token của giáo viên.
///
/// Có hai bản cài: bản thật gọi REST API của Google, bản giả chỉ chạy ở máy dev để thử toàn bộ luồng
/// gửi/tải tài liệu mà không cần tài khoản Google.
/// </summary>
public interface IKhachGoogleDrive
{
    /// <summary>Tải một tệp lên Drive của giáo viên (upload dạng resumable để chịu được tệp lớn).</summary>
    Task<TepDrive> TaiLenAsync(
        string accessToken,
        string tenTep,
        string mimeType,
        Stream noiDung,
        CancellationToken huyBo = default);

    /// <summary>Chép nội dung tệp từ Drive xuống luồng đích — app làm trung gian cho học sinh tải.</summary>
    Task SaoChepXuongAsync(string accessToken, string tepId, Stream dich, CancellationToken huyBo = default);

    /// <summary>Xoá tệp trên Drive (khi giáo viên thu hồi tài liệu đã giao).</summary>
    Task XoaAsync(string accessToken, string tepId, CancellationToken huyBo = default);
}
