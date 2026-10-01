using ClassManagement.Api.Auth;
using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using ClassManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Controllers;

/// <summary>
/// Tổng quan: hôm nay dạy ai và tuần này dạy những ai.
/// Giáo viên chỉ thấy lịch của mình; admin thấy tất cả và lọc được theo giáo viên.
/// </summary>
[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController(
    AppDbContext db,
    NguoiDungHienTai nguoiDungHienTai,
    DichVuLichDay dichVuLichDay) : ControllerBase
{
    [HttpGet("hom-nay")]
    public async Task<ActionResult<HomNayDto>> HomNay([FromQuery] Guid? giaoVienId, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);

        await dichVuLichDay.BaoDamBuoiChoKhoangAsync(toi, giaoVienId, null, homNay, homNay, huyBo);

        var duLieu = await DichVuLichDay.LayDtoAsync(
            dichVuLichDay.TruyVan(toi, giaoVienId, null, homNay, homNay), huyBo);

        return Ok(new HomNayDto
        {
            Ngay = homNay,
            SoBuoi = duLieu.Count,
            SoDaDiemDanh = duLieu.Count(x => x.TrangThai != TrangThaiDiemDanh.ChuaDiemDanh),
            SoChuaDiemDanh = duLieu.Count(x => x.TrangThai == TrangThaiDiemDanh.ChuaDiemDanh),
            DuLieu = duLieu,
        });
    }

    [HttpGet("tuan-nay")]
    public async Task<ActionResult<TuanNayDto>> TuanNay([FromQuery] Guid? giaoVienId, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);
        var tu = ThoiGian.DauTuan(homNay);
        var den = ThoiGian.CuoiTuan(homNay);

        await dichVuLichDay.BaoDamBuoiChoKhoangAsync(toi, giaoVienId, null, tu, den, huyBo);

        var duLieu = await DichVuLichDay.LayDtoAsync(
            dichVuLichDay.TruyVan(toi, giaoVienId, null, tu, den), huyBo);

        // Học phí dự kiến chỉ để nhìn nhanh: theo buổi thì số buổi mỗi tuần × 4 tuần × đơn giá,
        // theo tháng thì đúng mức học phí tháng. Công nợ thật tính từ điểm danh ở Phase 4.
        var hocSinh = await TruyVanHocSinhTheoPhamVi(toi, giaoVienId).ToListAsync(huyBo);
        var hocPhiDuKien = hocSinh.Sum(x => x.CachTinhHocPhi == CachTinhHocPhi.TheoBuoi
            ? (x.DonGiaTheoBuoi ?? 0m) * x.SoBuoiMoiTuan * 4
            : x.HocPhiTheoThang ?? 0m);

        return Ok(new TuanNayDto
        {
            TuNgay = tu,
            DenNgay = den,
            SoBuoi = duLieu.Count,
            SoDiHoc = duLieu.Count(x => x.TrangThai == TrangThaiDiemDanh.DiHoc),
            SoNghiCoPhep = duLieu.Count(x =>
                x.TrangThai == TrangThaiDiemDanh.Nghi && x.LyDoNghi == LyDoNghi.CoPhep),
            SoNghiKhongPhep = duLieu.Count(x =>
                x.TrangThai == TrangThaiDiemDanh.Nghi && x.LyDoNghi != LyDoNghi.CoPhep),
            SoChuaDiemDanh = duLieu.Count(x => x.TrangThai == TrangThaiDiemDanh.ChuaDiemDanh),
            HocPhiDuKienThangNay = hocPhiDuKien,
            DuLieu = duLieu,
            TongHopTheoHocSinh = DichVuLichDay.TongHopTheoHocSinh(duLieu),
            TongHopTheoGiaoVien = DichVuLichDay.TongHopTheoGiaoVien(duLieu),
        });
    }

    private IQueryable<HocSinh> TruyVanHocSinhTheoPhamVi(GiaoVien toi, Guid? giaoVienId)
    {
        var truyVan = db.HocSinh
            .AsNoTracking()
            .Where(x => x.TrangThai == TrangThaiHocSinh.DangHoc);

        if (toi.VaiTro != VaiTro.Admin)
        {
            truyVan = truyVan.Where(x => x.GiaoVienId == toi.Id);
        }
        else if (giaoVienId is { } loc)
        {
            truyVan = truyVan.Where(x => x.GiaoVienId == loc);
        }

        return truyVan;
    }
}
