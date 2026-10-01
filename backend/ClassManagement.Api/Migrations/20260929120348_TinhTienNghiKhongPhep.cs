using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClassManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class TinhTienNghiKhongPhep : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "TinhTienNghiKhongPhep",
                table: "CaiDat",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TinhTienNghiKhongPhep",
                table: "CaiDat");
        }
    }
}
