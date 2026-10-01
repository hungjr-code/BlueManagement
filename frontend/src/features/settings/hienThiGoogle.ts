import dayjs from 'dayjs'
import { ApiError } from '../../api/http'
import type { KetQuaDongBo } from '../../api/types'

/**
 * Nhãn hiển thị và hàm định dạng dùng riêng cho thẻ Google Calendar ở màn hình Cài đặt.
 *
 * Mỗi feature giữ bản sao nhỏ của mình thay vì import chéo sang feature khác; chuỗi quyền bên dưới
 * phải khớp `GoogleCalendarOptions.QuyenCanXin` ở backend
 * (`backend/ClassManagement.Api/Google/GoogleCalendarOptions.cs`).
 */

/** Quyền Google → câu tiếng Việt nói rõ quyền đó để làm gì. */
const TEN_QUYEN: Record<string, string> = {
  'https://www.googleapis.com/auth/calendar.events':
    'Đọc và ghi sự kiện trong lịch (calendar.events) — để tạo, sửa, gỡ sự kiện của từng buổi học',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly':
    'Xem danh sách lịch của tài khoản (calendar.calendarlist.readonly) — để chọn lịch đích',
}

/** Quyền chưa có mô tả thì hiện nguyên chuỗi, không bịa ý nghĩa. */
export function tenQuyen(quyen: string): string {
  return TEN_QUYEN[quyen] ?? quyen
}

/** Tóm tắt một lần đồng bộ: tạo mấy, cập nhật mấy, xoá mấy, bỏ qua mấy buổi. */
export function tomTatDongBo(ketQua: KetQuaDongBo): string {
  return `Tạo ${ketQua.soTao}, cập nhật ${ketQua.soCapNhat}, xoá ${ketQua.soXoa}, bỏ qua ${ketQua.soBoQua} buổi`
}

/**
 * `thoiDiemUtc` là giờ UTC; hiển thị theo giờ máy người dùng.
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

/**
 * Backend báo 409 "Chưa cấu hình Google Calendar" khi thiếu Client ID/Secret (chế độ giả đang tắt).
 * Trường hợp này không phải lỗi của người dùng mà là thiếu cấu hình máy chủ, nên phải hiện hướng dẫn
 * thay vì chỉ báo "thất bại".
 */
export function laLoiChuaCauHinh(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && /chưa cấu hình google calendar/i.test(error.message)
}
