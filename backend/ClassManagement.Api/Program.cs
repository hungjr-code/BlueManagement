using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using ClassManagement.Api.Auth;
using ClassManagement.Api.Common;
using ClassManagement.Api.Data;
using ClassManagement.Api.Entities;
using ClassManagement.Api.Email;
using ClassManagement.Api.Google;
using ClassManagement.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

/* ------------------------------------------------------------------ *
 * 1. Cơ sở dữ liệu
 * ------------------------------------------------------------------ */

var chuoiKetNoi = builder.Configuration.GetConnectionString("MacDinh")
    ?? throw new InvalidOperationException(
        "Thiếu ConnectionStrings:MacDinh trong appsettings.json. Ví dụ cho SQL Server Express:\n"
        + "  Server=.\\SQLEXPRESS;Database=ClassManagement;Trusted_Connection=True;TrustServerCertificate=True");

builder.Services.AddDbContext<AppDbContext>(tuyChon => tuyChon.UseSqlServer(chuoiKetNoi));

/* ------------------------------------------------------------------ *
 * 1b. Khoá mã hoá (Data Protection)
 * ------------------------------------------------------------------ */

// Khoá này mã hoá refresh token Google đã lưu trong database. Trên máy chủ có ổ đĩa TẠM thì mỗi lần
// deploy là mất khoá ⇒ mọi token đã mã hoá không giải mã được ⇒ TẤT CẢ giáo viên phải nối lại Google.
// Vì vậy bản chạy thật bắt buộc trỏ `DataProtection:ThuMucKhoa` vào ổ đĩa bền và sao lưu thư mục đó
// cùng với database. Máy dev không đặt thì dùng mặc định của ASP.NET Core (không sao, chỉ là máy dev).
var thuMucKhoa = builder.Configuration["DataProtection:ThuMucKhoa"];
if (!string.IsNullOrWhiteSpace(thuMucKhoa))
{
    Directory.CreateDirectory(thuMucKhoa);
    builder.Services
        .AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(thuMucKhoa))
        // Tên ứng dụng cố định: đổi tên là khoá cũ không dùng lại được.
        .SetApplicationName("ClassManagement");
}

/* ------------------------------------------------------------------ *
 * 2. Tài khoản và mật khẩu
 * ------------------------------------------------------------------ */

builder.Services
    .AddIdentityCore<GiaoVien>(tuyChon =>
    {
        // Đủ chặt để không ai đặt "123456", nhưng không bắt ký tự đặc biệt: giáo viên quên mật khẩu
        // thì phiền hơn nhiều so với cái lợi mà yêu cầu đó mang lại.
        tuyChon.Password.RequiredLength = 8;
        tuyChon.Password.RequireDigit = true;
        tuyChon.Password.RequireLowercase = true;
        tuyChon.Password.RequireUppercase = false;
        tuyChon.Password.RequireNonAlphanumeric = false;
        tuyChon.User.RequireUniqueEmail = true;

        // Sai 5 lần thì khoá 15 phút — đủ để chặn dò mật khẩu mà không làm khổ người gõ nhầm.
        tuyChon.Lockout.MaxFailedAccessAttempts = 5;
        tuyChon.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        tuyChon.Lockout.AllowedForNewUsers = true;
    })
    .AddEntityFrameworkStores<AppDbContext>()
    // Cần thiết để sinh token một lần (đặt lại mật khẩu, xác nhận email). Thiếu dòng này thì
    // GeneratePasswordResetTokenAsync ném NotSupportedException lúc chạy, không phải lúc build.
    .AddDefaultTokenProviders();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<NguoiDungHienTai>();
builder.Services.AddScoped<DichVuNhatKy>();
builder.Services.AddScoped<DichVuBuoiHoc>();
builder.Services.AddScoped<DichVuHocSinh>();
builder.Services.AddScoped<DichVuLichDay>();
builder.Services.AddScoped<DichVuHocPhi>();

// Email: mật khẩu SMTP chỉ nằm ở user-secrets. Thiếu cấu hình thì chỉ riêng việc gửi email báo lỗi,
// còn đăng nhập, lịch dạy, điểm danh và học phí vẫn chạy bình thường.
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection(EmailOptions.TenMuc));
builder.Services.AddScoped<DichVuTaiKhoan>();

var tuyChonEmail = builder.Configuration.GetSection(EmailOptions.TenMuc).Get<EmailOptions>()
    ?? new EmailOptions();

if (builder.Environment.IsDevelopment() && tuyChonEmail.CheDoGia)
{
    // Hộp thư giả: CHỈ ở máy dev và chỉ khi bật CheDoGia. Máy chạy thật luôn dùng SMTP thật.
    builder.Services.AddScoped<IDichVuEmail, DichVuEmailGia>();
}
else
{
    builder.Services.AddScoped<IDichVuEmail, DichVuEmailThat>();
}

// Google Calendar: Client ID/Secret nằm ở user-secrets, không bao giờ đi qua giao diện web.
builder.Services.Configure<GoogleCalendarOptions>(
    builder.Configuration.GetSection(GoogleCalendarOptions.TenMuc));
builder.Services.AddHttpClient<KhachGoogleCalendarThat>();
builder.Services.AddScoped<DichVuGoogleCalendar>();
builder.Services.AddScoped<DichVuDongBoLich>();

var tuyChonGoogle = builder.Configuration.GetSection(GoogleCalendarOptions.TenMuc).Get<GoogleCalendarOptions>()
    ?? new GoogleCalendarOptions();

if (builder.Environment.IsDevelopment() && tuyChonGoogle.CheDoGia)
{
    // Khách Google giả: CHỈ ở máy dev và chỉ khi bật CheDoGia, để thử luồng đồng bộ mà không cần
    // tài khoản Google thật. Máy chạy thật luôn dùng khách thật.
    builder.Services.AddScoped<IKhachGoogleCalendar, KhachGoogleCalendarGia>();
}
else
{
    builder.Services.AddScoped<IKhachGoogleCalendar>(dichVu => dichVu.GetRequiredService<KhachGoogleCalendarThat>());
}
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.Configure<SeedOptions>(builder.Configuration.GetSection(SeedOptions.TenMuc));

/* ------------------------------------------------------------------ *
 * 3. Token và phân quyền
 * ------------------------------------------------------------------ */

var tuyChonJwt = builder.Configuration.GetSection(JwtOptions.TenMuc).Get<JwtOptions>() ?? new JwtOptions();
tuyChonJwt.KiemTraHopLe();
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.TenMuc));

// Hai hằng số vai trò trong ChinhSach phải trùng giá trị trong Entities.Enums. Lệch nhau thì
// phân quyền sai một cách âm thầm, nên kiểm tra ngay lúc khởi động và dừng luôn.
if (EnumWire.ToWire(VaiTro.Admin) != ChinhSach.VaiTroAdmin
    || EnumWire.ToWire(VaiTro.GiaoVien) != ChinhSach.VaiTroGiaoVien)
{
    throw new InvalidOperationException(
        "Hằng số vai trò trong Auth/ChinhSach.cs không khớp với Entities/Enums.cs. Sửa cho khớp rồi chạy lại.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(tuyChon =>
    {
        // Giữ nguyên tên claim ngắn trong token ("sub", "vaiTro") thay vì để thư viện đổi sang
        // URI dài của Microsoft.
        tuyChon.MapInboundClaims = false;
        tuyChon.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = tuyChonJwt.Issuer,
            ValidateAudience = true,
            ValidAudience = tuyChonJwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(tuyChonJwt.Key!)),
            ValidateLifetime = true,
            // Máy chủ và máy khách lệch nhau vài giây là chuyện thường, không nên đá người dùng ra.
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "sub",
            RoleClaimType = ChinhSach.ClaimVaiTro,
        };
    });

builder.Services.AddAuthorization(tuyChon =>
{
    tuyChon.AddPolicy(
        ChinhSach.ChiAdmin,
        chinhSach => chinhSach.RequireClaim(ChinhSach.ClaimVaiTro, ChinhSach.VaiTroAdmin));
});

/* ------------------------------------------------------------------ *
 * 4. MVC, JSON, OpenAPI
 * ------------------------------------------------------------------ */

builder.Services
    .AddControllers()
    .AddJsonOptions(tuyChon =>
    {
        tuyChon.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;

        // Enum đi trên đường JSON dưới dạng chuỗi đọc được ("giao_vien", "theo_buoi") chứ không
        // phải số. Số thì đọc log không hiểu gì, mà đổi thứ tự enum là hỏng dữ liệu cũ.
        tuyChon.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

/* ------------------------------------------------------------------ *
 * 5. Đường ống xử lý request
 * ------------------------------------------------------------------ */

// Đứng trước tất cả để mọi lỗi ném ra từ dưới đều thành ProblemDetails đúng chuẩn.
app.UseMiddleware<XuLyLoiApiMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Cố tình KHÔNG bật UseHttpsRedirection: frontend gọi qua http://localhost:5080 và Vite proxy
// chuyển tiếp, bật chuyển hướng HTTPS ở đây chỉ làm proxy đứt.

// Giao diện đã build (deploy/build.sh copy frontend/dist vào wwwroot). Chỉ bật khi thật sự có
// index.html, nên máy dev — nơi giao diện chạy ở Vite cổng 5173 — không bị ảnh hưởng.
var thuMucGiaoDien = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
var coGiaoDien = File.Exists(Path.Combine(thuMucGiaoDien, "index.html"));

if (coGiaoDien)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

if (coGiaoDien)
{
    // Giao diện và API cùng MỘT tên miền: không cần CORS, cookie phiên SameSite=Lax hoạt động, và
    // Google chỉ phải khai 2 redirect URI trên tên miền đó. Mọi đường dẫn không phải API và không
    // phải tệp có thật thì trả index.html để React Router tự xử lý.
    app.MapFallbackToFile("index.html");
}

/* ------------------------------------------------------------------ *
 * 6. Migration và dữ liệu tối thiểu khi khởi động
 * ------------------------------------------------------------------ */

using (var phamVi = app.Services.CreateScope())
{
    var dichVu = phamVi.ServiceProvider;
    var db = dichVu.GetRequiredService<AppDbContext>();
    var ghiLog = dichVu.GetRequiredService<ILoggerFactory>().CreateLogger("KhoiDong");
    var tuyChonSeed = app.Configuration.GetSection(SeedOptions.TenMuc).Get<SeedOptions>() ?? new SeedOptions();

    if (app.Environment.IsDevelopment())
    {
        // Máy dev thì tự chạy migration cho tiện. Máy chạy thật phải chạy tay bằng
        // "dotnet ef database update" để không có chuyện tự sửa database khi khởi động.
        await db.Database.MigrateAsync();
    }
    else if (!await db.Database.CanConnectAsync())
    {
        ghiLog.LogWarning(
            "Không kết nối được database ở môi trường {MoiTruong}. Chạy migration bằng lệnh: dotnet ef database update",
            app.Environment.EnvironmentName);
    }

    await DbSeeder.ChayAsync(
        db,
        dichVu.GetRequiredService<UserManager<GiaoVien>>(),
        tuyChonSeed,
        ghiLog);
}

app.Run();
