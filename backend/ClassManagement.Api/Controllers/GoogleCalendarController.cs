using ClassManagement.Api.Auth;
using ClassManagement.Api.Data;
using ClassManagement.Api.Common;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using ClassManagement.Api.Google;
using ClassManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ClassManagement.Api.Controllers;

/// <summary>
/// Kết nối Google Calendar và đồng bộ lịch dạy lên đó.
///
/// Mỗi giáo viên tự quản kết nối Google của mình: buổi học của ai thì nằm trên lịch Google của người
/// đó, nên không ai — kể cả admin — kết nối hộ hay đọc token của người khác. Admin chỉ thấy số liệu
/// tổng hợp (bao nhiêu người đã kết nối) và có quyền chạy đồng bộ cho tất cả.
/// </summary>
[ApiController]
[Route("api/google-calendar")]
[Authorize]
public class GoogleCalendarController(
    AppDbContext db,
    DichVuGoogleCalendar google,
    DichVuDongBoLich dongBo,
    DichVuNhatKy nhatKy,
    NguoiDungHienTai nguoiDungHienTai,
    IHostEnvironment moiTruong,
    IOptions<GoogleCalendarOptions> tuyChon,
    ILogger<GoogleCalendarController> ghiLog) : ControllerBase
{
    private readonly GoogleCalendarOptions _tuyChon = tuyChon.Value;

    /// <summary>Trạng thái kết nối Google của chính người đang đăng nhập.</summary>
    [HttpGet("trang-thai")]
    public async Task<ActionResult<TrangThaiGoogleDto>> TrangThai(CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        return Ok(new TrangThaiGoogleDto
        {
            DaCauHinh = google.DaCauHinh,
            CheDoGia = google.CheDoGia,
            DaKetNoi = !string.IsNullOrWhiteSpace(toi.GoogleRefreshTokenMaHoa),
            TaiKhoan = toi.GoogleTaiKhoan,
            CalendarId = toi.GoogleCalendarId,
            Quyen = GoogleCalendarOptions.QuyenCanXin,
            LanDongBoCuoi = await dongBo.LayLanDongBoCuoiAsync(toi, huyBo),
            LanDongBoVeCuoi = await dongBo.LayLanDongBoVeCuoiAsync(toi, huyBo),
            TuDongDongBo = toi.GoogleTuDongDongBo,
            // Bản ghi cũ (kết nối trước khi app xin quyền Drive) không biết mình có quyền gì: coi như
            // CHƯA có để giao diện nhắc kết nối lại — sai theo hướng an toàn.
            CoQuyenDrive = !string.IsNullOrWhiteSpace(toi.GoogleQuyenDaCap)
                && GoogleCalendarOptions.CoQuyenDrive(toi.GoogleQuyenDaCap),
        });
    }

    /// <summary>Số liệu cho admin: bao nhiêu giáo viên đã kết nối Google. Không kèm email hay token của ai.</summary>
    [HttpGet("tong-hop")]
    public async Task<ActionResult<TongHopGoogleDto>> TongHop(CancellationToken huyBo)
    {
        await nguoiDungHienTai.YeuCauAdminAsync(huyBo);

        var dangLam = await db.GiaoVien
            .AsNoTracking()
            .Where(x => x.TrangThai == TrangThaiGiaoVien.DangLam)
            .OrderBy(x => x.HoTen)
            .Select(x => new { x.HoTen, DaKetNoi = x.GoogleRefreshTokenMaHoa != null })
            .ToListAsync(huyBo);

        return Ok(new TongHopGoogleDto
        {
            SoGiaoVienDangLam = dangLam.Count,
            SoDaKetNoi = dangLam.Count(x => x.DaKetNoi),
            SoChuaKetNoi = dangLam.Count(x => !x.DaKetNoi),
            TenChuaKetNoi = dangLam.Where(x => !x.DaKetNoi).Select(x => x.HoTen).ToList(),
        });
    }

    /// <summary>Đường dẫn để chính người đang đăng nhập bấm vào mà cấp quyền. Không tự chuyển hướng ở đây.</summary>
    [HttpGet("duong-dan-uy-quyen")]
    public async Task<ActionResult<DuongDanUyQuyenDto>> DuongDanUyQuyen(CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        var yeuCau = google.TaoYeuCauUyQuyen(MucDichUyQuyen.KetNoi, toi.Id);

        // Chế độ giả: trỏ vào chính backend để bấm là xong, vì tài khoản Google thật không có.
        var url = google.CheDoGia
            ? "/api/google-calendar/gia-cap-quyen?state=" + Uri.EscapeDataString(yeuCau.State)
            : yeuCau.Url;

        return Ok(new DuongDanUyQuyenDto
        {
            Url = url,
            Quyen = GoogleCalendarOptions.QuyenCanXin,
            CheDoGia = google.CheDoGia,
        });
    }

    /// <summary>Google gọi lại địa chỉ này sau khi người dùng đồng ý. State đã ký chính là hàng rào.</summary>
    [HttpGet("callback")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback(
        [FromQuery] string? code,
        [FromQuery] string? state,
        [FromQuery] string? error,
        CancellationToken huyBo)
    {
        if (!string.IsNullOrWhiteSpace(error))
        {
            return QuayVeCaiDat("loi", "Google báo: " + error);
        }

        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
        {
            return QuayVeCaiDat("loi", "Google không trả mã uỷ quyền.");
        }

        try
        {
            var noiDung = google.KiemTraState(state);
            if (noiDung.MucDich != MucDichUyQuyen.KetNoi || noiDung.GiaoVienId is not { } giaoVienId)
            {
                return QuayVeCaiDat("loi", "Yêu cầu này không phải để kết nối lịch.");
            }

            var giaoVien = await db.GiaoVien.FirstOrDefaultAsync(x => x.Id == giaoVienId, huyBo);
            if (giaoVien is null)
            {
                return QuayVeCaiDat("loi", "Không tìm thấy giáo viên của yêu cầu kết nối.");
            }

            await google.KetNoiAsync(giaoVien, code, huyBo);
            return QuayVeCaiDat("ket-noi-thanh-cong", null);
        }
        catch (LoiApiException loi)
        {
            ghiLog.LogWarning("Kết nối Google Calendar thất bại: {TieuDe} — {ChiTiet}", loi.TieuDe, loi.ChiTiet);
            return QuayVeCaiDat("loi", loi.ChiTiet ?? loi.TieuDe);
        }
    }

    /// <summary>
    /// Chỉ tồn tại ở chế độ giả trên máy dev: đóng vai màn hình đồng ý của Google bằng cách chuyển
    /// hướng về đúng địa chỉ callback thật, nên toàn bộ đường xử lý thật vẫn được chạy.
    /// </summary>
    [HttpGet("gia-cap-quyen")]
    [AllowAnonymous]
    public async Task<IActionResult> GiaCapQuyen(
        [FromQuery] string state,
        [FromQuery] string? email,
        CancellationToken huyBo)
    {
        if (!_tuyChon.CheDoGia || !moiTruong.IsDevelopment())
        {
            return NotFound();
        }

        MucDichUyQuyen mucDich;
        Guid? giaoVienId;
        try
        {
            var noiDung = google.KiemTraState(state);
            mucDich = noiDung.MucDich;
            giaoVienId = noiDung.GiaoVienId;
        }
        catch (LoiApiException loi)
        {
            return QuayVeCaiDat("loi", loi.ChiTiet ?? loi.TieuDe);
        }

        if (mucDich != MucDichUyQuyen.KetNoi || giaoVienId is not { } id)
        {
            return QuayVeCaiDat("loi", "Yêu cầu này không phải để kết nối lịch.");
        }

        // Tài khoản Google giả: mặc định lấy đúng email của giáo viên, cho giống thực tế.
        var taiKhoanGia = email ?? await db.GiaoVien
            .Where(x => x.Id == id)
            .Select(x => x.Email)
            .FirstOrDefaultAsync(huyBo) ?? "giao.vien.gia@classmanagement.local";

        var duongDan = "/api/google-calendar/callback?code="
            + Uri.EscapeDataString(KhachGoogleCalendarGia.TienToKetNoi + taiKhoanGia)
            + "&state=" + Uri.EscapeDataString(state);

        // Hiện trang nói rõ đang đóng vai ai, không tự chuyển hướng — xem TrangDongYGia trong README.
        return Content(TrangDongYGiaKetNoi(taiKhoanGia, duongDan), "text/html; charset=utf-8");
    }

    /// <summary>
    /// Chỉ có ở chế độ giả trên máy dev: trả về đúng những sự kiện mà bản giả đã "gửi lên Google",
    /// để kiểm tra nội dung, giờ giấc và múi giờ mà không cần tài khoản Google thật.
    /// </summary>
    [HttpGet("gia-su-kien-da-gui")]
    [AllowAnonymous]
    public ActionResult<IReadOnlyList<SuKienGiaDaGui>> GiaSuKienDaGui()
    {
        if (!_tuyChon.CheDoGia || !moiTruong.IsDevelopment())
        {
            return NotFound();
        }

        return Ok(KhachGoogleCalendarGia.SuKienDaGui.ToList());
    }

    /// <summary>Chỉ ở chế độ giả: xoá dấu vết các sự kiện đã gửi, để lần kiểm thử sau bắt đầu sạch.</summary>
    [HttpPost("gia-xoa-dau-vet")]
    [AllowAnonymous]
    public ActionResult<int> GiaXoaDauVet()
    {
        if (!_tuyChon.CheDoGia || !moiTruong.IsDevelopment())
        {
            return NotFound();
        }

        return Ok(KhachGoogleCalendarGia.XoaDauVet());
    }

    /// <summary>
    /// Chỉ ở chế độ giả: những sự kiện đang nằm "trên lịch Google" — dùng để kiểm thử chiều KÉO VỀ
    /// (lấy id sự kiện rồi sửa giờ hoặc huỷ ngay trên Google, không qua app).
    /// </summary>
    [HttpGet("gia-su-kien-tren-google")]
    [AllowAnonymous]
    public ActionResult<IReadOnlyList<SuKienGiaTrenGoogle>> GiaSuKienTrenGoogle()
    {
        if (!_tuyChon.CheDoGia || !moiTruong.IsDevelopment())
        {
            return NotFound();
        }

        return Ok(KhachGoogleCalendarGia.SuKienTrenGoogle.ToList());
    }

    /// <summary>
    /// Chỉ ở chế độ giả: đóng vai giáo viên sửa giờ hoặc huỷ một sự kiện NGAY TRÊN GOOGLE. Đây là
    /// hành vi mà chiều kéo về phải phát hiện được, nên kiểm thử cần cách tạo ra nó.
    /// </summary>
    [HttpPost("gia-sua-tren-google")]
    [AllowAnonymous]
    public ActionResult<object> GiaSuaTrenGoogle(GiaSuaSuKienRequest yeuCau)
    {
        if (!_tuyChon.CheDoGia || !moiTruong.IsDevelopment())
        {
            return NotFound();
        }

        if (yeuCau.Huy)
        {
            var daHuy = KhachGoogleCalendarGia.HuyTrenGoogle(yeuCau.EventId);
            return daHuy is null ? NotFound() : Ok(new { daHuy.Id, daHuy.DaHuy });
        }

        if (yeuCau.BatDau is not { } batDau || yeuCau.KetThuc is not { } ketThuc)
        {
            return BadRequest(new { detail = "Cần cả batDau và ketThuc khi sửa giờ." });
        }

        var daSua = KhachGoogleCalendarGia.SuaTrenGoogle(yeuCau.EventId, batDau, ketThuc);
        return daSua is null ? NotFound() : Ok(new { daSua.Id, daSua.BatDau, daSua.KetThuc });
    }

    /// <summary>
    /// KÉO thay đổi từ Google Calendar về app cho chính người đang đăng nhập.
    ///
    /// Màn Lịch dạy gọi endpoint này với <c>chiKhiQuaHan = true</c> mỗi lần mở: máy chủ tự bỏ qua nếu
    /// lần đồng bộ trước chưa quá 10 phút, nên mở đi mở lại vài lần không làm Google bị gọi liên tục.
    /// Nút "Đồng bộ lại" gọi với <c>chiKhiQuaHan = false</c> để chạy ngay.
    /// </summary>
    [HttpPost("dong-bo-ve")]
    public async Task<ActionResult<KetQuaDongBoVeDto>> DongBoVe(DongBoVeRequest yeuCau, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        return Ok(await dongBo.DongBoVeAsync(
            toi,
            yeuCau.TuNgay,
            yeuCau.DenNgay,
            toi.Id,
            yeuCau.ChiKhiQuaHan,
            huyBo));
    }

    /// <summary>Bật/tắt tự kéo thay đổi từ Google về khi mở màn Lịch dạy — của chính người đang đăng nhập.</summary>
    [HttpPut("tu-dong-dong-bo")]
    public async Task<ActionResult<TrangThaiGoogleDto>> BatTuDongDongBo(
        BatTuDongDongBoRequest yeuCau,
        CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        toi.GoogleTuDongDongBo = yeuCau.Bat;
        await db.SaveChangesAsync(huyBo);

        await ghiLogNhatKy(toi.Id, yeuCau.Bat, huyBo);

        return Ok(new { tuDongDongBo = toi.GoogleTuDongDongBo });
    }

    private async Task ghiLogNhatKy(Guid nguoiThucHienId, bool bat, CancellationToken huyBo)
    {
        await nhatKy.GhiAsync(
            nguoiThucHienId,
            "doi_tu_dong_dong_bo_google",
            "GiaoVien",
            nguoiThucHienId.ToString(),
            null,
            DichVuNhatKy.Json(new { tuDongDongBo = bat }),
            huyBo);
    }

    /// <summary>Ngắt kết nối của chính mình. Hỏi trước có xoá các sự kiện đã tạo trên Google hay không.</summary>
    [HttpPost("ngat-ket-noi")]
    public async Task<ActionResult<KetQuaDongBoDto?>> NgatKetNoi(NgatKetNoiRequest yeuCau, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        KetQuaDongBoDto? ketQuaXoa = null;

        if (yeuCau.XoaSuKienDaTao)
        {
            ketQuaXoa = await dongBo.XoaSuKienDaTaoAsync(toi, toi.Id, huyBo);
        }
        else
        {
            // Giữ sự kiện trên Google nhưng quên id: hệ thống không còn theo dõi chúng nữa.
            await dongBo.QuenSuKienDaLuuAsync(toi, huyBo);
        }

        await google.NgatKetNoiAsync(toi, huyBo);
        return Ok(ketQuaXoa);
    }

    [HttpGet("danh-sach-lich")]
    public async Task<ActionResult<IReadOnlyList<LichGoogleDto>>> DanhSachLich(CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        var danhSach = await google.LayDanhSachLichAsync(toi, huyBo);

        return Ok(danhSach
            .Select(x => new LichGoogleDto { Id = x.Id, Ten = x.Ten, LaLichChinh = x.LaLichChinh })
            .ToList());
    }

    [HttpPut("chon-lich")]
    public async Task<IActionResult> ChonLich(ChonLichRequest yeuCau, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);
        await google.ChonLichAsync(toi, yeuCau.CalendarId ?? string.Empty, huyBo);
        return NoContent();
    }

    /// <summary>
    /// Đồng bộ ngay. Bỏ trống khoảng ngày thì đồng bộ từ hôm nay tới hết tháng sau. Admin đặt
    /// TatCaGiaoVien = true để đồng bộ cho mọi giáo viên đã kết nối.
    /// </summary>
    [HttpPost("dong-bo")]
    public async Task<ActionResult<KetQuaDongBoDto>> DongBo(DongBoRequest yeuCau, CancellationToken huyBo)
    {
        var toi = await nguoiDungHienTai.YeuCauAsync(huyBo);

        if (!yeuCau.TatCaGiaoVien)
        {
            return Ok(await dongBo.DongBoAsync(toi, yeuCau.TuNgay, yeuCau.DenNgay, toi.Id, huyBo));
        }

        await nguoiDungHienTai.YeuCauAdminAsync(huyBo);
        return Ok(await dongBo.DongBoTatCaAsync(yeuCau.TuNgay, yeuCau.DenNgay, toi.Id, huyBo));
    }

    /* ------------------------------------------------------------------ */

    /// <summary>Trang HTML của màn hình đồng ý GIẢ khi nối lịch Google (chỉ máy dev).</summary>
    private static string TrangDongYGiaKetNoi(string taiKhoan, string duongDan)
    {
        Func<string, string> maHoa = chuoi => System.Net.WebUtility.HtmlEncode(chuoi);
        return $"""
            <!doctype html>
            <html lang="vi"><head><meta charset="utf-8"><title>Màn hình đồng ý GIẢ (máy dev)</title></head>
            <body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 16px; line-height: 1.6">
              <h1 style="color:#b45309">Đây KHÔNG phải Google thật</h1>
              <p>Máy chủ đang chạy <strong>chế độ giả</strong>: nối lịch Google của
              <strong>{maHoa(taiKhoan)}</strong> chỉ là giả lập trong bộ nhớ, không có sự kiện nào lên
              Google thật cả.</p>
              <p><a href="{maHoa(duongDan)}"
                    style="display:inline-block;padding:10px 18px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none">
                Vẫn tiếp tục với vai {maHoa(taiKhoan)}
              </a></p>
            </body></html>
            """;
    }

    private IActionResult QuayVeCaiDat(string ketQua, string? thongBao)
    {
        var dia = _tuyChon.FrontendUrl.TrimEnd('/') + "/settings?google=" + Uri.EscapeDataString(ketQua);

        if (!string.IsNullOrWhiteSpace(thongBao))
        {
            dia += "&thongBao=" + Uri.EscapeDataString(thongBao);
        }

        return Redirect(dia);
    }
}
