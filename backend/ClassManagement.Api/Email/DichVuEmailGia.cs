namespace ClassManagement.Api.Email;

/// <summary>
/// Hộp thư GIẢ — chỉ dùng ở máy dev khi bật <c>Email:CheDoGia</c>.
///
/// Mục đích: thử trọn luồng quên mật khẩu (gửi thư, lấy token trong thư, đặt mật khẩu mới) mà không
/// cần máy chủ SMTP thật. Thư nằm trong bộ nhớ và chỉ đọc được ở môi trường Development.
///
/// KHÔNG bao giờ được dùng ở môi trường chạy thật: Program.cs chỉ đăng ký bản này khi
/// app.Environment.IsDevelopment() và CheDoGia = true.
/// </summary>
public class DichVuEmailGia(ILogger<DichVuEmailGia> ghiLog) : IDichVuEmail
{
    public static readonly List<EmailGiaDaGui> HopThu = [];

    public bool DaCauHinh => true;

    public Task GuiAsync(string den, string tieuDe, string noiDungHtml, CancellationToken huyBo = default)
    {
        HopThu.Add(new EmailGiaDaGui(den, tieuDe, noiDungHtml, DateTime.UtcNow));
        ghiLog.LogInformation("[Email giả] đã \"gửi\" thư tới {Den}: {TieuDe}", den, tieuDe);
        return Task.CompletedTask;
    }
}
