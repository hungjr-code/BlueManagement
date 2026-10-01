using System.Text.Json.Serialization;

namespace ClassManagement.Api.Entities;

/*
 * Tên trong ngoặc là giá trị đi trên đường JSON và nằm trong database.
 * Sửa tên ở đây là đổi hợp đồng với frontend, phải sửa cả hai phía.
 */

/// <summary>Vai trò tài khoản. Chỉ có hai vai trò, không cho tự đăng ký thành admin qua web.</summary>
public enum VaiTro
{
    [JsonStringEnumMemberName("admin")] Admin,
    [JsonStringEnumMemberName("giao_vien")] GiaoVien,
}

/// <summary>Nghỉ việc thì chuyển trạng thái và khoá đăng nhập, không xoá hồ sơ.</summary>
public enum TrangThaiGiaoVien
{
    [JsonStringEnumMemberName("dang_lam")] DangLam,
    [JsonStringEnumMemberName("tam_nghi")] TamNghi,
    [JsonStringEnumMemberName("da_nghi")] DaNghi,
}

/// <summary>Quyết định học phí tính theo số buổi đi học hay theo tháng cố định.</summary>
public enum CachTinhHocPhi
{
    [JsonStringEnumMemberName("theo_buoi")] TheoBuoi,
    [JsonStringEnumMemberName("theo_thang")] TheoThang,
}

/// <summary>Ngừng dạy thì đổi trạng thái, không xoá — để giữ lịch sử điểm danh và học phí.</summary>
public enum TrangThaiHocSinh
{
    [JsonStringEnumMemberName("dang_hoc")] DangHoc,
    [JsonStringEnumMemberName("tam_nghi")] TamNghi,
    [JsonStringEnumMemberName("da_nghi")] DaNghi,
}

/// <summary>
/// Bốn trạng thái của một buổi. <c>ChuaDiemDanh</c> là mặc định và KHÁC với nghỉ:
/// bỏ trống mà coi là nghỉ thì học phí sẽ tính sai.
/// </summary>
public enum TrangThaiDiemDanh
{
    [JsonStringEnumMemberName("chua_diem_danh")] ChuaDiemDanh,
    [JsonStringEnumMemberName("di_hoc")] DiHoc,
    [JsonStringEnumMemberName("nghi")] Nghi,
}

/// <summary>Chỉ dùng khi buổi học ở trạng thái nghỉ. Học phí và thống kê xử lý khác nhau.</summary>
public enum LyDoNghi
{
    [JsonStringEnumMemberName("co_phep")] CoPhep,
    [JsonStringEnumMemberName("khong_phep")] KhongPhep,
}

public enum TrangThaiThanhToan
{
    [JsonStringEnumMemberName("chua_thu")] ChuaThu,
    [JsonStringEnumMemberName("thu_mot_phan")] ThuMotPhan,
    [JsonStringEnumMemberName("da_thu")] DaThu,
}

public enum HinhThucThanhToan
{
    [JsonStringEnumMemberName("tien_mat")] TienMat,
    [JsonStringEnumMemberName("chuyen_khoan")] ChuyenKhoan,
}

/// <summary>
/// Thứ trong tuần theo ISO-8601: 1 = thứ hai … 7 = chủ nhật, khớp cách frontend tính tuần
/// (tuần bắt đầu từ thứ hai). Cố tình dùng tên thay vì số để đọc dữ liệu thô là hiểu ngay.
/// </summary>
public enum ThuTrongTuan
{
    [JsonStringEnumMemberName("thu_2")] Thu2 = 1,
    [JsonStringEnumMemberName("thu_3")] Thu3 = 2,
    [JsonStringEnumMemberName("thu_4")] Thu4 = 3,
    [JsonStringEnumMemberName("thu_5")] Thu5 = 4,
    [JsonStringEnumMemberName("thu_6")] Thu6 = 5,
    [JsonStringEnumMemberName("thu_7")] Thu7 = 6,
    [JsonStringEnumMemberName("chu_nhat")] ChuNhat = 7,
}
