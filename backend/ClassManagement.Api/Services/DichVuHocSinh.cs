using ClassManagement.Api.Data;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Services;

/// <summary>
/// Nghiệp vụ học sinh: kiểm tra dữ liệu, tạo/sửa/nghỉ và đóng gói DTO.
/// Gom vào một chỗ để màn hình Học sinh, Điểm danh và Tổng quan dùng đúng cùng một cách hiểu.
/// </summary>
public class DichVuHocSinh(AppDbContext db, DichVuBuoiHoc dichVuBuoiHoc)
{
    /// <summary>
    /// Kiểm tra dữ liệu học sinh. Trả về lỗi theo từng field, khớp cấu trúc ProblemDetails.errors
    /// mà frontend đã đọc sẵn; rỗng nghĩa là hợp lệ.
    /// </summary>
    public async Task<Dictionary<string, string[]>> KiemTraDuLieuAsync(
        string hoTen,
        CachTinhHocPhi cachTinhHocPhi,
        decimal? donGiaTheoBuoi,
        decimal? hocPhiTheoThang,
        int soBuoiMoiTuan,
        IReadOnlyList<KhungGioHocRequest> lichHoc,
        DateOnly ngayBatDau,
        Guid giaoVienId,
        Guid? boQuaHocSinhId,
        CancellationToken huyBo = default)
    {
        var loi = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(hoTen) || hoTen.Trim().Length < 2)
        {
            loi[nameof(TaoHocSinhRequest.HoTen)] = ["Nhập tên học sinh, dài ít nhất 2 ký tự"];
        }

        if (cachTinhHocPhi == CachTinhHocPhi.TheoBuoi && (donGiaTheoBuoi is null || donGiaTheoBuoi <= 0))
        {
            loi[nameof(TaoHocSinhRequest.DonGiaTheoBuoi)] =
                ["Tính theo buổi thì phải nhập đơn giá mỗi buổi, lớn hơn 0"];
        }

        if (cachTinhHocPhi == CachTinhHocPhi.TheoThang && (hocPhiTheoThang is null || hocPhiTheoThang <= 0))
        {
            loi[nameof(TaoHocSinhRequest.HocPhiTheoThang)] =
                ["Tính theo tháng thì phải nhập học phí mỗi tháng, lớn hơn 0"];
        }

        if (lichHoc.Count == 0)
        {
            loi[nameof(TaoHocSinhRequest.LichHoc)] = ["Khai ít nhất một khung giờ học trong tuần"];
        }

        // Số khung giờ khai phải khớp số buổi mỗi tuần, nếu không thì lịch sinh ra sẽ khác
        // con số người dùng nhìn thấy trên màn hình.
        if (lichHoc.Count > 0 && lichHoc.Count != soBuoiMoiTuan)
        {
            loi[nameof(TaoHocSinhRequest.SoBuoiMoiTuan)] =
                ["Số buổi mỗi tuần (" + soBuoiMoiTuan + ") phải khớp số khung giờ đã khai (" + lichHoc.Count + ")"];
        }

        for (var i = 0; i < lichHoc.Count; i++)
        {
            var khung = lichHoc[i];
            if (khung.GioKetThuc <= khung.GioBatDau)
            {
                loi[nameof(TaoHocSinhRequest.LichHoc)] = ["Giờ kết thúc phải sau giờ bắt đầu"];
                break;
            }
        }

        // Hai khung giờ trong cùng một lịch mà đè nhau thì chắc chắn là nhập nhầm.
        if (loi.Count == 0)
        {
            for (var i = 0; i < lichHoc.Count && !loi.ContainsKey(nameof(TaoHocSinhRequest.LichHoc)); i++)
            {
                for (var j = i + 1; j < lichHoc.Count; j++)
                {
                    var a = lichHoc[i];
                    var b = lichHoc[j];
                    if (a.Thu == b.Thu && a.GioBatDau < b.GioKetThuc && b.GioBatDau < a.GioKetThuc)
                    {
                        loi[nameof(TaoHocSinhRequest.LichHoc)] = ["Hai khung giờ trong cùng một ngày bị trùng nhau"];
                        break;
                    }
                }
            }
        }

        if (loi.Count == 0)
        {
            var trungLich = await dichVuBuoiHoc.TimTrungLichAsync(giaoVienId, boQuaHocSinhId, lichHoc, huyBo);
            if (trungLich is not null)
            {
                loi[nameof(TaoHocSinhRequest.LichHoc)] = [trungLich];
            }
        }

        var giaoVienTonTai = await db.GiaoVien.AnyAsync(
            x => x.Id == giaoVienId && x.TrangThai == TrangThaiGiaoVien.DangLam,
            huyBo);

        if (!giaoVienTonTai)
        {
            loi[nameof(TaoHocSinhRequest.GiaoVienId)] = ["Giáo viên phụ trách không tồn tại hoặc đã nghỉ"];
        }

        return loi;
    }

    /// <summary>Tạo học sinh và sinh ngay các buổi học từ ngày bắt đầu tới hết tháng sau.</summary>
    public async Task<HocSinh> TaoAsync(TaoHocSinhRequest yeuCau, Guid giaoVienId, CancellationToken huyBo = default)
    {
        var bayGio = DateTime.UtcNow;

        var hocSinh = new HocSinh
        {
            HoTen = yeuCau.HoTen.Trim(),
            GiaoVienId = giaoVienId,
            CachTinhHocPhi = yeuCau.CachTinhHocPhi,
            DonGiaTheoBuoi = yeuCau.CachTinhHocPhi == CachTinhHocPhi.TheoBuoi ? yeuCau.DonGiaTheoBuoi : null,
            HocPhiTheoThang = yeuCau.CachTinhHocPhi == CachTinhHocPhi.TheoThang ? yeuCau.HocPhiTheoThang : null,
            SoBuoiMoiTuan = yeuCau.SoBuoiMoiTuan,
            NgayDenHanDongTien = yeuCau.NgayDenHanDongTien,
            NgayBatDau = yeuCau.NgayBatDau,
            PhuHuynh = ChuoiHoacNull(yeuCau.PhuHuynh),
            SoDienThoaiPhuHuynh = ChuoiHoacNull(yeuCau.SoDienThoaiPhuHuynh),
            Lop = ChuoiHoacNull(yeuCau.Lop),
            GhiChu = ChuoiHoacNull(yeuCau.GhiChu),
            TrangThai = yeuCau.TrangThai,
            NgayTaoUtc = bayGio,
            NgayCapNhatUtc = bayGio,
        };

        foreach (var khung in yeuCau.LichHoc)
        {
            hocSinh.LichHoc.Add(new KhungGioHoc
            {
                Thu = khung.Thu,
                GioBatDau = khung.GioBatDau,
                GioKetThuc = khung.GioKetThuc,
            });
        }

        db.HocSinh.Add(hocSinh);
        await db.SaveChangesAsync(huyBo);

        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);
        await dichVuBuoiHoc.BaoDamBuoiHocAsync(hocSinh, yeuCau.NgayBatDau, DichVuBuoiHoc.CuoiKySinhBuoi(homNay), huyBo);

        return hocSinh;
    }

    /// <summary>
    /// Cập nhật học sinh. Lịch học mới thì các buổi CHƯA điểm danh từ hôm nay trở đi được sinh lại;
    /// buổi đã điểm danh giữ nguyên. Đổi giáo viên phụ trách cũng chỉ ảnh hưởng buổi chưa dạy.
    /// </summary>
    public async Task<CapNhatKetQua> CapNhatAsync(
        HocSinh hocSinh,
        SuaHocSinhRequest yeuCau,
        Guid? giaoVienMoiId,
        CancellationToken huyBo = default)
    {
        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);
        var doiLichHoc = DoiLichHoc(hocSinh.LichHoc, yeuCau.LichHoc);
        var giaoVienCu = hocSinh.GiaoVienId;

        // Toàn bộ việc sửa học sinh (đổi lịch, dọn buổi cũ, sinh buổi mới) phải cùng thành công
        // hoặc cùng không làm gì, nếu không sẽ có lúc học sinh bị mất lịch học mà buổi thì đã xoá.
        await using var giaoDich = await db.Database.BeginTransactionAsync(huyBo);

        hocSinh.HoTen = yeuCau.HoTen.Trim();
        hocSinh.CachTinhHocPhi = yeuCau.CachTinhHocPhi;
        hocSinh.DonGiaTheoBuoi = yeuCau.CachTinhHocPhi == CachTinhHocPhi.TheoBuoi ? yeuCau.DonGiaTheoBuoi : null;
        hocSinh.HocPhiTheoThang = yeuCau.CachTinhHocPhi == CachTinhHocPhi.TheoThang ? yeuCau.HocPhiTheoThang : null;
        hocSinh.SoBuoiMoiTuan = yeuCau.SoBuoiMoiTuan;
        hocSinh.NgayDenHanDongTien = yeuCau.NgayDenHanDongTien;
        hocSinh.NgayBatDau = yeuCau.NgayBatDau;
        hocSinh.PhuHuynh = ChuoiHoacNull(yeuCau.PhuHuynh);
        hocSinh.SoDienThoaiPhuHuynh = ChuoiHoacNull(yeuCau.SoDienThoaiPhuHuynh);
        hocSinh.Lop = ChuoiHoacNull(yeuCau.Lop);
        hocSinh.GhiChu = ChuoiHoacNull(yeuCau.GhiChu);
        hocSinh.TrangThai = yeuCau.TrangThai;
        hocSinh.NgayCapNhatUtc = DateTime.UtcNow;

        if (giaoVienMoiId is { } giaoVienMoi && giaoVienMoi != giaoVienCu)
        {
            hocSinh.GiaoVienId = giaoVienMoi;
        }

        if (doiLichHoc)
        {
            // Xoá thẳng trong database thay vì xoá qua change tracker: xoá rồi thêm lại cùng một
            // lần lưu làm EF sinh ra cả DELETE lẫn UPDATE cho cùng một dòng, và câu UPDATE sẽ
            // thất bại vì dòng đó vừa bị xoá xong.
            await db.KhungGioHoc.Where(x => x.HocSinhId == hocSinh.Id).ExecuteDeleteAsync(huyBo);

            foreach (var khungCu in hocSinh.LichHoc)
            {
                db.Entry(khungCu).State = EntityState.Detached;
            }

            hocSinh.LichHoc.Clear();

            // Phải thêm qua DbSet.AddRange, KHÔNG thêm vào navigation của học sinh: học sinh đang
            // được theo dõi nên EF coi khung giờ mới là "đã tồn tại" (vì Id đã có giá trị) và sinh
            // ra câu UPDATE cho một dòng chưa hề tồn tại trong database.
            var khungGioMoi = yeuCau.LichHoc
                .Select(khung => new KhungGioHoc
                {
                    HocSinhId = hocSinh.Id,
                    Thu = khung.Thu,
                    GioBatDau = khung.GioBatDau,
                    GioKetThuc = khung.GioKetThuc,
                })
                .ToList();

            db.KhungGioHoc.AddRange(khungGioMoi);
        }

        await db.SaveChangesAsync(huyBo);

        var soBuoiXoa = 0;
        if (doiLichHoc || hocSinh.TrangThai != TrangThaiHocSinh.DangHoc)
        {
            // Buổi chưa điểm danh là kế hoạch, sửa lịch thì kế hoạch cũ không còn đúng nữa.
            soBuoiXoa = await dichVuBuoiHoc.XoaBuoiChuaDiemDanhAsync(hocSinh.Id, homNay, huyBo);
        }

        var soBuoiDoiGiaoVien = 0;
        if (hocSinh.GiaoVienId != giaoVienCu)
        {
            soBuoiDoiGiaoVien = await dichVuBuoiHoc.DoiGiaoVienChoBuoiChuaDiemDanhAsync(
                hocSinh.Id, hocSinh.GiaoVienId, homNay, huyBo);
        }

        var soBuoiSinh = 0;
        if (hocSinh.TrangThai == TrangThaiHocSinh.DangHoc)
        {
            var tuNgay = homNay < hocSinh.NgayBatDau ? hocSinh.NgayBatDau : homNay;
            soBuoiSinh = await dichVuBuoiHoc.BaoDamBuoiHocAsync(
                hocSinh, tuNgay, DichVuBuoiHoc.CuoiKySinhBuoi(homNay), huyBo);
        }

        await giaoDich.CommitAsync(huyBo);

        return new CapNhatKetQua(doiLichHoc, soBuoiXoa, soBuoiSinh, soBuoiDoiGiaoVien);
    }

    /// <summary>
    /// Cho học sinh nghỉ học: đổi trạng thái chứ KHÔNG xoá hồ sơ, và bỏ các buổi chưa dạy từ hôm nay.
    /// Giữ lại toàn bộ điểm danh và học phí đã ghi để còn tra cứu.
    /// </summary>
    public async Task<int> ChoNghiAsync(HocSinh hocSinh, CancellationToken huyBo = default)
    {
        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);
        hocSinh.TrangThai = TrangThaiHocSinh.DaNghi;
        hocSinh.NgayCapNhatUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(huyBo);

        return await dichVuBuoiHoc.XoaBuoiChuaDiemDanhAsync(hocSinh.Id, homNay, huyBo);
    }

    public static HocSinhDto TaoDto(HocSinh hocSinh)
    {
        return new HocSinhDto
        {
            Id = hocSinh.Id,
            HoTen = hocSinh.HoTen,
            GiaoVienId = hocSinh.GiaoVienId,
            TenGiaoVien = hocSinh.GiaoVien?.HoTen ?? "",
            CachTinhHocPhi = hocSinh.CachTinhHocPhi,
            DonGiaTheoBuoi = hocSinh.DonGiaTheoBuoi,
            HocPhiTheoThang = hocSinh.HocPhiTheoThang,
            SoBuoiMoiTuan = hocSinh.SoBuoiMoiTuan,
            NgayDenHanDongTien = hocSinh.NgayDenHanDongTien,
            NgayBatDau = hocSinh.NgayBatDau,
            PhuHuynh = hocSinh.PhuHuynh,
            SoDienThoaiPhuHuynh = hocSinh.SoDienThoaiPhuHuynh,
            Lop = hocSinh.Lop,
            GhiChu = hocSinh.GhiChu,
            TrangThai = hocSinh.TrangThai,
            LichHoc = hocSinh.LichHoc
                .OrderBy(x => x.Thu)
                .ThenBy(x => x.GioBatDau)
                .Select(x => new KhungGioHocDto
                {
                    Id = x.Id,
                    Thu = x.Thu,
                    GioBatDau = x.GioBatDau,
                    GioKetThuc = x.GioKetThuc,
                })
                .ToList(),
            NgayCapNhatUtc = hocSinh.NgayCapNhatUtc,
        };
    }

    private static bool DoiLichHoc(IEnumerable<KhungGioHoc> hienTai, IReadOnlyList<KhungGioHocRequest> moi)
    {
        var cu = hienTai
            .Select(x => (x.Thu, x.GioBatDau, x.GioKetThuc))
            .OrderBy(x => x.Thu)
            .ThenBy(x => x.GioBatDau)
            .ToList();

        var sapXep = moi
            .Select(x => (x.Thu, x.GioBatDau, x.GioKetThuc))
            .OrderBy(x => x.Thu)
            .ThenBy(x => x.GioBatDau)
            .ToList();

        return !cu.SequenceEqual(sapXep);
    }

    private static string? ChuoiHoacNull(string? chuoi)
    {
        return string.IsNullOrWhiteSpace(chuoi) ? null : chuoi.Trim();
    }
}

/// <summary>Tóm tắt việc đã làm khi cập nhật học sinh, để trả về cho người dùng biết.</summary>
public sealed record CapNhatKetQua(bool DoiLichHoc, int SoBuoiXoa, int SoBuoiSinh, int SoBuoiDoiGiaoVien);
