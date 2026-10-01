using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClassManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class TaiKhoanTuTaoVaQuenMatKhau : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "YeuCauDatLaiMatKhau",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GiaoVienId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TokenBam = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    NgayTaoUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    HetHanUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NgayDungUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DiaChiIp = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
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
                name: "YeuCauDatLaiMatKhau");
        }
    }
}
