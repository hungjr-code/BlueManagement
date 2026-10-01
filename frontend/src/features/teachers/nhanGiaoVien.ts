import type { FormRule } from 'antd'
import type { TrangThaiGiaoVien, VaiTro } from '../../api/types'

/** Nhãn và màu hiển thị cho vai trò / trạng thái giáo viên. Chuỗi phải khớp enum ở backend. */
export interface Nhan {
  nhan: string
  mau: string
}

export const NHAN_VAI_TRO: Record<VaiTro, Nhan> = {
  admin: { nhan: 'Admin (chủ)', mau: 'gold' },
  giao_vien: { nhan: 'Giáo viên', mau: 'blue' },
}

export const NHAN_TRANG_THAI: Record<TrangThaiGiaoVien, Nhan> = {
  dang_lam: { nhan: 'Đang làm', mau: 'success' },
  tam_nghi: { nhan: 'Tạm nghỉ', mau: 'warning' },
  da_nghi: { nhan: 'Đã nghỉ', mau: 'default' },
}

export const LUA_CHON_VAI_TRO: { value: VaiTro; label: string }[] = [
  { value: 'giao_vien', label: 'Giáo viên — chỉ thấy học sinh của mình' },
  { value: 'admin', label: 'Admin (chủ) — thấy toàn bộ dữ liệu' },
]

export const LUA_CHON_TRANG_THAI: { value: TrangThaiGiaoVien; label: string }[] = [
  { value: 'dang_lam', label: 'Đang làm — được đăng nhập' },
  { value: 'tam_nghi', label: 'Tạm nghỉ — khoá đăng nhập, đăng xuất mọi phiên đang mở' },
  { value: 'da_nghi', label: 'Đã nghỉ — khoá đăng nhập, giữ hồ sơ để tra cứu' },
]

/**
 * Quy tắc mật khẩu khớp cấu hình Identity ở backend (`Program.cs`): dài 8 ký tự, bắt buộc có số và
 * chữ thường, KHÔNG bắt ký tự đặc biệt. Đặt một chỗ để hai modal không lệch nhau.
 */
export const QUY_TAC_MAT_KHAU: FormRule[] = [
  { required: true, message: 'Nhập mật khẩu' },
  { min: 8, message: 'Mật khẩu phải dài ít nhất 8 ký tự' },
  { pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: 'Mật khẩu phải có cả chữ và số' },
]

export const GHI_CHU_MAT_KHAU =
  'Ít nhất 8 ký tự, có cả chữ và số. Chưa có kênh gửi email mời nên admin đặt mật khẩu hộ; giáo viên nên đổi lại ngay sau lần đăng nhập đầu.'
