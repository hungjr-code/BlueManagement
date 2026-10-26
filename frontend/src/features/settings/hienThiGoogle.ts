import { ApiError } from '../../api/http'

/**
 * Nhãn hiển thị và hàm định dạng dùng riêng cho thẻ Google Calendar ở màn hình Cài đặt.
 *
 * Chuỗi quyền bên dưới phải khớp `GoogleCalendarOptions.QuyenCanXin` ở backend
 * (`backend/ClassManagement.Api/Google/GoogleCalendarOptions.cs`).
 *
 * Tóm tắt đồng bộ, hiện thời điểm và đọc lỗi API đã bê lên dùng chung ở `src/lib/` — ở đây
 * re-export để không phải sửa đường dẫn import.
 */
export { tomTatDongBo, tomTatDongBoVe } from '../../lib/dongBo'
export { thoiDiemDiaPhuong } from '../../lib/thoiGian'
export { moTaLoi as noiDungLoi } from '../../lib/loiApi'

/** Quyền Google → câu tiếng Việt nói rõ quyền đó để làm gì. */
const TEN_QUYEN: Record<string, string> = {
  'https://www.googleapis.com/auth/calendar.events':
    'Đọc và ghi sự kiện trong lịch (calendar.events) — để tạo, sửa, gỡ sự kiện của từng buổi học',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly':
    'Xem danh sách lịch của tài khoản (calendar.calendarlist.readonly) — để chọn lịch đích',
  'https://www.googleapis.com/auth/drive.file':
    'Gửi tài liệu lên Drive của chính giáo viên (drive.file) — app CHỈ thấy những tệp do chính nó tạo, để giáo viên giao bài cho học sinh',
}

/** Quyền chưa có mô tả thì hiện nguyên chuỗi, không bịa ý nghĩa. */
export function tenQuyen(quyen: string): string {
  return TEN_QUYEN[quyen] ?? quyen
}

/**
 * Backend báo 409 "Chưa cấu hình Google Calendar" khi thiếu Client ID/Secret (chế độ giả đang tắt).
 * Trường hợp này không phải lỗi của người dùng mà là thiếu cấu hình máy chủ, nên phải hiện hướng dẫn
 * thay vì chỉ báo "thất bại".
 */
export function laLoiChuaCauHinh(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && /chưa cấu hình google calendar/i.test(error.message)
}
