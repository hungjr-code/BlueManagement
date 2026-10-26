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

    /// <summary>Nhật ký của chiều NGƯỢC LẠI: kéo thay đổi từ Google Calendar về app.</summary>
    public const string HanhDongDongBoVe = "dong_bo_ve_lich_google";

    /// <summary>Ghi khi app phải sửa dữ liệu vì Google đã đổi (đổi giờ, huỷ buổi).</summary>
    public const string HanhDongSuaTheoGoogle = "sua_buoi_theo_google";

    /// <summary>
    /// Khoảng cách tối thiểu giữa hai lần TỰ động kéo về. Mở lại màn Lịch dạy vài lần liên tiếp
    /// không làm Google bị gọi liên tục — muốn chạy ngay thì bấm "Đồng bộ lại".
    /// </summary>
    public static readonly TimeSpan KhoangToiThieuTuDong = TimeSpan.FromMinutes(10);

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

        // Tài liệu đã giao của từng buổi: ghi vào mô tả sự kiện để học sinh mở lịch là thấy ngay
        // hôm nay có bài gì. Tài liệu thật không mở công khai — học sinh tải qua app.
        var maBuoi = buoiHoc.Select(x => x.Id).ToList();
        var taiLieuTheoBuoi = (await db.TaiLieu
                .AsNoTracking()
                .Where(x => !x.DaXoa && x.BuoiHocId != null && maBuoi.Contains(x.BuoiHocId.Value))
                .Select(x => new { BuoiHocId = x.BuoiHocId!.Value, x.TieuDe, x.HanNop })
                .ToListAsync(huyBo))
            .GroupBy(x => x.BuoiHocId)
            .ToDictionary(
                nhom => nhom.Key,
                nhom => nhom.Select(x => (x.TieuDe, x.HanNop)).ToList());

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

            var suKien = TaoSuKien(
                buoi,
                caiDat,
                muiGio,
                taiLieuTheoBuoi.TryGetValue(buoi.Id, out var danhSachTaiLieu) ? danhSachTaiLieu : []);

            if (buoi.GoogleEventId is null)
            {
                buoi.GoogleEventId = await khach.TaoSuKienAsync(accessToken, calendarId, suKien, huyBo);
                buoi.GoogleDongBoUtc = bayGio;
                // Sự kiện vừa được tạo lại (sau khi bị huỷ trên Google) nên không còn là "đã huỷ".
                buoi.GoogleDaHuy = false;
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

    /// <summary>Lần KÉO VỀ gần nhất của một giáo viên, đọc lại từ nhật ký giống chiều đẩy lên.</summary>
    public async Task<KetQuaDongBoVeDto?> LayLanDongBoVeCuoiAsync(GiaoVien giaoVien, CancellationToken huyBo = default)
    {
        var maGiaoVien = giaoVien.Id.ToString();
        var dong = await db.NhatKy
            .AsNoTracking()
            .Where(x => x.HanhDong == HanhDongDongBoVe && x.DoiTuongId == maGiaoVien && x.DuLieuSau != null)
            .OrderByDescending(x => x.ThoiDiemUtc)
            .FirstOrDefaultAsync(huyBo);

        if (dong?.DuLieuSau is null)
        {
            return null;
        }

        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<KetQuaDongBoVeDto>(
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

    /// <summary>
    /// KÉO thay đổi từ Google Calendar về app: buổi nào giáo viên đã đổi giờ trên Google thì app cập
    /// nhật lại giờ; buổi nào có sự kiện bị huỷ/xoá trên Google thì app đánh dấu nghỉ (có phép, không
    /// tính tiền) — nhưng CHỈ khi buổi đó chưa điểm danh.
    ///
    /// Chỉ xét những buổi app đã từng đẩy lên (có GoogleEventId): sự kiện riêng của giáo viên trên
    /// Google không phải việc của app.
    /// </summary>
    public async Task<KetQuaDongBoVeDto> DongBoVeAsync(
        GiaoVien giaoVien,
        DateOnly? tuNgay,
        DateOnly? denNgay,
        Guid? nguoiThucHienId,
        bool chiKhiQuaHan,
        CancellationToken huyBo = default)
    {
        var bayGio = DateTime.UtcNow;
        var ketQua = new KetQuaDongBoVeDto { ThoiDiemUtc = bayGio };

        if (chiKhiQuaHan
            && giaoVien.GoogleDongBoVeUtc is { } lanTruoc
            && bayGio - lanTruoc < KhoangToiThieuTuDong)
        {
            ketQua.BoQua = true;
            ketQua.LyDoBoQua = "Lần đồng bộ trước chưa quá "
                + (int)KhoangToiThieuTuDong.TotalMinutes + " phút.";
            ketQua.ThoiDiemDongBoCuoi = lanTruoc;
            return ketQua;
        }

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
            .Include(x => x.DiemDanh)
            .Where(x => x.GiaoVienId == giaoVien.Id
                && x.GoogleEventId != null
                && x.Ngay >= khoangTu
                && x.Ngay <= khoangDen)
            .OrderBy(x => x.Ngay)
            .ThenBy(x => x.GioBatDau)
            .ToListAsync(huyBo);

        // Đã từng kéo về thì chỉ hỏi Google những sự kiện thay đổi từ mốc đó — một lời gọi cho cả
        // khoảng, thay vì một lời gọi cho mỗi buổi. Chưa từng kéo (hoặc vừa kết nối lại) thì đối
        // chiếu từng sự kiện một, vì chưa biết Google đang giữ gì.
        var danhSachThayDoi = giaoVien.GoogleDongBoVeUtc is { } moc
            ? (await khach.LaySuKienThayDoiAsync(accessToken, calendarId, moc.AddMinutes(-1), huyBo))
                .ToDictionary(x => x.Id, x => x, StringComparer.Ordinal)
            : null;

        foreach (var buoi in buoiHoc)
        {
            SuKienGoogleDaDoc? suKien;
            if (danhSachThayDoi is null)
            {
                suKien = await khach.LaySuKienAsync(accessToken, calendarId, buoi.GoogleEventId!, huyBo);
            }
            else if (!danhSachThayDoi.TryGetValue(buoi.GoogleEventId!, out suKien))
            {
                ketQua.SoBoQua++;
                continue;
            }

            ketQua.SoDaXet++;
            await ApDungThayDoiTuGoogleAsync(giaoVien, buoi, suKien, muiGio, ketQua, nguoiThucHienId, huyBo);
            buoi.GoogleDongBoVeUtc = bayGio;
        }

        giaoVien.GoogleDongBoVeUtc = bayGio;
        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            nguoiThucHienId ?? giaoVien.Id,
            HanhDongDongBoVe,
            "GiaoVien",
            giaoVien.Id.ToString(),
            null,
            DichVuNhatKy.Json(ketQua),
            huyBo);

        ghiLog.LogInformation(
            "Kéo Google về cho {Ten}: xét {Xet}, đổi giờ {DoiGio}, đánh dấu nghỉ {Nghi}, cảnh báo {CanhBao}.",
            giaoVien.HoTen, ketQua.SoDaXet, ketQua.SoDoiGio, ketQua.SoDanhDauNghi, ketQua.SoCanhBao);

        return ketQua;
    }

    /// <summary>
    /// Áp một thay đổi đọc được từ Google vào buổi học trong app.
    ///
    /// Nguyên tắc: chỉ tự sửa những gì KHÔNG đụng tới tiền và không ghi đè việc giáo viên đã làm.
    /// Đổi giờ thì áp luôn (đó là thông tin thời khoá biểu); huỷ buổi thì đánh dấu nghỉ vì
    /// <see cref="TrangThaiDiemDanh.ChuaDiemDanh"/> là "chưa có gì để mất"; còn buổi ĐÃ điểm danh
    /// thì không tự sửa — chỉ ghi lại chỗ lệch để giáo viên xem.
    /// </summary>
    private async Task ApDungThayDoiTuGoogleAsync(
        GiaoVien giaoVien,
        BuoiHoc buoi,
        SuKienGoogleDaDoc? suKien,
        TimeZoneInfo muiGio,
        KetQuaDongBoVeDto ketQua,
        Guid? nguoiThucHienId,
        CancellationToken huyBo)
    {
        var bayGio = DateTime.UtcNow;

        // Không đọc được sự kiện (đã bị xoá hẳn) hoặc Google báo đã huỷ — cùng một ý nghĩa với
        // người dùng: buổi này không còn trên lịch Google nữa.
        if (suKien is null || suKien.DaHuy)
        {
            // Buổi này đã được xử lý ở lần kéo trước (đã đánh dấu nghỉ vì Google huỷ). Không xét lại:
            // xét lại thì buổi do CHÍNH hệ thống đánh dấu nghỉ sẽ bị coi là "đã điểm danh rồi mới bị
            // huỷ" và sinh ra cảnh báo sai ở mọi lần đồng bộ sau đó.
            if (buoi.GoogleDaHuy)
            {
                ketQua.SoBoQua++;
                return;
            }

            buoi.GoogleDaHuy = true;

            if (buoi.DiemDanh is { } diemDanhCu && diemDanhCu.TrangThai != TrangThaiDiemDanh.ChuaDiemDanh)
            {
                buoi.GoogleLechGanNhat =
                    "Sự kiện đã bị huỷ trên Google Calendar nhưng buổi này đã điểm danh — kiểm tra lại rồi sửa nếu cần.";
                ketQua.SoCanhBao++;
                return;
            }

            if (buoi.DiemDanh is null)
            {
                buoi.DiemDanh = new DiemDanh { BuoiHocId = buoi.Id };
                db.DiemDanh.Add(buoi.DiemDanh);
            }

            buoi.DiemDanh.TrangThai = TrangThaiDiemDanh.Nghi;
            buoi.DiemDanh.LyDoNghi = LyDoNghi.CoPhep;
            buoi.DiemDanh.CoTinhTien = false;
            buoi.DiemDanh.GhiChu = GhepGhiChu(buoi.DiemDanh.GhiChu, "Buổi bị huỷ trên Google Calendar.");
            buoi.DiemDanh.NguoiDiemDanhId = giaoVien.Id;
            buoi.DiemDanh.ThoiDiemDiemDanhUtc = bayGio;
            buoi.DiemDanh.NgayCapNhatUtc = bayGio;
            buoi.GoogleLechGanNhat = null;
            ketQua.SoDanhDauNghi++;

            await nhatKy.GhiAsync(
                nguoiThucHienId ?? giaoVien.Id,
                HanhDongSuaTheoGoogle,
                "BuoiHoc",
                buoi.Id.ToString(),
                null,
                DichVuNhatKy.Json(new
                {
                    hocSinh = buoi.HocSinh?.HoTen,
                    ngay = buoi.Ngay,
                    viec = "danh_dau_nghi",
                    lyDo = "su_kien_bi_huy_tren_google",
                }),
                huyBo);

            return;
        }

        buoi.GoogleDaHuy = false;

        if (suKien.BatDau is not { } batDauGoogle)
        {
            ketQua.SoBoQua++;
            return;
        }

        var batDauTheoGioTuong = TimeZoneInfo.ConvertTime(batDauGoogle, muiGio).DateTime;
        var ketThucTheoGioTuong = suKien.KetThuc is { } ketThucGoogle
            ? TimeZoneInfo.ConvertTime(ketThucGoogle, muiGio).DateTime
            : batDauTheoGioTuong.AddMinutes(90);

        var ngayMoi = DateOnly.FromDateTime(batDauTheoGioTuong);
        var gioMoi = TimeOnly.FromDateTime(batDauTheoGioTuong);
        var gioKetThucMoi = TimeOnly.FromDateTime(ketThucTheoGioTuong);

        if (ngayMoi != buoi.Ngay)
        {
            // Đổi sang NGÀY khác thì KHÔNG tự sửa: buổi học trong app còn gắn với lịch lặp, học phí
            // theo kỳ và có thể đụng buổi khác cùng ngày. Ghi lại để giáo viên quyết định.
            buoi.GoogleLechGanNhat = "Trên Google sự kiện đã chuyển sang ngày "
                + ngayMoi.ToString("dd/MM/yyyy") + " — sửa buổi học trong app nếu đúng.";
            ketQua.SoCanhBao++;
            return;
        }

        if (gioMoi == buoi.GioBatDau && gioKetThucMoi == buoi.GioKetThuc)
        {
            buoi.GoogleLechGanNhat = null;
            ketQua.SoBoQua++;
            return;
        }

        // Đưa về đúng khung giờ của lịch tuần thì không còn là buổi bị dời nữa.
        if (buoi.GioBatDauTheoLich is { } gioGoc && gioMoi == gioGoc)
        {
            buoi.GioBatDauTheoLich = null;
        }

        var gioBatDauCu = buoi.GioBatDau;
        var gioKetThucCu = buoi.GioKetThuc;

        // Ghi lại khung giờ theo lịch tuần (lần đầu bị dời) để bộ sinh buổi không sinh thêm buổi
        // thứ hai ở giờ cũ; xem BuoiHoc.GioBatDauTheoLich.
        buoi.GioBatDauTheoLich ??= gioBatDauCu;

        buoi.GioBatDau = gioMoi;
        buoi.GioKetThuc = gioKetThucMoi;
        buoi.GoogleLechGanNhat = null;
        ketQua.SoDoiGio++;

        await nhatKy.GhiAsync(
            nguoiThucHienId ?? giaoVien.Id,
            HanhDongSuaTheoGoogle,
            "BuoiHoc",
            buoi.Id.ToString(),
            DichVuNhatKy.Json(new { GioBatDau = gioBatDauCu, GioKetThuc = gioKetThucCu }),
            DichVuNhatKy.Json(new { GioBatDau = buoi.GioBatDau, GioKetThuc = buoi.GioKetThuc, viec = "doi_gio" }),
            huyBo);
    }

    private static string GhepGhiChu(string? ghiChuCu, string ghiChuMoi)
    {
        return string.IsNullOrWhiteSpace(ghiChuCu) ? ghiChuMoi : ghiChuCu + " | " + ghiChuMoi;
    }

    private static SuKienGoogle TaoSuKien(
        BuoiHoc buoi,
        CaiDat caiDat,
        TimeZoneInfo muiGio,
        IReadOnlyList<(string TieuDe, DateOnly? HanNop)> danhSachTaiLieu)
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

        if (danhSachTaiLieu.Count > 0)
        {
            moTa.Add(string.Empty);
            moTa.Add("Bài tập đã giao:");
            foreach (var taiLieu in danhSachTaiLieu)
            {
                moTa.Add("- " + taiLieu.TieuDe
                    + (taiLieu.HanNop is { } han ? " (hạn nộp " + han.ToString("dd/MM") + ")" : string.Empty));
            }

            moTa.Add("Học sinh mở ứng dụng ClassManagement để tải bài tập.");
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
