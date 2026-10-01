using ClassManagement.Api.Auth;
using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ClassManagement.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Controllers;

/// <summary>
/// Quản lý giáo viên và tài khoản đăng nhập. Chỉ admin được thêm, sửa vai trò và khoá tài khoản;
/// giáo viên chỉ xem được hồ sơ của chính mình.
/// </summary>
[ApiController]
[Route("api/teachers")]
[Authorize]
public class TeachersController(
    AppDbContext db,
    UserManager<GiaoVien> quanLyNguoiDung,
    NguoiDungHienTai nguoiDungHienTai,
    DichVuNhatKy nhatKy,
    ILogger<TeachersController> ghiLog) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<KetQuaPhanTrang<GiaoVienDto>>> DanhSach(
        [FromQuery] string? tuKhoa,
        [FromQuery] string? vaiTro,
        [FromQuery] string? trangThai,
        [FromQuery] int trang = 1,
        [FromQuery] int kichThuoc = 20,
        CancellationToken huyBo = default)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        var truyVan = db.GiaoVien.AsNoTracking();

        if (toi.VaiTro != VaiTro.Admin)
        {
            // Giáo viên chỉ thấy chính mình, dù có truyền tham số lọc kiểu gì.
            truyVan = truyVan.Where(x => x.Id == toi.Id);
        }
        else if (!string.IsNullOrWhiteSpace(vaiTro) && ThuVaiTro(vaiTro) is { } vaiTroLoc)
        {
            truyVan = truyVan.Where(x => x.VaiTro == vaiTroLoc);
        }

        if (!string.IsNullOrWhiteSpace(trangThai) && ThuTrangThai(trangThai) is { } trangThaiLoc)
        {
            truyVan = truyVan.Where(x => x.TrangThai == trangThaiLoc);
        }

        if (!string.IsNullOrWhiteSpace(tuKhoa))
        {
            var tuKhoaChuan = tuKhoa.Trim();
            truyVan = truyVan.Where(x => EF.Functions.Like(x.HoTen, "%" + tuKhoaChuan + "%")
                || (x.Email != null && EF.Functions.Like(x.Email, "%" + tuKhoaChuan + "%")));
        }

        var (trangChuan, kichThuocChuan) = ChuanHoaPhanTrang(trang, kichThuoc);
        var tongSo = await truyVan.CountAsync(huyBo);

        // Đếm số học sinh phụ trách bằng truy vấn con để không kéo cả danh sách học sinh về.
        var duLieu = await truyVan
            .OrderBy(x => x.HoTen)
            .Skip((trangChuan - 1) * kichThuocChuan)
            .Take(kichThuocChuan)
            .Select(x => new GiaoVienDto
            {
                Id = x.Id,
                HoTen = x.HoTen,
                Email = x.Email ?? "",
                SoDienThoai = x.PhoneNumber,
                VaiTro = x.VaiTro,
                TrangThai = x.TrangThai,
                NgayThamGia = x.NgayThamGia,
                GhiChu = x.GhiChu,
                SoHocSinhDangPhuTrach = x.HocSinhPhuTrach.Count,
            })
            .ToListAsync(huyBo);

        await GanSoBuoiDayTrongThangAsync(duLieu, huyBo);

        return Ok(new KetQuaPhanTrang<GiaoVienDto>
        {
            DuLieu = duLieu,
            TongSo = tongSo,
            Trang = trangChuan,
            KichThuoc = kichThuocChuan,
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<GiaoVienDto>> ChiTiet(Guid id, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        if (toi.VaiTro != VaiTro.Admin && toi.Id != id)
        {
            // 404 chứ không 403: trả 403 là xác nhận tài khoản này có tồn tại.
            throw LoiApiException.NgoaiPhamVi("giáo viên");
        }

        var duLieu = await db.GiaoVien
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new GiaoVienDto
            {
                Id = x.Id,
                HoTen = x.HoTen,
                Email = x.Email ?? "",
                SoDienThoai = x.PhoneNumber,
                VaiTro = x.VaiTro,
                TrangThai = x.TrangThai,
                NgayThamGia = x.NgayThamGia,
                GhiChu = x.GhiChu,
                SoHocSinhDangPhuTrach = x.HocSinhPhuTrach.Count,
            })
            .FirstOrDefaultAsync(huyBo);

        if (duLieu is null)
        {
            throw LoiApiException.KhongTimThay("giáo viên");
        }

        await GanSoBuoiDayTrongThangAsync([duLieu], huyBo);
        return Ok(duLieu);
    }

    /// <summary>
    /// Admin tạo tài khoản giáo viên. Không có endpoint tự đăng ký: tài khoản admin đầu tiên sinh
    /// bằng seed lúc khởi động, còn lại do admin tạo.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<GiaoVienDto>> TaoMoi(TaoGiaoVienRequest yeuCau, CancellationToken huyBo)
    {
        await nguoiDungHienTai.YeuCauAdminAsync(huyBo);

        var email = yeuCau.Email.Trim();
        if (await quanLyNguoiDung.FindByEmailAsync(email) is not null)
        {
            throw LoiApiException.DuLieuSai(
                "Email này đã có tài khoản.",
                new Dictionary<string, string[]> { [nameof(yeuCau.Email)] = ["Email đã được dùng cho một giáo viên khác"] });
        }

        var caiDat = await db.CaiDat.AsNoTracking().FirstAsync(x => x.Id == CaiDat.IdDuyNhat, huyBo);

        var giaoVien = new GiaoVien
        {
            Id = Guid.NewGuid(),
            HoTen = yeuCau.HoTen.Trim(),
            Email = email,
            UserName = email,
            PhoneNumber = ChuoiHoacNull(yeuCau.SoDienThoai),
            // Không bao giờ mặc định thành admin: bỏ trống thì lấy vai trò mặc định trong Cài đặt.
            VaiTro = yeuCau.VaiTro ?? caiDat.VaiTroMacDinh,
            TrangThai = TrangThaiGiaoVien.DangLam,
            NgayThamGia = yeuCau.NgayThamGia ?? DateOnly.FromDateTime(DateTime.UtcNow),
            GhiChu = ChuoiHoacNull(yeuCau.GhiChu),
            EmailConfirmed = true,
            NgayTaoUtc = DateTime.UtcNow,
        };

        var ketQua = await quanLyNguoiDung.CreateAsync(giaoVien, yeuCau.MatKhauTamThoi);
        if (!ketQua.Succeeded)
        {
            throw LoiApiException.DuLieuSai(
                "Không tạo được tài khoản giáo viên.",
                ketQua.Errors
                    .GroupBy(_ => nameof(yeuCau.MatKhauTamThoi))
                    .ToDictionary(nhom => nhom.Key, nhom => nhom.Select(x => x.Description).ToArray()));
        }

        await nhatKy.GhiAsync(null, "tao_giao_vien", "GiaoVien", giaoVien.Id.ToString(), null, $"{giaoVien.HoTen} <{giaoVien.Email}>", huyBo);

        return CreatedAtAction(nameof(ChiTiet), new { id = giaoVien.Id }, new GiaoVienDto
        {
            Id = giaoVien.Id,
            HoTen = giaoVien.HoTen,
            Email = giaoVien.Email!,
            SoDienThoai = giaoVien.PhoneNumber,
            VaiTro = giaoVien.VaiTro,
            TrangThai = giaoVien.TrangThai,
            NgayThamGia = giaoVien.NgayThamGia,
            GhiChu = giaoVien.GhiChu,
            SoHocSinhDangPhuTrach = 0,
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<GiaoVienDto>> Sua(Guid id, SuaGiaoVienRequest yeuCau, CancellationToken huyBo)
    {
        var admin = await nguoiDungHienTai.YeuCauAdminAsync(huyBo);

        var giaoVien = await db.GiaoVien.FirstOrDefaultAsync(x => x.Id == id, huyBo)
            ?? throw LoiApiException.KhongTimThay("giáo viên");

        var vaiTroCu = giaoVien.VaiTro;
        var trangThaiCu = giaoVien.TrangThai;

        // Không để admin tự hạ quyền hoặc tự khoá mình khi không còn admin nào khác —
        // mất hết admin là không ai còn quyền quản lý tài khoản nữa.
        var dangTuHuyQuyen = admin.Id == giaoVien.Id
            && (yeuCau.VaiTro != VaiTro.Admin || yeuCau.TrangThai != TrangThaiGiaoVien.DangLam);

        if (dangTuHuyQuyen && !await ConAdminKhacAsync(admin.Id, huyBo))
        {
            throw LoiApiException.DuLieuSai(
                "Không thể tự hạ quyền admin cuối cùng",
                new Dictionary<string, string[]>
                {
                    [nameof(yeuCau.VaiTro)] = ["Phải còn ít nhất một admin đang làm việc. Tạo admin khác trước rồi hãy đổi."],
                });
        }

        giaoVien.HoTen = yeuCau.HoTen.Trim();
        giaoVien.PhoneNumber = ChuoiHoacNull(yeuCau.SoDienThoai);
        giaoVien.VaiTro = yeuCau.VaiTro;
        giaoVien.TrangThai = yeuCau.TrangThai;
        giaoVien.GhiChu = ChuoiHoacNull(yeuCau.GhiChu);
        if (yeuCau.NgayThamGia is { } ngayThamGia)
        {
            giaoVien.NgayThamGia = ngayThamGia;
        }

        // Nghỉ việc thì khoá đăng nhập, không xoá hồ sơ để còn tra cứu lịch sử dạy và học phí.
        if (giaoVien.TrangThai != TrangThaiGiaoVien.DangLam)
        {
            await KhoaDangNhapAsync(giaoVien);
        }
        else if (trangThaiCu != TrangThaiGiaoVien.DangLam)
        {
            await MoKhoaDangNhapAsync(giaoVien);
        }

        await db.SaveChangesAsync(huyBo);

        if (trangThaiCu != giaoVien.TrangThai)
        {
            ghiLog.LogInformation(
                "Admin {AdminId} đổi trạng thái giáo viên {GiaoVienId} từ {TrangThaiCu} sang {TrangThaiMoi}",
                admin.Id, giaoVien.Id, EnumWire.ToWire(trangThaiCu), EnumWire.ToWire(giaoVien.TrangThai));
        }

        if (vaiTroCu != giaoVien.VaiTro)
        {
            ghiLog.LogInformation(
                "Admin {AdminId} đổi vai trò giáo viên {GiaoVienId} từ {VaiTroCu} sang {VaiTroMoi}",
                admin.Id, giaoVien.Id, EnumWire.ToWire(vaiTroCu), EnumWire.ToWire(giaoVien.VaiTro));

            // Đổi vai trò là đổi phạm vi nhìn thấy dữ liệu, bắt buộc vào nhật ký.
            await nhatKy.GhiAsync(
                admin.Id, "doi_vai_tro", "GiaoVien", giaoVien.Id.ToString(),
                DichVuNhatKy.Json(new { vaiTro = vaiTroCu, trangThai = trangThaiCu }),
                DichVuNhatKy.Json(new { vaiTro = giaoVien.VaiTro, trangThai = giaoVien.TrangThai }),
                huyBo);
        }

        var soBuoiTrongThang = await DemSoBuoiDayTrongThangAsync([giaoVien.Id], huyBo);

        return Ok(new GiaoVienDto
        {
            Id = giaoVien.Id,
            HoTen = giaoVien.HoTen,
            Email = giaoVien.Email ?? "",
            SoDienThoai = giaoVien.PhoneNumber,
            VaiTro = giaoVien.VaiTro,
            TrangThai = giaoVien.TrangThai,
            NgayThamGia = giaoVien.NgayThamGia,
            GhiChu = giaoVien.GhiChu,
            SoHocSinhDangPhuTrach = await db.HocSinh.CountAsync(x => x.GiaoVienId == giaoVien.Id, huyBo),
            SoBuoiDayTrongThang = soBuoiTrongThang.GetValueOrDefault(giaoVien.Id),
        });
    }

    /// <summary>Đếm buổi đã dạy trong tháng hiện tại cho một nhóm giáo viên.</summary>
    private async Task<Dictionary<Guid, int>> DemSoBuoiDayTrongThangAsync(
        IReadOnlyList<Guid> danhSachId,
        CancellationToken huyBo)
    {
        if (danhSachId.Count == 0)
        {
            return [];
        }

        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);
        var dauThang = new DateOnly(homNay.Year, homNay.Month, 1);
        var cuoiThang = dauThang.AddMonths(1).AddDays(-1);

        return await db.BuoiHoc
            .AsNoTracking()
            .Where(x => danhSachId.Contains(x.GiaoVienId)
                && x.Ngay >= dauThang
                && x.Ngay <= cuoiThang
                && x.DiemDanh != null
                && x.DiemDanh.TrangThai == TrangThaiDiemDanh.DiHoc)
            .GroupBy(x => x.GiaoVienId)
            .Select(nhom => new { GiaoVienId = nhom.Key, SoBuoi = nhom.Count() })
            .ToDictionaryAsync(x => x.GiaoVienId, x => x.SoBuoi, huyBo);
    }

    private async Task GanSoBuoiDayTrongThangAsync(
        IReadOnlyCollection<GiaoVienDto> danhSach,
        CancellationToken huyBo)
    {
        if (danhSach.Count == 0)
        {
            return;
        }

        var banDo = await DemSoBuoiDayTrongThangAsync(danhSach.Select(x => x.Id).ToList(), huyBo);

        foreach (var dong in danhSach)
        {
            dong.SoBuoiDayTrongThang = banDo.GetValueOrDefault(dong.Id);
        }
    }

    /// <summary>
    /// Giáo viên tự khai tài khoản nhận tiền của mình, dùng để sinh mã QR thu học phí cho học sinh
    /// mình dạy.
    ///
    /// Cố tình chỉ có endpoint "me": không ai khai hộ ai, admin cũng không. Tiền học phí chảy về
    /// tài khoản của người dạy, nên người dạy phải là người nhập, và số tài khoản của giáo viên
    /// không hiện ở bất kỳ màn hình nào khác — admin chỉ thấy số lượng đã khai.
    /// </summary>
    [HttpPut("me/tai-khoan-nhan-tien")]
    public async Task<ActionResult<TaiKhoanNhanTienDto>> CapNhatTaiKhoanNhanTien(
        TaiKhoanNhanTienRequest yeuCau,
        CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        var bin = ChuoiHoacNull(yeuCau.NganHangBin);
        var soTaiKhoan = ChuoiHoacNull(yeuCau.SoTaiKhoan);

        var loi = new Dictionary<string, string[]>();

        if (bin is not null && (bin.Length != 6 || !bin.All(char.IsAsciiDigit)))
        {
            loi[nameof(yeuCau.NganHangBin)] = ["Mã BIN ngân hàng gồm đúng 6 chữ số, ví dụ 970436"];
        }

        if (bin is not null && soTaiKhoan is null)
        {
            loi[nameof(yeuCau.SoTaiKhoan)] = ["Đã chọn ngân hàng thì phải nhập số tài khoản nhận tiền"];
        }

        if (soTaiKhoan is not null && bin is null)
        {
            loi[nameof(yeuCau.NganHangBin)] = ["Đã nhập số tài khoản thì phải chọn ngân hàng nhận tiền"];
        }

        if (loi.Count > 0)
        {
            throw LoiApiException.DuLieuSai("Tài khoản nhận tiền chưa hợp lệ.", loi);
        }

        toi.NganHangBin = bin;
        toi.SoTaiKhoan = soTaiKhoan;
        // Bỏ trống cả ngân hàng và số tài khoản nghĩa là gỡ tài khoản đã khai.
        toi.ChuTaiKhoan = bin is null && soTaiKhoan is null ? null : ChuoiHoacNull(yeuCau.ChuTaiKhoan);

        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            toi.Id, "sua_tai_khoan_nhan_tien", "GiaoVien", toi.Id.ToString(), null, null, huyBo);

        return Ok(TaiKhoanNhanTienDto.Tu(toi));
    }

    /// <summary>Admin đặt lại mật khẩu. Giáo viên nên đổi lại bằng chức năng đổi mật khẩu của mình.</summary>
    [HttpPost("{id:guid}/dat-lai-mat-khau")]
    public async Task<IActionResult> DatLaiMatKhau(Guid id, DatLaiMatKhauRequest yeuCau, CancellationToken huyBo)
    {
        var admin = await nguoiDungHienTai.YeuCauAdminAsync(huyBo);

        var giaoVien = await db.GiaoVien.FirstOrDefaultAsync(x => x.Id == id, huyBo)
            ?? throw LoiApiException.KhongTimThay("giáo viên");

        var maDatLai = await quanLyNguoiDung.GeneratePasswordResetTokenAsync(giaoVien);
        var ketQua = await quanLyNguoiDung.ResetPasswordAsync(giaoVien, maDatLai, yeuCau.MatKhauMoi);
        if (!ketQua.Succeeded)
        {
            throw LoiApiException.DuLieuSai(
                "Không đặt lại được mật khẩu.",
                ketQua.Errors
                    .GroupBy(_ => nameof(yeuCau.MatKhauMoi))
                    .ToDictionary(nhom => nhom.Key, nhom => nhom.Select(x => x.Description).ToArray()));
        }

        await MoKhoaDangNhapAsync(giaoVien);
        await db.SaveChangesAsync(huyBo);
        await nhatKy.GhiAsync(admin.Id, "dat_lai_mat_khau", "GiaoVien", giaoVien.Id.ToString(), null, null, huyBo);

        return NoContent();
    }

    /* ------------------------------------------------------------------ */

    private async Task<bool> ConAdminKhacAsync(Guid truTruongHopNay, CancellationToken huyBo)
    {
        return await db.GiaoVien.AnyAsync(
            x => x.Id != truTruongHopNay && x.VaiTro == VaiTro.Admin && x.TrangThai == TrangThaiGiaoVien.DangLam,
            huyBo);
    }

    private async Task KhoaDangNhapAsync(GiaoVien giaoVien)
    {
        // Khoá tới năm 9999 = khoá vĩnh viễn cho tới khi admin mở lại.
        await quanLyNguoiDung.SetLockoutEndDateAsync(giaoVien, DateTimeOffset.MaxValue);
        giaoVien.LockoutEnabled = true;

        // Thu hồi mọi phiên đang mở: đang đăng nhập cũng bị đẩy ra ngay, không đợi token hết hạn.
        await db.PhienDangNhap
            .Where(x => x.GiaoVienId == giaoVien.Id && x.NgayThuHoiUtc == null)
            .ExecuteUpdateAsync(capNhat => capNhat.SetProperty(x => x.NgayThuHoiUtc, DateTime.UtcNow));
    }

    private async Task MoKhoaDangNhapAsync(GiaoVien giaoVien)
    {
        await quanLyNguoiDung.SetLockoutEndDateAsync(giaoVien, null);
        await quanLyNguoiDung.ResetAccessFailedCountAsync(giaoVien);
    }

    private static string? ChuoiHoacNull(string? chuoi)
    {
        return string.IsNullOrWhiteSpace(chuoi) ? null : chuoi.Trim();
    }

    private static VaiTro? ThuVaiTro(string chuoi)
    {
        try
        {
            return EnumWire.FromWire<VaiTro>(chuoi);
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    private static TrangThaiGiaoVien? ThuTrangThai(string chuoi)
    {
        try
        {
            return EnumWire.FromWire<TrangThaiGiaoVien>(chuoi);
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    internal static (int Trang, int KichThuoc) ChuanHoaPhanTrang(int trang, int kichThuoc)
    {
        var trangChuan = trang < 1 ? 1 : trang;
        var kichThuocChuan = kichThuoc switch
        {
            < 1 => 20,
            > 200 => 200,
            _ => kichThuoc,
        };

        return (trangChuan, kichThuocChuan);
    }
}
