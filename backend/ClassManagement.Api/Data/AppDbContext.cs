using ClassManagement.Api.Common;
using ClassManagement.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace ClassManagement.Api.Data;

/// <summary>
/// Kế thừa <see cref="IdentityUserContext{TUser, TKey}"/> nghĩa là có bảng người dùng của Identity
/// nhưng KHÔNG có bảng vai trò: vai trò nằm trong cột <see cref="GiaoVien.VaiTro"/> vì nghiệp vụ chỉ
/// có đúng hai vai trò cố định.
///
/// Tên bảng và tên cột đều đặt theo tiếng Việt để mở SQL lên là đọc được ngay, không phải dịch
/// từ AspNetUsers sang GiaoVien trong đầu.
/// </summary>
public class AppDbContext : IdentityUserContext<GiaoVien, Guid>
{
    public AppDbContext(DbContextOptions<AppDbContext> tuyChon) : base(tuyChon)
    {
    }

    public DbSet<HocSinh> HocSinh => Set<HocSinh>();

    public DbSet<KhungGioHoc> KhungGioHoc => Set<KhungGioHoc>();

    public DbSet<BuoiHoc> BuoiHoc => Set<BuoiHoc>();

    public DbSet<DiemDanh> DiemDanh => Set<DiemDanh>();

    public DbSet<HocPhi> HocPhi => Set<HocPhi>();

    public DbSet<PhieuThu> PhieuThu => Set<PhieuThu>();

    public DbSet<CaiDat> CaiDat => Set<CaiDat>();

    public DbSet<PhienDangNhap> PhienDangNhap => Set<PhienDangNhap>();

    public DbSet<NhatKy> NhatKy => Set<NhatKy>();

    public DbSet<YeuCauDatLaiMatKhau> YeuCauDatLaiMatKhau => Set<YeuCauDatLaiMatKhau>();

    /// <summary>
    /// Tài khoản đăng nhập của giáo viên — cũng chính là bảng người dùng của Identity, đã đổi tên
    /// thành GiaoVien cho khớp nghiệp vụ. Identity gọi nó là Users; ở đây gọi đúng tên của nó.
    /// </summary>
    public DbSet<GiaoVien> GiaoVien => Set<GiaoVien>();

    protected override void OnModelCreating(ModelBuilder moHinh)
    {
        base.OnModelCreating(moHinh);

        CauHinhGiaoVien(moHinh);
        CauHinhHocSinh(moHinh);
        CauHinhBuoiHoc(moHinh);
        CauHinhHocPhi(moHinh);
        CauHinhCaiDat(moHinh);
        CauHinhYeuCauDatLaiMatKhau(moHinh);
        CauHinhNhatKy(moHinh);
        CauHinhPhienDangNhap(moHinh);
        EpKieuTien(moHinh);
    }

    private static void CauHinhGiaoVien(ModelBuilder moHinh)
    {
        // Bảng người dùng của Identity đổi tên cho khớp nghiệp vụ.
        moHinh.Entity<GiaoVien>().ToTable("GiaoVien");
        moHinh.Entity<IdentityUserClaim<Guid>>().ToTable("GiaoVienQuyen");
        moHinh.Entity<IdentityUserLogin<Guid>>().ToTable("GiaoVienDangNhapNgoai");
        moHinh.Entity<IdentityUserToken<Guid>>().ToTable("GiaoVienToken");

        var giaoVien = moHinh.Entity<GiaoVien>();
        giaoVien.Property(x => x.HoTen).HasMaxLength(200).IsRequired();
        giaoVien.Property(x => x.UserName).HasColumnName("TenDangNhap").HasMaxLength(256);
        giaoVien.Property(x => x.NormalizedUserName).HasColumnName("TenDangNhapChuanHoa").HasMaxLength(256);
        giaoVien.Property(x => x.PasswordHash).HasColumnName("MatKhauBam");
        giaoVien.Property(x => x.Email).HasMaxLength(256);
        giaoVien.Property(x => x.NormalizedEmail).HasColumnName("EmailChuanHoa").HasMaxLength(256);
        giaoVien.Property(x => x.PhoneNumber).HasColumnName("SoDienThoai").HasMaxLength(30);
        giaoVien.Property(x => x.LockoutEnd).HasColumnName("KhoaDenLuc");
        giaoVien.Property(x => x.LockoutEnabled).HasColumnName("ChoPhepKhoa");
        giaoVien.Property(x => x.AccessFailedCount).HasColumnName("SoLanSaiMatKhau");
        giaoVien.Property(x => x.GhiChu).HasMaxLength(1000);
        giaoVien.Property(x => x.NganHangBin).HasMaxLength(20);
        giaoVien.Property(x => x.SoTaiKhoan).HasMaxLength(40);
        giaoVien.Property(x => x.ChuTaiKhoan).HasMaxLength(120);
        giaoVien.Property(x => x.GoogleTaiKhoan).HasMaxLength(256);
        giaoVien.Property(x => x.GoogleCalendarId).HasMaxLength(256);
        giaoVien.Property(x => x.GoogleRefreshTokenMaHoa).HasMaxLength(2000);

        giaoVien.Property(x => x.VaiTro)
            .HasConversion(EnumWire.Converter<VaiTro>())
            .HasMaxLength(20)
            .IsRequired();

        giaoVien.Property(x => x.TrangThai)
            .HasConversion(EnumWire.Converter<TrangThaiGiaoVien>())
            .HasMaxLength(20)
            .IsRequired();

        giaoVien.HasIndex(x => x.VaiTro);
        giaoVien.HasIndex(x => x.TrangThai);
    }

    private static void CauHinhHocSinh(ModelBuilder moHinh)
    {
        var hocSinh = moHinh.Entity<HocSinh>();
        hocSinh.ToTable("HocSinh");
        hocSinh.Property(x => x.HoTen).HasMaxLength(200).IsRequired();
        hocSinh.Property(x => x.PhuHuynh).HasMaxLength(200);
        hocSinh.Property(x => x.SoDienThoaiPhuHuynh).HasMaxLength(30);
        hocSinh.Property(x => x.Lop).HasMaxLength(100);
        hocSinh.Property(x => x.GhiChu).HasMaxLength(1000);

        hocSinh.Property(x => x.CachTinhHocPhi)
            .HasConversion(EnumWire.Converter<CachTinhHocPhi>())
            .HasMaxLength(20)
            .IsRequired();

        hocSinh.Property(x => x.TrangThai)
            .HasConversion(EnumWire.Converter<TrangThaiHocSinh>())
            .HasMaxLength(20)
            .IsRequired();

        // Xoá giáo viên là mất học sinh — chặn ở tầng database chứ không chỉ ở tầng ứng dụng.
        hocSinh.HasOne(x => x.GiaoVien)
            .WithMany(x => x.HocSinhPhuTrach)
            .HasForeignKey(x => x.GiaoVienId)
            .OnDelete(DeleteBehavior.Restrict);

        hocSinh.HasIndex(x => x.GiaoVienId);
        hocSinh.HasIndex(x => x.TrangThai);
        hocSinh.HasIndex(x => x.HoTen);

        var khungGio = moHinh.Entity<KhungGioHoc>();
        khungGio.ToTable("KhungGioHoc");
        khungGio.Property(x => x.Thu)
            .HasConversion(EnumWire.Converter<ThuTrongTuan>())
            .HasMaxLength(20)
            .IsRequired();

        khungGio.HasOne(x => x.HocSinh)
            .WithMany(x => x.LichHoc)
            .HasForeignKey(x => x.HocSinhId)
            .OnDelete(DeleteBehavior.Cascade);

        khungGio.HasIndex(x => new { x.HocSinhId, x.Thu, x.GioBatDau }).IsUnique();
    }

    private static void CauHinhBuoiHoc(ModelBuilder moHinh)
    {
        var buoiHoc = moHinh.Entity<BuoiHoc>();
        buoiHoc.ToTable("BuoiHoc");

        buoiHoc.HasOne(x => x.HocSinh)
            .WithMany(x => x.DanhSachBuoiHoc)
            .HasForeignKey(x => x.HocSinhId)
            .OnDelete(DeleteBehavior.Restrict);

        buoiHoc.HasOne(x => x.GiaoVien)
            .WithMany()
            .HasForeignKey(x => x.GiaoVienId)
            .OnDelete(DeleteBehavior.Restrict);

        buoiHoc.Property(x => x.GoogleEventId).HasMaxLength(200);

        // Không cho sinh trùng một buổi hai lần cho cùng học sinh.
        buoiHoc.HasIndex(x => new { x.HocSinhId, x.Ngay, x.GioBatDau }).IsUnique();
        buoiHoc.HasIndex(x => x.GiaoVienId);
        buoiHoc.HasIndex(x => x.Ngay);

        var diemDanh = moHinh.Entity<DiemDanh>();
        diemDanh.ToTable("DiemDanh");
        diemDanh.Property(x => x.GhiChu).HasMaxLength(1000);

        diemDanh.Property(x => x.TrangThai)
            .HasConversion(EnumWire.Converter<TrangThaiDiemDanh>())
            .HasMaxLength(20)
            .IsRequired();

        diemDanh.Property(x => x.LyDoNghi)
            .HasConversion(EnumWire.Converter<LyDoNghi>())
            .HasMaxLength(20);

        diemDanh.HasOne(x => x.BuoiHoc)
            .WithOne(x => x.DiemDanh)
            .HasForeignKey<DiemDanh>(x => x.BuoiHocId)
            .OnDelete(DeleteBehavior.Cascade);

        diemDanh.HasOne(x => x.NguoiDiemDanh)
            .WithMany()
            .HasForeignKey(x => x.NguoiDiemDanhId)
            .OnDelete(DeleteBehavior.Restrict);

        diemDanh.HasIndex(x => x.BuoiHocId).IsUnique();
    }

    private static void CauHinhHocPhi(ModelBuilder moHinh)
    {
        var hocPhi = moHinh.Entity<HocPhi>();
        hocPhi.ToTable("HocPhi");

        hocPhi.Property(x => x.TrangThaiThanhToan)
            .HasConversion(EnumWire.Converter<TrangThaiThanhToan>())
            .HasMaxLength(20)
            .IsRequired();

        hocPhi.HasOne(x => x.HocSinh)
            .WithMany(x => x.DanhSachHocPhi)
            .HasForeignKey(x => x.HocSinhId)
            .OnDelete(DeleteBehavior.Restrict);

        hocPhi.HasOne(x => x.GiaoVien)
            .WithMany()
            .HasForeignKey(x => x.GiaoVienId)
            .OnDelete(DeleteBehavior.Restrict);

        // Mỗi học sinh đúng một kỳ học phí cho mỗi tháng.
        hocPhi.HasIndex(x => new { x.HocSinhId, x.Thang, x.Nam }).IsUnique();
        hocPhi.HasIndex(x => x.GiaoVienId);
        hocPhi.HasIndex(x => x.HanDongTien);

        var phieuThu = moHinh.Entity<PhieuThu>();
        phieuThu.ToTable("PhieuThu");

        phieuThu.Property(x => x.MaGiaoDichNganHang).HasMaxLength(100);
        phieuThu.Property(x => x.GhiChu).HasMaxLength(1000);

        phieuThu.Property(x => x.HinhThuc)
            .HasConversion(EnumWire.Converter<HinhThucThanhToan>())
            .HasMaxLength(20)
            .IsRequired();

        phieuThu.HasOne(x => x.HocPhi)
            .WithMany(x => x.DanhSachPhieuThu)
            .HasForeignKey(x => x.HocPhiId)
            .OnDelete(DeleteBehavior.Cascade);

        phieuThu.HasOne(x => x.NguoiThu)
            .WithMany()
            .HasForeignKey(x => x.NguoiThuId)
            .OnDelete(DeleteBehavior.Restrict);

        phieuThu.HasIndex(x => x.HocPhiId);

        // Một giao dịch ngân hàng chỉ được gắn vào đúng một phiếu thu.
        phieuThu.HasIndex(x => x.MaGiaoDichNganHang)
            .IsUnique()
            .HasFilter("\"MaGiaoDichNganHang\" IS NOT NULL");
    }

    private static void CauHinhCaiDat(ModelBuilder moHinh)
    {
        var caiDat = moHinh.Entity<CaiDat>();
        caiDat.ToTable("CaiDat");

        // Bảng này chỉ có đúng một dòng với Id = 1 nên Id không phải cột tự tăng:
        // để tự tăng thì không ghi được dòng Id = 1 và cũng chẳng có gì để tăng.
        caiDat.Property(x => x.Id).ValueGeneratedNever();
        caiDat.Property(x => x.MauNoiDungChuyenKhoan).HasMaxLength(200);
        caiDat.Property(x => x.MuiGio).HasMaxLength(100).IsRequired();
        caiDat.Property(x => x.KyTuTienTe).HasMaxLength(10).IsRequired();
        caiDat.Property(x => x.DinhDangNgay).HasMaxLength(20).IsRequired();

        caiDat.Property(x => x.VaiTroMacDinh)
            .HasConversion(EnumWire.Converter<VaiTro>())
            .HasMaxLength(20)
            .IsRequired();
    }

    private static void CauHinhYeuCauDatLaiMatKhau(ModelBuilder moHinh)
    {
        var yeuCau = moHinh.Entity<YeuCauDatLaiMatKhau>();
        yeuCau.ToTable("YeuCauDatLaiMatKhau");
        yeuCau.Property(x => x.TokenBam).HasMaxLength(128).IsRequired();
        yeuCau.Property(x => x.DiaChiIp).HasMaxLength(64);
        yeuCau.HasIndex(x => x.TokenBam).IsUnique();
        yeuCau.HasIndex(x => x.GiaoVienId);

        yeuCau.HasOne(x => x.GiaoVien)
            .WithMany()
            .HasForeignKey(x => x.GiaoVienId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void CauHinhNhatKy(ModelBuilder moHinh)
    {
        var nhatKy = moHinh.Entity<NhatKy>();
        nhatKy.ToTable("NhatKy");
        nhatKy.Property(x => x.HanhDong).HasMaxLength(100).IsRequired();
        nhatKy.Property(x => x.DoiTuong).HasMaxLength(100).IsRequired();
        nhatKy.Property(x => x.DoiTuongId).HasMaxLength(100);
        nhatKy.Property(x => x.DiaChiIp).HasMaxLength(64);

        nhatKy.HasOne(x => x.NguoiThucHien)
            .WithMany()
            .HasForeignKey(x => x.NguoiThucHienId)
            .OnDelete(DeleteBehavior.Restrict);

        nhatKy.HasIndex(x => x.ThoiDiemUtc);
        nhatKy.HasIndex(x => new { x.DoiTuong, x.DoiTuongId });
    }

    private static void CauHinhPhienDangNhap(ModelBuilder moHinh)
    {
        var phien = moHinh.Entity<PhienDangNhap>();
        phien.ToTable("PhienDangNhap");
        phien.Property(x => x.TokenBam).HasMaxLength(64).IsRequired();
        phien.Property(x => x.DiaChiIp).HasMaxLength(64);
        phien.Property(x => x.ThietBi).HasMaxLength(300);

        phien.HasOne(x => x.GiaoVien)
            .WithMany(x => x.PhienDangNhap)
            .HasForeignKey(x => x.GiaoVienId)
            .OnDelete(DeleteBehavior.Cascade);

        phien.HasIndex(x => x.TokenBam).IsUnique();
        phien.HasIndex(x => x.GiaoVienId);
    }

    /// <summary>
    /// Mọi cột tiền đều là decimal(18,2). Đặt một chỗ để không bao giờ có cột tiền nào bị lưu
    /// dạng số thực — số thực làm tròn sai và sổ sách lệch một đồng cũng là lệch.
    /// </summary>
    private static void EpKieuTien(ModelBuilder moHinh)
    {
        foreach (var thucThe in moHinh.Model.GetEntityTypes())
        {
            foreach (var thuocTinh in thucThe.GetProperties())
            {
                if (thuocTinh.ClrType == typeof(decimal) || thuocTinh.ClrType == typeof(decimal?))
                {
                    thuocTinh.SetPrecision(18);
                    thuocTinh.SetScale(2);
                }
            }
        }
    }
}
