using Microsoft.AspNetCore.Mvc;

namespace ClassManagement.Api.Common;

/// <summary>
/// Đổi lỗi thành ProblemDetails đúng chuẩn mà frontend đã đọc sẵn (ApiError đọc status, title,
/// detail và errors), và không để lộ chi tiết kỹ thuật của lỗi không lường trước ra ngoài.
/// </summary>
public class XuLyLoiApiMiddleware(RequestDelegate tiepTheo, ILogger<XuLyLoiApiMiddleware> ghiLog)
{
    public async Task InvokeAsync(HttpContext nguCanh)
    {
        try
        {
            await tiepTheo(nguCanh);
        }
        catch (LoiApiException loi)
        {
            await GhiAsync(nguCanh, loi);
        }
        catch (Exception loi)
        {
            ghiLog.LogError(loi, "Lỗi không lường trước ở {DuongDan}", nguCanh.Request.Path);
            await GhiAsync(
                nguCanh,
                new LoiApiException(
                    "Lỗi hệ thống",
                    StatusCodes.Status500InternalServerError,
                    "Xem log của backend để biết chi tiết. Không có dữ liệu nào bị ghi sai."));
        }
    }

    private static async Task GhiAsync(HttpContext nguCanh, LoiApiException loi)
    {
        if (nguCanh.Response.HasStarted)
        {
            return;
        }

        nguCanh.Response.Clear();
        nguCanh.Response.StatusCode = loi.MaTrangThai;
        nguCanh.Response.ContentType = "application/problem+json";

        var problem = new ProblemDetails
        {
            Status = loi.MaTrangThai,
            Title = loi.TieuDe,
            Detail = loi.ChiTiet,
            Instance = nguCanh.Request.Path,
        };

        problem.Extensions["traceId"] = nguCanh.TraceIdentifier;

        if (loi.LoiTheoField is not null)
        {
            problem.Extensions["errors"] = loi.LoiTheoField;
        }

        await nguCanh.Response.WriteAsJsonAsync(problem);
    }
}
