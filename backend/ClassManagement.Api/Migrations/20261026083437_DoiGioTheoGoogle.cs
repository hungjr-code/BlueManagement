using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClassManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class DoiGioTheoGoogle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "GioBatDauTheoLich",
                table: "BuoiHoc",
                type: "time without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GioBatDauTheoLich",
                table: "BuoiHoc");
        }
    }
}
