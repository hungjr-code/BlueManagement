using ClassManagement.Api.Auth;
using ClassManagement.Api.Common;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using ClassManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClassManagement.Api.Controllers;

/// <summary>
/// Học phí, thu tiền, chốt sổ và đối chiếu ngân hàng.
///
/// Giáo viên chỉ làm việc với học sinh của mình (truy cập dòng của người khác trả 404 chứ không 403,
/// để không xác nhận là dòng đó có tồn tại). Chốt sổ và mở chốt sổ là việc của admin vì nó khoá
/// con số của cả kỳ.
/// </summary>
[ApiController]
[Route("api/tuition")]
[Authorize]
public class TuitionController(
    DichVuHocPhi hocPhi,
    NguoiDungHienTai nguoiDungHienTai) : ControllerBase
{
    /// <summary>Tính (hoặc tính lại) học phí của kỳ từ điểm danh. Giáo viên chỉ tính cho học sinh của mình.</summary>
    [HttpPost("tinh-ky")]
    public async Task<ActionResult<KetQuaTinhKyDto>> TinhKy(KyHocPhiRequest yeuCau, CancellationToken huyBo)
    {
        var (toi, gioiHan) = await LayPhamViAsync(huyBo);
        var locGiaoVien = gioiHan ?? yeuCau.GiaoVienId;

        return Ok(await hocPhi.TinhKyAsync(yeuCau.Thang, yeuCau.Nam, locGiaoVien, toi.Id, huyBo));
    }

    /// <summary>Sổ học phí của một kỳ.</summary>
    [HttpGet("ky")]
    public async Task<ActionResult<IReadOnlyList<HocPhiDto>>> Ky(
        [FromQuery] int thang,
        [FromQuery] int nam,
        [FromQuery] TrangThaiThanhToan? trangThai,
        [FromQuery] Guid? giaoVienId,
        CancellationToken huyBo)
    {
        var (_, gioiHan) = await LayPhamViAsync(huyBo);
        return Ok(await hocPhi.LayKyAsync(thang, nam, gioiHan ?? giaoVienId, trangThai, huyBo));
    }

    /// <summary>Ai sắp đến hạn đóng tiền, ai đã quá hạn mà chưa thu đủ.</summary>
    [HttpGet("sap-den-han")]
    public async Task<ActionResult<SapDenHanDto>> SapDenHan([FromQuery] int? soNgay, CancellationToken huyBo)
    {
        var (_, gioiHan) = await LayPhamViAsync(huyBo);
        return Ok(await hocPhi.SapDenHanAsync(gioiHan, soNgay ?? 7, huyBo));
    }

    /// <summary>Doanh thu theo giáo viên trong kỳ. Chỉ admin xem được toàn trung tâm.</summary>
    [HttpGet("tong-hop")]
    public async Task<ActionResult<IReadOnlyList<TongHopTheoGiaoVienDto>>> TongHop(
        [FromQuery] int thang,
        [FromQuery] int nam,
        CancellationToken huyBo)
    {
        var (_, gioiHan) = await LayPhamViAsync(huyBo);
        if (gioiHan is null)
        {
            return Ok(await hocPhi.TongHopAsync(thang, nam, huyBo));
        }

        var cuaToi = await hocPhi.TongHopAsync(thang, nam, huyBo);
        return Ok(cuaToi.Where(x => x.GiaoVienId == gioiHan).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<HocPhiChiTietDto>> ChiTiet(Guid id, CancellationToken huyBo)
    {
        var (_, gioiHan) = await LayPhamViAsync(huyBo);
        return Ok(await hocPhi.ChiTietAsync(id, gioiHan, huyBo));
    }

    /// <summary>Ghi một lần thu tiền. Thu nhiều lần được, mỗi lần một phiếu thu.</summary>
    [HttpPost("{id:guid}/thu-tien")]
    public async Task<ActionResult<PhieuThuDto>> ThuTien(Guid id, ThuTienRequest yeuCau, CancellationToken huyBo)
    {
        var (toi, gioiHan) = await LayPhamViAsync(huyBo);
        return Ok(await hocPhi.ThuTienAsync(id, yeuCau, gioiHan, toi.Id, huyBo));
    }

    /// <summary>Huỷ một phiếu thu đã ghi sai. Bắt buộc có lý do và luôn để lại vết trong nhật ký.</summary>
    [HttpPost("phieu-thu/{id:guid}/huy")]
    public async Task<IActionResult> HuyPhieuThu(Guid id, HuyPhieuThuRequest yeuCau, CancellationToken huyBo)
    {
        var (toi, gioiHan) = await LayPhamViAsync(huyBo);
        await hocPhi.HuyPhieuThuAsync(id, yeuCau.LyDo, gioiHan, toi.Id, huyBo);
        return NoContent();
    }

    /// <summary>Xem trước khi chốt sổ: còn buổi nào chưa điểm danh, còn ai chưa được tính tiền.</summary>
    [HttpGet("chot-so/xem-truoc")]
    public async Task<ActionResult<CanhBaoChotSoDto>> XemTruocChotSo(
        [FromQuery] int thang,
        [FromQuery] int nam,
        CancellationToken huyBo)
    {
        await nguoiDungHienTai.YeuCauAdminAsync(huyBo);
        return Ok(await hocPhi.XemTruocChotSoAsync(thang, nam, huyBo));
    }

    /// <summary>Chốt sổ kỳ: khoá con số của kỳ lại. Chỉ admin.</summary>
    [HttpPost("chot-so")]
    public async Task<ActionResult<KetQuaChotSoDto>> ChotSo(ChotSoRequest yeuCau, CancellationToken huyBo)
    {
        var admin = await nguoiDungHienTai.YeuCauAdminAsync(huyBo);
        return Ok(await hocPhi.ChotSoAsync(yeuCau.Thang, yeuCau.Nam, yeuCau.BoQuaCanhBao, admin.Id, huyBo));
    }

    /// <summary>Mở lại sổ đã chốt. Chỉ admin, và phải nêu lý do.</summary>
    [HttpPost("mo-chot-so")]
    public async Task<ActionResult<KetQuaChotSoDto>> MoChotSo(MoChotSoRequest yeuCau, CancellationToken huyBo)
    {
        var admin = await nguoiDungHienTai.YeuCauAdminAsync(huyBo);
        return Ok(await hocPhi.MoChotSoAsync(yeuCau.Thang, yeuCau.Nam, yeuCau.LyDo, admin.Id, huyBo));
    }

    /// <summary>
    /// Phân tích các dòng sao kê ngân hàng thành đề xuất ghép với học phí. KHÔNG ghi gì cả: máy đề
    /// xuất, người xác nhận.
    /// </summary>
    [HttpPost("doi-chieu/phan-tich")]
    public async Task<ActionResult<IReadOnlyList<DeXuatDoiChieuDto>>> PhanTichDoiChieu(
        [FromBody] IReadOnlyList<GiaoDichNganHangDto> giaoDich,
        [FromQuery] Guid? giaoVienId,
        CancellationToken huyBo)
    {
        var (_, gioiHan) = await LayPhamViAsync(huyBo);
        return Ok(await hocPhi.PhanTichDoiChieuAsync(
            DateTime.UtcNow.Month, DateTime.UtcNow.Year, giaoDich, gioiHan ?? giaoVienId, huyBo));
    }

    /// <summary>Ghi những cặp đã được xác nhận thành phiếu thu chuyển khoản.</summary>
    [HttpPost("doi-chieu/xac-nhan")]
    public async Task<ActionResult<KetQuaDoiChieuDto>> XacNhanDoiChieu(
        XacNhanDoiChieuRequest yeuCau,
        CancellationToken huyBo)
    {
        var (toi, gioiHan) = await LayPhamViAsync(huyBo);
        return Ok(await hocPhi.XacNhanDoiChieuAsync(yeuCau.CacCap, gioiHan, toi.Id, huyBo));
    }

    /// <summary>Xuất sổ học phí của kỳ ra Excel (3 sheet: chi tiết, tổng hợp theo giáo viên, phiếu thu).</summary>
    [HttpGet("xuat-excel")]
    public async Task<IActionResult> XuatExcel([FromQuery] int thang, [FromQuery] int nam, CancellationToken huyBo)
    {
        var (_, gioiHan) = await LayPhamViAsync(huyBo);
        var noiDung = await hocPhi.XuatExcelAsync(thang, nam, gioiHan, huyBo);
        var ten = $"hoc-phi-{thang:00}-{nam}.xlsx";

        return File(
            noiDung,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ten);
    }

    /* ------------------------------------------------------------------ */

    /// <summary>
    /// Phạm vi dữ liệu của người đang đăng nhập: admin thì không giới hạn (null), giáo viên thì chỉ
    /// được thấy học sinh của chính mình.
    /// </summary>
    private async Task<(GiaoVien Toi, Guid? GioiHan)> LayPhamViAsync(CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        return (toi, toi.VaiTro == VaiTro.Admin ? null : toi.Id);
    }
}
