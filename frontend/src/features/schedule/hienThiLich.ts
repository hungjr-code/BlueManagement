/**
 * Cách hiển thị riêng của màn hình Lịch dạy.
 *
 * Nhãn trạng thái điểm danh, cách hiện thời điểm, tóm tắt đồng bộ và cách đọc lỗi API đều đã bê lên
 * dùng CHUNG ở `src/lib/` — ở đây chỉ re-export để các màn hình khác khỏi phải sửa đường dẫn import.
 */
export { nhanCuaBuoi as nhanTrangThaiBuoi } from '../../lib/diemDanh'
export { thoiDiemDiaPhuong } from '../../lib/thoiGian'
export { moTaLoi as noiDungLoi } from '../../lib/loiApi'
export { tomTatDongBo } from '../../lib/dongBo'
