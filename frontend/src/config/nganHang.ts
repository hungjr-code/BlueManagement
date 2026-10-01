import type { TaiKhoanNhanTien } from '../api/types'

/**
 * Danh sách ngân hàng phổ biến kèm mã BIN (NAPAS 247) để người dùng chọn thay vì gõ mã số.
 * Đây là cấu hình tĩnh của giao diện; còn tài khoản nhận tiền là của từng giáo viên, khai ở
 * Cài đặt và lưu ở backend (/api/teachers/me/tai-khoan-nhan-tien).
 */
export const NGAN_HANG_PHO_BIEN: ReadonlyArray<{ bin: string; ten: string }> = [
  { bin: '970436', ten: 'Vietcombank' },
  { bin: '970415', ten: 'VietinBank' },
  { bin: '970418', ten: 'BIDV' },
  { bin: '970405', ten: 'Agribank' },
  { bin: '970407', ten: 'Techcombank' },
  { bin: '970422', ten: 'MB Bank' },
  { bin: '970416', ten: 'ACB' },
  { bin: '970432', ten: 'VPBank' },
  { bin: '970423', ten: 'TPBank' },
  { bin: '970403', ten: 'Sacombank' },
  { bin: '970441', ten: 'VIB' },
  { bin: '970443', ten: 'SHB' },
  { bin: '970437', ten: 'HDBank' },
  { bin: '970428', ten: 'Nam A Bank' },
  { bin: '970454', ten: 'VietCapitalBank' },
  { bin: '970452', ten: 'KienLongBank' },
]

export function tenNganHang(bin: string | null | undefined): string {
  if (!bin) return '—'
  return NGAN_HANG_PHO_BIEN.find((bank) => bank.bin === bin)?.ten ?? `BIN ${bin}`
}

export function daCauHinhTaiKhoan(taiKhoan: TaiKhoanNhanTien | undefined | null): boolean {
  return Boolean(taiKhoan?.nganHangBin?.trim()) && Boolean(taiKhoan?.soTaiKhoan?.trim())
}

/**
 * Đổ tên học sinh và kỳ học phí vào mẫu nội dung chuyển khoản khai ở Cài đặt.
 * Không có mẫu (hoặc mẫu không có chỗ chèn) thì dùng dạng mặc định "Tên học sinh - Kỳ học phí".
 */
export function dungMauNoiDung(mauChu: string | null | undefined, tenHocSinh: string, kyHocPhi: string): string {
  const mau = mauChu?.trim()
  if (!mau || !mau.includes('{')) return `${tenHocSinh} - ${kyHocPhi}`.trim()

  return mau
    .replaceAll('{tenHocSinh}', tenHocSinh)
    .replaceAll('{thang}', kyHocPhi)
    .replaceAll('{kyHocPhi}', kyHocPhi)
    .trim()
}

/**
 * Ảnh mã QR theo chuẩn VietQR, dựng từ tài khoản nhận tiền của giáo viên dạy học sinh đó.
 *
 * Dùng ảnh do vietqr.io sinh thay vì tự dựng chuỗi EMVCo: định dạng đó có CRC và
 * nhiều trường bắt buộc, tự viết mà không quét thử được thì rủi ro sai mã.
 * Phase 4 nếu cần chạy offline mới cân nhắc sinh mã tại chỗ.
 */
export function buildVietQrUrl(
  taiKhoan: TaiKhoanNhanTien | undefined | null,
  soTien: number,
  noiDung: string,
): string | null {
  if (!daCauHinhTaiKhoan(taiKhoan) || !taiKhoan) return null

  const params = new URLSearchParams()
  if (soTien > 0) params.set('amount', String(Math.round(soTien)))
  if (noiDung.trim() !== '') params.set('addInfo', noiDung.trim())
  if (taiKhoan.chuTaiKhoan?.trim()) params.set('accountName', taiKhoan.chuTaiKhoan.trim())

  const query = params.toString()
  return `https://img.vietqr.io/image/${taiKhoan.nganHangBin}-${taiKhoan.soTaiKhoan}-compact2.png${
    query ? `?${query}` : ''
  }`
}
