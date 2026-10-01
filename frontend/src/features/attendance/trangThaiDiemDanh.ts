import dayjs from 'dayjs'
import type { BuoiHoc, LyDoNghi, LuuDiemDanhItem, TrangThaiDiemDanh } from '../../api/types'

/**
 * Nhãn tiếng Việt của điểm danh và các phép so sánh dùng chung cho màn hình Điểm danh.
 *
 * Chuỗi giá trị (`di_hoc`, `nghi`, `co_phep`…) phải khớp enum ở backend
 * (`backend/ClassManagement.Api/Entities/Enums.cs`); file này chỉ giữ NHÃN hiển thị, không tự
 * sinh giá trị mới.
 */

export const NHAN_TRANG_THAI: Record<TrangThaiDiemDanh, string> = {
  chua_diem_danh: 'Chưa điểm danh',
  di_hoc: 'Đi học',
  nghi: 'Nghỉ',
}

export const NHAN_LY_DO_NGHI: Record<LyDoNghi, string> = {
  co_phep: 'Nghỉ có phép',
  khong_phep: 'Nghỉ không phép',
}

/** Giá trị đang nhập của một buổi: trạng thái, lý do nghỉ và ghi chú. */
export interface BanNhapDiemDanh {
  trangThai: TrangThaiDiemDanh
  lyDoNghi: LyDoNghi | null
  ghiChu: string
}

/**
 * Giá trị hiện tại của một buổi: bản người dùng đang sửa nếu có, chưa sửa thì lấy đúng dữ liệu
 * backend trả về. Nhờ vậy không phải đồng bộ state mỗi lần dữ liệu được tải lại.
 */
export function banNhapCua(buoi: BuoiHoc, dangSua: Record<string, BanNhapDiemDanh>): BanNhapDiemDanh {
  const daSua = dangSua[buoi.id]
  if (daSua) return daSua

  return {
    trangThai: buoi.trangThai,
    lyDoNghi: buoi.lyDoNghi,
    ghiChu: buoi.ghiChu ?? '',
  }
}

/**
 * Buổi này đã bị sửa so với dữ liệu backend chưa.
 *
 * Chỉ những buổi thật sự đổi mới được gửi lên: gửi thừa một dòng không đổi là backend ghi thêm
 * một dòng nhật ký `sua_diem_danh` vô nghĩa, làm nhật ký đầy mà không nói lên điều gì.
 */
export function laThayDoi(buoi: BuoiHoc, nhap: BanNhapDiemDanh): boolean {
  if (nhap.trangThai !== buoi.trangThai) return true

  // Lý do nghỉ chỉ có nghĩa khi buổi đó là nghỉ; backend cũng xoá nó khi đổi sang đi học.
  if (nhap.trangThai === 'nghi' && nhap.lyDoNghi !== buoi.lyDoNghi) return true

  return nhap.ghiChu.trim() !== (buoi.ghiChu ?? '')
}

/** Đóng gói một dòng cho POST /api/attendance/luu-hang-loat. */
export function thanhItemLuu(buoiHocId: string, nhap: BanNhapDiemDanh): LuuDiemDanhItem {
  const ghiChu = nhap.ghiChu.trim()

  return {
    buoiHocId,
    trangThai: nhap.trangThai,
    // Không tự bịa lý do nghỉ: người dùng chọn gì thì gửi đúng cái đó.
    lyDoNghi: nhap.trangThai === 'nghi' ? nhap.lyDoNghi : null,
    ghiChu: ghiChu === '' ? null : ghiChu,
  }
}

/**
 * `thoiDiemDiemDanhUtc` là giờ UTC; hiển thị theo giờ máy người dùng.
 *
 * Giá trị đọc từ SQL Server có thể mất hậu tố "Z" (DateTimeKind.Unspecified), lúc đó phải tự
 * gắn lại mới không bị hiển thị lệch 7 tiếng.
 */
export function thoiDiemDiaPhuong(iso: string | null | undefined): string {
  if (!iso) return '—'

  const coMuiGio = /(Z|[+-]\d{2}:?\d{2})$/.test(iso)
  return dayjs(coMuiGio ? iso : `${iso}Z`).format('HH:mm DD/MM/YYYY')
}
