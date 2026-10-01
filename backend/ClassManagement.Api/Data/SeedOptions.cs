namespace ClassManagement.Api.Data;

/// <summary>
/// Cấu hình đọc từ mục "Seed" trong appsettings hoặc từ user-secrets.
///
/// Mật khẩu KHÔNG bao giờ nằm trong appsettings.json (file đó vào git). Khi chạy máy dev, đặt bằng:
///   dotnet user-secrets set "Seed:Admin:MatKhau" "..."
/// Khi chạy thật, đặt bằng biến môi trường Seed__Admin__MatKhau của máy chủ.
/// </summary>
public class SeedOptions
{
    public const string TenMuc = "Seed";

    public AdminSeed Admin { get; set; } = new();

    /// <summary>
    /// Tạo sẵn một giáo viên và vài học sinh mẫu để thử giao diện. Chỉ bật ở môi trường Development,
    /// và chỉ khi database chưa có học sinh nào.
    /// </summary>
    public bool DuLieuMau { get; set; }
}

public class AdminSeed
{
    public string? Email { get; set; }

    public string? HoTen { get; set; }

    /// <summary>Mật khẩu của admin đầu tiên. Không đặt trong appsettings.</summary>
    public string? MatKhau { get; set; }
}
