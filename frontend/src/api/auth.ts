import { http } from './http'
import type { KetQuaDangNhap, NguoiDung, TaiKhoanNhanTien } from './types'

/**
 * Đăng nhập và quản lý phiên.
 *
 * Access token trả về trong body và chỉ được giữ trong RAM (xem tokenStore ở http.ts).
 * Refresh token nằm trong cookie httpOnly do backend đặt — JavaScript không đọc được,
 * trình duyệt tự gửi kèm nhờ `withCredentials`. Vì vậy F5 là mất access token, và việc
 * khôi phục phiên dựa vào POST /api/auth/refresh chứ không dựa vào localStorage.
 */

export async function dangNhap(email: string, matKhau: string): Promise<KetQuaDangNhap> {
  const { data } = await http.post<KetQuaDangNhap>('/auth/login', { email, matKhau })
  return data
}

export interface DuongDanDangNhapGoogle {
  url: string
  quyen: string[]
  cheDoGia: boolean
}

/**
 * Đường dẫn để mở tab đăng nhập bằng Google. Xin MỘT lần cả quyền định danh lẫn quyền lịch, nên
 * đăng nhập xong là giáo viên đã có sẵn đường đồng bộ lịch dạy của chính mình.
 *
 * Đường dẫn trả về có thể là địa chỉ của Google, hoặc (chỉ khi chạy máy dev ở chế độ giả) một đường
 * dẫn nội bộ của backend đóng vai màn hình đồng ý.
 */
export async function layDuongDanDangNhapGoogle(): Promise<DuongDanDangNhapGoogle> {
  const { data } = await http.get<DuongDanDangNhapGoogle>('/auth/google/duong-dan')
  return data
}

export interface TuyChonDangNhap {
  /** Máy chủ đã có Client ID/Secret của Google chưa (chưa tính chế độ giả). */
  googleDaCauHinh: boolean
  /** Đang chạy khách Google GIẢ: bấm nút Google sẽ KHÔNG mở trang của Google. */
  googleCheDoGia: boolean
  /** Máy chủ đã cấu hình gửi email chưa (chưa tính chế độ giả). */
  emailDaCauHinh: boolean
  /** Đang chạy hộp thư GIẢ: thư không đi đâu cả. */
  emailCheDoGia: boolean
}

/**
 * Máy chủ đang có những đường đăng nhập THẬT nào. Màn hình đăng nhập gọi hàm này để không hiện nút
 * dẫn tới ngõ cụt, và để nói rõ khi đang ở chế độ giả của máy dev.
 */
export async function layTuyChonDangNhap(): Promise<TuyChonDangNhap> {
  const { data } = await http.get<TuyChonDangNhap>('/auth/tuy-chon-dang-nhap')
  return data
}

/**
 * Tự tạo tài khoản bằng email và mật khẩu. Backend tạo tài khoản với vai trò giáo viên và đăng nhập
 * luôn, nên hàm này trả về y như đăng nhập.
 */
export async function dangKy(hoTen: string, email: string, matKhau: string): Promise<KetQuaDangNhap> {
  const { data } = await http.post<KetQuaDangNhap>('/auth/dang-ky', { hoTen, email, matKhau })
  return data
}

/**
 * Xin thư đặt lại mật khẩu. Backend luôn trả về cùng một kết quả dù email có tài khoản hay không,
 * nên giao diện cũng phải nói như nhau — đừng hứa là "đã gửi tới email này".
 */
export async function quenMatKhau(email: string): Promise<void> {
  await http.post('/auth/quen-mat-khau', { email })
}

/** Đặt mật khẩu mới bằng mã trong thư. Dùng được một lần, hạn 30 phút. */
export async function datLaiMatKhau(token: string, matKhauMoi: string): Promise<void> {
  await http.post('/auth/dat-lai-mat-khau', { token, matKhauMoi })
}

export async function dangXuat(): Promise<void> {
  await http.post('/auth/logout')
}

export async function layNguoiDungHienTai(): Promise<NguoiDung> {
  const { data } = await http.get<NguoiDung>('/auth/me')
  return data
}

export async function doiMatKhau(matKhauHienTai: string, matKhauMoi: string): Promise<void> {
  await http.post('/auth/doi-mat-khau', { matKhauHienTai, matKhauMoi })
}

/**
 * Khai tài khoản nhận tiền của chính mình. Không có endpoint sửa hộ người khác — kể cả admin —
 * vì tiền học phí chảy về tài khoản của người dạy.
 * Gửi cả ba ô rỗng nghĩa là gỡ tài khoản đã khai.
 */
export async function capNhatTaiKhoanNhanTien(duLieu: {
  nganHangBin?: string | null
  soTaiKhoan?: string | null
  chuTaiKhoan?: string | null
}): Promise<TaiKhoanNhanTien> {
  const { data } = await http.put<TaiKhoanNhanTien>('/teachers/me/tai-khoan-nhan-tien', duLieu)
  return data
}
