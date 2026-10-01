namespace ClassManagement.Api.Email;

/// <summary>Thư đã gửi ở chế độ giả, để kiểm thử và người dùng dev đọc lại.</summary>
public record EmailGiaDaGui(string Den, string TieuDe, string NoiDung, DateTime ThoiDiemUtc);

/// <summary>
/// Gửi email. Có hai bản cài: bản thật nói chuyện với máy chủ SMTP, bản giả chỉ chạy ở máy dev.
/// </summary>
public interface IDichVuEmail
{
    bool DaCauHinh { get; }

    Task GuiAsync(string den, string tieuDe, string noiDungHtml, CancellationToken huyBo = default);
}
