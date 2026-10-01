using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Services;

/// <summary>
/// Truy vấn lịch dạy dùng chung cho màn hình Điểm danh và Tổng quan.
///
/// Điểm quan trọng: phạm vi dữ liệu được áp ở đây, một chỗ duy nhất. Giáo viên luôn bị giới hạn
/// theo <c>GiaoVienId</c> của chính mình, kể cả khi họ tự truyền tham số lọc của người khác.
/// </summary>
public class DichVuLichDay(AppDbContext db, DichVuBuoiHoc dichVuBuoiHoc)
{
    /// <summary>
    /// Sinh bù các buổi học còn thiếu trong khoảng ngày trước khi đọc.
    ///
    /// Buổi học suy ra từ lịch hằng tuần, mà lịch thì lặp vô hạn — nên khi người dùng mở một tuần,
    /// hệ thống tự vật chất hoá các buổi của tuần đó. Thao tác này lặp lại được nên mở lại bao nhiêu
    /// lần cũng không sinh thêm bản ghi; chỉ tuần hiện tại hoặc tương lai mới sinh, tuần đã qua
    /// không được thêm buổi "mới" nữa.
    /// </summary>
    public async Task BaoDamBuoiChoKhoangAsync(
        GiaoVien toi,
        Guid? giaoVienId,
        Guid? hocSinhId,
        DateOnly tuNgay,
        DateOnly denNgay,
        CancellationToken huyBo = default)
    {
        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);
        if (denNgay < homNay)
        {
            return;
        }

        var truyVan = db.HocSinh
            .Include(x => x.LichHoc)
            .Where(x => x.TrangThai == TrangThaiHocSinh.DangHoc && x.NgayBatDau <= denNgay);

        if (toi.VaiTro != VaiTro.Admin)
        {
            truyVan = truyVan.Where(x => x.GiaoVienId == toi.Id);
        }
        else if (giaoVienId is { } loc)
        {
            truyVan = truyVan.Where(x => x.GiaoVienId == loc);
        }

        if (hocSinhId is { } hocSinhLoc)
        {
            truyVan = truyVan.Where(x => x.Id == hocSinhLoc);
        }

        var hocSinh = await truyVan.ToListAsync(huyBo);

        foreach (var hs in hocSinh)
        {
            await dichVuBuoiHoc.BaoDamBuoiHocAsync(hs, tuNgay, denNgay, huyBo);
        }
    }

    /// <summary>Truy vấn buổi học trong khoảng ngày, đã áp phạm vi dữ liệu của người gọi.</summary>
    public IQueryable<BuoiHoc> TruyVan(
        GiaoVien toi,
        Guid? giaoVienId,
        Guid? hocSinhId,
        DateOnly tuNgay,
        DateOnly denNgay)
    {
        var truyVan = db.BuoiHoc
            .AsNoTracking()
            .Where(x => x.Ngay >= tuNgay && x.Ngay <= denNgay);

        if (toi.VaiTro != VaiTro.Admin)
        {
            truyVan = truyVan.Where(x => x.GiaoVienId == toi.Id);
        }
        else if (giaoVienId is { } loc)
        {
            truyVan = truyVan.Where(x => x.GiaoVienId == loc);
        }

        if (hocSinhId is { } hocSinhLoc)
        {
            truyVan = truyVan.Where(x => x.HocSinhId == hocSinhLoc);
        }

        return truyVan;
    }

    public static async Task<List<BuoiHocDto>> LayDtoAsync(IQueryable<BuoiHoc> truyVan, CancellationToken huyBo = default)
    {
        // Lấy thực thể rồi mới đóng gói: cần tên học sinh, tên giáo viên và thông tin điểm danh.
        var thucThe = await truyVan
            .Include(x => x.HocSinh)
            .Include(x => x.GiaoVien)
            .Include(x => x.DiemDanh)
            .ThenInclude(x => x!.NguoiDiemDanh)
            .OrderBy(x => x.Ngay)
            .ThenBy(x => x.GioBatDau)
            .ThenBy(x => x.HocSinh!.HoTen)
            .ToListAsync(huyBo);

        return thucThe.Select(TaoDto).ToList();
    }

    public static BuoiHocDto TaoDto(BuoiHoc buoiHoc)
    {
        return new BuoiHocDto
        {
            Id = buoiHoc.Id,
            HocSinhId = buoiHoc.HocSinhId,
            TenHocSinh = buoiHoc.HocSinh?.HoTen ?? "",
            LopHocSinh = buoiHoc.HocSinh?.Lop,
            GiaoVienId = buoiHoc.GiaoVienId,
            TenGiaoVien = buoiHoc.GiaoVien?.HoTen ?? "",
            Ngay = buoiHoc.Ngay,
            GioBatDau = buoiHoc.GioBatDau,
            GioKetThuc = buoiHoc.GioKetThuc,
            LaBuoiDayBu = buoiHoc.LaBuoiDayBu,
            TrangThai = buoiHoc.DiemDanh?.TrangThai ?? TrangThaiDiemDanh.ChuaDiemDanh,
            LyDoNghi = buoiHoc.DiemDanh?.LyDoNghi,
            GhiChu = buoiHoc.DiemDanh?.GhiChu,
            CoTinhTien = buoiHoc.DiemDanh?.CoTinhTien ?? false,
            ThoiLuongThucTePhut = buoiHoc.DiemDanh?.ThoiLuongThucTePhut,
            NguoiDiemDanh = buoiHoc.DiemDanh?.NguoiDiemDanh?.HoTen,
            ThoiDiemDiemDanhUtc = buoiHoc.DiemDanh?.ThoiDiemDiemDanhUtc,
            DaDongBoGoogle = buoiHoc.GoogleEventId is not null,
            GoogleDongBoUtc = buoiHoc.GoogleDongBoUtc,
        };
    }

    /// <summary>Đếm theo từng học sinh — cuối tuần nhìn vào là biết ai còn buổi chưa điểm danh.</summary>
    public static List<TongHopDiemDanhDto> TongHopTheoHocSinh(IEnumerable<BuoiHocDto> duLieu)
    {
        return duLieu
            .GroupBy(x => (x.HocSinhId, x.TenHocSinh))
            .Select(nhom => TaoTongHop(nhom.Key.HocSinhId, nhom.Key.TenHocSinh, nhom))
            .OrderBy(x => x.Ten)
            .ToList();
    }

    public static List<TongHopDiemDanhDto> TongHopTheoGiaoVien(IEnumerable<BuoiHocDto> duLieu)
    {
        return duLieu
            .GroupBy(x => (x.GiaoVienId, x.TenGiaoVien))
            .Select(nhom => TaoTongHop(nhom.Key.GiaoVienId, nhom.Key.TenGiaoVien, nhom))
            .OrderBy(x => x.Ten)
            .ToList();
    }

    private static TongHopDiemDanhDto TaoTongHop(Guid id, string ten, IEnumerable<BuoiHocDto> nhom)
    {
        var danhSach = nhom.ToList();

        return new TongHopDiemDanhDto
        {
            Id = id,
            Ten = ten,
            SoBuoi = danhSach.Count,
            SoDiHoc = danhSach.Count(x => x.TrangThai == TrangThaiDiemDanh.DiHoc),
            SoNghiCoPhep = danhSach.Count(x =>
                x.TrangThai == TrangThaiDiemDanh.Nghi && x.LyDoNghi == LyDoNghi.CoPhep),
            SoNghiKhongPhep = danhSach.Count(x =>
                x.TrangThai == TrangThaiDiemDanh.Nghi && x.LyDoNghi != LyDoNghi.CoPhep),
            SoChuaDiemDanh = danhSach.Count(x => x.TrangThai == TrangThaiDiemDanh.ChuaDiemDanh),
        };
    }
}
