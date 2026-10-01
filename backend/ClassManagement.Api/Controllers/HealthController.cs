using ClassManagement.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Controllers;

/// <summary>
/// Cấu trúc trả về đã chốt với frontend (frontend/src/api/health.ts). Đổi cấu trúc này là phải
/// sửa cả hai phía, nên nó nằm ngay đây chứ không rải rác.
/// </summary>
public record HealthDatabase(bool CanConnect, string Provider);

public record HealthResponse(
    string Status,
    string Service,
    string Version,
    string Environment,
    DateTime ServerTimeUtc,
    HealthDatabase Database);

/// <summary>
/// Endpoint duy nhất không cần đăng nhập, dùng để biết API và database còn sống không.
/// </summary>
[ApiController]
[Route("api/health")]
[AllowAnonymous]
public class HealthController(
    AppDbContext db,
    IHostEnvironment moiTruong,
    ILogger<HealthController> ghiLog) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<HealthResponse>> Get(CancellationToken huyBo)
    {
        bool ketNoiDuoc;
        try
        {
            ketNoiDuoc = await db.Database.CanConnectAsync(huyBo);
        }
        catch (Exception loi)
        {
            // Không ném lỗi ra ngoài: mất database là tình trạng cần báo cáo, không phải lỗi 500.
            ghiLog.LogWarning(loi, "Kiểm tra sức khoẻ: không kết nối được database.");
            ketNoiDuoc = false;
        }

        var phienBan = typeof(HealthController).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";
        var nhaCungCap = db.Database.ProviderName?.Contains("SqlServer", StringComparison.Ordinal) == true
            ? "SQL Server"
            : db.Database.ProviderName ?? "Không rõ";

        return Ok(new HealthResponse(
            ketNoiDuoc ? "ok" : "degraded",
            "ClassManagement.Api",
            phienBan,
            moiTruong.EnvironmentName,
            DateTime.UtcNow,
            new HealthDatabase(ketNoiDuoc, nhaCungCap)));
    }
}
