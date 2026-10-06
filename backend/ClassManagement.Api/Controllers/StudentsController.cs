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
/// Học sinh: nhập liệu, sửa, cho nghỉ.
///
/// Nguyên tắc bắt buộc: giáo viên chỉ thấy và chỉ sửa học sinh có giaoVienId là mình; giáo viên
/// thêm học sinh thì mặc định gán cho chính mình và không đổi được sang người khác. Việc ẩn nút ở
/// frontend chỉ để gọn mắt — gọi thẳng API vẫn phải bị chặn ở đây.
/// </summary>
[ApiController]
[Route("api/students")]
[Authorize]
public class StudentsController(
    AppDbContext db,
    NguoiDungHienTai nguoiDungHienTai,
    DichVuHocSinh dichVuHocSinh,
    DichVuNhatKy nhatKy) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<KetQuaPhanTrang<HocSinhDto>>> DanhSach(
        [FromQuery] string? tuKhoa,
        [FromQuery] Guid? giaoVienId,
        [FromQuery] string? trangThai,
        [FromQuery] int trang = 1,
        [FromQuery] int kichThuoc = 20,
        CancellationToken huyBo = default)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        var truyVan = db.HocSinh.AsNoTracking();

        if (toi.VaiTro != VaiTro.Admin)
        {
            truyVan = truyVan.Where(x => x.GiaoVienId == toi.Id);
        }
        else if (giaoVienId is { } giaoVienLoc)
        {
            truyVan = truyVan.Where(x => x.GiaoVienId == giaoVienLoc);
        }

        if (!string.IsNullOrWhiteSpace(trangThai) && ThuTrangThai(trangThai) is { } trangThaiLoc)
        {
            truyVan = truyVan.Where(x => x.TrangThai == trangThaiLoc);
        }

        if (!string.IsNullOrWhiteSpace(tuKhoa))
        {
            var tuKhoaChuan = tuKhoa.Trim();
            truyVan = truyVan.Where(x => EF.Functions.ILike(x.HoTen, "%" + tuKhoaChuan + "%"));
        }

        var (trangChuan, kichThuocChuan) = TeachersController.ChuanHoaPhanTrang(trang, kichThuoc);
        var tongSo = await truyVan.CountAsync(huyBo);

        // Lấy thực thể rồi mới sắp xếp lịch học: cột "thu" lưu dạng chuỗi nên sắp xếp trong SQL
        // sẽ ra thứ tự chữ cái (chủ nhật đứng trước thứ hai), không phải thứ tự trong tuần.
        var thucThe = await truyVan
            .Include(x => x.GiaoVien)
            .Include(x => x.LichHoc)
            .OrderBy(x => x.HoTen)
            .Skip((trangChuan - 1) * kichThuocChuan)
            .Take(kichThuocChuan)
            .ToListAsync(huyBo);

        return Ok(new KetQuaPhanTrang<HocSinhDto>
        {
            DuLieu = thucThe.Select(DichVuHocSinh.TaoDto).ToList(),
            TongSo = tongSo,
            Trang = trangChuan,
            KichThuoc = kichThuocChuan,
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<HocSinhDto>> ChiTiet(Guid id, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        var hocSinh = await LayTrongPhamViAsync(toi, id, huyBo);

        // Học sinh của giáo viên khác trả về 404 giống như không tồn tại.
        return hocSinh is null ? throw LoiApiException.NgoaiPhamVi("học sinh") : Ok(DichVuHocSinh.TaoDto(hocSinh));
    }

    /// <summary>
    /// Thêm học sinh. Trùng tên chỉ là cảnh báo: lần gửi đầu trả 409 kèm tên đã có, người dùng xác
    /// nhận thì gửi lại với <c>boQuaCanhBaoTrungTen</c>.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<HocSinhDto>> TaoMoi(TaoHocSinhRequest yeuCau, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        if (toi.VaiTro != VaiTro.Admin && yeuCau.GiaoVienId is { } giaoVienKhac && giaoVienKhac != toi.Id)
        {
            throw LoiApiException.KhongDuocPhep(
                "Giáo viên chỉ được thêm học sinh cho chính mình; admin mới gán được cho người khác.");
        }

        var giaoVienId = toi.VaiTro == VaiTro.Admin ? yeuCau.GiaoVienId ?? toi.Id : toi.Id;

        if (!yeuCau.BoQuaCanhBaoTrungTen)
        {
            var ten = yeuCau.HoTen.Trim();
            var trungTen = await db.HocSinh
                .AsNoTracking()
                .Where(x => x.GiaoVienId == giaoVienId
                    && x.HoTen == ten
                    && x.TrangThai != TrangThaiHocSinh.DaNghi)
                .Select(x => x.HoTen)
                .ToListAsync(huyBo);

            if (trungTen.Count > 0)
            {
                throw new LoiApiException(
                    "Đã có học sinh trùng tên",
                    StatusCodes.Status409Conflict,
                    "Trùng tên không bị chặn cứng vì học sinh thật có thể trùng tên. Xác nhận nếu đúng là hai em khác nhau.",
                    new Dictionary<string, string[]>
                    {
                        [nameof(TaoHocSinhRequest.HoTen)] =
                            ["Giáo viên này đã có học sinh tên \"" + ten + "\""],
                    });
            }
        }

        var loi = await dichVuHocSinh.KiemTraDuLieuAsync(
            yeuCau.HoTen,
            yeuCau.CachTinhHocPhi,
            yeuCau.DonGiaTheoBuoi,
            yeuCau.HocPhiTheoThang,
            yeuCau.SoBuoiMoiTuan,
            yeuCau.LichHoc,
            yeuCau.NgayBatDau,
            giaoVienId,
            null,
            huyBo);

        if (loi.Count > 0)
        {
            throw LoiApiException.DuLieuSai("Dữ liệu học sinh chưa hợp lệ.", loi);
        }

        var hocSinh = await dichVuHocSinh.TaoAsync(yeuCau, giaoVienId, huyBo);

        await nhatKy.GhiAsync(
            toi.Id,
            "tao_hoc_sinh",
            "HocSinh",
            hocSinh.Id.ToString(),
            null,
            DichVuNhatKy.Json(new { hocSinh.HoTen, giaoVienId, hocSinh.SoBuoiMoiTuan, hocSinh.NgayBatDau }),
            huyBo);

        var dayDu = await LayTrongPhamViAsync(toi, hocSinh.Id, huyBo);
        return CreatedAtAction(nameof(ChiTiet), new { id = hocSinh.Id }, DichVuHocSinh.TaoDto(dayDu!));
    }

    /// <summary>
    /// Sửa học sinh. Sửa lịch học thì các buổi CHƯA điểm danh từ hôm nay được sinh lại theo lịch mới;
    /// buổi đã điểm danh giữ nguyên để lịch sử dạy và học phí không bị viết lại.
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<HocSinhDto>> Sua(Guid id, SuaHocSinhRequest yeuCau, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        var hocSinh = await db.HocSinh
            .Include(x => x.LichHoc)
            .FirstOrDefaultAsync(x => x.Id == id, huyBo);

        if (hocSinh is null || (toi.VaiTro != VaiTro.Admin && hocSinh.GiaoVienId != toi.Id))
        {
            throw LoiApiException.NgoaiPhamVi("học sinh");
        }

        // Chỉ admin đổi được giáo viên phụ trách; giáo viên gửi lên cũng bị bỏ qua.
        var giaoVienMoiId = toi.VaiTro == VaiTro.Admin ? yeuCau.GiaoVienId : null;
        var giaoVienKiemTra = giaoVienMoiId ?? hocSinh.GiaoVienId;

        var loi = await dichVuHocSinh.KiemTraDuLieuAsync(
            yeuCau.HoTen,
            yeuCau.CachTinhHocPhi,
            yeuCau.DonGiaTheoBuoi,
            yeuCau.HocPhiTheoThang,
            yeuCau.SoBuoiMoiTuan,
            yeuCau.LichHoc,
            yeuCau.NgayBatDau,
            giaoVienKiemTra,
            hocSinh.Id,
            huyBo);

        if (loi.Count > 0)
        {
            throw LoiApiException.DuLieuSai("Dữ liệu học sinh chưa hợp lệ.", loi);
        }

        var ketQua = await dichVuHocSinh.CapNhatAsync(hocSinh, yeuCau, giaoVienMoiId, huyBo);

        await nhatKy.GhiAsync(
            toi.Id,
            "sua_hoc_sinh",
            "HocSinh",
            hocSinh.Id.ToString(),
            null,
            DichVuNhatKy.Json(new
            {
                hocSinh.HoTen,
                doiLichHoc = ketQua.DoiLichHoc,
                soBuoiXoa = ketQua.SoBuoiXoa,
                soBuoiSinh = ketQua.SoBuoiSinh,
                soBuoiDoiGiaoVien = ketQua.SoBuoiDoiGiaoVien,
            }),
            huyBo);

        var dayDu = await LayTrongPhamViAsync(toi, hocSinh.Id, huyBo);
        return Ok(DichVuHocSinh.TaoDto(dayDu!));
    }

    /// <summary>
    /// Cho học sinh nghỉ: đổi trạng thái thành đã nghỉ và bỏ các buổi CHƯA dạy từ hôm nay.
    /// KHÔNG xoá hồ sơ: xoá là mất luôn lịch sử điểm danh và học phí đã ghi.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> ChoNghi(Guid id, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        var hocSinh = await db.HocSinh.FirstOrDefaultAsync(x => x.Id == id, huyBo);

        if (hocSinh is null || (toi.VaiTro != VaiTro.Admin && hocSinh.GiaoVienId != toi.Id))
        {
            throw LoiApiException.NgoaiPhamVi("học sinh");
        }

        var trangThaiCu = hocSinh.TrangThai;
        var soBuoiXoa = await dichVuHocSinh.ChoNghiAsync(hocSinh, huyBo);

        await nhatKy.GhiAsync(
            toi.Id,
            "cho_hoc_sinh_nghi",
            "HocSinh",
            hocSinh.Id.ToString(),
            DichVuNhatKy.Json(new { trangThai = trangThaiCu }),
            DichVuNhatKy.Json(new { trangThai = TrangThaiHocSinh.DaNghi, soBuoiXoa }),
            huyBo);

        return NoContent();
    }

    /* ------------------------------------------------------------------ */

    private async Task<HocSinh?> LayTrongPhamViAsync(GiaoVien toi, Guid id, CancellationToken huyBo)
    {
        var truyVan = db.HocSinh
            .AsNoTracking()
            .Include(x => x.GiaoVien)
            .Include(x => x.LichHoc)
            .Where(x => x.Id == id);

        if (toi.VaiTro != VaiTro.Admin)
        {
            truyVan = truyVan.Where(x => x.GiaoVienId == toi.Id);
        }

        return await truyVan.FirstOrDefaultAsync(huyBo);
    }

    private static TrangThaiHocSinh? ThuTrangThai(string chuoi)
    {
        try
        {
            return EnumWire.FromWire<TrangThaiHocSinh>(chuoi);
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }
}
