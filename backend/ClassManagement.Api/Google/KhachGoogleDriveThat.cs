using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ClassManagement.Api.Common;

namespace ClassManagement.Api.Google;

/// <summary>
/// Gọi REST API của Google Drive bằng HttpClient, không kéo cả bộ SDK Google về: chỉ cần ba việc —
/// tải tệp lên, đọc tệp xuống, xoá tệp.
///
/// Tải lên dùng chế độ <c>resumable</c> (hai bước: xin địa chỉ, rồi PUT nội dung) chứ không nhồi cả
/// tệp vào một request multipart: multipart chỉ chịu được khoảng 5MB, mà đề bài scan thì vượt xa.
/// </summary>
public class KhachGoogleDriveThat(HttpClient http, ILogger<KhachGoogleDriveThat> ghiLog) : IKhachGoogleDrive
{
    private const string DiaChiTep = "https://www.googleapis.com/drive/v3/files";
    private const string DiaChiTaiLen = "https://www.googleapis.com/upload/drive/v3/files";

    public async Task<TepDrive> TaiLenAsync(
        string accessToken,
        string tenTep,
        string mimeType,
        Stream noiDung,
        CancellationToken huyBo = default)
    {
        var kichThuoc = noiDung.CanSeek ? noiDung.Length : (long?)null;

        // Bước 1: xin địa chỉ nhận tệp.
        using var xin = new HttpRequestMessage(
            HttpMethod.Post,
            $"{DiaChiTaiLen}?uploadType=resumable&fields=id,name,mimeType,size,webViewLink");
        xin.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        xin.Headers.Add("X-Upload-Content-Type", mimeType);
        if (kichThuoc is { } dai)
        {
            xin.Headers.Add("X-Upload-Content-Length", dai.ToString());
        }

        xin.Content = JsonContent.Create(new { name = tenTep, mimeType });

        using var traLoi = await http.SendAsync(xin, huyBo);
        if (!traLoi.IsSuccessStatusCode)
        {
            var loi = await traLoi.Content.ReadAsStringAsync(huyBo);
            ghiLog.LogWarning("Drive từ chối mở phiên tải lên: {Ma} {Than}", (int)traLoi.StatusCode, loi);
            throw TaoLoi(traLoi.StatusCode, "mở phiên tải tệp lên Drive", loi);
        }

        var dia = traLoi.Headers.Location
            ?? throw new LoiApiException(
                "Google Drive không trả địa chỉ nhận tệp",
                StatusCodes.Status502BadGateway,
                "Thử lại sau; nếu vẫn lỗi thì kiểm tra xem ứng dụng đã được cấp quyền Drive chưa.");

        // Bước 2: gửi nội dung tệp.
        using var tai = new HttpRequestMessage(HttpMethod.Put, dia);
        tai.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var than = new StreamContent(noiDung);
        than.Headers.ContentType = new MediaTypeHeaderValue(mimeType);
        tai.Content = than;

        using var ketQua = await http.SendAsync(tai, huyBo);
        var noiDungKetQua = await DocHoacNemAsync(ketQua, "tải tệp lên Drive", huyBo);

        return DocTep(noiDungKetQua, tenTep, mimeType, kichThuoc ?? 0);
    }

    public async Task SaoChepXuongAsync(
        string accessToken,
        string tepId,
        Stream dich,
        CancellationToken huyBo = default)
    {
        using var yeuCau = new HttpRequestMessage(
            HttpMethod.Get,
            $"{DiaChiTep}/{Uri.EscapeDataString(tepId)}?alt=media");
        yeuCau.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        // ResponseHeadersRead: bắt đầu chuyển tiếp ngay khi có byte đầu tiên, không giữ cả tệp
        // trong RAM (máy chủ gói free chỉ có vài trăm MB).
        using var phanHoi = await http.SendAsync(yeuCau, HttpCompletionOption.ResponseHeadersRead, huyBo);

        if (!phanHoi.IsSuccessStatusCode)
        {
            var loi = await phanHoi.Content.ReadAsStringAsync(huyBo);
            ghiLog.LogWarning("Drive từ chối đọc tệp {TepId}: {Ma} {Than}", tepId, (int)phanHoi.StatusCode, loi);
            throw TaoLoi(phanHoi.StatusCode, "đọc tệp từ Drive", loi);
        }

        await phanHoi.Content.CopyToAsync(dich, huyBo);
    }

    public async Task XoaAsync(string accessToken, string tepId, CancellationToken huyBo = default)
    {
        using var yeuCau = new HttpRequestMessage(HttpMethod.Delete, $"{DiaChiTep}/{Uri.EscapeDataString(tepId)}");
        yeuCau.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var phanHoi = await http.SendAsync(yeuCau, huyBo);

        // Tệp đã bị xoá tay trên Drive thì coi như xong — không báo lỗi cho người dùng.
        if (phanHoi.StatusCode is System.Net.HttpStatusCode.NotFound or System.Net.HttpStatusCode.Gone)
        {
            return;
        }

        _ = await DocHoacNemAsync(phanHoi, "xoá tệp trên Drive", huyBo);
    }

    /* ------------------------------------------------------------------ */

    private static TepDrive DocTep(JsonElement than, string tenMacDinh, string mimeMacDinh, long kichThuocMacDinh)
    {
        var id = than.TryGetProperty("id", out var i) ? i.GetString() : null;

        if (string.IsNullOrWhiteSpace(id))
        {
            throw new LoiApiException(
                "Google Drive không trả id tệp",
                StatusCodes.Status502BadGateway,
                "Không thể theo dõi tệp vừa tải lên. Thử lại.");
        }

        var ten = than.TryGetProperty("name", out var n) ? n.GetString() ?? tenMacDinh : tenMacDinh;
        var mime = than.TryGetProperty("mimeType", out var m) ? m.GetString() ?? mimeMacDinh : mimeMacDinh;
        var kichThuoc = than.TryGetProperty("size", out var s) && long.TryParse(s.GetString(), out var so)
            ? so
            : kichThuocMacDinh;
        var link = than.TryGetProperty("webViewLink", out var w) ? w.GetString() : null;

        return new TepDrive(id, ten, mime, kichThuoc, link);
    }

    private static async Task<JsonElement> DocHoacNemAsync(
        HttpResponseMessage phanHoi,
        string viecDangLam,
        CancellationToken huyBo)
    {
        var than = await phanHoi.Content.ReadAsStringAsync(huyBo);

        if (!phanHoi.IsSuccessStatusCode)
        {
            throw TaoLoi(phanHoi.StatusCode, viecDangLam, than);
        }

        using var taiLieu = JsonDocument.Parse(string.IsNullOrWhiteSpace(than) ? "{}" : than);
        return taiLieu.RootElement.Clone();
    }

    private static LoiApiException TaoLoi(System.Net.HttpStatusCode ma, string viecDangLam, string than)
    {
        var chiTiet = (int)ma switch
        {
            401 => "Token Google không còn hiệu lực. Vào Cài đặt, ngắt kết nối rồi kết nối lại.",
            403 => "Tài khoản Google chưa cấp quyền ghi tài liệu (Drive). Vào Cài đặt, bấm Ngắt kết nối "
                + "rồi Kết nối Google Calendar lại để cấp đủ quyền.",
            404 => "Không tìm thấy tệp trên Drive — có thể giáo viên đã xoá tay.",
            413 => "Tệp quá lớn để gửi lên Drive.",
            _ => "Google Drive trả lỗi " + (int)ma + " khi " + viecDangLam + ". Xem log backend để biết chi tiết.",
        };

        return new LoiApiException("Google Drive báo lỗi", StatusCodes.Status502BadGateway, chiTiet + " (" + than[..Math.Min(than.Length, 200)] + ")");
    }
}
