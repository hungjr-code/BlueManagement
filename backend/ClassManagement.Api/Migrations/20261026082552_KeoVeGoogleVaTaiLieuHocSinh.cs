using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClassManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class KeoVeGoogleVaTaiLieuHocSinh : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "KhoaDenLuc",
                table: "HocSinh",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LanDangNhapCuoiUtc",
                table: "HocSinh",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MaHocSinh",
                table: "HocSinh",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MatKhauBam",
                table: "HocSinh",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SoLanSaiMatKhau",
                table: "HocSinh",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "GoogleDongBoVeUtc",
                table: "GiaoVien",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GoogleQuyenDaCap",
                table: "GiaoVien",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "GoogleTuDongDongBo",
                table: "GiaoVien",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "GoogleDaHuy",
                table: "BuoiHoc",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "GoogleDongBoVeUtc",
                table: "BuoiHoc",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GoogleLechGanNhat",
                table: "BuoiHoc",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PhienHocSinh",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HocSinhId = table.Column<Guid>(type: "uuid", nullable: false),
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
                    table.PrimaryKey("PK_PhienHocSinh", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PhienHocSinh_HocSinh_HocSinhId",
                        column: x => x.HocSinhId,
                        principalTable: "HocSinh",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TaiLieu",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GiaoVienId = table.Column<Guid>(type: "uuid", nullable: false),
                    HocSinhId = table.Column<Guid>(type: "uuid", nullable: false),
                    BuoiHocId = table.Column<Guid>(type: "uuid", nullable: true),
                    TieuDe = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TenTep = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    MimeType = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    KichThuocByte = table.Column<long>(type: "bigint", nullable: false),
                    GoogleDriveFileId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    GoogleDriveLink = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    HanNop = table.Column<DateOnly>(type: "date", nullable: true),
                    GhiChu = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DaXoa = table.Column<bool>(type: "boolean", nullable: false),
                    NgayTaoUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    NgayCapNhatUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaiLieu", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaiLieu_BuoiHoc_BuoiHocId",
                        column: x => x.BuoiHocId,
                        principalTable: "BuoiHoc",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TaiLieu_GiaoVien_GiaoVienId",
                        column: x => x.GiaoVienId,
                        principalTable: "GiaoVien",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TaiLieu_HocSinh_HocSinhId",
                        column: x => x.HocSinhId,
                        principalTable: "HocSinh",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // Học sinh đã có từ trước cũng phải có mã đăng nhập, nếu không giáo viên mở màn Học sinh
            // sẽ thấy một loạt em không thể đăng nhập được. Đánh số theo thứ tự tạo hồ sơ, đúng dạng
            // HS-0001 mà phần cấp tài khoản sinh ra cho học sinh mới.
            migrationBuilder.Sql(
                """
                UPDATE "HocSinh" AS h
                SET "MaHocSinh" = 'HS-' || lpad(x.so::text, 4, '0')
                FROM (
                    SELECT "Id", row_number() OVER (ORDER BY "NgayTaoUtc", "HoTen") AS so
                    FROM "HocSinh"
                    WHERE "MaHocSinh" IS NULL
                ) AS x
                WHERE h."Id" = x."Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_HocSinh_MaHocSinh",
                table: "HocSinh",
                column: "MaHocSinh",
                unique: true,
                filter: "\"MaHocSinh\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PhienHocSinh_HocSinhId",
                table: "PhienHocSinh",
                column: "HocSinhId");

            migrationBuilder.CreateIndex(
                name: "IX_PhienHocSinh_TokenBam",
                table: "PhienHocSinh",
                column: "TokenBam",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaiLieu_BuoiHocId",
                table: "TaiLieu",
                column: "BuoiHocId");

            migrationBuilder.CreateIndex(
                name: "IX_TaiLieu_GiaoVienId",
                table: "TaiLieu",
                column: "GiaoVienId");

            migrationBuilder.CreateIndex(
                name: "IX_TaiLieu_HanNop",
                table: "TaiLieu",
                column: "HanNop");

            migrationBuilder.CreateIndex(
                name: "IX_TaiLieu_HocSinhId",
                table: "TaiLieu",
                column: "HocSinhId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PhienHocSinh");

            migrationBuilder.DropTable(
                name: "TaiLieu");

            migrationBuilder.DropIndex(
                name: "IX_HocSinh_MaHocSinh",
                table: "HocSinh");

            migrationBuilder.DropColumn(
                name: "KhoaDenLuc",
                table: "HocSinh");

            migrationBuilder.DropColumn(
                name: "LanDangNhapCuoiUtc",
                table: "HocSinh");

            migrationBuilder.DropColumn(
                name: "MaHocSinh",
                table: "HocSinh");

            migrationBuilder.DropColumn(
                name: "MatKhauBam",
                table: "HocSinh");

            migrationBuilder.DropColumn(
                name: "SoLanSaiMatKhau",
                table: "HocSinh");

            migrationBuilder.DropColumn(
                name: "GoogleDongBoVeUtc",
                table: "GiaoVien");

            migrationBuilder.DropColumn(
                name: "GoogleQuyenDaCap",
                table: "GiaoVien");

            migrationBuilder.DropColumn(
                name: "GoogleTuDongDongBo",
                table: "GiaoVien");

            migrationBuilder.DropColumn(
                name: "GoogleDaHuy",
                table: "BuoiHoc");

            migrationBuilder.DropColumn(
                name: "GoogleDongBoVeUtc",
                table: "BuoiHoc");

            migrationBuilder.DropColumn(
                name: "GoogleLechGanNhat",
                table: "BuoiHoc");
        }
    }
}
