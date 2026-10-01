import dayjs from 'dayjs'
import { ApiError } from '../../api/http'
import type { KetQuaDongBo, LyDoNghi, TrangThaiDiemDanh } from '../../api/types'

/**
 * Nhãn hiển thị và hàm định dạng dùng riêng cho màn hình Lịch dạy.
 *
 * Mỗi feature giữ bản sao nhỏ của mình thay vì import chéo sang feature khác — cùng cách
 * `dashboard/nhanDiemDanh.ts` và `attendance/trangThaiDiemDanh.ts` đang làm. Chuỗi giá trị
 * (`di_hoc`, `nghi`, `co_phep`…) phải khớp enum ở backend.
 */

export interface NhanTrangThaiBuoi {
  nhan: string
  mau: string
}

/** Buổi học ở mức tối thiểu cần cho việc hiển thị trạng thái điểm danh. */
export interface BuoiCoTrangThai {
  trangThai: TrangThaiDiemDanh
  lyDoNghi: LyDoNghi | null
}

const NHAN_TRANG_THAI: Record<TrangThaiDiemDanh, NhanTrangThaiBuoi> = {
  chua_diem_danh: { nhan: 'Chưa điểm danh', mau: 'default' },
  di_hoc: { nhan: 'Đi học', mau: 'success' },
  nghi: { nhan: 'Nghỉ', mau: 'warning' },
}

/**
 * Nhãn của một buổi cụ thể. "Nghỉ" tách làm hai nhãn vì nghỉ có phép và nghỉ không phép
 * được đếm riêng; thiếu `lyDoNghi` tính là nghỉ không phép, khớp cách backend đếm.
 */
export function nhanTrangThaiBuoi(buoi: BuoiCoTrangThai): NhanTrangThaiBuoi {
  if (buoi.trangThai !== 'nghi') return NHAN_TRANG_THAI[buoi.trangThai]

  return buoi.lyDoNghi === 'co_phep'
    ? { nhan: 'Nghỉ có phép', mau: 'orange' }
    : { nhan: 'Nghỉ không phép', mau: 'error' }
}

/** Tóm tắt một lần đồng bộ: tạo mấy, cập nhật mấy, xoá mấy, bỏ qua mấy buổi. */
export function tomTatDongBo(ketQua: KetQuaDongBo): string {
  return `Tạo ${ketQua.soTao}, cập nhật ${ketQua.soCapNhat}, xoá ${ketQua.soXoa}, bỏ qua ${ketQua.soBoQua} buổi`
}

/**
 * `thoiDiemUtc` / `googleDongBoUtc` là giờ UTC; hiển thị theo giờ máy người dùng.
 *
 * Giá trị đọc từ SQL Server có thể mất hậu tố "Z" (DateTimeKind.Unspecified), lúc đó phải tự
 * gắn lại mới không bị hiển thị lệch 7 tiếng.
 */
export function thoiDiemDiaPhuong(iso: string | null | undefined): string {
  if (!iso) return '—'

  const coMuiGio = /(Z|[+-]\d{2}:?\d{2})$/.test(iso)
  return dayjs(coMuiGio ? iso : `${iso}Z`).format('HH:mm DD/MM/YYYY')
}

/** Nội dung lỗi cho người dùng: ưu tiên lỗi theo từng field, rồi mới tới thông báo chung. */
export function noiDungLoi(error: unknown, macDinh: string): string {
  const loiApi = error instanceof ApiError ? error : null
  const theoField = loiApi?.fieldMessages ?? []

  return theoField.length > 0 ? theoField.join(' · ') : (loiApi?.message ?? macDinh)
}
