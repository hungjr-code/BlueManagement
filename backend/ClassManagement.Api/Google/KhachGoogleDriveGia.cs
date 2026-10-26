using ClassManagement.Api.Common;

namespace ClassManagement.Api.Google;

/// <summary>
/// Khách Google Drive GIẢ — chỉ dùng ở máy dev khi bật <c>GoogleCalendar:CheDoGia</c>.
///
/// Giữ tệp trong bộ nhớ để thử được trọn luồng giao bài: tải lên, học sinh tải về, thu hồi — mà không
/// cần tài khoản Google và không tốn dung lượng Drive thật.
/// </summary>
public class KhachGoogleDriveGia(ILogger<KhachGoogleDriveGia> ghiLog) : IKhachGoogleDrive
{
    /// <summary>Kho tệp giả, khoá theo id tệp.</summary>
    public static readonly Dictionary<string, TepGia> Kho = [];

    public async Task<TepDrive> TaiLenAsync(
        string accessToken,
        string tenTep,
        string mimeType,
        Stream noiDung,
        CancellationToken huyBo = default)
    {
        using var boNho = new MemoryStream();
        await noiDung.CopyToAsync(boNho, huyBo);

        var id = "gia-drive-" + Guid.NewGuid().ToString("N")[..12];
        Kho[id] = new TepGia(id, tenTep, mimeType, boNho.ToArray(), DateTime.UtcNow);

        ghiLog.LogInformation("[Drive giả] đã nhận tệp {Ten} ({So} byte)", tenTep, boNho.Length);

        return new TepDrive(id, tenTep, mimeType, boNho.Length, "https://drive.google.com/file/d/" + id + "/view");
    }

    public async Task SaoChepXuongAsync(
        string accessToken,
        string tepId,
        Stream dich,
        CancellationToken huyBo = default)
    {
        if (!Kho.TryGetValue(tepId, out var tep))
        {
            throw new LoiApiException(
                "Không tìm thấy tệp trên Drive",
                StatusCodes.Status404NotFound,
                "Tệp đã bị xoá khỏi Drive của giáo viên.");
        }

        await dich.WriteAsync(tep.NoiDung, huyBo);
    }

    public Task XoaAsync(string accessToken, string tepId, CancellationToken huyBo = default)
    {
        Kho.Remove(tepId);
        ghiLog.LogInformation("[Drive giả] đã xoá tệp {TepId}", tepId);
        return Task.CompletedTask;
    }

    /// <summary>Đọc nội dung một tệp giả, để kiểm thử so sánh với tệp đã gửi lên.</summary>
    public static byte[]? DocNoiDung(string tepId)
    {
        return Kho.TryGetValue(tepId, out var tep) ? tep.NoiDung : null;
    }

    /// <summary>Dọn kho tệp giả để lượt kiểm thử sau bắt đầu sạch.</summary>
    public static int XoaHet()
    {
        var soTep = Kho.Count;
        Kho.Clear();
        return soTep;
    }
}

/// <summary>Một tệp trong kho giả.</summary>
public record TepGia(string Id, string Ten, string MimeType, byte[] NoiDung, DateTime NgayTaoUtc);
