using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using ClassManagement.Api.Google;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Services;

/// <summary>
/// Tài liệu giao cho học sinh: tệp nằm trên Google Drive CỦA GIÁO VIÊN, app giữ bản ghi để biết ai
/// được giao bài gì.
///
/// Hai quyết định quan trọng:
///  - Tệp KHÔNG mở công khai trên Drive. Học sinh tải qua app (app đọc hộ tệp bằng token của giáo
///    viên), nên link Drive không bị lọt ra ngoài và không ai lấy được bài của học sinh khác.
///  - Quyền xin là <c>drive.file</c>: app chỉ thấy tệp do chính nó tạo, không đọc được phần còn lại
///    của Drive. Người kết nối Google TRƯỚC khi app xin quyền này phải kết nối lại — xem
///    <see cref="KiemTraQuyenDriveAsync"/>.
/// </summary>
public class DichVuTaiLieu(
    AppDbContext db,
    IKhachGoogleDrive drive,
    DichVuGoogleCalendar google,
    DichVuNhatKy nhatKy,
    ILogger<DichVuTaiLieu> ghiLog)
{
    public const string HanhDongGuiTaiLieu = "gui_tai_lieu";
    public const string HanhDongThuHoiTaiLieu = "thu_hoi_tai_lieu";

    /// <summary>Trần dung lượng một tệp. Đủ cho đề bài scan, mà không làm nghẽn máy chủ gói free.</summary>
    public const long KichThuocToiDaByte = 25L * 1024 * 1024;

    private static readonly string[] DuoiTepChoPhep =
    [
        ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt",
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".zip", ".rar",
    ];

    /// <summary>
    /// Chặn sớm khi token Google của giáo viên chưa có quyền ghi Drive. Không kiểm được (bản ghi cũ,
    /// chưa lưu quyền) thì cứ để lời gọi thật trả lỗi — lúc đó thông báo vẫn nói rõ cần kết nối lại.
    /// </summary>
    public async Task KiemTraQuyenDriveAsync(GiaoVien giaoVien, CancellationToken huyBo = default)
    {
        var trangThai = await google.DaKetNoiAsync(giaoVien, huyBo);

        if (!trangThai)
        {
            throw new LoiApiException(
                "Chưa kết nối Google Drive",
                StatusCodes.Status409Conflict,
                "Vào Cài đặt → Kết nối Google Calendar trước, rồi mới gửi được tài liệu.");
        }

        if (giaoVien.GoogleQuyenDaCap is { Length: > 0 } quyen
            && !GoogleCalendarOptions.CoQuyenDrive(quyen))
        {
            throw new LoiApiException(
                "Chưa có quyền ghi tài liệu lên Drive",
                StatusCodes.Status409Conflict,
                "Tài khoản Google này kết nối từ trước khi có tính năng gửi tài liệu. "
                + "Vào Cài đặt → Ngắt kết nối → Kết nối Google Calendar lại để cấp thêm quyền Drive.");
        }
    }

    /// <summary>Gửi một tài liệu lên Drive của giáo viên rồi ghi lại việc giao bài.</summary>
    public async Task<TaiLieuDto> GuiAsync(
        GiaoVien giaoVien,
        TaoTaiLieuRequest yeuCau,
        CancellationToken huyBo = default)
    {
        var tep = yeuCau.Tep
            ?? throw LoiApiException.DuLieuSai(
                "Chưa chọn tệp.",
                new Dictionary<string, string[]> { ["tep"] = ["Chọn một tệp để gửi"] });

        if (tep.Length <= 0)
        {
            throw LoiApiException.DuLieuSai(
                "Tệp rỗng.",
                new Dictionary<string, string[]> { ["tep"] = ["Tệp không có nội dung"] });
        }

        if (tep.Length > KichThuocToiDaByte)
        {
            throw LoiApiException.DuLieuSai(
                "Tệp quá lớn.",
                new Dictionary<string, string[]>
                {
                    ["tep"] = ["Tệp tối đa " + (KichThuocToiDaByte / 1024 / 1024) + "MB"],
                });
        }

        var tenTep = Path.GetFileName(tep.FileName);

        if (string.IsNullOrWhiteSpace(tenTep))
        {
            tenTep = "tai-lieu";
        }

        var duoi = Path.GetExtension(tenTep).ToLowerInvariant();
        if (!DuoiTepChoPhep.Contains(duoi))
        {
            throw LoiApiException.DuLieuSai(
                "Định dạng tệp không được hỗ trợ.",
                new Dictionary<string, string[]>
                {
                    ["tep"] = ["Chỉ nhận các định dạng: " + string.Join(", ", DuoiTepChoPhep)],
                });
        }

        var hocSinh = await db.HocSinh.FirstOrDefaultAsync(x => x.Id == yeuCau.HocSinhId, huyBo);

        // Học sinh của giáo viên khác: 404 như không tồn tại, không phải 403.
        if (hocSinh is null || (giaoVien.VaiTro != VaiTro.Admin && hocSinh.GiaoVienId != giaoVien.Id))
        {
            throw LoiApiException.NgoaiPhamVi("học sinh");
        }

        BuoiHoc? buoiHoc = null;
        if (yeuCau.BuoiHocId is { } buoiHocId)
        {
            buoiHoc = await db.BuoiHoc.FirstOrDefaultAsync(x => x.Id == buoiHocId, huyBo);

            if (buoiHoc is null || buoiHoc.HocSinhId != hocSinh.Id)
            {
                throw LoiApiException.DuLieuSai(
                    "Buổi học không thuộc học sinh này.",
                    new Dictionary<string, string[]> { ["buoiHocId"] = ["Chọn buổi học của chính học sinh đó"] });
            }
        }

        await KiemTraQuyenDriveAsync(giaoVien, huyBo);

        var accessToken = await google.LayAccessTokenAsync(giaoVien, huyBo);
        var mime = string.IsNullOrWhiteSpace(tep.ContentType) ? "application/octet-stream" : tep.ContentType;

        TepDrive tepDrive;
        await using (var luong = tep.OpenReadStream())
        {
            tepDrive = await drive.TaiLenAsync(accessToken, tenTep, mime, luong, huyBo);
        }

        var bayGio = DateTime.UtcNow;
        var taiLieu = new TaiLieu
        {
            GiaoVienId = giaoVien.Id,
            HocSinhId = hocSinh.Id,
            BuoiHocId = buoiHoc?.Id,
            TieuDe = string.IsNullOrWhiteSpace(yeuCau.TieuDe) ? Path.GetFileNameWithoutExtension(tenTep) : yeuCau.TieuDe.Trim(),
            TenTep = tenTep,
            MimeType = tepDrive.MimeType ?? mime,
            KichThuocByte = tepDrive.KichThuocByte > 0 ? tepDrive.KichThuocByte : tep.Length,
            GoogleDriveFileId = tepDrive.Id,
            GoogleDriveLink = tepDrive.LinkXem,
            HanNop = yeuCau.HanNop,
            GhiChu = yeuCau.GhiChu?.Trim(),
            NgayTaoUtc = bayGio,
            NgayCapNhatUtc = bayGio,
        };

        db.TaiLieu.Add(taiLieu);

        // Buổi học có bài tập mới thì lần đồng bộ kế tiếp phải ghi lại sự kiện trên Google để học
        // sinh thấy được là "có bài" ngay trên lịch. Đặt mốc đồng bộ về null là cách đánh dấu đó.
        if (buoiHoc is not null)
        {
            buoiHoc.GoogleDongBoUtc = null;
        }

        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            giaoVien.Id,
            HanhDongGuiTaiLieu,
            "TaiLieu",
            taiLieu.Id.ToString(),
            null,
            DichVuNhatKy.Json(new
            {
                hocSinh = hocSinh.HoTen,
                taiLieu.TieuDe,
                taiLieu.TenTep,
                taiLieu.KichThuocByte,
                taiLieu.HanNop,
                buoiHocId = buoiHoc?.Id,
            }),
            huyBo);

        ghiLog.LogInformation(
            "Giáo viên {Ten} gửi tài liệu {Tep} cho học sinh {HocSinh}.",
            giaoVien.HoTen, taiLieu.TieuDe, hocSinh.HoTen);

        taiLieu.HocSinh = hocSinh;
        taiLieu.BuoiHoc = buoiHoc;
        return TaoDto(taiLieu);
    }

    /// <summary>Danh sách tài liệu đã giao, nhìn từ phía giáo viên.</summary>
    public async Task<IReadOnlyList<TaiLieuDto>> DanhSachCuaGiaoVienAsync(
        GiaoVien giaoVien,
        Guid? hocSinhId,
        Guid? buoiHocId,
        CancellationToken huyBo = default)
    {
        var truyVan = db.TaiLieu
            .AsNoTracking()
            .Include(x => x.HocSinh)
            .Include(x => x.BuoiHoc)
            .Where(x => !x.DaXoa);

        if (giaoVien.VaiTro != VaiTro.Admin)
        {
            truyVan = truyVan.Where(x => x.GiaoVienId == giaoVien.Id);
        }

        if (hocSinhId is { } hocSinh)
        {
            truyVan = truyVan.Where(x => x.HocSinhId == hocSinh);
        }

        if (buoiHocId is { } buoiHoc)
        {
            truyVan = truyVan.Where(x => x.BuoiHocId == buoiHoc);
        }

        var danhSach = await truyVan
            .OrderByDescending(x => x.NgayTaoUtc)
            .ToListAsync(huyBo);

        return danhSach.Select(TaoDto).ToList();
    }

    /// <summary>Danh sách bài tập của HỌC SINH đang đăng nhập. Chỉ của chính em, không của ai khác.</summary>
    public async Task<IReadOnlyList<BaiTapCuaHocSinhDto>> DanhSachCuaHocSinhAsync(
        HocSinh hocSinh,
        CancellationToken huyBo = default)
    {
        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);

        var danhSach = await db.TaiLieu
            .AsNoTracking()
            .Include(x => x.BuoiHoc)
            .Include(x => x.GiaoVien)
            .Where(x => x.HocSinhId == hocSinh.Id && !x.DaXoa)
            .OrderByDescending(x => x.HanNop == null)
            .ThenByDescending(x => x.HanNop)
            .ThenByDescending(x => x.NgayTaoUtc)
            .ToListAsync(huyBo);

        return danhSach.Select(x => new BaiTapCuaHocSinhDto
        {
            Id = x.Id,
            TieuDe = x.TieuDe,
            TenTep = x.TenTep,
            MimeType = x.MimeType,
            KichThuocByte = x.KichThuocByte,
            HanNop = x.HanNop,
            GhiChu = x.GhiChu,
            TenGiaoVien = x.GiaoVien?.HoTen ?? "—",
            BuoiHocId = x.BuoiHocId,
            NgayBuoi = x.BuoiHoc?.Ngay,
            GioBuoi = x.BuoiHoc?.GioBatDau,
            QuaHan = x.HanNop is { } han && han < homNay,
            NgayTaoUtc = x.NgayTaoUtc,
        }).ToList();
    }

    /// <summary>Thu hồi một tài liệu: xoá tệp trên Drive của giáo viên và đánh dấu đã xoá trong app.</summary>
    public async Task ThuHoiAsync(GiaoVien giaoVien, Guid taiLieuId, CancellationToken huyBo = default)
    {
        var taiLieu = await db.TaiLieu
            .Include(x => x.HocSinh)
            .Include(x => x.BuoiHoc)
            .FirstOrDefaultAsync(x => x.Id == taiLieuId, huyBo);

        if (taiLieu is null || taiLieu.DaXoa
            || (giaoVien.VaiTro != VaiTro.Admin && taiLieu.GiaoVienId != giaoVien.Id))
        {
            throw LoiApiException.NgoaiPhamVi("tài liệu");
        }

        // Tệp nằm trên Drive của CHÍNH giáo viên đã gửi (kể cả khi admin thu hồi hộ).
        var chuSoHuu = taiLieu.GiaoVienId == giaoVien.Id
            ? giaoVien
            : await db.GiaoVien.FirstOrDefaultAsync(x => x.Id == taiLieu.GiaoVienId, huyBo)
                ?? throw LoiApiException.NgoaiPhamVi("giáo viên đã gửi tài liệu");

        try
        {
            var accessToken = await google.LayAccessTokenAsync(chuSoHuu, huyBo);
            await drive.XoaAsync(accessToken, taiLieu.GoogleDriveFileId, huyBo);
        }
        catch (LoiApiException loi)
        {
            // Không xoá được trên Drive (token hết hiệu lực, tệp đã bị xoá tay…) vẫn phải thu hồi
            // trong app: học sinh không được thấy bài mà giáo viên đã gỡ.
            ghiLog.LogWarning(
                "Không xoá được tệp Drive {TepId} của tài liệu {TaiLieuId}: {Loi}",
                taiLieu.GoogleDriveFileId, taiLieu.Id, loi.TieuDe);
        }

        taiLieu.DaXoa = true;
        taiLieu.NgayCapNhatUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            giaoVien.Id,
            HanhDongThuHoiTaiLieu,
            "TaiLieu",
            taiLieu.Id.ToString(),
            DichVuNhatKy.Json(new { taiLieu.TieuDe, taiLieu.TenTep }),
            null,
            huyBo);
    }

    /// <summary>Lấy tài liệu theo id nếu GIÁO VIÊN đang đăng nhập được phép xem.</summary>
    public async Task<TaiLieu?> LayChoGiaoVienAsync(GiaoVien giaoVien, Guid taiLieuId, CancellationToken huyBo = default)
    {
        var taiLieu = await db.TaiLieu
            .AsNoTracking()
            .Include(x => x.GiaoVien)
            .FirstOrDefaultAsync(x => x.Id == taiLieuId && !x.DaXoa, huyBo);

        if (taiLieu is null)
        {
            return null;
        }

        return giaoVien.VaiTro == VaiTro.Admin || taiLieu.GiaoVienId == giaoVien.Id ? taiLieu : null;
    }

    /// <summary>Lấy tài liệu theo id nếu HỌC SINH đang đăng nhập là người được giao bài đó.</summary>
    public async Task<TaiLieu?> LayChoHocSinhAsync(HocSinh hocSinh, Guid taiLieuId, CancellationToken huyBo = default)
    {
        return await db.TaiLieu
            .AsNoTracking()
            .Include(x => x.GiaoVien)
            .FirstOrDefaultAsync(x => x.Id == taiLieuId && !x.DaXoa && x.HocSinhId == hocSinh.Id, huyBo);
    }

    /// <summary>
    /// Chép nội dung tệp từ Drive xuống luồng đích. App làm trung gian nên tệp không bao giờ phải mở
    /// công khai, và mỗi lần tải đều đi qua kiểm tra quyền của chính người đang đăng nhập.
    /// </summary>
    public async Task ChuyenTepXuongAsync(TaiLieu taiLieu, Stream dich, CancellationToken huyBo = default)
    {
        var chuSoHuu = taiLieu.GiaoVien
            ?? await db.GiaoVien.FirstOrDefaultAsync(x => x.Id == taiLieu.GiaoVienId, huyBo)
            ?? throw LoiApiException.NgoaiPhamVi("giáo viên đã gửi tài liệu");

        var accessToken = await google.LayAccessTokenAsync(chuSoHuu, huyBo);
        await drive.SaoChepXuongAsync(accessToken, taiLieu.GoogleDriveFileId, dich, huyBo);
    }

    public static TaiLieuDto TaoDto(TaiLieu taiLieu)
    {
        return new TaiLieuDto
        {
            Id = taiLieu.Id,
            HocSinhId = taiLieu.HocSinhId,
            TenHocSinh = taiLieu.HocSinh?.HoTen ?? "—",
            BuoiHocId = taiLieu.BuoiHocId,
            NgayBuoi = taiLieu.BuoiHoc?.Ngay,
            GioBuoi = taiLieu.BuoiHoc?.GioBatDau,
            TieuDe = taiLieu.TieuDe,
            TenTep = taiLieu.TenTep,
            MimeType = taiLieu.MimeType,
            KichThuocByte = taiLieu.KichThuocByte,
            HanNop = taiLieu.HanNop,
            GhiChu = taiLieu.GhiChu,
            LinkDrive = taiLieu.GoogleDriveLink,
            NgayTaoUtc = taiLieu.NgayTaoUtc,
        };
    }
}
