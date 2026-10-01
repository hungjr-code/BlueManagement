using ClassManagement.Api.Common;
using ClassManagement.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Data;

/// <summary>
/// Tạo những thứ tối thiểu để hệ thống chạy được: dòng cấu hình chung và tài khoản admin đầu tiên.
/// Admin đầu tiên phải sinh từ đây (hoặc từ công cụ dòng lệnh), KHÔNG có endpoint nào cho phép
/// tự đăng ký thành admin qua web.
/// </summary>
public static class DbSeeder
{
    public static async Task ChayAsync(
        AppDbContext db,
        UserManager<GiaoVien> quanLyNguoiDung,
        SeedOptions tuyChon,
        ILogger ghiLog,
        CancellationToken huyBo = default)
    {
        await BaoDamCaiDatAsync(db, ghiLog, huyBo);
        await BaoDamAdminAsync(quanLyNguoiDung, tuyChon, ghiLog);

        if (tuyChon.DuLieuMau)
        {
            await TaoDuLieuMauAsync(db, quanLyNguoiDung, tuyChon, ghiLog, huyBo);
        }
    }

    /// <summary>Luôn có đúng một dòng cấu hình, để GET /api/settings không bao giờ trả về rỗng.</summary>
    private static async Task BaoDamCaiDatAsync(AppDbContext db, ILogger ghiLog, CancellationToken huyBo)
    {
        var daCo = await db.CaiDat.AnyAsync(x => x.Id == CaiDat.IdDuyNhat, huyBo);
        if (daCo)
        {
            return;
        }

        db.CaiDat.Add(new CaiDat
        {
            Id = CaiDat.IdDuyNhat,
            MuiGio = "Asia/Ho_Chi_Minh",
            NgayCapNhatUtc = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(huyBo);
        ghiLog.LogInformation("Đã tạo dòng cấu hình mặc định trong bảng CaiDat.");
    }

    private static async Task BaoDamAdminAsync(
        UserManager<GiaoVien> quanLyNguoiDung,
        SeedOptions tuyChon,
        ILogger ghiLog)
    {
        var daCoAdmin = await quanLyNguoiDung.Users.AnyAsync(x => x.VaiTro == VaiTro.Admin);
        if (daCoAdmin)
        {
            return;
        }

        var thongTin = tuyChon.Admin;
        if (string.IsNullOrWhiteSpace(thongTin.Email)
            || string.IsNullOrWhiteSpace(thongTin.MatKhau)
            || string.IsNullOrWhiteSpace(thongTin.HoTen))
        {
            ghiLog.LogWarning(
                "Chưa có tài khoản admin nào và cũng chưa cấu hình Seed:Admin (Email, HoTen, MatKhau). "
                + "Đặt mật khẩu bằng: dotnet user-secrets set \"Seed:Admin:MatKhau\" \"...\" rồi chạy lại API. "
                + "Hệ thống không cho tự đăng ký admin qua web.");
            return;
        }

        var admin = new GiaoVien
        {
            Id = Guid.NewGuid(),
            HoTen = thongTin.HoTen.Trim(),
            Email = thongTin.Email.Trim(),
            UserName = thongTin.Email.Trim(),
            VaiTro = VaiTro.Admin,
            TrangThai = TrangThaiGiaoVien.DangLam,
            NgayThamGia = DateOnly.FromDateTime(DateTime.UtcNow),
            EmailConfirmed = true,
            NgayTaoUtc = DateTime.UtcNow,
        };

        var ketQua = await quanLyNguoiDung.CreateAsync(admin, thongTin.MatKhau!);
        if (!ketQua.Succeeded)
        {
            ghiLog.LogError(
                "Không tạo được admin đầu tiên: {Loi}",
                string.Join("; ", ketQua.Errors.Select(x => x.Code + " — " + x.Description)));
            return;
        }

        ghiLog.LogInformation("Đã tạo tài khoản admin đầu tiên: {Email}", admin.Email);
    }

    /// <summary>
    /// Dữ liệu mẫu để thử giao diện, chỉ ở máy dev. Cố tình KHÔNG sinh buổi học ở đây:
    /// việc sinh buổi học lặp hằng tuần là nghiệp vụ của Phase 2, viết hai lần sẽ lệch nhau.
    /// </summary>
    private static async Task TaoDuLieuMauAsync(
        AppDbContext db,
        UserManager<GiaoVien> quanLyNguoiDung,
        SeedOptions tuyChon,
        ILogger ghiLog,
        CancellationToken huyBo)
    {
        if (await db.HocSinh.AnyAsync(huyBo))
        {
            return;
        }

        var matKhau = tuyChon.Admin.MatKhau;
        if (string.IsNullOrWhiteSpace(matKhau))
        {
            ghiLog.LogWarning("Bỏ qua dữ liệu mẫu vì chưa có Seed:Admin:MatKhau để đặt mật khẩu cho giáo viên mẫu.");
            return;
        }

        var giaoVienMau = await quanLyNguoiDung.FindByEmailAsync("giao.vien.mau@classmanagement.local");
        if (giaoVienMau is null)
        {
            giaoVienMau = new GiaoVien
            {
                Id = Guid.NewGuid(),
                HoTen = "Giáo viên mẫu",
                Email = "giao.vien.mau@classmanagement.local",
                UserName = "giao.vien.mau@classmanagement.local",
                PhoneNumber = "0900000001",
                VaiTro = VaiTro.GiaoVien,
                TrangThai = TrangThaiGiaoVien.DangLam,
                NgayThamGia = DateOnly.FromDateTime(DateTime.UtcNow),
                EmailConfirmed = true,
                NgayTaoUtc = DateTime.UtcNow,
            };

            var ketQua = await quanLyNguoiDung.CreateAsync(giaoVienMau, matKhau);
            if (!ketQua.Succeeded)
            {
                ghiLog.LogError(
                    "Không tạo được giáo viên mẫu: {Loi}",
                    string.Join("; ", ketQua.Errors.Select(x => x.Code + " — " + x.Description)));
                return;
            }
        }

        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);

        var hocSinhMau = new[]
        {
            new HocSinh
            {
                HoTen = "Nguyễn Minh Anh",
                GiaoVienId = giaoVienMau.Id,
                CachTinhHocPhi = CachTinhHocPhi.TheoBuoi,
                DonGiaTheoBuoi = 200_000m,
                SoBuoiMoiTuan = 2,
                NgayDenHanDongTien = 5,
                NgayBatDau = homNay,
                PhuHuynh = "Nguyễn Văn Bình",
                SoDienThoaiPhuHuynh = "0900000002",
                GhiChu = "Dữ liệu mẫu ở máy dev, xoá được bất cứ lúc nào.",
                NgayTaoUtc = DateTime.UtcNow,
                NgayCapNhatUtc = DateTime.UtcNow,
                LichHoc =
                {
                    new KhungGioHoc { Thu = ThuTrongTuan.Thu2, GioBatDau = new TimeOnly(18, 0), GioKetThuc = new TimeOnly(19, 30) },
                    new KhungGioHoc { Thu = ThuTrongTuan.Thu5, GioBatDau = new TimeOnly(18, 0), GioKetThuc = new TimeOnly(19, 30) },
                },
            },
            new HocSinh
            {
                HoTen = "Trần Gia Hân",
                GiaoVienId = giaoVienMau.Id,
                CachTinhHocPhi = CachTinhHocPhi.TheoThang,
                HocPhiTheoThang = 1_600_000m,
                SoBuoiMoiTuan = 2,
                NgayDenHanDongTien = 10,
                NgayBatDau = homNay,
                PhuHuynh = "Trần Thị Hoa",
                SoDienThoaiPhuHuynh = "0900000003",
                NgayTaoUtc = DateTime.UtcNow,
                NgayCapNhatUtc = DateTime.UtcNow,
                LichHoc =
                {
                    new KhungGioHoc { Thu = ThuTrongTuan.Thu3, GioBatDau = new TimeOnly(19, 45), GioKetThuc = new TimeOnly(21, 15) },
                    new KhungGioHoc { Thu = ThuTrongTuan.ChuNhat, GioBatDau = new TimeOnly(8, 0), GioKetThuc = new TimeOnly(9, 30) },
                },
            },
            new HocSinh
            {
                HoTen = "Lê Quang Dũng",
                GiaoVienId = giaoVienMau.Id,
                CachTinhHocPhi = CachTinhHocPhi.TheoBuoi,
                DonGiaTheoBuoi = 250_000m,
                SoBuoiMoiTuan = 1,
                NgayDenHanDongTien = 20,
                NgayBatDau = homNay,
                TrangThai = TrangThaiHocSinh.TamNghi,
                GhiChu = "Học sinh mẫu đang tạm nghỉ để thử bộ lọc trạng thái.",
                NgayTaoUtc = DateTime.UtcNow,
                NgayCapNhatUtc = DateTime.UtcNow,
                LichHoc =
                {
                    new KhungGioHoc { Thu = ThuTrongTuan.Thu7, GioBatDau = new TimeOnly(9, 0), GioKetThuc = new TimeOnly(10, 30) },
                },
            },
        };

        db.HocSinh.AddRange(hocSinhMau);
        await db.SaveChangesAsync(huyBo);

        ghiLog.LogInformation(
            "Đã tạo dữ liệu mẫu ở máy dev: 1 giáo viên ({Email}) và {SoHocSinh} học sinh.",
            giaoVienMau.Email,
            hocSinhMau.Length);
    }
}
