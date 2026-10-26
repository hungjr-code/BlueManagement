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
/// Cổng thông tin của HỌC SINH: lịch học, tình trạng đi học, bài tập được giao và tải bài tập về.
///
/// Mọi endpoint ở đây đều nằm dưới lược đồ token của học sinh và chỉ trả về dữ liệu CỦA CHÍNH EM
/// đang đăng nhập — không có tham số nào cho phép hỏi về học sinh khác, nên không có cửa để dò.
/// </summary>
[ApiController]
[Route("api/hoc-sinh")]
[Authorize(AuthenticationSchemes = ChinhSach.LuocDoTokenHocSinh)]
public class HocSinhPortalController(
    AppDbContext db,
    NguoiHocSinhHienTai nguoiHocSinhHienTai,
    DichVuTaiLieu dichVuTaiLieu,
    DichVuBuoiHoc dichVuBuoiHoc) : ControllerBase
{
    /// <summary>Giới hạn khoảng ngày một lần xem, khớp với giới hạn của màn Điểm danh.</summary>
    private const int SoNgayToiDa = 62;

    [HttpGet("toi")]
    public async Task<ActionResult<HocSinhToiDto>> ToiLaAi(CancellationToken huyBo)
    {
        var hocSinh = await nguoiHocSinhHienTai.YeuCauAsync(huyBo);
        return Ok(DichVuTaiKhoanHocSinh.TaoDto(hocSinh));
    }

    /// <summary>Bài tập giáo viên đã giao cho chính em.</summary>
    [HttpGet("bai-tap")]
    public async Task<ActionResult<IReadOnlyList<BaiTapCuaHocSinhDto>>> BaiTap(CancellationToken huyBo)
    {
        var hocSinh = await nguoiHocSinhHienTai.YeuCauAsync(huyBo);
        return Ok(await dichVuTaiLieu.DanhSachCuaHocSinhAsync(hocSinh, huyBo));
    }

    /// <summary>
    /// Lịch học của em: bỏ trống khoảng ngày thì lấy từ hôm nay tới hết tháng sau — vừa đủ để nhìn
    /// tuần này và tuần sau, không kéo về cả năm.
    /// </summary>
    [HttpGet("lich-hoc")]
    public async Task<ActionResult<IReadOnlyList<BuoiHocCuaHocSinhDto>>> LichHoc(
        [FromQuery] DateOnly? tuNgay,
        [FromQuery] DateOnly? denNgay,
        CancellationToken huyBo)
    {
        var hocSinh = await nguoiHocSinhHienTai.YeuCauAsync(huyBo);

        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);
        var tu = tuNgay ?? homNay;
        var den = denNgay ?? DichVuBuoiHoc.CuoiKySinhBuoi(homNay);

        if (den < tu)
        {
            throw LoiApiException.DuLieuSai(
                "Khoảng ngày không hợp lệ.",
                new Dictionary<string, string[]> { ["denNgay"] = ["Ngày kết thúc phải sau ngày bắt đầu"] });
        }

        if (den.DayNumber - tu.DayNumber > SoNgayToiDa)
        {
            throw LoiApiException.DuLieuSai(
                "Khoảng ngày quá dài.",
                new Dictionary<string, string[]>
                {
                    ["denNgay"] = ["Chỉ xem được tối đa " + SoNgayToiDa + " ngày một lần"],
                });
        }

        // Buổi học được SINH THEO YÊU CẦU (không có sẵn trong database), nên phải bảo đảm buổi trước
        // khi đọc: nếu chỉ đọc bảng BuoiHoc thì học sinh vào xem lần đầu sẽ thấy lịch trống trơn, dù
        // giáo viên đã khai lịch học lặp hằng tuần cho mình.
        await dichVuBuoiHoc.BaoDamBuoiHocAsync(hocSinh, tu, den, huyBo);

        var danhSach = await db.BuoiHoc
            .AsNoTracking()
            .Include(x => x.DiemDanh)
            .Include(x => x.GiaoVien)
            .Include(x => x.DanhSachTaiLieu)
            .Where(x => x.HocSinhId == hocSinh.Id && x.Ngay >= tu && x.Ngay <= den)
            .OrderBy(x => x.Ngay)
            .ThenBy(x => x.GioBatDau)
            .ToListAsync(huyBo);

        var ketQua = danhSach.Select(buoi => new BuoiHocCuaHocSinhDto
        {
            Id = buoi.Id,
            Ngay = buoi.Ngay,
            GioBatDau = buoi.GioBatDau,
            GioKetThuc = buoi.GioKetThuc,
            LaBuoiDayBu = buoi.LaBuoiDayBu,
            TrangThai = buoi.DiemDanh?.TrangThai ?? TrangThaiDiemDanh.ChuaDiemDanh,
            LyDoNghi = buoi.DiemDanh?.LyDoNghi,
            GhiChuDiemDanh = buoi.DiemDanh?.GhiChu,
            Lop = hocSinh.Lop,
            TenGiaoVien = buoi.GiaoVien?.HoTen ?? "—",
            SoTaiLieu = buoi.DanhSachTaiLieu.Count(x => !x.DaXoa),
            DaQua = buoi.Ngay < homNay,
        }).ToList();

        return Ok(ketQua);
    }

    /// <summary>
    /// Tải một bài tập về. App đọc hộ tệp từ Drive của giáo viên nên tệp không phải mở công khai;
    /// chỉ học sinh được giao bài đó mới tải được, học sinh khác (và người ngoài) nhận 404.
    /// </summary>
    [HttpGet("bai-tap/{id:guid}/tai-ve")]
    public async Task<IActionResult> TaiBaiTap(Guid id, CancellationToken huyBo)
    {
        var hocSinh = await nguoiHocSinhHienTai.YeuCauAsync(huyBo);

        var taiLieu = await dichVuTaiLieu.LayChoHocSinhAsync(hocSinh, id, huyBo)
            ?? throw LoiApiException.NgoaiPhamVi("bài tập");

        Response.ContentType = string.IsNullOrWhiteSpace(taiLieu.MimeType)
            ? "application/octet-stream"
            : taiLieu.MimeType;

        Response.Headers.Append("Content-Disposition", "attachment; filename*=UTF-8''" + Uri.EscapeDataString(taiLieu.TenTep));

        if (taiLieu.KichThuocByte > 0)
        {
            Response.ContentLength = taiLieu.KichThuocByte;
        }

        await dichVuTaiLieu.ChuyenTepXuongAsync(taiLieu, Response.Body, huyBo);
        return new EmptyResult();
    }
}
