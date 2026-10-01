using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using ClassManagement.Api.Google;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Services;

/// <summary>
/// Đẩy lịch dạy lên Google Calendar: mỗi buổi học là một sự kiện, nằm trên lịch Google của CHÍNH giáo
/// viên dạy buổi đó.
///
/// Chọn mỗi buổi một sự kiện (thay vì một sự kiện lặp hằng tuần) vì đơn vị nghiệp vụ ở đây là BUỔI:
/// nghỉ một buổi, dạy bù một buổi, đổi giờ một buổi — tất cả đều là thao tác trên từng buổi. Sự kiện
/// lặp sẽ phải sinh ngoại lệ cho mọi thay đổi như vậy, phức tạp hơn mà lại khó đối chiếu.
///
/// Buổi đã điểm danh là nghỉ thì KHÔNG đẩy lên lịch, và nếu trước đó đã đẩy thì xoá đi.
/// </summary>
public class DichVuDongBoLich(
    AppDbContext db,
    IKhachGoogleCalendar khach,
    DichVuGoogleCalendar google,
    DichVuNhatKy nhatKy,
    ILogger<DichVuDongBoLich> ghiLog)
{
    public const string HanhDongDongBo = "dong_bo_lich_google";

    public static (DateOnly Tu, DateOnly Den) KhoangMacDinh()
    {
        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);
        return (homNay, DichVuBuoiHoc.CuoiKySinhBuoi(homNay));
    }

    /// <summary>Đồng bộ lịch của MỘT giáo viên lên chính lịch Google của người đó.</summary>
    public async Task<KetQuaDongBoDto> DongBoAsync(
        GiaoVien giaoVien,
        DateOnly? tuNgay,
        DateOnly? denNgay,
        Guid? nguoiThucHienId,
        CancellationToken huyBo = default)
    {
        var (tu, den) = KhoangMacDinh();
        var khoangTu = tuNgay ?? tu;
        var khoangDen = denNgay ?? den;

        if (khoangDen < khoangTu)
        {
            throw LoiApiException.DuLieuSai(
                "Khoảng ngày đồng bộ không hợp lệ.",
                new Dictionary<string, string[]> { ["denNgay"] = ["Ngày kết thúc phải sau ngày bắt đầu"] });
        }

        var caiDat = await google.LayCaiDatAsync(huyBo);
        var accessToken = await google.LayAccessTokenAsync(giaoVien, huyBo);
        var calendarId = string.IsNullOrWhiteSpace(giaoVien.GoogleCalendarId)
            ? "primary"
            : giaoVien.GoogleCalendarId;
        var muiGio = ThoiGian.LayMuiGio(caiDat.MuiGio);

        var buoiHoc = await db.BuoiHoc
            .Include(x => x.HocSinh)
            .Include(x => x.GiaoVien)
            .Include(x => x.DiemDanh)
            .Where(x => x.GiaoVienId == giaoVien.Id && x.Ngay >= khoangTu && x.Ngay <= khoangDen)
            .OrderBy(x => x.Ngay)
            .ThenBy(x => x.GioBatDau)
            .ToListAsync(huyBo);

        var bayGio = DateTime.UtcNow;
        var ketQua = new KetQuaDongBoDto { ThoiDiemUtc = bayGio };

        foreach (var buoi in buoiHoc)
        {
            var laNghi = buoi.DiemDanh?.TrangThai == TrangThaiDiemDanh.Nghi;

            if (laNghi)
            {
                if (buoi.GoogleEventId is null)
                {
                    ketQua.SoBoQua++;
                    continue;
                }

                await khach.XoaSuKienAsync(accessToken, calendarId, buoi.GoogleEventId, huyBo);
                buoi.GoogleEventId = null;
                buoi.GoogleDongBoUtc = bayGio;
                ketQua.SoXoa++;
                continue;
            }

            var suKien = TaoSuKien(buoi, caiDat, muiGio);

            if (buoi.GoogleEventId is null)
            {
                buoi.GoogleEventId = await khach.TaoSuKienAsync(accessToken, calendarId, suKien, huyBo);
                buoi.GoogleDongBoUtc = bayGio;
                ketQua.SoTao++;
                continue;
            }

            // Chỉ cập nhật khi có gì đó đổi sau lần đồng bộ trước: điểm danh sửa lúc nào thì
            // DiemDanh.NgayCapNhatUtc đổi lúc đó, còn giờ học đổi thì sửa lịch cũng tạo buổi mới.
            var canCapNhat = buoi.GoogleDongBoUtc is null
                || (buoi.DiemDanh?.NgayCapNhatUtc ?? DateTime.MinValue) > buoi.GoogleDongBoUtc;

            if (!canCapNhat)
            {
                ketQua.SoBoQua++;
                continue;
            }

            await khach.CapNhatSuKienAsync(accessToken, calendarId, buoi.GoogleEventId, suKien, huyBo);
            buoi.GoogleDongBoUtc = bayGio;
            ketQua.SoCapNhat++;
        }

        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            nguoiThucHienId,
            HanhDongDongBo,
            "GiaoVien",
            giaoVien.Id.ToString(),
            null,
            DichVuNhatKy.Json(ketQua),
            huyBo);

        ghiLog.LogInformation(
            "Đồng bộ Google cho {Ten} {Tu}–{Den}: tạo {Tao}, cập nhật {CapNhat}, xoá {Xoa}, bỏ qua {BoQua}.",
            giaoVien.HoTen, khoangTu, khoangDen, ketQua.SoTao, ketQua.SoCapNhat, ketQua.SoXoa, ketQua.SoBoQua);

        return ketQua;
    }

    /// <summary>
    /// Đồng bộ cho mọi giáo viên đã kết nối (chỉ admin gọi). Một người lỗi — token bị thu hồi chẳng
    /// hạn — thì ghi lại lỗi và đi tiếp, không làm hỏng lượt đồng bộ của người khác.
    /// </summary>
    public async Task<KetQuaDongBoDto> DongBoTatCaAsync(
        DateOnly? tuNgay,
        DateOnly? denNgay,
        Guid? nguoiThucHienId,
        CancellationToken huyBo = default)
    {
        var danhSach = await db.GiaoVien
            .Where(x => x.TrangThai == TrangThaiGiaoVien.DangLam && x.GoogleRefreshTokenMaHoa != null)
            .OrderBy(x => x.HoTen)
            .ToListAsync(huyBo);

        var tong = new KetQuaDongBoDto { ThoiDiemUtc = DateTime.UtcNow };
        var loi = new List<string>();

        foreach (var giaoVien in danhSach)
        {
            try
            {
                var ketQua = await DongBoAsync(giaoVien, tuNgay, denNgay, nguoiThucHienId, huyBo);
                tong.SoTao += ketQua.SoTao;
                tong.SoCapNhat += ketQua.SoCapNhat;
                tong.SoXoa += ketQua.SoXoa;
                tong.SoBoQua += ketQua.SoBoQua;
            }
            catch (LoiApiException loiApi)
            {
                ghiLog.LogWarning("Đồng bộ Google cho {Ten} thất bại: {Loi}", giaoVien.HoTen, loiApi.TieuDe);
                loi.Add($"{giaoVien.HoTen}: {loiApi.ChiTiet ?? loiApi.TieuDe}");
            }
        }

        if (loi.Count > 0)
        {
            tong.Loi = string.Join(" | ", loi);
        }

        return tong;
    }

    /// <summary>Xoá các sự kiện do hệ thống này tạo trên lịch Google của một giáo viên (khi ngắt kết nối).</summary>
    public async Task<KetQuaDongBoDto> XoaSuKienDaTaoAsync(
        GiaoVien giaoVien,
        Guid? nguoiThucHienId,
        CancellationToken huyBo = default)
    {
        var accessToken = await google.LayAccessTokenAsync(giaoVien, huyBo);
        var calendarId = string.IsNullOrWhiteSpace(giaoVien.GoogleCalendarId) ? "primary" : giaoVien.GoogleCalendarId;

        var buoiHoc = await db.BuoiHoc
            .Where(x => x.GiaoVienId == giaoVien.Id && x.GoogleEventId != null)
            .ToListAsync(huyBo);

        var bayGio = DateTime.UtcNow;
        var ketQua = new KetQuaDongBoDto { ThoiDiemUtc = bayGio };

        foreach (var buoi in buoiHoc)
        {
            await khach.XoaSuKienAsync(accessToken, calendarId, buoi.GoogleEventId!, huyBo);
            buoi.GoogleEventId = null;
            buoi.GoogleDongBoUtc = bayGio;
            ketQua.SoXoa++;
        }

        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            nguoiThucHienId,
            "xoa_su_kien_google",
            "GiaoVien",
            giaoVien.Id.ToString(),
            null,
            DichVuNhatKy.Json(ketQua),
            huyBo);

        return ketQua;
    }

    /// <summary>
    /// Quên các id sự kiện đã lưu của một giáo viên. Dùng khi ngắt kết nối: dù chọn giữ lại sự kiện
    /// trên Google hay xoá, hệ thống cũng không theo dõi chúng nữa, để lần kết nối sau bắt đầu sạch.
    /// </summary>
    public async Task<int> QuenSuKienDaLuuAsync(GiaoVien giaoVien, CancellationToken huyBo = default)
    {
        var buoiHoc = await db.BuoiHoc
            .Where(x => x.GiaoVienId == giaoVien.Id && x.GoogleEventId != null)
            .ToListAsync(huyBo);

        foreach (var buoi in buoiHoc)
        {
            buoi.GoogleEventId = null;
        }

        await db.SaveChangesAsync(huyBo);
        return buoiHoc.Count;
    }

    /// <summary>Lần đồng bộ gần nhất của một giáo viên, đọc lại từ nhật ký để không phải thêm bảng riêng.</summary>
    public async Task<KetQuaDongBoDto?> LayLanDongBoCuoiAsync(GiaoVien giaoVien, CancellationToken huyBo = default)
    {
        var maGiaoVien = giaoVien.Id.ToString();
        var dong = await db.NhatKy
            .AsNoTracking()
            .Where(x => x.HanhDong == HanhDongDongBo && x.DoiTuongId == maGiaoVien && x.DuLieuSau != null)
            .OrderByDescending(x => x.ThoiDiemUtc)
            .FirstOrDefaultAsync(huyBo);

        if (dong?.DuLieuSau is null)
        {
            return null;
        }

        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<KetQuaDongBoDto>(
                dong.DuLieuSau,
                new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase,
                });
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }

    private static SuKienGoogle TaoSuKien(BuoiHoc buoi, CaiDat caiDat, TimeZoneInfo muiGio)
    {
        var batDauTheoGioTuong = buoi.Ngay.ToDateTime(TimeOnly.FromTimeSpan(buoi.GioBatDau.ToTimeSpan()));
        var ketThucTheoGioTuong = buoi.Ngay.ToDateTime(TimeOnly.FromTimeSpan(buoi.GioKetThuc.ToTimeSpan()));

        var lech = muiGio.GetUtcOffset(batDauTheoGioTuong);

        var tieuDe = "Dạy " + (buoi.HocSinh?.HoTen ?? "học sinh")
            + (buoi.LaBuoiDayBu ? " (dạy bù)" : string.Empty);

        var moTa = new List<string>
        {
            "Giáo viên: " + (buoi.GiaoVien?.HoTen ?? "—"),
            "Học sinh: " + (buoi.HocSinh?.HoTen ?? "—"),
        };

        if (buoi.DiemDanh?.GhiChu is { Length: > 0 } ghiChu)
        {
            moTa.Add("Ghi chú: " + ghiChu);
        }

        moTa.Add("Tạo bởi ClassManagement — sửa lịch ở đó, không sửa trực tiếp trên Google.");

        return new SuKienGoogle(
            tieuDe,
            string.Join('\n', moTa),
            new DateTimeOffset(batDauTheoGioTuong, lech),
            new DateTimeOffset(ketThucTheoGioTuong, lech),
            caiDat.MuiGio,
            caiDat.NhacTruocBaoLauPhut);
    }
}
