using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClassManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class DongBoGoogleCalendar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "GoogleDongBoUtc",
                table: "BuoiHoc",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GoogleEventId",
                table: "BuoiHoc",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GoogleDongBoUtc",
                table: "BuoiHoc");

            migrationBuilder.DropColumn(
                name: "GoogleEventId",
                table: "BuoiHoc");
        }
    }
}
