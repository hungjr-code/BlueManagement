namespace ClassManagement.Api.Auth;

/// <summary>
/// Tên chính sách, tên claim và tên cookie dùng xuyên suốt backend. Gom một chỗ để không có
/// chuyện chỗ này ghi "admin", chỗ kia ghi "Admin" rồi phân quyền im lặng sai.
/// </summary>
public static class ChinhSach
{
    /// <summary>Chính sách chỉ dành cho admin (chủ trung tâm).</summary>
    public const string ChiAdmin = "ChiAdmin";

    /// <summary>
    /// Tên claim chứa vai trò. Khác các hệ thống thường dùng "role" vì đây cũng chính là
    /// RoleClaimType lúc kiểm tra token, và giá trị của nó là "admin" / "giao_vien".
    /// </summary>
    public const string ClaimVaiTro = "vaiTro";

    public const string ClaimEmail = "email";

    public const string ClaimHoTen = "hoTen";

    /// <summary>Cookie chứa refresh token. Chỉ gửi tới các endpoint /api/auth nên các API khác không thấy nó.</summary>
    public const string TenCookiePhien = "cm_phien";

    /// <summary>Đường dẫn được phép gửi kèm cookie phiên.</summary>
    public const string DuongDanCookie = "/api/auth";

    // Hai hằng số dưới đây PHẢI trùng giá trị trong Entities.Enums. Program.cs kiểm tra lúc khởi
    // động, lệch nhau là dừng ngay chứ không để phân quyền sai một cách âm thầm.
    public const string VaiTroAdmin = "admin";

    public const string VaiTroGiaoVien = "giao_vien";
}
