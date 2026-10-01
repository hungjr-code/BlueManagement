using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClassManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class TaiKhoanNhanTienTheoGiaoVien : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ChuTaiKhoan",
                table: "CaiDat");

            migrationBuilder.DropColumn(
                name: "NganHangBin",
                table: "CaiDat");

            migrationBuilder.DropColumn(
                name: "SoTaiKhoan",
                table: "CaiDat");

            migrationBuilder.AddColumn<string>(
                name: "ChuTaiKhoan",
                table: "GiaoVien",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NganHangBin",
                table: "GiaoVien",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SoTaiKhoan",
                table: "GiaoVien",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ChuTaiKhoan",
                table: "GiaoVien");

            migrationBuilder.DropColumn(
                name: "NganHangBin",
                table: "GiaoVien");

            migrationBuilder.DropColumn(
                name: "SoTaiKhoan",
                table: "GiaoVien");

            migrationBuilder.AddColumn<string>(
                name: "ChuTaiKhoan",
                table: "CaiDat",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NganHangBin",
                table: "CaiDat",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SoTaiKhoan",
                table: "CaiDat",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);
        }
    }
}
