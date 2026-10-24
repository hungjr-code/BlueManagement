import dayjs from 'dayjs'

/**
 * Đổi một thời điểm UTC (ISO) sang giờ máy người dùng để hiển thị.
 *
 * Giá trị đọc từ database có thể mất hậu tố "Z" (DateTimeKind.Unspecified ở phía .NET), lúc đó
 * phải tự gắn lại mới không bị hiển thị lệch 7 tiếng.
 *
 * Một chỗ duy nhất: màn hình Lịch dạy, Điểm danh và Cài đặt Google đều dùng chung — trước đây mỗi
 * màn hình chép lại một bản.
 */
export function thoiDiemDiaPhuong(iso: string | null | undefined): string {
  if (!iso) return '—'

  const coMuiGio = /(Z|[+-]\d{2}:?\d{2})$/.test(iso)
  return dayjs(coMuiGio ? iso : `${iso}Z`).format('HH:mm DD/MM/YYYY')
}
