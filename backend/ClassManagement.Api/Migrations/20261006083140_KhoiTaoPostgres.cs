using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ClassManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class KhoiTaoPostgres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CaiDat",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    MauNoiDungChuyenKhoan = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    VaiTroMacDinh = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    NguongCanhBaoSoHocSinh = table.Column<int>(type: "integer", nullable: false),
                    TinhTienNghiKhongPhep = table.Column<bool>(type: "boolean", nullable: false),
                    MuiGio = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NhacTruocBaoLauPhut = table.Column<int>(type: "integer", nullable: false),
                    GioGuiThongBaoHomNay = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    BatThongBaoHomNay = table.Column<bool>(type: "boolean", nullable: false),
                    KyTuTienTe = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    DinhDangNgay = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    NgayCapNhatUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CaiDat", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GiaoVien",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HoTen = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    VaiTro = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TrangThai = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    NgayThamGia = table.Column<DateOnly>(type: "date", nullable: false),
                    GhiChu = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    GoogleTaiKhoan = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    GoogleCalendarId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    GoogleRefreshTokenMaHoa = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    NganHangBin = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SoTaiKhoan = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    ChuTaiKhoan = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    NgayTaoUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    TenDangNhap = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    TenDangNhapChuanHoa = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    EmailChuanHoa = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    MatKhauBam = table.Column<string>(type: "text", nullable: true),
                    SecurityStamp = table.Column<string>(type: "text", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true),
                    SoDienThoai = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    KhoaDenLuc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ChoPhepKhoa = table.Column<bool>(type: "boolean", nullable: false),
                    SoLanSaiMatKhau = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GiaoVien", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GiaoVienDangNhapNgoai",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    ProviderKey = table.Column<string>(type: "text", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GiaoVienDangNhapNgoai", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_GiaoVienDangNhapNgoai_GiaoVien_UserId",
                        column: x => x.UserId,
                        principalTable: "GiaoVien",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GiaoVienQuyen",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GiaoVienQuyen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GiaoVienQuyen_GiaoVien_UserId",
                        column: x => x.UserId,
                        principalTable: "GiaoVien",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GiaoVienToken",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GiaoVienToken", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_GiaoVienToken_GiaoVien_UserId",
                        column: x => x.UserId,
                        principalTable: "GiaoVien",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HocSinh",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HoTen = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    GiaoVienId = table.Column<Guid>(type: "uuid", nullable: false),
                    CachTinhHocPhi = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DonGiaTheoBuoi = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    HocPhiTheoThang = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    SoBuoiMoiTuan = table.Column<int>(type: "integer", nullable: false),
                    NgayDenHanDongTien = table.Column<int>(type: "integer", nullable: false),
                    NgayBatDau = table.Column<DateOnly>(type: "date", nullable: false),
                    PhuHuynh = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SoDienThoaiPhuHuynh = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Lop = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    GhiChu = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    TrangThai = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    NgayTaoUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    NgayCapNhatUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HocSinh", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HocSinh_GiaoVien_GiaoVienId",
                        column: x => x.GiaoVienId,
                        principalTable: "GiaoVien",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "NhatKy",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NguoiThucHienId = table.Column<Guid>(type: "uuid", nullable: true),
                    HanhDong = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DoiTuong = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DoiTuongId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DuLieuTruoc = table.Column<string>(type: "text", nullable: true),
                    DuLieuSau = table.Column<string>(type: "text", nullable: true),
                    DiaChiIp = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ThoiDiemUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NhatKy", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NhatKy_GiaoVien_NguoiThucHienId",
                        column: x => x.NguoiThucHienId,
                        principalTable: "GiaoVien",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PhienDangNhap",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GiaoVienId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenBam = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    NgayTaoUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    HetHanUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    NgayThuHoiUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ThayTheBoiId = table.Column<Guid>(type: "uuid", nullable: true),
                    DiaChiIp = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ThietBi = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhienDangNhap", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PhienDangNhap_GiaoVien_GiaoVienId",
                        column: x => x.GiaoVienId,
                        principalTable: "GiaoVien",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "YeuCauDatLaiMatKhau",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GiaoVienId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenBam = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    NgayTaoUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    HetHanUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    NgayDungUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DiaChiIp = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_YeuCauDatLaiMatKhau", x => x.Id);
                    table.ForeignKey(
                        name: "FK_YeuCauDatLaiMatKhau_GiaoVien_GiaoVienId",
                        column: x => x.GiaoVienId,
                        principalTable: "GiaoVien",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BuoiHoc",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HocSinhId = table.Column<Guid>(type: "uuid", nullable: false),
                    GiaoVienId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ngay = table.Column<DateOnly>(type: "date", nullable: false),
                    GioBatDau = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    GioKetThuc = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    LaBuoiDayBu = table.Column<bool>(type: "boolean", nullable: false),
                    NgayTaoUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    GoogleEventId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    GoogleDongBoUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BuoiHoc", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BuoiHoc_GiaoVien_GiaoVienId",
                        column: x => x.GiaoVienId,
                        principalTable: "GiaoVien",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BuoiHoc_HocSinh_HocSinhId",
                        column: x => x.HocSinhId,
                        principalTable: "HocSinh",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "HocPhi",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HocSinhId = table.Column<Guid>(type: "uuid", nullable: false),
                    GiaoVienId = table.Column<Guid>(type: "uuid", nullable: false),
                    Thang = table.Column<int>(type: "integer", nullable: false),
                    Nam = table.Column<int>(type: "integer", nullable: false),
                    HanDongTien = table.Column<DateOnly>(type: "date", nullable: false),
                    SoBuoiDiHoc = table.Column<int>(type: "integer", nullable: false),
                    SoBuoiNghiCoPhep = table.Column<int>(type: "integer", nullable: false),
                    SoBuoiNghiKhongPhep = table.Column<int>(type: "integer", nullable: false),
                    DonGiaApDung = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ThanhTien = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SoTienDaThu = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TrangThaiThanhToan = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DaChotSo = table.Column<bool>(type: "boolean", nullable: false),
                    NgayChotUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    NgayTaoUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HocPhi", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HocPhi_GiaoVien_GiaoVienId",
                        column: x => x.GiaoVienId,
                        principalTable: "GiaoVien",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_HocPhi_HocSinh_HocSinhId",
                        column: x => x.HocSinhId,
                        principalTable: "HocSinh",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "KhungGioHoc",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HocSinhId = table.Column<Guid>(type: "uuid", nullable: false),
                    Thu = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    GioBatDau = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    GioKetThuc = table.Column<TimeOnly>(type: "time without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KhungGioHoc", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KhungGioHoc_HocSinh_HocSinhId",
                        column: x => x.HocSinhId,
                        principalTable: "HocSinh",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DiemDanh",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BuoiHocId = table.Column<Guid>(type: "uuid", nullable: false),
                    TrangThai = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    LyDoNghi = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    GhiChu = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CoTinhTien = table.Column<bool>(type: "boolean", nullable: false),
                    ThoiLuongThucTePhut = table.Column<int>(type: "integer", nullable: true),
                    NguoiDiemDanhId = table.Column<Guid>(type: "uuid", nullable: true),
                    ThoiDiemDiemDanhUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    NgayCapNhatUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DiemDanh", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DiemDanh_BuoiHoc_BuoiHocId",
                        column: x => x.BuoiHocId,
                        principalTable: "BuoiHoc",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DiemDanh_GiaoVien_NguoiDiemDanhId",
                        column: x => x.NguoiDiemDanhId,
                        principalTable: "GiaoVien",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PhieuThu",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HocPhiId = table.Column<Guid>(type: "uuid", nullable: false),
                    SoTien = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NgayThu = table.Column<DateOnly>(type: "date", nullable: false),
                    HinhThuc = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MaGiaoDichNganHang = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    NguoiThuId = table.Column<Guid>(type: "uuid", nullable: true),
                    GhiChu = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    NgayTaoUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhieuThu", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PhieuThu_GiaoVien_NguoiThuId",
                        column: x => x.NguoiThuId,
                        principalTable: "GiaoVien",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PhieuThu_HocPhi_HocPhiId",
                        column: x => x.HocPhiId,
                        principalTable: "HocPhi",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BuoiHoc_GiaoVienId",
                table: "BuoiHoc",
                column: "GiaoVienId");

            migrationBuilder.CreateIndex(
                name: "IX_BuoiHoc_HocSinhId_Ngay_GioBatDau",
                table: "BuoiHoc",
                columns: new[] { "HocSinhId", "Ngay", "GioBatDau" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BuoiHoc_Ngay",
                table: "BuoiHoc",
                column: "Ngay");

            migrationBuilder.CreateIndex(
                name: "IX_DiemDanh_BuoiHocId",
                table: "DiemDanh",
                column: "BuoiHocId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DiemDanh_NguoiDiemDanhId",
                table: "DiemDanh",
                column: "NguoiDiemDanhId");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "GiaoVien",
                column: "EmailChuanHoa");

            migrationBuilder.CreateIndex(
                name: "IX_GiaoVien_TrangThai",
                table: "GiaoVien",
                column: "TrangThai");

            migrationBuilder.CreateIndex(
                name: "IX_GiaoVien_VaiTro",
                table: "GiaoVien",
                column: "VaiTro");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "GiaoVien",
                column: "TenDangNhapChuanHoa",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GiaoVienDangNhapNgoai_UserId",
                table: "GiaoVienDangNhapNgoai",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_GiaoVienQuyen_UserId",
                table: "GiaoVienQuyen",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_HocPhi_GiaoVienId",
                table: "HocPhi",
                column: "GiaoVienId");

            migrationBuilder.CreateIndex(
                name: "IX_HocPhi_HanDongTien",
                table: "HocPhi",
                column: "HanDongTien");

            migrationBuilder.CreateIndex(
                name: "IX_HocPhi_HocSinhId_Thang_Nam",
                table: "HocPhi",
                columns: new[] { "HocSinhId", "Thang", "Nam" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HocSinh_GiaoVienId",
                table: "HocSinh",
                column: "GiaoVienId");

            migrationBuilder.CreateIndex(
                name: "IX_HocSinh_HoTen",
                table: "HocSinh",
                column: "HoTen");

            migrationBuilder.CreateIndex(
                name: "IX_HocSinh_TrangThai",
                table: "HocSinh",
                column: "TrangThai");

            migrationBuilder.CreateIndex(
                name: "IX_KhungGioHoc_HocSinhId_Thu_GioBatDau",
                table: "KhungGioHoc",
                columns: new[] { "HocSinhId", "Thu", "GioBatDau" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NhatKy_DoiTuong_DoiTuongId",
                table: "NhatKy",
                columns: new[] { "DoiTuong", "DoiTuongId" });

            migrationBuilder.CreateIndex(
                name: "IX_NhatKy_NguoiThucHienId",
                table: "NhatKy",
                column: "NguoiThucHienId");

            migrationBuilder.CreateIndex(
                name: "IX_NhatKy_ThoiDiemUtc",
                table: "NhatKy",
                column: "ThoiDiemUtc");

            migrationBuilder.CreateIndex(
                name: "IX_PhienDangNhap_GiaoVienId",
                table: "PhienDangNhap",
                column: "GiaoVienId");

            migrationBuilder.CreateIndex(
                name: "IX_PhienDangNhap_TokenBam",
                table: "PhienDangNhap",
                column: "TokenBam",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PhieuThu_HocPhiId",
                table: "PhieuThu",
                column: "HocPhiId");

            migrationBuilder.CreateIndex(
                name: "IX_PhieuThu_MaGiaoDichNganHang",
                table: "PhieuThu",
                column: "MaGiaoDichNganHang",
                unique: true,
                filter: "\"MaGiaoDichNganHang\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PhieuThu_NguoiThuId",
                table: "PhieuThu",
                column: "NguoiThuId");

            migrationBuilder.CreateIndex(
                name: "IX_YeuCauDatLaiMatKhau_GiaoVienId",
                table: "YeuCauDatLaiMatKhau",
                column: "GiaoVienId");

            migrationBuilder.CreateIndex(
                name: "IX_YeuCauDatLaiMatKhau_TokenBam",
                table: "YeuCauDatLaiMatKhau",
                column: "TokenBam",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CaiDat");

            migrationBuilder.DropTable(
                name: "DiemDanh");

            migrationBuilder.DropTable(
                name: "GiaoVienDangNhapNgoai");

            migrationBuilder.DropTable(
                name: "GiaoVienQuyen");

            migrationBuilder.DropTable(
                name: "GiaoVienToken");

            migrationBuilder.DropTable(
                name: "KhungGioHoc");

            migrationBuilder.DropTable(
                name: "NhatKy");

            migrationBuilder.DropTable(
                name: "PhienDangNhap");

            migrationBuilder.DropTable(
                name: "PhieuThu");

            migrationBuilder.DropTable(
                name: "YeuCauDatLaiMatKhau");

            migrationBuilder.DropTable(
                name: "BuoiHoc");

            migrationBuilder.DropTable(
                name: "HocPhi");

            migrationBuilder.DropTable(
                name: "HocSinh");

            migrationBuilder.DropTable(
                name: "GiaoVien");
        }
    }
}
