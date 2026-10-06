using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Services;

/// <summary>
/// Sinh và dọn các buổi học cụ thể từ lịch học lặp hằng tuần của học sinh.
///
/// Buổi học KHÔNG phải dữ liệu người dùng nhập tay: nó suy ra từ lịch hằng tuần. Vì vậy việc
/// sinh buổi là thao tác lặp lại được (chạy nhiều lần vẫn ra đúng một kết quả) — nhờ chỉ mục
/// duy nhất trên (HocSinhId, Ngay, GioBatDau), kể cả khi hai request cùng sinh một lúc.
/// </summary>
public class DichVuBuoiHoc(AppDbContext db, ILogger<DichVuBuoiHoc> ghiLog)
{
    /// <summary>
    /// Sinh những buổi còn thiếu trong khoảng [tuNgay, denNgay] cho một học sinh.
    /// Trả về số buổi vừa sinh.
    /// </summary>
    public async Task<int> BaoDamBuoiHocAsync(
        HocSinh hocSinh,
        DateOnly tuNgay,
        DateOnly denNgay,
        CancellationToken huyBo = default)
    {
        // Chỉ học sinh đang học mới sinh buổi mới; tạm nghỉ hoặc đã nghỉ thì giữ nguyên lịch sử.
        if (hocSinh.TrangThai != TrangThaiHocSinh.DangHoc)
        {
            return 0;
        }

        var batDau = tuNgay < hocSinh.NgayBatDau ? hocSinh.NgayBatDau : tuNgay;
        if (denNgay < batDau)
        {
            return 0;
        }

        var lichHoc = hocSinh.LichHoc.Count > 0
            ? hocSinh.LichHoc
            : await db.KhungGioHoc.Where(x => x.HocSinhId == hocSinh.Id).ToListAsync(huyBo);

        if (lichHoc.Count == 0)
        {
            return 0;
        }

        var daCo = await db.BuoiHoc
            .Where(x => x.HocSinhId == hocSinh.Id && x.Ngay >= batDau && x.Ngay <= denNgay)
            .Select(x => new { x.Ngay, x.GioBatDau })
            .ToListAsync(huyBo);

        var khoaDaCo = daCo.Select(x => (x.Ngay, x.GioBatDau)).ToHashSet();
        var bayGio = DateTime.UtcNow;
        var buoiMoi = new List<BuoiHoc>();

        for (var ngay = batDau; ngay <= denNgay; ngay = ngay.AddDays(1))
        {
            var thu = ThoiGian.ThuCua(ngay);
            foreach (var khung in lichHoc.Where(x => x.Thu == thu))
            {
                if (!khoaDaCo.Add((ngay, khung.GioBatDau)))
                {
                    continue;
                }

                buoiMoi.Add(new BuoiHoc
                {
                    HocSinhId = hocSinh.Id,
                    // Chụp lại giáo viên tại thời điểm sinh buổi: chuyển học sinh sang giáo viên
                    // khác về sau sẽ không viết lại lịch sử dạy.
                    GiaoVienId = hocSinh.GiaoVienId,
                    Ngay = ngay,
                    GioBatDau = khung.GioBatDau,
                    GioKetThuc = khung.GioKetThuc,
                    NgayTaoUtc = bayGio,
                    // Buổi mới luôn bắt đầu ở trạng thái chưa điểm danh, KHÔNG phải nghỉ.
                    DiemDanh = new DiemDanh
                    {
                        TrangThai = TrangThaiDiemDanh.ChuaDiemDanh,
                        CoTinhTien = false,
                        NgayCapNhatUtc = bayGio,
                    },
                });
            }
        }

        if (buoiMoi.Count == 0)
        {
            return 0;
        }

        db.BuoiHoc.AddRange(buoiMoi);

        try
        {
            await db.SaveChangesAsync(huyBo);
        }
        catch (DbUpdateException loi) when (loi.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation })
        {
            // Hai request cùng sinh buổi một lúc: chỉ mục duy nhất đã chặn bản ghi trùng,
            // buổi học đã có người sinh trước nên không cần làm gì thêm.
            ghiLog.LogInformation("Bỏ qua buổi học trùng khi sinh song song cho học sinh {HocSinhId}.", hocSinh.Id);
            db.ChangeTracker.Clear();
            return 0;
        }

        return buoiMoi.Count;
    }

    /// <summary>
    /// Xoá các buổi CHƯA điểm danh từ một ngày trở đi. Dùng khi sửa lịch học hoặc cho học sinh nghỉ:
    /// buổi đã điểm danh là lịch sử, không được đụng tới.
    /// </summary>
    public async Task<int> XoaBuoiChuaDiemDanhAsync(Guid hocSinhId, DateOnly tuNgay, CancellationToken huyBo = default)
    {
        var soXoa = await db.BuoiHoc
            .Where(x => x.HocSinhId == hocSinhId
                && x.Ngay >= tuNgay
                && x.DiemDanh != null
                && x.DiemDanh.TrangThai == TrangThaiDiemDanh.ChuaDiemDanh)
            .ExecuteDeleteAsync(huyBo);

        return soXoa;
    }

    /// <summary>
    /// Chuyển các buổi chưa điểm danh sang giáo viên mới. Buổi đã điểm danh giữ nguyên giáo viên cũ
    /// để học phí và thống kê đã ghi không bị viết lại.
    /// </summary>
    public async Task<int> DoiGiaoVienChoBuoiChuaDiemDanhAsync(
        Guid hocSinhId,
        Guid giaoVienMoiId,
        DateOnly tuNgay,
        CancellationToken huyBo = default)
    {
        return await db.BuoiHoc
            .Where(x => x.HocSinhId == hocSinhId
                && x.Ngay >= tuNgay
                && x.GiaoVienId != giaoVienMoiId
                && x.DiemDanh != null
                && x.DiemDanh.TrangThai == TrangThaiDiemDanh.ChuaDiemDanh)
            .ExecuteUpdateAsync(
                capNhat => capNhat.SetProperty(x => x.GiaoVienId, giaoVienMoiId),
                huyBo);
    }

    /// <summary>
    /// Kiểm tra lịch mới có đè lên lịch của học sinh khác cùng giáo viên không.
    /// Trả về mô tả chỗ trùng để báo cho người dùng biết đang trùng với ai.
    /// </summary>
    public async Task<string?> TimTrungLichAsync(
        Guid giaoVienId,
        Guid? boQuaHocSinhId,
        IReadOnlyList<KhungGioHocRequest> lichMoi,
        CancellationToken huyBo = default)
    {
        if (lichMoi.Count == 0)
        {
            return null;
        }

        var lichNguoiKhac = await db.KhungGioHoc
            .AsNoTracking()
            .Where(x => x.HocSinh != null
                && x.HocSinh.GiaoVienId == giaoVienId
                && x.HocSinh.TrangThai == TrangThaiHocSinh.DangHoc
                && (boQuaHocSinhId == null || x.HocSinhId != boQuaHocSinhId))
            .Select(x => new
            {
                x.HocSinh!.HoTen,
                x.Thu,
                x.GioBatDau,
                x.GioKetThuc,
            })
            .ToListAsync(huyBo);

        foreach (var khung in lichMoi)
        {
            var trung = lichNguoiKhac.FirstOrDefault(x =>
                x.Thu == khung.Thu
                && khung.GioBatDau < x.GioKetThuc
                && x.GioBatDau < khung.GioKetThuc);

            if (trung is not null)
            {
                return "Trùng giờ với học sinh " + trung.HoTen + " ("
                    + EnumWire.ToWire(khung.Thu) + " " + khung.GioBatDau.ToString("HH:mm")
                    + "–" + khung.GioKetThuc.ToString("HH:mm") + ")";
            }
        }

        return null;
    }

    /// <summary>Ngày cuối cùng của tháng sau — mốc sinh buổi để lịch luôn có sẵn cho tháng tới.</summary>
    public static DateOnly CuoiKySinhBuoi(DateOnly homNay)
    {
        return new DateOnly(homNay.Year, homNay.Month, 1).AddMonths(2).AddDays(-1);
    }
}
