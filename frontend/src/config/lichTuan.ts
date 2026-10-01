import dayjs from 'dayjs'
import type { ThuTrongTuan } from '../api/types'

/**
 * Quy ước tuần của cả ứng dụng: tuần bắt đầu từ THỨ HAI và kết thúc CHỦ NHẬT, khớp cách backend
 * tính tuần (Common/ThoiGian.cs). Mọi màn hình dùng chung file này để không chỗ nào lệch một ngày.
 */

export const THU_TRONG_TUAN: ReadonlyArray<{ value: ThuTrongTuan; label: string; ngan: string }> = [
  { value: 'thu_2', label: 'Thứ hai', ngan: 'T2' },
  { value: 'thu_3', label: 'Thứ ba', ngan: 'T3' },
  { value: 'thu_4', label: 'Thứ tư', ngan: 'T4' },
  { value: 'thu_5', label: 'Thứ năm', ngan: 'T5' },
  { value: 'thu_6', label: 'Thứ sáu', ngan: 'T6' },
  { value: 'thu_7', label: 'Thứ bảy', ngan: 'T7' },
  { value: 'chu_nhat', label: 'Chủ nhật', ngan: 'CN' },
]

/** Thứ ISO-8601 (thứ hai = 1 … chủ nhật = 7) của một ngày. */
export function thuCua(ngay: string | Date): ThuTrongTuan {
  const ngayDayjs = dayjs(ngay)
  // dayjs coi chủ nhật là 0, còn quy ước ở đây là 7.
  const iso = ngayDayjs.day() === 0 ? 7 : ngayDayjs.day()
  return THU_TRONG_TUAN[iso - 1].value
}

export function tenThu(thu: ThuTrongTuan): string {
  return THU_TRONG_TUAN.find((item) => item.value === thu)?.label ?? thu
}

export function tenThuNgan(thu: ThuTrongTuan): string {
  return THU_TRONG_TUAN.find((item) => item.value === thu)?.ngan ?? thu
}

/** Thứ hai của tuần chứa ngày đã cho. */
export function dauTuan(ngay: string | Date): string {
  const ngayDayjs = dayjs(ngay)
  return ngayDayjs.subtract((ngayDayjs.day() + 6) % 7, 'day').format('YYYY-MM-DD')
}

/** Chủ nhật của tuần chứa ngày đã cho. */
export function cuoiTuan(ngay: string | Date): string {
  return dayjs(dauTuan(ngay)).add(6, 'day').format('YYYY-MM-DD')
}

/** Dịch cả một khoảng tuần đi trước hoặc sau một số tuần. */
export function dichTuan(tuNgay: string, soTuan: number): { tu: string; den: string } {
  const tu = dayjs(tuNgay).add(soTuan, 'week').format('YYYY-MM-DD')
  return { tu, den: dayjs(tu).add(6, 'day').format('YYYY-MM-DD') }
}

/** "18:00:00" → "18:00" để hiển thị. */
export function gioNgan(gio: string | null | undefined): string {
  return gio ? gio.slice(0, 5) : '—'
}

/** "2026-09-29" → "29/09/2026". */
export function ngayNgan(ngay: string | null | undefined): string {
  return ngay ? dayjs(ngay).format('DD/MM/YYYY') : '—'
}

export function laHomNay(ngay: string): boolean {
  return dayjs(ngay).isSame(dayjs(), 'day')
}
