using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using ClassManagement.Api.Common;
using Microsoft.Extensions.Options;

namespace ClassManagement.Api.Google;

/// <summary>
/// Gọi thẳng REST API của Google Calendar bằng HttpClient thay vì kéo cả bộ SDK Google về: chỉ cần
/// năm lời gọi (đổi mã, làm mới token, liệt kê lịch, tạo/sửa/xoá sự kiện) nên tự viết vừa gọn vừa dễ
/// kiểm soát lỗi.
/// </summary>
public class KhachGoogleCalendarThat(
    HttpClient http,
    IOptions<GoogleCalendarOptions> tuyChon,
    ILogger<KhachGoogleCalendarThat> ghiLog) : IKhachGoogleCalendar
{
    private readonly GoogleCalendarOptions _tuyChon = tuyChon.Value;

    private const string DiaChiToken = "https://oauth2.googleapis.com/token";
    private const string DiaChiLich = "https://www.googleapis.com/calendar/v3";

    private static readonly JsonSerializerOptions TuyChonJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public async Task<TokenGoogle> DoiMaUyQuyenAsync(string maUyQuyen, CancellationToken huyBo = default)
    {
        var tuyChon = LayTuyChon();

        var noiDung = new Dictionary<string, string>
        {
            ["code"] = maUyQuyen,
            ["client_id"] = tuyChon.ClientId!,
            ["client_secret"] = tuyChon.ClientSecret!,
            ["redirect_uri"] = tuyChon.RedirectUri,
            ["grant_type"] = "authorization_code",
        };

        using var phanHoi = await http.PostAsync(DiaChiToken, new FormUrlEncodedContent(noiDung), huyBo);
        var than = await DocHoacNemAsync(phanHoi, "đổi mã uỷ quyền", huyBo);

        var token = than.GetProperty("access_token").GetString()!;
        var refresh = than.TryGetProperty("refresh_token", out var r) ? r.GetString() : null;
        var idToken = than.TryGetProperty("id_token", out var t) ? t.GetString() : null;
        var giay = than.TryGetProperty("expires_in", out var e) ? e.GetInt32() : 3600;

        return new TokenGoogle(token, refresh, idToken, DateTime.UtcNow.AddSeconds(giay));
    }

    public async Task<string> LamMoiAccessTokenAsync(string refreshToken, CancellationToken huyBo = default)
    {
        var tuyChon = LayTuyChon();

        var noiDung = new Dictionary<string, string>
        {
            ["refresh_token"] = refreshToken,
            ["client_id"] = tuyChon.ClientId!,
            ["client_secret"] = tuyChon.ClientSecret!,
            ["grant_type"] = "refresh_token",
        };

        using var phanHoi = await http.PostAsync(DiaChiToken, new FormUrlEncodedContent(noiDung), huyBo);
        var than = await DocHoacNemAsync(phanHoi, "làm mới access token", huyBo);

        return than.GetProperty("access_token").GetString()!;
    }

    public async Task<IReadOnlyList<LichGoogle>> LayDanhSachLichAsync(string accessToken, CancellationToken huyBo = default)
    {
        using var yeuCau = TaoYeuCau(HttpMethod.Get, $"{DiaChiLich}/users/me/calendarList", accessToken);
        using var phanHoi = await http.SendAsync(yeuCau, huyBo);
        var than = await DocHoacNemAsync(phanHoi, "liệt kê lịch", huyBo);

        var ketQua = new List<LichGoogle>();
        if (!than.TryGetProperty("items", out var items))
        {
            return ketQua;
        }

        foreach (var item in items.EnumerateArray())
        {
            var id = item.TryGetProperty("id", out var i) ? i.GetString() : null;
            if (string.IsNullOrWhiteSpace(id))
            {
                continue;
            }

            var ten = item.TryGetProperty("summary", out var s) ? s.GetString() ?? id : id;
            var laChinh = item.TryGetProperty("primary", out var p) && p.ValueKind == JsonValueKind.True;
            ketQua.Add(new LichGoogle(id, ten, laChinh));
        }

        return ketQua;
    }

    public async Task<string> TaoSuKienAsync(
        string accessToken,
        string calendarId,
        SuKienGoogle suKien,
        CancellationToken huyBo = default)
    {
        using var yeuCau = TaoYeuCau(HttpMethod.Post, $"{DiaChiLich}/calendars/{Uri.EscapeDataString(calendarId)}/events", accessToken);
        yeuCau.Content = JsonContent.Create(ThanSuKien(suKien), options: TuyChonJson);

        using var phanHoi = await http.SendAsync(yeuCau, huyBo);
        var than = await DocHoacNemAsync(phanHoi, "tạo sự kiện", huyBo);

        return than.GetProperty("id").GetString()!;
    }

    public async Task CapNhatSuKienAsync(
        string accessToken,
        string calendarId,
        string eventId,
        SuKienGoogle suKien,
        CancellationToken huyBo = default)
    {
        using var yeuCau = TaoYeuCau(
            HttpMethod.Patch,
            $"{DiaChiLich}/calendars/{Uri.EscapeDataString(calendarId)}/events/{Uri.EscapeDataString(eventId)}",
            accessToken);
        yeuCau.Content = JsonContent.Create(ThanSuKien(suKien), options: TuyChonJson);

        using var phanHoi = await http.SendAsync(yeuCau, huyBo);
        _ = await DocHoacNemAsync(phanHoi, "cập nhật sự kiện", huyBo);
    }

    public async Task XoaSuKienAsync(
        string accessToken,
        string calendarId,
        string eventId,
        CancellationToken huyBo = default)
    {
        using var yeuCau = TaoYeuCau(
            HttpMethod.Delete,
            $"{DiaChiLich}/calendars/{Uri.EscapeDataString(calendarId)}/events/{Uri.EscapeDataString(eventId)}",
            accessToken);

        using var phanHoi = await http.SendAsync(yeuCau, huyBo);

        // Sự kiện đã bị xoá tay trên Google thì coi như xong, không báo lỗi cho người dùng.
        if (phanHoi.StatusCode is System.Net.HttpStatusCode.NotFound or System.Net.HttpStatusCode.Gone)
        {
            return;
        }

        _ = await DocHoacNemAsync(phanHoi, "xoá sự kiện", huyBo);
    }

    /* ------------------------------------------------------------------ */

    private GoogleCalendarOptions LayTuyChon()
    {
        if (!_tuyChon.DaCauHinh)
        {
            throw new LoiApiException(
                "Chưa cấu hình Google Calendar",
                StatusCodes.Status409Conflict,
                "Đặt GoogleCalendar:ClientId và GoogleCalendar:ClientSecret bằng user-secrets của backend "
                + "(xem backend/README.md), hoặc bật GoogleCalendar:CheDoGia khi chạy máy dev.");
        }

        return _tuyChon;
    }

    private static HttpRequestMessage TaoYeuCau(HttpMethod phuongThuc, string diaChi, string accessToken)
    {
        var yeuCau = new HttpRequestMessage(phuongThuc, diaChi);
        yeuCau.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return yeuCau;
    }

    private static object ThanSuKien(SuKienGoogle suKien)
    {
        return new
        {
            summary = suKien.TieuDe,
            description = suKien.MoTa,
            start = new { dateTime = suKien.BatDau.ToString("yyyy-MM-ddTHH:mm:sszzz"), timeZone = suKien.MuiGio },
            end = new { dateTime = suKien.KetThuc.ToString("yyyy-MM-ddTHH:mm:sszzz"), timeZone = suKien.MuiGio },
            reminders = suKien.NhacTruocPhut is { } phut
                ? new
                {
                    useDefault = false,
                    overrides = new[] { new { method = "popup", minutes = phut } },
                }
                : null,
        };
    }

    private async Task<JsonElement> DocHoacNemAsync(
        HttpResponseMessage phanHoi,
        string viecDangLam,
        CancellationToken huyBo)
    {
        var than = await phanHoi.Content.ReadAsStringAsync(huyBo);

        if (!phanHoi.IsSuccessStatusCode)
        {
            ghiLog.LogWarning("Google trả lỗi khi {Viec}: {Ma} {Than}", viecDangLam, (int)phanHoi.StatusCode, than);

            var chiTiet = (int)phanHoi.StatusCode switch
            {
                401 => "Token Google không còn hiệu lực. Ngắt kết nối rồi kết nối lại trong Cài đặt.",
                403 => "Tài khoản Google chưa cấp đủ quyền, hoặc đã hết hạn mức. Kiểm tra lại ở Cài đặt.",
                404 => "Không tìm thấy lịch hoặc sự kiện trên Google — có thể đã bị xoá tay.",
                _ => "Google trả lỗi " + (int)phanHoi.StatusCode + ". Xem log của backend để biết chi tiết.",
            };

            throw new LoiApiException("Google Calendar báo lỗi", StatusCodes.Status502BadGateway, chiTiet);
        }

        using var taiLieu = JsonDocument.Parse(string.IsNullOrWhiteSpace(than) ? "{}" : than);
        return taiLieu.RootElement.Clone();
    }
}
