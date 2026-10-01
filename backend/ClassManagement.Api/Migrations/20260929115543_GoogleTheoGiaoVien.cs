using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClassManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class GoogleTheoGiaoVien : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GoogleCalendarId",
                table: "CaiDat");

            migrationBuilder.DropColumn(
                name: "GoogleRefreshTokenMaHoa",
                table: "CaiDat");

            migrationBuilder.DropColumn(
                name: "GoogleTaiKhoan",
                table: "CaiDat");

            migrationBuilder.AddColumn<string>(
                name: "GoogleCalendarId",
                table: "GiaoVien",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GoogleRefreshTokenMaHoa",
                table: "GiaoVien",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GoogleTaiKhoan",
                table: "GiaoVien",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GoogleCalendarId",
                table: "GiaoVien");

            migrationBuilder.DropColumn(
                name: "GoogleRefreshTokenMaHoa",
                table: "GiaoVien");

            migrationBuilder.DropColumn(
                name: "GoogleTaiKhoan",
                table: "GiaoVien");

            migrationBuilder.AddColumn<string>(
                name: "GoogleCalendarId",
                table: "CaiDat",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GoogleRefreshTokenMaHoa",
                table: "CaiDat",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GoogleTaiKhoan",
                table: "CaiDat",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);
        }
    }
}
