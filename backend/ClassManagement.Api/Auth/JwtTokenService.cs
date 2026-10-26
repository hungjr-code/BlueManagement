using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ClassManagement.Api.Common;
using ClassManagement.Api.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace ClassManagement.Api.Auth;

/// <summary>Tạo access token (JWT) và refresh token (chuỗi ngẫu nhiên, database chỉ lưu bản băm).</summary>
public class JwtTokenService(IOptions<JwtOptions> tuyChon)
{
    private readonly JwtOptions _tuyChon = tuyChon.Value;

    /// <summary>
    /// Access token chứa đúng thứ cần để phân quyền và hiển thị tên, không chứa gì thêm:
    /// token nằm trong trình duyệt nên càng ít thông tin càng tốt.
    /// </summary>
    public (string Token, DateTime HetHanUtc) TaoAccessToken(GiaoVien nguoiDung)
    {
        var hetHan = DateTime.UtcNow.AddMinutes(_tuyChon.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, nguoiDung.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ChinhSach.ClaimVaiTro, EnumWire.ToWire(nguoiDung.VaiTro)),
            new(ChinhSach.ClaimHoTen, nguoiDung.HoTen),
        };

        if (!string.IsNullOrWhiteSpace(nguoiDung.Email))
        {
            claims.Add(new Claim(ChinhSach.ClaimEmail, nguoiDung.Email));
        }

        var thongTin = new JwtSecurityToken(
            issuer: _tuyChon.Issuer,
            audience: _tuyChon.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: hetHan,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_tuyChon.Key!)),
                SecurityAlgorithms.HmacSha256));

        return (new JwtSecurityTokenHandler().WriteToken(thongTin), hetHan);
    }

    /// <summary>
    /// Access token của HỌC SINH. Khác token giáo viên ở hai chỗ: vai trò là "hoc_sinh", và audience
    /// là <see cref="JwtOptions.AudienceHocSinh"/> — nhờ vậy token này KHÔNG dùng được cho bất kỳ API
    /// nào của giáo viên, kể cả khi ai đó quên kiểm tra vai trò.
    /// </summary>
    public (string Token, DateTime HetHanUtc) TaoAccessToken(HocSinh hocSinh)
    {
        var hetHan = DateTime.UtcNow.AddMinutes(_tuyChon.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, hocSinh.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ChinhSach.ClaimVaiTro, ChinhSach.VaiTroHocSinh),
            new(ChinhSach.ClaimHoTen, hocSinh.HoTen),
        };

        if (!string.IsNullOrWhiteSpace(hocSinh.MaHocSinh))
        {
            claims.Add(new Claim(ChinhSach.ClaimMaHocSinh, hocSinh.MaHocSinh));
        }

        var thongTin = new JwtSecurityToken(
            issuer: _tuyChon.Issuer,
            audience: _tuyChon.AudienceHocSinh,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: hetHan,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_tuyChon.Key!)),
                SecurityAlgorithms.HmacSha256));

        return (new JwtSecurityTokenHandler().WriteToken(thongTin), hetHan);
    }

    /// <summary>
    /// Refresh token là 64 byte ngẫu nhiên. Không nhét thêm thông tin gì vào token: mọi thứ cần
    /// biết đều tra được trong bảng PhienDangNhap, nhờ vậy thu hồi phiên là xoá/huỷ một dòng.
    /// </summary>
    public static string TaoRefreshToken()
    {
        return Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(64));
    }

    /// <summary>
    /// Database chỉ giữ bản băm SHA-256. Kẻ đọc được database cũng không dùng lại được token
    /// của người khác, còn backend thì vẫn tra cứu được vì token là chuỗi ngẫu nhiên đủ dài.
    /// </summary>
    public static string BamToken(string token)
    {
        var bam = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexStringLower(bam);
    }
}
