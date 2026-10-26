using ClassManagement.Api.Auth;
using ClassManagement.Api.Common;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClassManagement.Api.Controllers;

/// <summary>
/// Gửi tài liệu cho học sinh và thu hồi lại.
///
/// Tệp nằm trên Google Drive của CHÍNH giáo viên gửi, nhưng không mở công khai: học sinh tải qua
/// endpoint <c>tai-ve</c> của app (cả ở đây cho giáo viên, và ở HocSinhPortalController cho học sinh).
/// </summary>
[ApiController]
[Route("api/tai-lieu")]
[Authorize]
public class TaiLieuController(
    NguoiDungHienTai nguoiDungHienTai,
    DichVuTaiLieu dichVuTaiLieu) : ControllerBase
{
    /// <summary>Gửi một tệp lên Drive của giáo viên và giao cho học sinh (gắn buổi học nếu có).</summary>
    [HttpPost]
    [RequestSizeLimit(DichVuTaiLieu.KichThuocToiDaByte + (1024 * 1024))]
    public async Task<ActionResult<TaiLieuDto>> Gui([FromForm] TaoTaiLieuRequest yeuCau, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        return Ok(await dichVuTaiLieu.GuiAsync(toi, yeuCau, huyBo));
    }

    [HttpGet("danh-sach")]
    public async Task<ActionResult<IReadOnlyList<TaiLieuDto>>> DanhSach(
        [FromQuery] Guid? hocSinhId,
        [FromQuery] Guid? buoiHocId,
        CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        return Ok(await dichVuTaiLieu.DanhSachCuaGiaoVienAsync(toi, hocSinhId, buoiHocId, huyBo));
    }

    /// <summary>
    /// Giáo viên tải lại tài liệu mình đã gửi (hoặc admin xem hộ). Dữ liệu đi thẳng từ Drive ra
    /// response, không giữ cả tệp trong bộ nhớ máy chủ.
    /// </summary>
    [HttpGet("{id:guid}/tai-ve")]
    public async Task<IActionResult> TaiVe(Guid id, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        var taiLieu = await dichVuTaiLieu.LayChoGiaoVienAsync(toi, id, huyBo)
            ?? throw LoiApiException.NgoaiPhamVi("tài liệu");

        return await ChuyenTepAsync(taiLieu, huyBo);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> ThuHoi(Guid id, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        await dichVuTaiLieu.ThuHoiAsync(toi, id, huyBo);
        return NoContent();
    }

    /// <summary>Bơm tệp từ Drive ra response — dùng chung cho giáo viên và học sinh.</summary>
    internal async Task<IActionResult> ChuyenTepAsync(Entities.TaiLieu taiLieu, CancellationToken huyBo)
    {
        Response.ContentType = string.IsNullOrWhiteSpace(taiLieu.MimeType)
            ? "application/octet-stream"
            : taiLieu.MimeType;

        // filename* theo RFC 5987 để tên tệp có dấu tiếng Việt không bị hỏng.
        Response.Headers.Append("Content-Disposition", "attachment; filename*=UTF-8''" + Uri.EscapeDataString(taiLieu.TenTep));

        if (taiLieu.KichThuocByte > 0)
        {
            Response.ContentLength = taiLieu.KichThuocByte;
        }

        await dichVuTaiLieu.ChuyenTepXuongAsync(taiLieu, Response.Body, huyBo);
        return new EmptyResult();
    }
}
