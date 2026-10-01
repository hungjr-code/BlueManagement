using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using ClassManagement.Api.Data;
using ClassManagement.Api.Entities;

namespace ClassManagement.Api.Services;

/// <summary>
/// Nhật ký cho những thao tác đổi phạm vi nhìn thấy dữ liệu hoặc đổi tiền: đổi vai trò, sửa điểm
/// danh đã lưu, đổi tài khoản nhận tiền… Một đường ghi duy nhất để mọi bản ghi có cùng định dạng.
/// </summary>
public class DichVuNhatKy(AppDbContext db, IHttpContextAccessor truyCap)
{
    private static readonly JsonSerializerOptions TuyChonJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
        // Nhật ký là để người đọc: giữ nguyên tiếng Việt có dấu thay vì đổi thành \u1ecd.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public async Task GhiAsync(
        Guid? nguoiThucHienId,
        string hanhDong,
        string doiTuong,
        string? doiTuongId,
        string? duLieuTruoc = null,
        string? duLieuSau = null,
        CancellationToken huyBo = default)
    {
        db.NhatKy.Add(new NhatKy
        {
            NguoiThucHienId = nguoiThucHienId,
            HanhDong = hanhDong,
            DoiTuong = doiTuong,
            DoiTuongId = doiTuongId,
            DuLieuTruoc = duLieuTruoc,
            DuLieuSau = duLieuSau,
            DiaChiIp = truyCap.HttpContext?.Connection.RemoteIpAddress?.ToString(),
            ThoiDiemUtc = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(huyBo);
    }

    /// <summary>Ảnh chụp trạng thái trước/sau, dạng JSON đọc được (enum ra chuỗi, không ra số).</summary>
    public static string Json<T>(T giaTri)
    {
        return JsonSerializer.Serialize(giaTri, TuyChonJson);
    }
}
