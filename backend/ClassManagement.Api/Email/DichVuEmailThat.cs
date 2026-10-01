using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace ClassManagement.Api.Email;

/// <summary>
/// Gửi thư thật qua SMTP (MailKit). Dùng STARTTLS mặc định vì hầu hết nhà cung cấp (Gmail, Outlook,
/// Zoho…) đều yêu cầu; mật khẩu ứng dụng nằm ở user-secrets.
/// </summary>
public class DichVuEmailThat(IOptions<EmailOptions> tuyChon, ILogger<DichVuEmailThat> ghiLog) : IDichVuEmail
{
    private readonly EmailOptions _tuyChon = tuyChon.Value;

    public bool DaCauHinh => _tuyChon.DaCauHinh;

    public async Task GuiAsync(string den, string tieuDe, string noiDungHtml, CancellationToken huyBo = default)
    {
        if (!_tuyChon.DaCauHinh)
        {
            throw new InvalidOperationException(
                "Chưa cấu hình gửi email (Email:SmtpHost, Email:TuDiaChi).");
        }

        var thu = new MimeMessage();
        thu.From.Add(new MailboxAddress(_tuyChon.TenNguoiGui, _tuyChon.TuDiaChi!));
        thu.To.Add(MailboxAddress.Parse(den));
        thu.Subject = tieuDe;
        thu.Body = new BodyBuilder { HtmlBody = noiDungHtml }.ToMessageBody();

        using var khach = new SmtpClient();
        var baoMat = _tuyChon.DungTls ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto;

        await khach.ConnectAsync(_tuyChon.SmtpHost!, _tuyChon.SmtpPort, baoMat, huyBo);

        if (!string.IsNullOrWhiteSpace(_tuyChon.SmtpTaiKhoan))
        {
            await khach.AuthenticateAsync(_tuyChon.SmtpTaiKhoan, _tuyChon.SmtpMatKhau ?? string.Empty, huyBo);
        }

        await khach.SendAsync(thu, huyBo);
        await khach.DisconnectAsync(true, huyBo);

        ghiLog.LogInformation("Đã gửi email tới {Den}: {TieuDe}", den, tieuDe);
    }
}
