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
/// Điểm danh từng buổi: đi học hay nghỉ, kèm ghi chú.
///
/// Hai quy tắc không được phá:
/// 1. Buổi mới luôn ở trạng thái CHƯA điểm danh — bỏ trống không đồng nghĩa với nghỉ, vì coi bỏ
///    trống là nghỉ thì học phí sẽ tính sai.
/// 2. Sửa lại một buổi đã điểm danh thì phải vào nhật ký: sửa buổi nào, từ trạng thái nào sang
///    trạng thái nào, ai sửa, lúc nào.
/// </summary>
[ApiController]
[Route("api/attendance")]
[Authorize]
public class AttendanceController(
    AppDbContext db,
    NguoiDungHienTai nguoiDungHienTai,
    DichVuLichDay dichVuLichDay,
    DichVuNhatKy nhatKy) : ControllerBase
{
    /// <summary>
    /// Danh sách buổi học trong một khoảng ngày (mặc định là tuần hiện tại, thứ hai đến chủ nhật).
    /// Mở tuần nào thì hệ thống sinh bù các buổi của tuần đó từ lịch học lặp hằng tuần.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<DanhSachBuoiHocDto>> DanhSach(
        [FromQuery] DateOnly? tuNgay,
        [FromQuery] DateOnly? denNgay,
        [FromQuery] Guid? hocSinhId,
        [FromQuery] Guid? giaoVienId,
        [FromQuery] string? trangThai,
        CancellationToken huyBo = default)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        var (tu, den) = ChuanHoaKhoangNgay(tuNgay, denNgay);

        await dichVuLichDay.BaoDamBuoiChoKhoangAsync(toi, giaoVienId, hocSinhId, tu, den, huyBo);

        var duLieu = await DichVuLichDay.LayDtoAsync(
            dichVuLichDay.TruyVan(toi, giaoVienId, hocSinhId, tu, den), huyBo);

        // Tổng hợp luôn tính trên toàn bộ khoảng đang xem, không phụ thuộc bộ lọc trạng thái —
        // lọc để nhìn, còn con số cuối tuần phải là con số thật.
        var tongHopTheoHocSinh = DichVuLichDay.TongHopTheoHocSinh(duLieu);
        var tongHopTheoGiaoVien = DichVuLichDay.TongHopTheoGiaoVien(duLieu);

        if (!string.IsNullOrWhiteSpace(trangThai) && ThuTrangThai(trangThai) is { } loc)
        {
            duLieu = duLieu.Where(x => x.TrangThai == loc).ToList();
        }

        return Ok(new DanhSachBuoiHocDto
        {
            TuNgay = tu,
            DenNgay = den,
            DuLieu = duLieu,
            TongHopTheoHocSinh = tongHopTheoHocSinh,
            TongHopTheoGiaoVien = tongHopTheoGiaoVien,
        });
    }

    /// <summary>
    /// Lưu điểm danh theo lô — bấm Lưu một lần cho cả tuần thay vì mỗi buổi một request.
    /// </summary>
    [HttpPost("luu-hang-loat")]
    public async Task<ActionResult<KetQuaLuuDiemDanhDto>> LuuHangLoat(
        LuuDiemDanhRequest yeuCau,
        CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        var danhSachId = yeuCau.DuLieu.Select(x => x.BuoiHocId).Distinct().ToList();

        var truyVan = db.BuoiHoc
            .Include(x => x.DiemDanh)
            .Include(x => x.HocSinh)
            .Where(x => danhSachId.Contains(x.Id));

        if (toi.VaiTro != VaiTro.Admin)
        {
            // Giáo viên chỉ điểm danh được buổi của mình.
            truyVan = truyVan.Where(x => x.GiaoVienId == toi.Id);
        }

        var buoiHoc = await truyVan.ToListAsync(huyBo);

        if (buoiHoc.Count != danhSachId.Count)
        {
            throw LoiApiException.NgoaiPhamVi("buổi học");
        }

        var bayGio = DateTime.UtcNow;
        var soGhiNhatKy = 0;

        foreach (var item in yeuCau.DuLieu)
        {
            var buoi = buoiHoc.First(x => x.Id == item.BuoiHocId);
            var diemDanh = buoi.DiemDanh;

            if (diemDanh is null)
            {
                // PHẢI thêm qua DbSet, KHÔNG chỉ gán vào navigation của buổi học: buổi học đang được
                // theo dõi nên EF thấy Id của dòng điểm danh đã có giá trị (Guid sinh sẵn ở property
                // initializer) và coi đó là dòng "đã tồn tại" — nó phát ra UPDATE cho một dòng chưa hề
                // có trong database, rồi ném DbUpdateConcurrencyException và trả về 500 cho người dùng
                // (xem mục "Bài học khi viết code với EF Core" trong README backend).
                diemDanh = new DiemDanh { BuoiHocId = buoi.Id, NgayCapNhatUtc = bayGio };
                db.DiemDanh.Add(diemDanh);
                buoi.DiemDanh = diemDanh;
            }

            var daDiemDanhTruocDo = diemDanh.TrangThai != TrangThaiDiemDanh.ChuaDiemDanh;
            var truoc = DichVuNhatKy.Json(new
            {
                trangThai = diemDanh.TrangThai,
                lyDoNghi = diemDanh.LyDoNghi,
                ghiChu = diemDanh.GhiChu,
                coTinhTien = diemDanh.CoTinhTien,
            });

            diemDanh.TrangThai = item.TrangThai;
            // Lý do nghỉ chỉ có nghĩa khi buổi đó là nghỉ; đổi sang đi học thì xoá đi.
            diemDanh.LyDoNghi = item.TrangThai == TrangThaiDiemDanh.Nghi ? item.LyDoNghi : null;
            diemDanh.GhiChu = ChuoiHoacNull(item.GhiChu);
            // Mặc định: đi học thì tính tiền, nghỉ thì không. Chỉ đặt tay khi dạy bù hoặc trừ buổi.
            diemDanh.CoTinhTien = item.CoTinhTien ?? item.TrangThai == TrangThaiDiemDanh.DiHoc;
            diemDanh.ThoiLuongThucTePhut = item.ThoiLuongThucTePhut;
            diemDanh.NguoiDiemDanhId = item.TrangThai == TrangThaiDiemDanh.ChuaDiemDanh ? null : toi.Id;
            diemDanh.ThoiDiemDiemDanhUtc = item.TrangThai == TrangThaiDiemDanh.ChuaDiemDanh ? null : bayGio;
            diemDanh.NgayCapNhatUtc = bayGio;

            if (!daDiemDanhTruocDo)
            {
                continue;
            }

            // Đã điểm danh rồi mà còn sửa: đây là thao tác đổi số liệu, phải để lại dấu vết.
            db.NhatKy.Add(new NhatKy
            {
                NguoiThucHienId = toi.Id,
                HanhDong = "sua_diem_danh",
                DoiTuong = "DiemDanh",
                DoiTuongId = buoi.Id.ToString(),
                DuLieuTruoc = truoc,
                DuLieuSau = DichVuNhatKy.Json(new
                {
                    trangThai = diemDanh.TrangThai,
                    lyDoNghi = diemDanh.LyDoNghi,
                    ghiChu = diemDanh.GhiChu,
                    coTinhTien = diemDanh.CoTinhTien,
                    hocSinh = buoi.HocSinh?.HoTen,
                    ngay = buoi.Ngay,
                }),
                ThoiDiemUtc = bayGio,
            });

            soGhiNhatKy++;
        }

        await db.SaveChangesAsync(huyBo);

        return Ok(new KetQuaLuuDiemDanhDto
        {
            SoBuoiDaLuu = yeuCau.DuLieu.Count,
            SoBuoiGhiNhatKy = soGhiNhatKy,
        });
    }

    /// <summary>
    /// Thêm một buổi dạy bù ngoài lịch lặp hằng tuần. Buổi này chỉ tính cho tháng hiện tại và
    /// không sinh thêm buổi hằng tuần nào.
    /// </summary>
    [HttpPost("buoi-day-bu")]
    public async Task<ActionResult<BuoiHocDto>> ThemBuoiDayBu(BuoiDayBuRequest yeuCau, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        var hocSinh = await db.HocSinh
            .Include(x => x.GiaoVien)
            .FirstOrDefaultAsync(x => x.Id == yeuCau.HocSinhId, huyBo);

        if (hocSinh is null || (toi.VaiTro != VaiTro.Admin && hocSinh.GiaoVienId != toi.Id))
        {
            throw LoiApiException.NgoaiPhamVi("học sinh");
        }

        var loi = new Dictionary<string, string[]>();
        if (yeuCau.GioKetThuc <= yeuCau.GioBatDau)
        {
            loi[nameof(yeuCau.GioKetThuc)] = ["Giờ kết thúc phải sau giờ bắt đầu"];
        }

        var trungGio = await db.BuoiHoc.AnyAsync(
            x => x.GiaoVienId == hocSinh.GiaoVienId
                && x.Ngay == yeuCau.Ngay
                && yeuCau.GioBatDau < x.GioKetThuc
                && x.GioBatDau < yeuCau.GioKetThuc,
            huyBo);

        if (trungGio)
        {
            loi[nameof(yeuCau.GioBatDau)] = ["Giáo viên đã có buổi khác trùng giờ trong ngày này"];
        }

        if (loi.Count > 0)
        {
            throw LoiApiException.DuLieuSai("Buổi dạy bù chưa hợp lệ.", loi);
        }

        var bayGio = DateTime.UtcNow;
        var buoi = new BuoiHoc
        {
            HocSinhId = hocSinh.Id,
            GiaoVienId = hocSinh.GiaoVienId,
            Ngay = yeuCau.Ngay,
            GioBatDau = yeuCau.GioBatDau,
            GioKetThuc = yeuCau.GioKetThuc,
            LaBuoiDayBu = true,
            NgayTaoUtc = bayGio,
            DiemDanh = new DiemDanh
            {
                TrangThai = TrangThaiDiemDanh.ChuaDiemDanh,
                GhiChu = ChuoiHoacNull(yeuCau.GhiChu),
                CoTinhTien = false,
                NgayCapNhatUtc = bayGio,
            },
        };

        db.BuoiHoc.Add(buoi);
        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            toi.Id,
            "them_buoi_day_bu",
            "BuoiHoc",
            buoi.Id.ToString(),
            null,
            DichVuNhatKy.Json(new { hocSinh = hocSinh.HoTen, buoi.Ngay, buoi.GioBatDau, buoi.GioKetThuc }),
            huyBo);

        buoi.HocSinh = hocSinh;
        return CreatedAtAction(nameof(DanhSach), new { tuNgay = buoi.Ngay, denNgay = buoi.Ngay }, DichVuLichDay.TaoDto(buoi));
    }

    /* ------------------------------------------------------------------ */

    private static (DateOnly Tu, DateOnly Den) ChuanHoaKhoangNgay(DateOnly? tuNgay, DateOnly? denNgay)
    {
        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);
        var tu = tuNgay ?? ThoiGian.DauTuan(homNay);
        var den = denNgay ?? (tuNgay is null ? ThoiGian.CuoiTuan(homNay) : tu.AddDays(6));

        if (den < tu)
        {
            throw LoiApiException.DuLieuSai(
                "Khoảng ngày không hợp lệ.",
                new Dictionary<string, string[]> { ["denNgay"] = ["Ngày kết thúc phải sau ngày bắt đầu"] });
        }

        if (den.DayNumber - tu.DayNumber > 62)
        {
            throw LoiApiException.DuLieuSai(
                "Xem tối đa 62 ngày một lần.",
                new Dictionary<string, string[]> { ["denNgay"] = ["Chọn khoảng ngắn hơn để xem"] });
        }

        return (tu, den);
    }

    private static TrangThaiDiemDanh? ThuTrangThai(string chuoi)
    {
        try
        {
            return EnumWire.FromWire<TrangThaiDiemDanh>(chuoi);
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    private static string? ChuoiHoacNull(string? chuoi)
    {
        return string.IsNullOrWhiteSpace(chuoi) ? null : chuoi.Trim();
    }
}
