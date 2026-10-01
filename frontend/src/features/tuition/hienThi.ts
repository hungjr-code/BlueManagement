/**
 * Cách hiển thị riêng của màn hình Học phí: nhãn tiếng Việt, màu Tag, cách đọc lỗi API và cách tính
 * số ngày so với hạn đóng tiền.
 *
 * Đặt trong thư mục feature (không bê lên src/lib) vì hiện chỉ màn hình này dùng — khi màn hình khác
 * cần thì lúc đó mới chuyển lên trên.
 */
import dayjs from 'dayjs'
import { ApiError } from '../../api/http'
import type {
  BuoiTrongKy,
  HinhThucThanhToan,
  MucDoKhop,
  TepExcel,
  TrangThaiThanhToan,
} from '../../api/tuition'
import type { CachTinhHocPhi } from '../../api/types'

/* --------------------------- Trạng thái thanh toán --------------------------- */

export const TRANG_THAI_THANH_TOAN: ReadonlyArray<{
  value: TrangThaiThanhToan
  label: string
  mau: string
}> = [
  { value: 'chua_thu', label: 'Chưa thu', mau: 'red' },
  { value: 'thu_mot_phan', label: 'Thu một phần', mau: 'gold' },
  { value: 'da_thu', label: 'Đã thu đủ', mau: 'green' },
]

export function nhanTrangThaiThanhToan(trangThai: TrangThaiThanhToan): string {
  return TRANG_THAI_THANH_TOAN.find((item) => item.value === trangThai)?.label ?? trangThai
}

export function mauTrangThaiThanhToan(trangThai: TrangThaiThanhToan): string {
  return TRANG_THAI_THANH_TOAN.find((item) => item.value === trangThai)?.mau ?? 'default'
}

/* ----------------------------- Hình thức thu tiền ----------------------------- */

export const HINH_THUC_THANH_TOAN: ReadonlyArray<{ value: HinhThucThanhToan; label: string }> = [
  { value: 'tien_mat', label: 'Tiền mặt' },
  { value: 'chuyen_khoan', label: 'Chuyển khoản' },
]

export function nhanHinhThuc(hinhThuc: HinhThucThanhToan): string {
  return HINH_THUC_THANH_TOAN.find((item) => item.value === hinhThuc)?.label ?? hinhThuc
}

/* -------------------------------- Cách tính -------------------------------- */

export function nhanCachTinh(cachTinh: CachTinhHocPhi): string {
  return cachTinh === 'theo_thang' ? 'Theo tháng' : 'Theo buổi'
}

export function mauCachTinh(cachTinh: CachTinhHocPhi): string {
  return cachTinh === 'theo_thang' ? 'purple' : 'blue'
}

/* ------------------------------ Buổi trong kỳ ------------------------------ */

export function nhanTrangThaiBuoi(buoi: BuoiTrongKy): string {
  if (buoi.trangThai === 'di_hoc') return 'Đi học'
  if (buoi.trangThai === 'chua_diem_danh') return 'Chưa điểm danh'
  return buoi.lyDoNghi === 'co_phep' ? 'Nghỉ có phép' : 'Nghỉ không phép'
}

export function mauTrangThaiBuoi(buoi: BuoiTrongKy): string {
  if (buoi.trangThai === 'di_hoc') return 'green'
  if (buoi.trangThai === 'chua_diem_danh') return 'default'
  return buoi.lyDoNghi === 'co_phep' ? 'gold' : 'red'
}

/** Nhãn gọn cho trạng thái điểm danh (dùng khi chỉ có trạng thái, chưa có buổi đầy đủ). */
export function nhanTrangThaiDiemDanh(trangThai: string, lyDoNghi: string | null): string {
  if (trangThai === 'di_hoc') return 'Đi học'
  if (trangThai === 'chua_diem_danh') return 'Chưa điểm danh'
  return lyDoNghi === 'co_phep' ? 'Nghỉ có phép' : 'Nghỉ không phép'
}

/* ---------------------------- Đối chiếu ngân hàng ---------------------------- */

export const MUC_DO_KHOP: ReadonlyArray<{
  value: MucDoKhop
  label: string
  mau: string
  moTa: string
}> = [
  {
    value: 'khop_chac',
    label: 'Khớp chắc',
    mau: 'green',
    moTa: 'Nội dung nhắc tới học sinh và số tiền khớp — tin được, nhưng vẫn do bạn xác nhận.',
  },
  {
    value: 'khop_mot_phan',
    label: 'Khớp một phần',
    mau: 'gold',
    moTa: 'Có dấu hiệu khớp (tên hoặc kỳ, hoặc số tiền) nhưng chưa đủ để chắc chắn.',
  },
  {
    value: 'chi_khop_so_tien',
    label: 'Chỉ khớp số tiền',
    mau: 'orange',
    moTa: 'Chỉ dựa vào số tiền, không có tên trong nội dung — nên mở sổ ra kiểm tra trước.',
  },
  {
    value: 'da_ghep_truoc_do',
    label: 'Đã ghép trước đó',
    mau: 'default',
    moTa: 'Mã giao dịch này đã có phiếu thu trong sổ, ghép lại là ghi trùng tiền.',
  },
  {
    value: 'khong_khop',
    label: 'Không khớp',
    mau: 'red',
    moTa: 'Không tìm thấy dòng học phí còn nợ nào phù hợp.',
  },
]

export function nhanMucDoKhop(mucDo: MucDoKhop): string {
  return MUC_DO_KHOP.find((item) => item.value === mucDo)?.label ?? mucDo
}

export function mauMucDoKhop(mucDo: MucDoKhop): string {
  return MUC_DO_KHOP.find((item) => item.value === mucDo)?.mau ?? 'default'
}

export function moTaMucDoKhop(mucDo: MucDoKhop): string {
  return MUC_DO_KHOP.find((item) => item.value === mucDo)?.moTa ?? ''
}

/** Chỉ những đề xuất đã trỏ tới một dòng học phí mới được phép tích để ghi. */
export function coTheGhi(deXuat: { hocPhiId: string | null; mucDoKhop: MucDoKhop }): boolean {
  return deXuat.hocPhiId !== null && deXuat.mucDoKhop !== 'da_ghep_truoc_do'
}

/* --------------------------------- Ngày tháng --------------------------------- */

/** "Tháng 09/2026" */
export function moTaKy(thang: number, nam: number): string {
  return `Tháng ${String(thang).padStart(2, '0')}/${nam}`
}

/** Nội dung chuyển khoản dùng chuỗi này, khớp phần chèn {thang} của mẫu ở Cài đặt. */
export function tenKyHocPhi(thang: number, nam: number): string {
  return `Học phí ${moTaKy(thang, nam).toLowerCase()}`
}

/**
 * Số ngày còn lại tới hạn đóng tiền: dương là còn, âm là quá hạn.
 * Tính theo NGÀY (không theo giờ) vì hạn đóng tiền là một ngày trên lịch.
 */
export function soNgayToiHan(hanDongTien: string): number {
  return dayjs(hanDongTien).startOf('day').diff(dayjs().startOf('day'), 'day')
}

export function moTaHanDong(hanDongTien: string): string {
  const soNgay = soNgayToiHan(hanDongTien)
  if (soNgay === 0) return 'Đến hạn hôm nay'
  if (soNgay > 0) return `Còn ${soNgay} ngày`
  return `Quá hạn ${Math.abs(soNgay)} ngày`
}

/* --------------------------------- Lỗi API --------------------------------- */

/**
 * Một dòng mô tả lỗi để hiện cho người dùng: lỗi theo từng field trước (backend nói rõ sai ở đâu),
 * rồi mới tới message chung.
 */
export function moTaLoi(error: unknown, macDinh: string): string {
  if (error instanceof ApiError) {
    if (error.fieldMessages.length > 0) return error.fieldMessages.join(' · ')
    return error.message
  }
  return macDinh
}

export interface LoiTheoField {
  field: string
  thongDiep: string
}

export function loiTheoField(error: unknown): LoiTheoField[] {
  const problem = error instanceof ApiError ? error.problem : undefined
  if (!problem?.errors) return []
  return Object.entries(problem.errors).flatMap(([field, danhSach]) =>
    danhSach.map((thongDiep) => ({ field, thongDiep })),
  )
}

/** Backend trả 409 khi chốt sổ mà còn buổi chưa điểm danh (và chưa xác nhận bỏ qua cảnh báo). */
export function laLoiChotSoConCanhBao(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409
}

/* --------------------------------- Tải file --------------------------------- */

/** Tải một Blob thành file trong trình duyệt (dùng cho xuất Excel). */
export function taiTepXuong(tep: TepExcel): void {
  const duongDan = URL.createObjectURL(tep.blob)
  const the = document.createElement('a')
  the.href = duongDan
  the.download = tep.tenTep
  document.body.appendChild(the)
  the.click()
  the.remove()
  // Thu hồi sau khi trình duyệt kịp bắt đầu tải, nếu không file sẽ trắng.
  window.setTimeout(() => {
    URL.revokeObjectURL(duongDan)
  }, 1000)
}
