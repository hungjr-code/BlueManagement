/**
 * Cách hiển thị riêng của màn hình Học sinh: nhãn tiếng Việt, mô tả lịch học, học phí dự kiến và
 * cách đọc lỗi API.
 *
 * Đặt trong thư mục feature thay vì sửa tầng dùng chung (src/lib, src/config) vì hiện chỉ màn hình
 * này dùng; khi màn hình khác cần thì lúc đó mới bê lên trên.
 */
import { ApiError } from '../../api/http'
import type { CachTinhHocPhi, HocSinh, KhungGioHoc, TrangThaiHocSinh } from '../../api/types'
import { THU_TRONG_TUAN, gioNgan, tenThuNgan } from '../../config/lichTuan'
import { formatVnd } from '../../lib/money'

/** Số tuần mỗi tháng dùng để ước lượng học phí theo buổi (khớp cách backend tính ở /api/dashboard). */
export const SO_TUAN_MOI_THANG = 4

export const TRANG_THAI_HOC_SINH: ReadonlyArray<{
  value: TrangThaiHocSinh
  label: string
  mau: string
}> = [
  { value: 'dang_hoc', label: 'Đang học', mau: 'green' },
  { value: 'tam_nghi', label: 'Tạm nghỉ', mau: 'gold' },
  { value: 'da_nghi', label: 'Đã nghỉ', mau: 'default' },
]

export const CACH_TINH_HOC_PHI: ReadonlyArray<{
  value: CachTinhHocPhi
  label: string
  mau: string
}> = [
  { value: 'theo_buoi', label: 'Theo buổi', mau: 'blue' },
  { value: 'theo_thang', label: 'Theo tháng', mau: 'purple' },
]

export function nhanTrangThai(trangThai: TrangThaiHocSinh): string {
  return TRANG_THAI_HOC_SINH.find((item) => item.value === trangThai)?.label ?? trangThai
}

export function mauTrangThai(trangThai: TrangThaiHocSinh): string {
  return TRANG_THAI_HOC_SINH.find((item) => item.value === trangThai)?.mau ?? 'default'
}

export function nhanCachTinhHocPhi(cachTinh: CachTinhHocPhi): string {
  return CACH_TINH_HOC_PHI.find((item) => item.value === cachTinh)?.label ?? cachTinh
}

export function mauCachTinhHocPhi(cachTinh: CachTinhHocPhi): string {
  return CACH_TINH_HOC_PHI.find((item) => item.value === cachTinh)?.mau ?? 'default'
}

/** Đơn giá đang áp dụng, theo đúng cách tính học phí của học sinh đó. */
export function moTaDonGia(hocSinh: HocSinh): string {
  if (hocSinh.cachTinhHocPhi === 'theo_thang') {
    return hocSinh.hocPhiTheoThang === null ? '—' : `${formatVnd(hocSinh.hocPhiTheoThang)} / tháng`
  }
  return hocSinh.donGiaTheoBuoi === null ? '—' : `${formatVnd(hocSinh.donGiaTheoBuoi)} / buổi`
}

/** Thứ tự thứ trong tuần (thứ hai → chủ nhật) để sắp lịch học cho dễ đọc. */
const thuTuTrongTuan = new Map(THU_TRONG_TUAN.map((item, chiSo) => [item.value, chiSo]))

/** "T3 18:00–19:30, T6 18:00–19:30", sắp theo thứ rồi theo giờ bắt đầu. */
export function moTaLichHoc(lichHoc: KhungGioHoc[]): string {
  if (lichHoc.length === 0) return '—'
  return [...lichHoc]
    .sort(
      (a, b) =>
        (thuTuTrongTuan.get(a.thu) ?? 99) - (thuTuTrongTuan.get(b.thu) ?? 99) ||
        a.gioBatDau.localeCompare(b.gioBatDau),
    )
    .map((khung) => `${tenThuNgan(khung.thu)} ${gioNgan(khung.gioBatDau)}–${gioNgan(khung.gioKetThuc)}`)
    .join(', ')
}

/**
 * Học phí dự kiến một tháng — con số nuôi cột "Học phí dự kiến/tháng".
 *
 * Đây là ước lượng để nhìn nhanh, KHÔNG phải công nợ thật: theo buổi thì lấy số buổi mỗi tuần
 * × 4 tuần × đơn giá nên chưa trừ buổi nghỉ (buổi nghỉ chỉ trừ được khi đã điểm danh — trang Học phí,
 * Phase 4). Theo tháng thì đúng bằng mức tháng đã khai.
 */
export function hocPhiDuKienThang(hocSinh: HocSinh): number | null {
  if (hocSinh.cachTinhHocPhi === 'theo_thang') return hocSinh.hocPhiTheoThang
  if (hocSinh.donGiaTheoBuoi === null) return null
  return hocSinh.soBuoiMoiTuan * SO_TUAN_MOI_THANG * hocSinh.donGiaTheoBuoi
}

/** Ngày đến hạn đóng tiền trong tháng: 5 → "mùng 5 hằng tháng". */
export function moTaHanDong(ngay: number): string {
  return `mùng ${ngay} hằng tháng`
}

export interface LoiTheoField {
  field: string
  thongDiep: string
}

/** Lỗi validate của backend tách theo từng field (ProblemDetails.errors). */
export function loiTheoField(error: unknown): LoiTheoField[] {
  const problem = error instanceof ApiError ? error.problem : undefined
  if (!problem?.errors) return []
  return Object.entries(problem.errors).flatMap(([field, danhSach]) =>
    danhSach.map((thongDiep) => ({ field, thongDiep })),
  )
}

/** Một dòng mô tả lỗi để hiện trong Alert khi không tách được theo từng field. */
export function thongBaoLoi(error: unknown, macDinh: string): string {
  const theoField = loiTheoField(error)
  if (theoField.length > 0) {
    return theoField.map((item) => `${item.field}: ${item.thongDiep}`).join(' · ')
  }
  if (error instanceof ApiError) return error.message
  return macDinh
}

/** Backend trả 409 khi tạo học sinh trùng tên với học sinh đã có của cùng giáo viên. */
export function laLoiTrungTen(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409
}
