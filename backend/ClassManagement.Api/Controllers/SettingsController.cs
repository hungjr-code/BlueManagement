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
/// Cấu hình dùng chung của cả trung tâm — trước đây nằm trong localStorage của từng máy,
/// giờ nằm ở đây để mọi máy dùng đúng một tài khoản nhận tiền. Chỉ admin được sửa.
/// </summary>
[ApiController]
[Route("api/settings")]
[Authorize]
public class SettingsController(
    AppDbContext db,
    NguoiDungHienTai nguoiDungHienTai) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CaiDatDto>> Doc(CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        var caiDat = await LayCaiDatAsync(huyBo);
        return Ok(TaoDto(caiDat, await ThongKeTaiKhoanNhanTienAsync(toi, huyBo)));
    }

    [HttpPut]
    public async Task<ActionResult<CaiDatDto>> Sua(SuaCaiDatRequest yeuCau, CancellationToken huyBo)
    {
        var admin = await nguoiDungHienTai.YeuCauAdminAsync(huyBo);
        var caiDat = await LayCaiDatAsync(huyBo);

        var loi = new Dictionary<string, string[]>();

        if (yeuCau.MuiGio is { } muiGioMoi && !string.IsNullOrWhiteSpace(muiGioMoi))
        {
            try
            {
                TimeZoneInfo.FindSystemTimeZoneById(muiGioMoi.Trim());
            }
            catch (TimeZoneNotFoundException)
            {
                loi[nameof(yeuCau.MuiGio)] = [$"Không hiểu mã múi giờ \"{muiGioMoi}\". Ví dụ đúng: Asia/Ho_Chi_Minh"];
            }
            catch (InvalidTimeZoneException)
            {
                loi[nameof(yeuCau.MuiGio)] = [$"Dữ liệu múi giờ \"{muiGioMoi}\" bị hỏng trên máy này. Ví dụ đúng: Asia/Ho_Chi_Minh"];
            }
        }

        if (yeuCau.NhacTruocBaoLauPhut is { } nhacTruoc && (nhacTruoc < 0 || nhacTruoc > 1440))
        {
            loi[nameof(yeuCau.NhacTruocBaoLauPhut)] = ["Số phút nhắc trước phải trong khoảng 0 đến 1440"];
        }

        if (yeuCau.NguongCanhBaoSoHocSinh is { } nguong && nguong < 1)
        {
            loi[nameof(yeuCau.NguongCanhBaoSoHocSinh)] = ["Ngưỡng cảnh báo phải từ 1 trở lên"];
        }

        if (loi.Count > 0)
        {
            throw LoiApiException.DuLieuSai("Cấu hình chưa hợp lệ.", loi);
        }

        // Cập nhật từng ô được gửi lên; ô không gửi thì giữ nguyên giá trị đang dùng.
        // Tài khoản nhận tiền KHÔNG sửa ở đây: mỗi giáo viên tự khai tài khoản của mình ở
        // PUT /api/teachers/me/tai-khoan-nhan-tien.
        if (yeuCau.MauNoiDungChuyenKhoan is not null)
        {
            caiDat.MauNoiDungChuyenKhoan = ChuoiHoacNull(yeuCau.MauNoiDungChuyenKhoan);
        }

        if (yeuCau.MuiGio is { } muiGio && !string.IsNullOrWhiteSpace(muiGio))
        {
            caiDat.MuiGio = muiGio.Trim();
        }

        if (yeuCau.NhacTruocBaoLauPhut is { } nhac)
        {
            caiDat.NhacTruocBaoLauPhut = nhac;
        }

        if (yeuCau.TinhTienNghiKhongPhep is { } tinhTienNghi)
        {
            caiDat.TinhTienNghiKhongPhep = tinhTienNghi;
        }

        if (yeuCau.GioGuiThongBaoHomNay is { } gioGui)
        {
            caiDat.GioGuiThongBaoHomNay = gioGui;
        }

        if (yeuCau.BatThongBaoHomNay is { } batThongBao)
        {
            caiDat.BatThongBaoHomNay = batThongBao;
        }

        if (yeuCau.NguongCanhBaoSoHocSinh is { } nguongMoi)
        {
            caiDat.NguongCanhBaoSoHocSinh = nguongMoi;
        }

        if (yeuCau.KyTuTienTe is not null)
        {
            caiDat.KyTuTienTe = ChuoiHoacNull(yeuCau.KyTuTienTe) ?? "VND";
        }

        if (yeuCau.DinhDangNgay is not null)
        {
            caiDat.DinhDangNgay = ChuoiHoacNull(yeuCau.DinhDangNgay) ?? "dd/MM/yyyy";
        }

        caiDat.NgayCapNhatUtc = DateTime.UtcNow;

        db.NhatKy.Add(new NhatKy
        {
            NguoiThucHienId = admin.Id,
            HanhDong = "sua_cai_dat",
            DoiTuong = "CaiDat",
            DoiTuongId = CaiDat.IdDuyNhat.ToString(),
            DiaChiIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
            ThoiDiemUtc = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(huyBo);

        return Ok(TaoDto(caiDat, await ThongKeTaiKhoanNhanTienAsync(admin, huyBo)));
    }

    /// <summary>
    /// Số liệu tổng hợp về tài khoản nhận tiền của giáo viên, để admin biết còn ai chưa khai.
    /// Chỉ admin nhận được, và chỉ là con số kèm tên — không có số tài khoản của ai.
    /// </summary>
    private async Task<ThongKeTaiKhoanNhanTien> ThongKeTaiKhoanNhanTienAsync(
        GiaoVien nguoiHoi,
        CancellationToken huyBo)
    {
        if (nguoiHoi.VaiTro != VaiTro.Admin)
        {
            return new ThongKeTaiKhoanNhanTien(null, null, null);
        }

        var danhSach = await db.GiaoVien
            .AsNoTracking()
            .Where(x => x.TrangThai == TrangThaiGiaoVien.DangLam)
            .Select(x => new { x.HoTen, DaKhai = x.NganHangBin != null && x.SoTaiKhoan != null })
            .ToListAsync(huyBo);

        var tenChuaKhai = danhSach
            .Where(x => !x.DaKhai)
            .Select(x => x.HoTen)
            .OrderBy(x => x, StringComparer.CurrentCulture)
            .ToList();

        return new ThongKeTaiKhoanNhanTien(danhSach.Count - tenChuaKhai.Count, tenChuaKhai.Count, tenChuaKhai);
    }

    private sealed record ThongKeTaiKhoanNhanTien(
        int? DaKhai,
        int? ChuaKhai,
        IReadOnlyList<string>? TenChuaKhai);

    /* ------------------------------------------------------------------ */

    private async Task<CaiDat> LayCaiDatAsync(CancellationToken huyBo)
    {
        return await db.CaiDat.FirstOrDefaultAsync(x => x.Id == CaiDat.IdDuyNhat, huyBo)
            ?? throw new LoiApiException(
                "Chưa có dòng cấu hình",
                StatusCodes.Status500InternalServerError,
                "Bảng CaiDat chưa có dòng dữ liệu. Khởi động lại API để seed lại.");
    }

    private static CaiDatDto TaoDto(CaiDat caiDat, ThongKeTaiKhoanNhanTien thongKe)
    {
        return new CaiDatDto
        {
            MauNoiDungChuyenKhoan = caiDat.MauNoiDungChuyenKhoan,
            VaiTroMacDinh = caiDat.VaiTroMacDinh,
            NguongCanhBaoSoHocSinh = caiDat.NguongCanhBaoSoHocSinh,
            TinhTienNghiKhongPhep = caiDat.TinhTienNghiKhongPhep,
            MuiGio = caiDat.MuiGio,
            NhacTruocBaoLauPhut = caiDat.NhacTruocBaoLauPhut,
            GioGuiThongBaoHomNay = caiDat.GioGuiThongBaoHomNay,
            BatThongBaoHomNay = caiDat.BatThongBaoHomNay,
            KyTuTienTe = caiDat.KyTuTienTe,
            DinhDangNgay = caiDat.DinhDangNgay,
            SoGiaoVienDaKhaiTaiKhoanNhanTien = thongKe.DaKhai,
            SoGiaoVienChuaKhaiTaiKhoanNhanTien = thongKe.ChuaKhai,
            TenGiaoVienChuaKhaiTaiKhoanNhanTien = thongKe.TenChuaKhai,
            NgayCapNhatUtc = caiDat.NgayCapNhatUtc,
        };
    }

    private static string? ChuoiHoacNull(string? chuoi)
    {
        return string.IsNullOrWhiteSpace(chuoi) ? null : chuoi.Trim();
    }
}
