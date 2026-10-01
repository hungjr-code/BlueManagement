using System.Globalization;
using System.Text;
using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Dtos;
using ClassManagement.Api.Entities;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Services;

/// <summary>
/// Học phí và thu tiền.
///
/// Nguyên tắc: số buổi và thành tiền luôn ĐẾM VÀ TÍNH TỪ ĐIỂM DANH, không cho nhập tay — nhập tay là
/// mất tính đúng đắn, sau này không đối chiếu được với lịch dạy. Vì vậy học phí của một kỳ được
/// "tính" ra thành từng dòng, và người dùng chỉ được sửa gián tiếp qua việc điểm danh.
///
/// Buổi nghỉ CÓ phép không tính tiền (đã báo trước). Buổi nghỉ KHÔNG phép tính tiền hay không là
/// tuỳ trung tâm, đọc từ <see cref="CaiDat.TinhTienNghiKhongPhep"/>. Buổi CHƯA điểm danh không tính
/// tiền, và khi chốt sổ mà còn buổi đã qua chưa điểm danh thì hệ thống cảnh báo chứ không tự đoán.
/// </summary>
public class DichVuHocPhi(
    AppDbContext db,
    DichVuBuoiHoc buoiHoc,
    DichVuNhatKy nhatKy,
    ILogger<DichVuHocPhi> ghiLog)
{
    public const string HanhDongTinhKy = "tinh_hoc_phi_ky";
    public const string HanhDongThuTien = "thu_hoc_phi";
    public const string HanhDongHuyPhieuThu = "huy_phieu_thu";
    public const string HanhDongChotSo = "chot_so_hoc_phi";
    public const string HanhDongMoChotSo = "mo_chot_so_hoc_phi";
    public const string HanhDongDoiChieu = "doi_chieu_ngan_hang";

    /* --------------------------------- Tiện ích -------------------------------- */

    public static (DateOnly Tu, DateOnly Den) KhoangThang(int thang, int nam)
    {
        var dau = new DateOnly(nam, thang, 1);
        return (dau, dau.AddMonths(1).AddDays(-1));
    }

    public static void KiemTraKy(int thang, int nam)
    {
        if (thang is < 1 or > 12)
        {
            throw LoiApiException.DuLieuSai("Tháng không hợp lệ.", new Dictionary<string, string[]> { ["thang"] = ["Tháng phải từ 1 đến 12"] });
        }

        if (nam is < 2000 or > 2100)
        {
            throw LoiApiException.DuLieuSai("Năm không hợp lệ.", new Dictionary<string, string[]> { ["nam"] = ["Năm phải từ 2000 đến 2100"] });
        }
    }

    /// <summary>Hạn đóng tiền của kỳ: ngày đã khai với học sinh, kẹp lại nếu tháng đó không có ngày 31.</summary>
    public static DateOnly TinhHanDongTien(int thang, int nam, int ngayDenHan)
    {
        var soNgay = DateTime.DaysInMonth(nam, thang);
        return new DateOnly(nam, thang, Math.Clamp(ngayDenHan, 1, soNgay));
    }

    public static TrangThaiThanhToan SuyTrangThai(decimal thanhTien, decimal daThu)
    {
        if (daThu <= 0)
        {
            return TrangThaiThanhToan.ChuaThu;
        }

        return daThu >= thanhTien ? TrangThaiThanhToan.DaThu : TrangThaiThanhToan.ThuMotPhan;
    }

    /// <summary>Bỏ dấu tiếng Việt và hạ chữ thường: nội dung chuyển khoản ngoài ngân hàng thường không dấu.</summary>
    public static string KhongDau(string? chuoi)
    {
        if (string.IsNullOrWhiteSpace(chuoi))
        {
            return string.Empty;
        }

        var chuanHoa = chuoi.Normalize(NormalizationForm.FormD);
        var ketQua = new StringBuilder(chuanHoa.Length);

        foreach (var kyTu in chuanHoa)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(kyTu) != UnicodeCategory.NonSpacingMark)
            {
                ketQua.Append(kyTu);
            }
        }

        return ketQua.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }

    /* ------------------------------- Tính học phí ------------------------------ */

    /// <summary>
    /// Tính (hoặc tính lại) học phí của một kỳ. Dòng đã chốt sổ thì không đụng tới — giữ nguyên con
    /// số đã chốt, muốn tính lại phải mở chốt sổ trước.
    /// </summary>
    public async Task<KetQuaTinhKyDto> TinhKyAsync(
        int thang,
        int nam,
        Guid? giaoVienId,
        Guid? nguoiThucHienId,
        CancellationToken huyBo = default)
    {
        KiemTraKy(thang, nam);
        var (tu, den) = KhoangThang(thang, nam);
        var caiDat = await LayCaiDatAsync(huyBo);

        var hocSinh = await db.HocSinh
            .Include(x => x.GiaoVien)
            .Where(x => giaoVienId == null || x.GiaoVienId == giaoVienId)
            .Where(x => x.TrangThai != TrangThaiHocSinh.DaNghi)
            .OrderBy(x => x.HoTen)
            .ToListAsync(huyBo);

        var daCo = await db.HocPhi
            .Where(x => x.Thang == thang && x.Nam == nam)
            .ToDictionaryAsync(x => x.HocSinhId, huyBo);

        var ketQua = new KetQuaTinhKyDto { Thang = thang, Nam = nam };
        var bayGio = DateTime.UtcNow;

        foreach (var em in hocSinh)
        {
            // Sinh bù buổi của kỳ trước khi đếm: kỳ có thể chưa từng được mở nên chưa có buổi nào.
            await buoiHoc.BaoDamBuoiHocAsync(em, tu, den, huyBo);

            var (diHoc, nghiCoPhep, nghiKhongPhep, chuaDiemDanh) = await DemBuoiAsync(em.Id, tu, den, huyBo);

            // Không có buổi nào trong kỳ thì không sinh dòng học phí: tránh hoá đơn 0 đồng cho người
            // đã nghỉ từ lâu, mà lịch sử cũ vẫn còn nguyên.
            if (diHoc + nghiCoPhep + nghiKhongPhep + chuaDiemDanh == 0)
            {
                continue;
            }

            var donGia = em.CachTinhHocPhi == CachTinhHocPhi.TheoThang
                ? em.HocPhiTheoThang ?? 0
                : em.DonGiaTheoBuoi ?? 0;

            var thanhTien = TinhThanhTien(em, caiDat, donGia, diHoc, nghiKhongPhep);
            var hanDong = TinhHanDongTien(thang, nam, em.NgayDenHanDongTien);

            if (daCo.TryGetValue(em.Id, out var dong))
            {
                if (dong.DaChotSo)
                {
                    ketQua.SoBoQuaDaChot++;
                    ketQua.TongThanhTien += dong.ThanhTien;
                    continue;
                }

                dong.SoBuoiDiHoc = diHoc;
                dong.SoBuoiNghiCoPhep = nghiCoPhep;
                dong.SoBuoiNghiKhongPhep = nghiKhongPhep;
                dong.DonGiaApDung = donGia;
                dong.ThanhTien = thanhTien;
                dong.HanDongTien = hanDong;
                dong.GiaoVienId = em.GiaoVienId;
                dong.TrangThaiThanhToan = SuyTrangThai(thanhTien, dong.SoTienDaThu);
                ketQua.SoCapNhat++;
                ketQua.TongThanhTien += thanhTien;
                continue;
            }

            db.HocPhi.Add(new HocPhi
            {
                HocSinhId = em.Id,
                GiaoVienId = em.GiaoVienId,
                Thang = thang,
                Nam = nam,
                HanDongTien = hanDong,
                SoBuoiDiHoc = diHoc,
                SoBuoiNghiCoPhep = nghiCoPhep,
                SoBuoiNghiKhongPhep = nghiKhongPhep,
                DonGiaApDung = donGia,
                ThanhTien = thanhTien,
                SoTienDaThu = 0,
                TrangThaiThanhToan = TrangThaiThanhToan.ChuaThu,
                NgayTaoUtc = bayGio,
            });

            ketQua.SoTao++;
            ketQua.TongThanhTien += thanhTien;
        }

        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            nguoiThucHienId,
            HanhDongTinhKy,
            "HocPhi",
            $"{nam:0000}-{thang:00}",
            null,
            DichVuNhatKy.Json(ketQua),
            huyBo);

        ghiLog.LogInformation(
            "Tính học phí {Thang}/{Nam}: tạo {Tao}, cập nhật {CapNhat}, bỏ qua đã chốt {BoQua}.",
            thang, nam, ketQua.SoTao, ketQua.SoCapNhat, ketQua.SoBoQuaDaChot);

        return ketQua;
    }

    private static decimal TinhThanhTien(
        HocSinh em,
        CaiDat caiDat,
        decimal donGia,
        int diHoc,
        int nghiKhongPhep)
    {
        if (em.CachTinhHocPhi == CachTinhHocPhi.TheoThang)
        {
            // Theo tháng: giữ chỗ nên thu đủ tháng, số buổi chỉ để hiển thị và đối chiếu.
            return donGia;
        }

        var soBuoiTinhTien = diHoc + (caiDat.TinhTienNghiKhongPhep ? nghiKhongPhep : 0);
        return donGia * soBuoiTinhTien;
    }

    private async Task<(int DiHoc, int NghiCoPhep, int NghiKhongPhep, int ChuaDiemDanh)> DemBuoiAsync(
        Guid hocSinhId,
        DateOnly tu,
        DateOnly den,
        CancellationToken huyBo)
    {
        var buoi = await db.BuoiHoc
            .AsNoTracking()
            .Where(x => x.HocSinhId == hocSinhId && x.Ngay >= tu && x.Ngay <= den)
            .Select(x => new
            {
                TrangThai = x.DiemDanh == null ? (TrangThaiDiemDanh?)null : x.DiemDanh.TrangThai,
                LyDoNghi = x.DiemDanh == null ? (LyDoNghi?)null : x.DiemDanh.LyDoNghi,
            })
            .ToListAsync(huyBo);

        var diHoc = buoi.Count(x => x.TrangThai == TrangThaiDiemDanh.DiHoc);
        var nghiCoPhep = buoi.Count(x => x.TrangThai == TrangThaiDiemDanh.Nghi && x.LyDoNghi == LyDoNghi.CoPhep);
        var nghiKhongPhep = buoi.Count(x => x.TrangThai == TrangThaiDiemDanh.Nghi && x.LyDoNghi == LyDoNghi.KhongPhep);
        var chuaDiemDanh = buoi.Count(x => x.TrangThai is null or TrangThaiDiemDanh.ChuaDiemDanh);

        return (diHoc, nghiCoPhep, nghiKhongPhep, chuaDiemDanh);
    }

    /* ---------------------------------- Xem kỳ --------------------------------- */

    public async Task<IReadOnlyList<HocPhiDto>> LayKyAsync(
        int thang,
        int nam,
        Guid? giaoVienId,
        TrangThaiThanhToan? trangThai,
        CancellationToken huyBo = default)
    {
        KiemTraKy(thang, nam);

        var truyVan = db.HocPhi
            .AsNoTracking()
            .Include(x => x.HocSinh)
            .Include(x => x.GiaoVien)
            .Where(x => x.Thang == thang && x.Nam == nam)
            .Where(x => giaoVienId == null || x.GiaoVienId == giaoVienId);

        if (trangThai is { } tt)
        {
            truyVan = truyVan.Where(x => x.TrangThaiThanhToan == tt);
        }

        var danhSach = await truyVan
            .OrderBy(x => x.HanDongTien)
            .ThenBy(x => x.HocSinh!.HoTen)
            .ToListAsync(huyBo);

        var soChuaDiemDanh = await DemChuaDiemDanhTheoHocSinhAsync(thang, nam, huyBo);

        return danhSach
            .Select(x => TaoDto(x, soChuaDiemDanh.GetValueOrDefault(x.HocSinhId)))
            .ToList();
    }

    public async Task<HocPhiChiTietDto> ChiTietAsync(Guid id, Guid? giaoVienIdGioiHan, CancellationToken huyBo = default)
    {
        var dong = await db.HocPhi
            .AsNoTracking()
            .Include(x => x.HocSinh)
            .Include(x => x.GiaoVien)
            .Include(x => x.DanhSachPhieuThu).ThenInclude(x => x.NguoiThu)
            .FirstOrDefaultAsync(x => x.Id == id, huyBo)
            ?? throw LoiApiException.KhongTimThay("Không có dòng học phí này.");

        KiemTraQuyen(giaoVienIdGioiHan, dong.GiaoVienId);

        var (tu, den) = KhoangThang(dong.Thang, dong.Nam);

        var buoi = await db.BuoiHoc
            .AsNoTracking()
            .Include(x => x.DiemDanh)
            .Where(x => x.HocSinhId == dong.HocSinhId && x.Ngay >= tu && x.Ngay <= den)
            .OrderBy(x => x.Ngay)
            .ThenBy(x => x.GioBatDau)
            .ToListAsync(huyBo);

        var soChuaDiemDanh = buoi.Count(x => x.DiemDanh is null || x.DiemDanh.TrangThai == TrangThaiDiemDanh.ChuaDiemDanh);

        return new HocPhiChiTietDto
        {
            HocPhi = TaoDto(dong, soChuaDiemDanh),
            DanhSachBuoi = buoi.Select(x => new BuoiTrongKyDto
            {
                Id = x.Id,
                Ngay = x.Ngay,
                Gio = x.GioBatDau.ToString("HH:mm") + " – " + x.GioKetThuc.ToString("HH:mm"),
                LaBuoiDayBu = x.LaBuoiDayBu,
                TrangThai = x.DiemDanh?.TrangThai ?? TrangThaiDiemDanh.ChuaDiemDanh,
                LyDoNghi = x.DiemDanh?.LyDoNghi,
                GhiChu = x.DiemDanh?.GhiChu,
            }).ToList(),
            DanhSachPhieuThu = dong.DanhSachPhieuThu
                .OrderByDescending(x => x.NgayThu)
                .Select(x => new PhieuThuDto
                {
                    Id = x.Id,
                    SoTien = x.SoTien,
                    NgayThu = x.NgayThu,
                    HinhThuc = x.HinhThuc,
                    MaGiaoDichNganHang = x.MaGiaoDichNganHang,
                    TenNguoiThu = x.NguoiThu?.HoTen,
                    GhiChu = x.GhiChu,
                    NgayTaoUtc = x.NgayTaoUtc,
                }).ToList(),
        };
    }

    /// <summary>Ai sắp đến hạn đóng tiền, ai đã quá hạn mà chưa thu đủ.</summary>
    public async Task<SapDenHanDto> SapDenHanAsync(Guid? giaoVienId, int soNgay, CancellationToken huyBo = default)
    {
        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);
        var moc = homNay.AddDays(Math.Clamp(soNgay, 0, 90));

        var conNo = await db.HocPhi
            .AsNoTracking()
            .Include(x => x.HocSinh)
            .Include(x => x.GiaoVien)
            .Where(x => x.ThanhTien > x.SoTienDaThu)
            .Where(x => giaoVienId == null || x.GiaoVienId == giaoVienId)
            .OrderBy(x => x.HanDongTien)
            .ToListAsync(huyBo);

        var soChuaDiemDanh = await DemChuaDiemDanhTheoHocSinhChoNhieuKyAsync(conNo, huyBo);

        var sapDenHan = conNo.Where(x => x.HanDongTien >= homNay && x.HanDongTien <= moc).ToList();
        var quaHan = conNo.Where(x => x.HanDongTien < homNay).ToList();

        return new SapDenHanDto
        {
            SapDenHan = sapDenHan.Select(x => TaoDto(x, soChuaDiemDanh.GetValueOrDefault(x.Id))).ToList(),
            QuaHan = quaHan.Select(x => TaoDto(x, soChuaDiemDanh.GetValueOrDefault(x.Id))).ToList(),
            TongConLai = conNo.Sum(x => x.ThanhTien - x.SoTienDaThu),
        };
    }

    public async Task<IReadOnlyList<TongHopTheoGiaoVienDto>> TongHopAsync(int thang, int nam, CancellationToken huyBo = default)
    {
        KiemTraKy(thang, nam);

        var duLieu = await db.HocPhi
            .AsNoTracking()
            .Include(x => x.GiaoVien)
            .Where(x => x.Thang == thang && x.Nam == nam)
            .ToListAsync(huyBo);

        return duLieu
            .GroupBy(x => new { x.GiaoVienId, Ten = x.GiaoVien?.HoTen ?? "—" })
            .Select(nhom => new TongHopTheoGiaoVienDto
            {
                GiaoVienId = nhom.Key.GiaoVienId,
                TenGiaoVien = nhom.Key.Ten,
                SoHocSinh = nhom.Count(),
                PhaiThu = nhom.Sum(x => x.ThanhTien),
                DaThu = nhom.Sum(x => x.SoTienDaThu),
                ConLai = nhom.Sum(x => x.ThanhTien - x.SoTienDaThu),
            })
            .OrderByDescending(x => x.PhaiThu)
            .ToList();
    }

    /* --------------------------------- Thu tiền -------------------------------- */

    public async Task<PhieuThuDto> ThuTienAsync(
        Guid hocPhiId,
        ThuTienRequest yeuCau,
        Guid? giaoVienIdGioiHan,
        Guid? nguoiThuId,
        CancellationToken huyBo = default)
    {
        var dong = await db.HocPhi
            .Include(x => x.HocSinh)
            .FirstOrDefaultAsync(x => x.Id == hocPhiId, huyBo)
            ?? throw LoiApiException.KhongTimThay("Không có dòng học phí này.");

        KiemTraQuyen(giaoVienIdGioiHan, dong.GiaoVienId);

        if (yeuCau.SoTien <= 0)
        {
            throw LoiApiException.DuLieuSai(
                "Số tiền thu không hợp lệ.",
                new Dictionary<string, string[]> { ["soTien"] = ["Số tiền phải lớn hơn 0"] });
        }

        var conLai = dong.ThanhTien - dong.SoTienDaThu;
        if (yeuCau.SoTien > conLai)
        {
            throw LoiApiException.DuLieuSai(
                "Số tiền thu vượt quá số còn lại.",
                new Dictionary<string, string[]>
                {
                    ["soTien"] = [$"Còn lại {conLai:#,##0} đồng. Thu thừa thì phải sửa lại học phí trước, không ghi thừa vào sổ."],
                });
        }

        var ngayThu = yeuCau.NgayThu ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (ngayThu > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            throw LoiApiException.DuLieuSai(
                "Ngày thu không hợp lệ.",
                new Dictionary<string, string[]> { ["ngayThu"] = ["Ngày thu không được ở tương lai"] });
        }

        var phieuThu = new PhieuThu
        {
            HocPhiId = dong.Id,
            SoTien = yeuCau.SoTien,
            NgayThu = ngayThu,
            HinhThuc = yeuCau.HinhThuc,
            NguoiThuId = nguoiThuId,
            GhiChu = ChuoiHoacNull(yeuCau.GhiChu),
            NgayTaoUtc = DateTime.UtcNow,
        };

        db.PhieuThu.Add(phieuThu);
        dong.SoTienDaThu += yeuCau.SoTien;
        dong.TrangThaiThanhToan = SuyTrangThai(dong.ThanhTien, dong.SoTienDaThu);

        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            nguoiThuId,
            HanhDongThuTien,
            nameof(PhieuThu),
            phieuThu.Id.ToString(),
            null,
            DichVuNhatKy.Json(new { dong.HocSinhId, dong.Thang, dong.Nam, phieuThu.SoTien, dong.SoTienDaThu }),
            huyBo);

        return new PhieuThuDto
        {
            Id = phieuThu.Id,
            SoTien = phieuThu.SoTien,
            NgayThu = phieuThu.NgayThu,
            HinhThuc = phieuThu.HinhThuc,
            MaGiaoDichNganHang = phieuThu.MaGiaoDichNganHang,
            TenNguoiThu = null,
            GhiChu = phieuThu.GhiChu,
            NgayTaoUtc = phieuThu.NgayTaoUtc,
        };
    }

    /// <summary>
    /// Huỷ một phiếu thu đã ghi sai. Bắt buộc có lý do, và luôn để lại vết trong nhật ký — tiền đã
    /// ghi vào sổ rồi thì việc xoá nó phải giải thích được về sau.
    /// </summary>
    public async Task HuyPhieuThuAsync(
        Guid phieuThuId,
        string? lyDo,
        Guid? giaoVienIdGioiHan,
        Guid? nguoiThucHienId,
        CancellationToken huyBo = default)
    {
        if (string.IsNullOrWhiteSpace(lyDo))
        {
            throw LoiApiException.DuLieuSai(
                "Chưa nêu lý do huỷ.",
                new Dictionary<string, string[]> { ["lyDo"] = ["Phải ghi lý do huỷ phiếu thu"] });
        }

        var phieuThu = await db.PhieuThu
            .Include(x => x.HocPhi)
            .FirstOrDefaultAsync(x => x.Id == phieuThuId, huyBo)
            ?? throw LoiApiException.KhongTimThay("Không có phiếu thu này.");

        var dong = phieuThu.HocPhi!;
        KiemTraQuyen(giaoVienIdGioiHan, dong.GiaoVienId);

        var truoc = DichVuNhatKy.Json(new { phieuThu.SoTien, phieuThu.NgayThu, dong.SoTienDaThu });

        dong.SoTienDaThu -= phieuThu.SoTien;
        if (dong.SoTienDaThu < 0)
        {
            dong.SoTienDaThu = 0;
        }

        dong.TrangThaiThanhToan = SuyTrangThai(dong.ThanhTien, dong.SoTienDaThu);
        db.PhieuThu.Remove(phieuThu);

        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            nguoiThucHienId,
            HanhDongHuyPhieuThu,
            nameof(PhieuThu),
            phieuThuId.ToString(),
            truoc,
            DichVuNhatKy.Json(new { LyDo = lyDo.Trim(), dong.SoTienDaThu }),
            huyBo);
    }

    /* --------------------------------- Chốt sổ --------------------------------- */

    public async Task<CanhBaoChotSoDto> XemTruocChotSoAsync(int thang, int nam, CancellationToken huyBo = default)
    {
        KiemTraKy(thang, nam);
        var (tu, den) = KhoangThang(thang, nam);
        var homNay = DateOnly.FromDateTime(DateTime.UtcNow);
        var denDaQua = den < homNay ? den : homNay;

        var dong = await db.HocPhi
            .AsNoTracking()
            .Include(x => x.HocSinh)
            .Where(x => x.Thang == thang && x.Nam == nam)
            .ToListAsync(huyBo);

        var chuaDiemDanh = await db.BuoiHoc
            .AsNoTracking()
            .Include(x => x.HocSinh)
            .Include(x => x.DiemDanh)
            .Where(x => x.Ngay >= tu && x.Ngay <= denDaQua)
            .Where(x => x.DiemDanh == null || x.DiemDanh.TrangThai == TrangThaiDiemDanh.ChuaDiemDanh)
            .GroupBy(x => x.HocSinh!.HoTen)
            .Select(nhom => new CanhBaoChuaDiemDanhDto
            {
                TenHocSinh = nhom.Key ?? "—",
                SoBuoiChuaDiemDanh = nhom.Count(),
            })
            .ToListAsync(huyBo);

        var hocSinhCoBuoi = await db.BuoiHoc
            .AsNoTracking()
            .Where(x => x.Ngay >= tu && x.Ngay <= den && x.HocSinh!.TrangThai != TrangThaiHocSinh.DaNghi)
            .Select(x => x.HocSinhId)
            .Distinct()
            .ToListAsync(huyBo);

        var daTinh = dong.Select(x => x.HocSinhId).ToHashSet();

        return new CanhBaoChotSoDto
        {
            Thang = thang,
            Nam = nam,
            SoDongHocPhi = dong.Count,
            TongPhaiThu = dong.Sum(x => x.ThanhTien),
            TongDaThu = dong.Sum(x => x.SoTienDaThu),
            TongConLai = dong.Sum(x => x.ThanhTien - x.SoTienDaThu),
            ChuaDiemDanh = chuaDiemDanh.OrderByDescending(x => x.SoBuoiChuaDiemDanh).ToList(),
            SoHocSinhChuaTinhTien = hocSinhCoBuoi.Count(x => !daTinh.Contains(x)),
        };
    }

    public async Task<KetQuaChotSoDto> ChotSoAsync(
        int thang,
        int nam,
        bool boQuaCanhBao,
        Guid? nguoiThucHienId,
        CancellationToken huyBo = default)
    {
        var canhBao = await XemTruocChotSoAsync(thang, nam, huyBo);

        if (canhBao.CoCanhBao && !boQuaCanhBao)
        {
            throw new LoiApiException(
                "Kỳ này còn việc chưa xong",
                StatusCodes.Status409Conflict,
                $"Còn {canhBao.ChuaDiemDanh.Count} học sinh có buổi chưa điểm danh và "
                + $"{canhBao.SoHocSinhChuaTinhTien} học sinh chưa được tính tiền. Điểm danh và tính tiền xong "
                + "rồi chốt, hoặc chốt với xác nhận bỏ qua cảnh báo.");
        }

        var dong = await db.HocPhi.Where(x => x.Thang == thang && x.Nam == nam).ToListAsync(huyBo);
        if (dong.Count == 0)
        {
            throw LoiApiException.DuLieuSai("Chưa có dòng học phí nào để chốt.");
        }

        var bayGio = DateTime.UtcNow;
        foreach (var phan in dong)
        {
            phan.DaChotSo = true;
            phan.NgayChotUtc = bayGio;
        }

        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            nguoiThucHienId,
            HanhDongChotSo,
            "HocPhi",
            $"{nam:0000}-{thang:00}",
            null,
            DichVuNhatKy.Json(new { dong.Count, canhBao.TongPhaiThu, canhBao.TongDaThu, BoQuaCanhBao = boQuaCanhBao, CanhBao = canhBao }),
            huyBo);

        ghiLog.LogInformation("Chốt sổ học phí {Thang}/{Nam}: {So} dòng.", thang, nam, dong.Count);

        return new KetQuaChotSoDto
        {
            Thang = thang,
            Nam = nam,
            SoDong = dong.Count,
            TongPhaiThu = dong.Sum(x => x.ThanhTien),
            TongDaThu = dong.Sum(x => x.SoTienDaThu),
        };
    }

    public async Task<KetQuaChotSoDto> MoChotSoAsync(
        int thang,
        int nam,
        string? lyDo,
        Guid? nguoiThucHienId,
        CancellationToken huyBo = default)
    {
        if (string.IsNullOrWhiteSpace(lyDo))
        {
            throw LoiApiException.DuLieuSai(
                "Chưa nêu lý do mở chốt sổ.",
                new Dictionary<string, string[]> { ["lyDo"] = ["Phải ghi lý do mở lại sổ đã chốt"] });
        }

        var dong = await db.HocPhi.Where(x => x.Thang == thang && x.Nam == nam && x.DaChotSo).ToListAsync(huyBo);
        if (dong.Count == 0)
        {
            throw LoiApiException.DuLieuSai("Kỳ này chưa chốt sổ, không có gì để mở.");
        }

        var truoc = DichVuNhatKy.Json(dong.Select(x => new { x.HocSinhId, x.ThanhTien, x.SoTienDaThu }));

        foreach (var phan in dong)
        {
            phan.DaChotSo = false;
            phan.NgayChotUtc = null;
        }

        await db.SaveChangesAsync(huyBo);

        await nhatKy.GhiAsync(
            nguoiThucHienId,
            HanhDongMoChotSo,
            "HocPhi",
            $"{nam:0000}-{thang:00}",
            truoc,
            DichVuNhatKy.Json(new { LyDo = lyDo.Trim(), SoDong = dong.Count }),
            huyBo);

        ghiLog.LogWarning("Mở chốt sổ học phí {Thang}/{Nam}: {So} dòng. Lý do: {LyDo}", thang, nam, dong.Count, lyDo);

        return new KetQuaChotSoDto
        {
            Thang = thang,
            Nam = nam,
            SoDong = dong.Count,
            TongPhaiThu = dong.Sum(x => x.ThanhTien),
            TongDaThu = dong.Sum(x => x.SoTienDaThu),
            };
    }

    /* --------------------------- Đối chiếu ngân hàng --------------------------- */

    public async Task<IReadOnlyList<DeXuatDoiChieuDto>> PhanTichDoiChieuAsync(
        int thang,
        int nam,
        IReadOnlyList<GiaoDichNganHangDto> giaoDich,
        Guid? giaoVienId,
        CancellationToken huyBo = default)
    {
        KiemTraKy(thang, nam);

        var conNo = await db.HocPhi
            .AsNoTracking()
            .Include(x => x.HocSinh)
            .Where(x => x.ThanhTien > x.SoTienDaThu)
            .Where(x => giaoVienId == null || x.GiaoVienId == giaoVienId)
            .ToListAsync(huyBo);

        var maDaDung = await db.PhieuThu
            .AsNoTracking()
            .Where(x => x.MaGiaoDichNganHang != null)
            .Select(x => x.MaGiaoDichNganHang!)
            .ToListAsync(huyBo);
        var tapMaDaDung = maDaDung.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var ketQua = new List<DeXuatDoiChieuDto>();

        foreach (var gd in giaoDich)
        {
            if (!string.IsNullOrWhiteSpace(gd.MaGiaoDich) && tapMaDaDung.Contains(gd.MaGiaoDich))
            {
                ketQua.Add(new DeXuatDoiChieuDto
                {
                    GiaoDich = gd,
                    MucDoKhop = MucDoKhop.DaGhepTruocDo,
                    LyDo = "Mã giao dịch này đã được ghép vào một phiếu thu trước đó.",
                });
                continue;
            }

            if (gd.SoTien <= 0)
            {
                ketQua.Add(new DeXuatDoiChieuDto
                {
                    GiaoDich = gd,
                    MucDoKhop = MucDoKhop.KhongKhop,
                    LyDo = "Giao dịch không phải tiền vào.",
                });
                continue;
            }

            var noiDung = KhongDau(gd.NoiDung);
            var ungVien = new List<(HocPhi Dong, int Diem, string LyDo)>();

            foreach (var dong in conNo)
            {
                var conLai = dong.ThanhTien - dong.SoTienDaThu;

                // Chuyển khoản nhiều hơn số còn lại thì không thể là trả cho dòng này.
                if (gd.SoTien > conLai)
                {
                    continue;
                }

                var tenChuan = KhongDau(dong.HocSinh?.HoTen);
                var diem = 0;
                var lyDo = new List<string>();

                if (!string.IsNullOrWhiteSpace(tenChuan) && noiDung.Contains(tenChuan, StringComparison.Ordinal))
                {
                    diem += 2;
                    lyDo.Add("nội dung có tên học sinh");
                }
                else if (HaiTuCuoi(tenChuan) is { Length: > 3 } haiTu && noiDung.Contains(haiTu, StringComparison.Ordinal))
                {
                    diem += 1;
                    lyDo.Add("nội dung có tên gần đúng");
                }

                if (noiDung.Contains($"{thang:00}/{nam}", StringComparison.Ordinal)
                    || noiDung.Contains($"{thang}/{nam}", StringComparison.Ordinal)
                    || noiDung.Contains($"thang {thang}", StringComparison.Ordinal)
                    || noiDung.Contains($"t{thang}", StringComparison.Ordinal))
                {
                    diem += 1;
                    lyDo.Add($"nội dung nhắc tới kỳ {thang:00}/{nam}");
                }

                if (gd.SoTien == conLai)
                {
                    diem += 2;
                    lyDo.Add("số tiền khớp đúng số còn lại");
                }
                else
                {
                    lyDo.Add($"số tiền nhỏ hơn số còn lại ({conLai:#,##0} đồng)");
                }

                if (diem > 0)
                {
                    ungVien.Add((dong, diem, string.Join(", ", lyDo)));
                }
            }

            if (ungVien.Count == 0)
            {
                ketQua.Add(new DeXuatDoiChieuDto
                {
                    GiaoDich = gd,
                    MucDoKhop = MucKhopTheoNoiDung(noiDung, thang, nam),
                    LyDo = "Không tìm thấy dòng học phí nào còn nợ phù hợp với số tiền và nội dung này.",
                });
                continue;
            }

            // Cùng điểm thì ưu tiên dòng đến hạn sớm hơn, rồi tới học sinh — để hai lần phân tích
            // cùng một sao kê luôn cho cùng một đề xuất, không phụ thuộc thứ tự database trả về.
            var totNhat = ungVien
                .OrderByDescending(x => x.Diem)
                .ThenBy(x => x.Dong.HanDongTien)
                .ThenBy(x => x.Dong.HocSinhId)
                .First();
            ketQua.Add(new DeXuatDoiChieuDto
            {
                GiaoDich = gd,
                MucDoKhop = totNhat.Diem >= 4 ? MucDoKhop.KhopChac
                    : totNhat.Diem >= 2 ? MucDoKhop.KhopMotPhan
                    : MucDoKhop.ChiKhopSoTien,
                LyDo = totNhat.LyDo,
                HocPhiId = totNhat.Dong.Id,
                TenHocSinh = totNhat.Dong.HocSinh?.HoTen,
                ConLai = totNhat.Dong.ThanhTien - totNhat.Dong.SoTienDaThu,
            });
        }

        return ketQua;
    }

    private static MucDoKhop MucKhopTheoNoiDung(string noiDungKhongDau, int thang, int nam)
    {
        return noiDungKhongDau.Contains($"{thang:00}/{nam}", StringComparison.Ordinal)
            ? MucDoKhop.ChiKhopSoTien
            : MucDoKhop.KhongKhop;
    }

    private static string? HaiTuCuoi(string tenKhongDau)
    {
        var tu = tenKhongDau.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return tu.Length >= 2 ? string.Join(' ', tu[^2..]) : null;
    }

    /// <summary>
    /// Ghi các cặp đã được người dùng xác nhận thành phiếu thu chuyển khoản. Không tự ghép: máy chỉ
    /// đề xuất, người thật xác nhận — ghép sai thì sổ sai mà không ai biết.
    /// </summary>
    public async Task<KetQuaDoiChieuDto> XacNhanDoiChieuAsync(
        IReadOnlyList<CapDoiChieuRequest> cacCap,
        Guid? giaoVienIdGioiHan,
        Guid? nguoiThucHienId,
        CancellationToken huyBo = default)
    {
        if (cacCap.Count == 0)
        {
            throw LoiApiException.DuLieuSai("Không có cặp nào để ghi.");
        }

        var boQua = new List<string>();
        decimal tongDaGhi = 0;
        var soDaGhi = 0;

        foreach (var cap in cacCap)
        {
            var dong = await db.HocPhi.Include(x => x.HocSinh).FirstOrDefaultAsync(x => x.Id == cap.HocPhiId, huyBo);
            if (dong is null)
            {
                boQua.Add($"Không có dòng học phí {cap.HocPhiId}.");
                continue;
            }

            if (giaoVienIdGioiHan is { } gv && dong.GiaoVienId != gv)
            {
                boQua.Add($"{dong.HocSinh?.HoTen}: không thuộc quyền quản lý của bạn.");
                continue;
            }

            if (cap.SoTien <= 0)
            {
                boQua.Add($"{dong.HocSinh?.HoTen}: số tiền không hợp lệ.");
                continue;
            }

            var conLai = dong.ThanhTien - dong.SoTienDaThu;
            if (cap.SoTien > conLai)
            {
                boQua.Add($"{dong.HocSinh?.HoTen}: số tiền vượt quá còn lại ({conLai:#,##0} đồng).");
                continue;
            }

            if (!string.IsNullOrWhiteSpace(cap.MaGiaoDichNganHang))
            {
                var ma = cap.MaGiaoDichNganHang.Trim();
                var daDung = await db.PhieuThu.AnyAsync(x => x.MaGiaoDichNganHang == ma, huyBo);
                if (daDung && !cap.BoQuaTrungMaGiaoDich)
                {
                    boQua.Add($"{dong.HocSinh?.HoTen}: mã giao dịch {ma} đã được ghi trước đó.");
                    continue;
                }
            }

            var phieuThu = new PhieuThu
            {
                HocPhiId = dong.Id,
                SoTien = cap.SoTien,
                NgayThu = cap.NgayThu,
                HinhThuc = HinhThucThanhToan.ChuyenKhoan,
                MaGiaoDichNganHang = ChuoiHoacNull(cap.MaGiaoDichNganHang),
                NguoiThuId = nguoiThucHienId,
                GhiChu = "Ghi từ đối chiếu sao kê ngân hàng",
                NgayTaoUtc = DateTime.UtcNow,
            };

            db.PhieuThu.Add(phieuThu);
            dong.SoTienDaThu += cap.SoTien;
            dong.TrangThaiThanhToan = SuyTrangThai(dong.ThanhTien, dong.SoTienDaThu);

            soDaGhi++;
            tongDaGhi += cap.SoTien;
        }

        await db.SaveChangesAsync(huyBo);

        if (soDaGhi > 0)
        {
            await nhatKy.GhiAsync(
                nguoiThucHienId,
                HanhDongDoiChieu,
                nameof(PhieuThu),
                null,
                null,
                DichVuNhatKy.Json(new { soDaGhi, tongDaGhi, SoBoQua = boQua }),
                huyBo);
        }

        return new KetQuaDoiChieuDto { SoDaGhi = soDaGhi, TongDaGhi = tongDaGhi, BoQua = boQua };
    }

    /* -------------------------------- Xuất Excel ------------------------------- */

    /// <summary>Xuất sổ học phí của kỳ ra file Excel: một sheet chi tiết, một sheet tổng hợp theo giáo viên.</summary>
    public async Task<byte[]> XuatExcelAsync(int thang, int nam, Guid? giaoVienId, CancellationToken huyBo = default)
    {
        KiemTraKy(thang, nam);

        var danhSach = await db.HocPhi
            .AsNoTracking()
            .Include(x => x.HocSinh)
            .Include(x => x.GiaoVien)
            .Where(x => x.Thang == thang && x.Nam == nam)
            .Where(x => giaoVienId == null || x.GiaoVienId == giaoVienId)
            .OrderBy(x => x.GiaoVien!.HoTen)
            .ThenBy(x => x.HocSinh!.HoTen)
            .ToListAsync(huyBo);

        var soChuaDiemDanh = await DemChuaDiemDanhTheoHocSinhAsync(thang, nam, huyBo);

        var phieuThu = await db.PhieuThu
            .AsNoTracking()
            .Include(x => x.HocPhi).ThenInclude(x => x!.HocSinh)
            .Include(x => x.NguoiThu)
            .Where(x => x.HocPhi!.Thang == thang && x.HocPhi.Nam == nam)
            .OrderBy(x => x.NgayThu)
            .ToListAsync(huyBo);

        using var so = new XLWorkbook();

        var bang = so.Worksheets.Add($"Học phí {thang:00}-{nam}");
        var tieuDe = new[]
        {
            "Học sinh", "Giáo viên", "Hạn đóng", "Đi học", "Nghỉ có phép", "Nghỉ không phép", "Chưa điểm danh",
            "Cách tính", "Đơn giá", "Thành tiền", "Đã thu", "Còn lại", "Trạng thái", "Đã chốt sổ",
        };

        for (var i = 0; i < tieuDe.Length; i++)
        {
            bang.Cell(1, i + 1).Value = tieuDe[i];
        }

        var dong = 2;
        foreach (var phan in danhSach)
        {
            bang.Cell(dong, 1).Value = phan.HocSinh?.HoTen ?? "—";
            bang.Cell(dong, 2).Value = phan.GiaoVien?.HoTen ?? "—";
            bang.Cell(dong, 3).Value = phan.HanDongTien.ToDateTime(TimeOnly.MinValue);
            bang.Cell(dong, 3).Style.DateFormat.Format = "dd/MM/yyyy";
            bang.Cell(dong, 4).Value = phan.SoBuoiDiHoc;
            bang.Cell(dong, 5).Value = phan.SoBuoiNghiCoPhep;
            bang.Cell(dong, 6).Value = phan.SoBuoiNghiKhongPhep;
            bang.Cell(dong, 7).Value = soChuaDiemDanh.GetValueOrDefault(phan.HocSinhId);
            bang.Cell(dong, 8).Value = phan.HocSinh?.CachTinhHocPhi == CachTinhHocPhi.TheoThang ? "Theo tháng" : "Theo buổi";
            bang.Cell(dong, 9).Value = phan.DonGiaApDung;
            bang.Cell(dong, 10).Value = phan.ThanhTien;
            bang.Cell(dong, 11).Value = phan.SoTienDaThu;
            bang.Cell(dong, 12).Value = phan.ThanhTien - phan.SoTienDaThu;
            bang.Cell(dong, 13).Value = TenTrangThai(phan.TrangThaiThanhToan);
            bang.Cell(dong, 14).Value = phan.DaChotSo ? "Rồi" : "";
            dong++;
        }

        for (var cot = 9; cot <= 12; cot++)
        {
            bang.Column(cot).Style.NumberFormat.Format = "#,##0";
        }

        bang.Cell(dong, 1).Value = "Tổng cộng";
        bang.Cell(dong, 10).Value = danhSach.Sum(x => x.ThanhTien);
        bang.Cell(dong, 11).Value = danhSach.Sum(x => x.SoTienDaThu);
        bang.Cell(dong, 12).Value = danhSach.Sum(x => x.ThanhTien - x.SoTienDaThu);
        bang.Range(1, 1, dong, tieuDe.Length).Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        bang.Row(1).Style.Font.Bold = true;
        bang.Row(dong).Style.Font.Bold = true;
        bang.SheetView.FreezeRows(1);
        bang.Columns().AdjustToContents();

        var tongHop = so.Worksheets.Add("Tổng hợp theo giáo viên");
        tongHop.Cell(1, 1).Value = "Giáo viên";
        tongHop.Cell(1, 2).Value = "Số học sinh";
        tongHop.Cell(1, 3).Value = "Phải thu";
        tongHop.Cell(1, 4).Value = "Đã thu";
        tongHop.Cell(1, 5).Value = "Còn lại";

        var theoGiaoVien = danhSach
            .GroupBy(x => x.GiaoVien?.HoTen ?? "—")
            .Select(nhom => new
            {
                Ten = nhom.Key,
                SoHocSinh = nhom.Count(),
                PhaiThu = nhom.Sum(x => x.ThanhTien),
                DaThu = nhom.Sum(x => x.SoTienDaThu),
                ConLai = nhom.Sum(x => x.ThanhTien - x.SoTienDaThu),
            })
            .OrderByDescending(x => x.PhaiThu)
            .ToList();

        dong = 2;
        foreach (var nhom in theoGiaoVien)
        {
            tongHop.Cell(dong, 1).Value = nhom.Ten;
            tongHop.Cell(dong, 2).Value = nhom.SoHocSinh;
            tongHop.Cell(dong, 3).Value = nhom.PhaiThu;
            tongHop.Cell(dong, 4).Value = nhom.DaThu;
            tongHop.Cell(dong, 5).Value = nhom.ConLai;
            dong++;
        }

        for (var cot = 3; cot <= 5; cot++)
        {
            tongHop.Column(cot).Style.NumberFormat.Format = "#,##0";
        }

        tongHop.Row(1).Style.Font.Bold = true;
        tongHop.SheetView.FreezeRows(1);
        tongHop.Columns().AdjustToContents();

        var bangPhieuThu = so.Worksheets.Add("Phiếu thu");
        var tieuDePhieuThu = new[] { "Ngày thu", "Học sinh", "Số tiền", "Hình thức", "Mã giao dịch", "Người thu", "Ghi chú" };
        for (var i = 0; i < tieuDePhieuThu.Length; i++)
        {
            bangPhieuThu.Cell(1, i + 1).Value = tieuDePhieuThu[i];
        }

        dong = 2;
        foreach (var phan in phieuThu)
        {
            bangPhieuThu.Cell(dong, 1).Value = phan.NgayThu.ToDateTime(TimeOnly.MinValue);
            bangPhieuThu.Cell(dong, 1).Style.DateFormat.Format = "dd/MM/yyyy";
            bangPhieuThu.Cell(dong, 2).Value = phan.HocPhi?.HocSinh?.HoTen ?? "—";
            bangPhieuThu.Cell(dong, 3).Value = phan.SoTien;
            bangPhieuThu.Cell(dong, 4).Value = phan.HinhThuc == HinhThucThanhToan.TienMat ? "Tiền mặt" : "Chuyển khoản";
            bangPhieuThu.Cell(dong, 5).Value = phan.MaGiaoDichNganHang ?? "";
            bangPhieuThu.Cell(dong, 6).Value = phan.NguoiThu?.HoTen ?? "";
            bangPhieuThu.Cell(dong, 7).Value = phan.GhiChu ?? "";
            dong++;
        }

        bangPhieuThu.Column(3).Style.NumberFormat.Format = "#,##0";
        bangPhieuThu.Row(1).Style.Font.Bold = true;
        bangPhieuThu.SheetView.FreezeRows(1);
        bangPhieuThu.Columns().AdjustToContents();

        using var boNho = new MemoryStream();
        so.SaveAs(boNho);
        return boNho.ToArray();
    }

    public static string TenTrangThai(TrangThaiThanhToan trangThai) => trangThai switch
    {
        TrangThaiThanhToan.ChuaThu => "Chưa thu",
        TrangThaiThanhToan.ThuMotPhan => "Thu một phần",
        _ => "Đã thu đủ",
    };

    /* --------------------------------- Nội bộ ---------------------------------- */

    public static void KiemTraQuyen(Guid? giaoVienIdGioiHan, Guid giaoVienCuaDong)
    {
        if (giaoVienIdGioiHan is { } gv && gv != giaoVienCuaDong)
        {
            // Trả 404 chứ không 403: không xác nhận là dòng này có tồn tại.
            throw LoiApiException.KhongTimThay("Không có dòng học phí này.");
        }
    }

    private static HocPhiDto TaoDto(HocPhi dong, int soChuaDiemDanh) => new()
    {
        Id = dong.Id,
        HocSinhId = dong.HocSinhId,
        TenHocSinh = dong.HocSinh?.HoTen ?? "—",
        GiaoVienId = dong.GiaoVienId,
        TenGiaoVien = dong.GiaoVien?.HoTen ?? "—",
        Thang = dong.Thang,
        Nam = dong.Nam,
        HanDongTien = dong.HanDongTien,
        SoBuoiDiHoc = dong.SoBuoiDiHoc,
        SoBuoiNghiCoPhep = dong.SoBuoiNghiCoPhep,
        SoBuoiNghiKhongPhep = dong.SoBuoiNghiKhongPhep,
        SoBuoiChuaDiemDanh = soChuaDiemDanh,
        CachTinhHocPhi = dong.HocSinh?.CachTinhHocPhi ?? CachTinhHocPhi.TheoBuoi,
        DonGiaApDung = dong.DonGiaApDung,
        ThanhTien = dong.ThanhTien,
        SoTienDaThu = dong.SoTienDaThu,
        ConLai = dong.ThanhTien - dong.SoTienDaThu,
        TrangThaiThanhToan = dong.TrangThaiThanhToan,
        DaChotSo = dong.DaChotSo,
        NgayChotUtc = dong.NgayChotUtc,
    };

    private async Task<Dictionary<Guid, int>> DemChuaDiemDanhTheoHocSinhAsync(int thang, int nam, CancellationToken huyBo)
    {
        var (tu, den) = KhoangThang(thang, nam);

        return await db.BuoiHoc
            .AsNoTracking()
            .Where(x => x.Ngay >= tu && x.Ngay <= den)
            .Where(x => x.DiemDanh == null || x.DiemDanh.TrangThai == TrangThaiDiemDanh.ChuaDiemDanh)
            .GroupBy(x => x.HocSinhId)
            .Select(nhom => new { HocSinhId = nhom.Key, So = nhom.Count() })
            .ToDictionaryAsync(x => x.HocSinhId, x => x.So, huyBo);
    }

    private async Task<Dictionary<Guid, int>> DemChuaDiemDanhTheoHocSinhChoNhieuKyAsync(
        IReadOnlyList<HocPhi> danhSach,
        CancellationToken huyBo)
    {
        var ketQua = new Dictionary<Guid, int>();

        foreach (var phan in danhSach)
        {
            var (tu, den) = KhoangThang(phan.Thang, phan.Nam);
            var so = await db.BuoiHoc
                .AsNoTracking()
                .CountAsync(
                    x => x.HocSinhId == phan.HocSinhId && x.Ngay >= tu && x.Ngay <= den
                        && (x.DiemDanh == null || x.DiemDanh.TrangThai == TrangThaiDiemDanh.ChuaDiemDanh),
                    huyBo);

            ketQua[phan.Id] = so;
        }

        return ketQua;
    }

    private static string? ChuoiHoacNull(string? chuoi) => string.IsNullOrWhiteSpace(chuoi) ? null : chuoi.Trim();

    private async Task<CaiDat> LayCaiDatAsync(CancellationToken huyBo)
    {
        return await db.CaiDat.FirstOrDefaultAsync(x => x.Id == CaiDat.IdDuyNhat, huyBo)
            ?? throw new LoiApiException(
                "Chưa có dòng cấu hình",
                StatusCodes.Status500InternalServerError,
                "Bảng CaiDat chưa có dữ liệu. Khởi động lại API để seed lại.");
    }
}
