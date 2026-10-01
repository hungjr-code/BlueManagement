using System.Collections.Concurrent;
using System.Reflection;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace ClassManagement.Api.Common;

/// <summary>
/// Enum trong C# tên là <c>GiaoVien</c>, nhưng trên API và trong database phải là <c>giao_vien</c>.
/// Bộ chuyển đổi này đọc tên từ <see cref="JsonStringEnumMemberNameAttribute"/> nên JSON và SQL dùng
/// đúng một chuỗi — tránh cảnh API trả "giao_vien" mà câu lệnh SQL phải đi tìm "GiaoVien".
/// </summary>
public static class EnumWire
{
    private static readonly ConcurrentDictionary<Type, IReadOnlyDictionary<Enum, string>> BoNhoDem = new();

    private static IReadOnlyDictionary<Enum, string> BanDo(Type kieuEnum)
    {
        return BoNhoDem.GetOrAdd(kieuEnum, static kieu =>
        {
            var banDo = new Dictionary<Enum, string>();
            foreach (var truong in kieu.GetFields(BindingFlags.Public | BindingFlags.Static))
            {
                var giaTri = (Enum)truong.GetValue(null)!;
                var ten = truong.GetCustomAttribute<JsonStringEnumMemberNameAttribute>()?.Name ?? truong.Name;
                banDo[giaTri] = ten;
            }

            return banDo;
        });
    }

    /// <summary>Đổi giá trị enum thành chuỗi dùng chung cho JSON và database.</summary>
    public static string ToWire<TEnum>(TEnum giaTri) where TEnum : struct, Enum
    {
        return BanDo(typeof(TEnum)).TryGetValue(giaTri, out var ten)
            ? ten
            : throw new InvalidOperationException($"Enum {typeof(TEnum).Name} không có giá trị {giaTri}.");
    }

    /// <summary>Đọc chuỗi từ API hoặc từ database trở lại thành enum.</summary>
    public static TEnum FromWire<TEnum>(string chuoi) where TEnum : struct, Enum
    {
        foreach (var cap in BanDo(typeof(TEnum)))
        {
            if (string.Equals(cap.Value, chuoi, StringComparison.OrdinalIgnoreCase))
            {
                return (TEnum)(object)cap.Key;
            }
        }

        throw new InvalidOperationException($"Không hiểu giá trị \"" + chuoi + "\" của enum " + typeof(TEnum).Name + ".");
    }

    /// <summary>Converter cho EF Core: cột trong database lưu đúng chuỗi mà API trả về.</summary>
    public static ValueConverter<TEnum, string> Converter<TEnum>() where TEnum : struct, Enum
    {
        return new ValueConverter<TEnum, string>(
            giaTri => ToWire(giaTri),
            chuoi => FromWire<TEnum>(chuoi));
    }
}
