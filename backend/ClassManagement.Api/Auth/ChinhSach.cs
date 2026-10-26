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

    /// <summary>
    /// Vai trò của HỌC SINH. Không nằm trong enum <c>VaiTro</c> vì enum đó là vai trò của tài khoản
    /// giáo viên/admin (bảng GiaoVien); học sinh là một loại tài khoản riêng, đăng nhập bằng mã chứ
    /// không bằng email, và chỉ thấy dữ liệu của chính mình.
    /// </summary>
    public const string VaiTroHocSinh = "hoc_sinh";

    /// <summary>Cookie phiên của học sinh — tên khác để hai phiên không đè lên nhau trên cùng trình duyệt.</summary>
    public const string TenCookiePhienHocSinh = "cm_phien_hs";

    /// <summary>Cookie phiên học sinh chỉ gửi tới các endpoint đăng nhập của học sinh.</summary>
    public const string DuongDanCookieHocSinh = "/api/hoc-sinh/auth";

    /// <summary>Claim chứa mã học sinh, để giao diện hiện đúng mã mà không phải gọi thêm API.</summary>
    public const string ClaimMaHocSinh = "maHocSinh";

    /// <summary>
    /// Tên lược đồ xác thực dành riêng cho token của học sinh. Endpoint của học sinh khai
    /// <c>[Authorize(AuthenticationSchemes = ChinhSach.LuocDoTokenHocSinh)]</c>, còn mọi endpoint của
    /// giáo viên dùng lược đồ mặc định — token của bên này không dùng được cho bên kia.
    /// </summary>
    public const string LuocDoTokenHocSinh = "HocSinh";

    // Hai hằng số dưới đây PHẢI trùng giá trị trong Entities.Enums. Program.cs kiểm tra lúc khởi
    // động, lệch nhau là dừng ngay chứ không để phân quyền sai một cách âm thầm.
    public const string VaiTroAdmin = "admin";

    public const string VaiTroGiaoVien = "giao_vien";
}
