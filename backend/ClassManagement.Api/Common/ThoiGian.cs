using ClassManagement.Api.Entities;

namespace ClassManagement.Api.Common;

/// <summary>
/// Cách tính tuần và múi giờ đã chốt với frontend: tuần bắt đầu từ thứ hai, giờ hiển thị theo
/// múi giờ của trung tâm (mặc định Asia/Ho_Chi_Minh).
/// </summary>
public static class ThoiGian
{
    /// <summary>Đổi ngày dương lịch sang thứ ISO-8601 (thứ hai = 1 … chủ nhật = 7).</summary>
    public static ThuTrongTuan ThuCua(DateOnly ngay)
    {
        return ngay.DayOfWeek == DayOfWeek.Sunday
            ? ThuTrongTuan.ChuNhat
            : (ThuTrongTuan)(int)ngay.DayOfWeek;
    }

    /// <summary>Ngày thứ hai của tuần chứa ngày đã cho.</summary>
    public static DateOnly DauTuan(DateOnly ngay)
    {
        return ngay.AddDays(-((int)ThuCua(ngay) - 1));
    }

    /// <summary>Ngày chủ nhật của tuần chứa ngày đã cho.</summary>
    public static DateOnly CuoiTuan(DateOnly ngay)
    {
        return DauTuan(ngay).AddDays(6);
    }

    /// <summary>
    /// Múi giờ của trung tâm. Không hiểu mã múi giờ thì trả về UTC kèm cảnh báo ở tầng gọi,
    /// không làm sập ứng dụng vì một dòng cấu hình sai.
    /// </summary>
    public static TimeZoneInfo LayMuiGio(string? muiGio)
    {
        if (string.IsNullOrWhiteSpace(muiGio))
        {
            return TimeZoneInfo.Utc;
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(muiGio);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }

    /// <summary>Thời điểm UTC hiện tại, ghi vào các cột audit.</summary>
    public static DateTime BayGioUtc()
    {
        return DateTime.UtcNow;
    }
}
