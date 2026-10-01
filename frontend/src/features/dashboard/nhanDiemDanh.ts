import type { LyDoNghi, TrangThaiDiemDanh } from '../../api/types'

/**
 * Nhãn hiển thị cho trạng thái điểm danh của một buổi học.
 *
 * Backend chỉ có ba trạng thái (`chua_diem_danh`, `di_hoc`, `nghi`) nhưng "nghỉ" được tách làm hai
 * nhãn ở giao diện vì nghỉ có phép và nghỉ không phép được đếm riêng, ảnh hưởng tới học phí.
 */
export interface NhanTrangThai {
  nhan: string
  mau: string
}

/** Buổi học ở mức tối thiểu cần cho việc hiển thị trạng thái. */
export interface BuoiCoTrangThai {
  trangThai: TrangThaiDiemDanh
  lyDoNghi: LyDoNghi | null
}

export const NHAN_TRANG_THAI: Record<TrangThaiDiemDanh, NhanTrangThai> = {
  chua_diem_danh: { nhan: 'Chưa điểm danh', mau: 'default' },
  di_hoc: { nhan: 'Đi học', mau: 'success' },
  nghi: { nhan: 'Nghỉ', mau: 'warning' },
}

/**
 * Nhãn của một buổi cụ thể. Thiếu `lyDoNghi` cũng tính là nghỉ không phép, khớp cách backend đếm
 * (`soNghiKhongPhep` đếm mọi buổi nghỉ không phải "có phép").
 */
export function nhanCuaBuoi(buoi: BuoiCoTrangThai): NhanTrangThai {
  if (buoi.trangThai !== 'nghi') return NHAN_TRANG_THAI[buoi.trangThai]

  return buoi.lyDoNghi === 'co_phep'
    ? { nhan: 'Nghỉ có phép', mau: 'orange' }
    : { nhan: 'Nghỉ không phép', mau: 'error' }
}
