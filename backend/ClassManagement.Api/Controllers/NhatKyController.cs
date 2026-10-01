using ClassManagement.Api.Auth;
using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Controllers;

/// <summary>
/// Nhật ký thay đổi — trả lời câu hỏi "số liệu khác hôm qua là do ai, lúc nào, từ giá trị nào sang
/// giá trị nào". Nhật ký đã được ghi từ Phase 1, nhưng trước đây chỉ ghi mà không có đường đọc ra.
///
/// Quyền đọc: admin đọc được mọi dòng; giáo viên chỉ đọc được những dòng do CHÍNH MÌNH thực hiện.
/// Nhật ký có cả ảnh chụp số tiền và hành động lên dữ liệu của người khác, nên không mở rộng hơn.
/// Đây là chặn thật ở backend — giao diện ẩn hay hiện không tính.
/// </summary>
[ApiController]
[Route("api/nhat-ky")]
[Authorize]
public class NhatKyController(AppDbContext db, NguoiDungHienTai nguoiDungHienTai) : ControllerBase
{
    /// <summary>
    /// Danh sách nhật ký, mới nhất lên đầu. Lọc theo khoảng ngày (theo giờ trung tâm), hành động,
    /// đối tượng và người thực hiện.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<KetQuaPhanTrang<NhatKyDto>>> DanhSach(
        [FromQuery] DateOnly? tuNgay,
        [FromQuery] DateOnly? denNgay,
        [FromQuery] string? hanhDong,
        [FromQuery] string? doiTuong,
        [FromQuery] Guid? nguoiThucHienId,
        [FromQuery] int trang = 1,
        [FromQuery] int kichThuoc = 20,
        CancellationToken huyBo = default)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        var truyVan = db.NhatKy.AsNoTracking();

        if (toi.VaiTro != VaiTro.Admin)
        {
            // Giáo viên: chỉ dòng của chính mình. Cố tình bỏ qua tham số nguoiThucHienId của người
            // khác thay vì báo lỗi — báo lỗi là vô tình xác nhận "người đó có nhật ký".
            truyVan = truyVan.Where(x => x.NguoiThucHienId == toi.Id);
        }
        else if (nguoiThucHienId is { } nguoiLoc)
        {
            truyVan = truyVan.Where(x => x.NguoiThucHienId == nguoiLoc);
        }

        if (tuNgay is { } tu || denNgay is { } den)
        {
            // Người dùng chọn NGÀY THEO GIỜ TRUNG TÂM, nhật ký lưu UTC: đổi ở đúng một chỗ này.
            // denNgay là ngày trọn vẹn nên phải lấy hết ngày, tức là trước 0 giờ ngày kế tiếp.
            var muiGio = await LayMuiGioAsync(huyBo);
            if (tuNgay is { } tuLoc)
            {
                var tuUtc = SangUtc(tuLoc, muiGio);
                truyVan = truyVan.Where(x => x.ThoiDiemUtc >= tuUtc);
            }

            if (denNgay is { } denLoc)
            {
                var denUtc = SangUtc(denLoc.AddDays(1), muiGio);
                truyVan = truyVan.Where(x => x.ThoiDiemUtc < denUtc);
            }
        }

        if (!string.IsNullOrWhiteSpace(hanhDong))
        {
            var hanhDongLoc = hanhDong.Trim();
            truyVan = truyVan.Where(x => x.HanhDong == hanhDongLoc);
        }

        if (!string.IsNullOrWhiteSpace(doiTuong))
        {
            var doiTuongLoc = doiTuong.Trim();
            truyVan = truyVan.Where(x => x.DoiTuong == doiTuongLoc);
        }

        var (trangChuan, kichThuocChuan) = TeachersController.ChuanHoaPhanTrang(trang, kichThuoc);
        var tongSo = await truyVan.CountAsync(huyBo);

        var duLieu = await truyVan
            .OrderByDescending(x => x.ThoiDiemUtc)
            .ThenByDescending(x => x.Id)
            .Skip((trangChuan - 1) * kichThuocChuan)
            .Take(kichThuocChuan)
            .Select(x => new NhatKyDto
            {
                Id = x.Id,
                ThoiDiemUtc = x.ThoiDiemUtc,
                HanhDong = x.HanhDong,
                DoiTuong = x.DoiTuong,
                DoiTuongId = x.DoiTuongId,
                NguoiThucHien = x.NguoiThucHien == null ? null : x.NguoiThucHien.HoTen,
                DuLieuTruoc = x.DuLieuTruoc,
                DuLieuSau = x.DuLieuSau,
                DiaChiIp = x.DiaChiIp,
            })
            .ToListAsync(huyBo);

        // DateTime đọc từ SQL không mang thông tin loại giờ, nên mặc định nó được ghi ra JSON dạng
        // "2026-10-01T08:19:07" — trông y như giờ địa phương. Nhật ký là để đối chiếu "việc này xảy ra
        // lúc nào", gắn nhãn UTC ngay tại đây để người đọc API không phải đoán.
        foreach (var dongNhatKy in duLieu)
        {
            dongNhatKy.ThoiDiemUtc = DateTime.SpecifyKind(dongNhatKy.ThoiDiemUtc, DateTimeKind.Utc);
        }

        return Ok(new KetQuaPhanTrang<NhatKyDto>
        {
            DuLieu = duLieu,
            TongSo = tongSo,
            Trang = trangChuan,
            KichThuoc = kichThuocChuan,
        });
    }

    /// <summary>
    /// Danh mục hành động/đối tượng đã từng có, để giao diện dựng bộ lọc từ dữ liệu thật thay vì
    /// chép tay một danh sách sẽ lệch dần khi thêm hành động mới.
    /// </summary>
    [HttpGet("danh-muc")]
    public async Task<ActionResult<DanhMucNhatKyDto>> DanhMuc(CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        var truyVan = db.NhatKy.AsNoTracking();

        if (toi.VaiTro != VaiTro.Admin)
        {
            truyVan = truyVan.Where(x => x.NguoiThucHienId == toi.Id);
        }

        return Ok(new DanhMucNhatKyDto
        {
            HanhDong = await truyVan.Select(x => x.HanhDong).Distinct().OrderBy(x => x).Take(100).ToListAsync(huyBo),
            DoiTuong = await truyVan.Select(x => x.DoiTuong).Distinct().OrderBy(x => x).Take(100).ToListAsync(huyBo),
        });
    }

    private async Task<TimeZoneInfo> LayMuiGioAsync(CancellationToken huyBo)
    {
        var caiDat = await db.CaiDat.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == CaiDat.IdDuyNhat, huyBo);

        return ThoiGian.LayMuiGio(caiDat?.MuiGio);
    }

    /// <summary>Nửa đêm của một ngày theo giờ trung tâm, đổi sang UTC.</summary>
    private static DateTime SangUtc(DateOnly ngay, TimeZoneInfo muiGio)
    {
        var nuaDem = ngay.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(nuaDem, muiGio);
    }
}
