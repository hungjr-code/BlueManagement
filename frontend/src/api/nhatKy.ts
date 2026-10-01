import { useQuery } from '@tanstack/react-query'
import { http } from './http'
import type { KetQuaPhanTrang } from './types'

/**
 * Tầng gọi API cho nhật ký thay đổi. Hợp đồng khớp
 * `backend/ClassManagement.Api/Controllers/NhatKyController.cs` và `Dtos/NhatKyDtos.cs`.
 *
 * Hai điểm phải nhớ khi đọc file này:
 *
 * 1. `thoiDiemUtc` là UTC thật (có hậu tố Z). Hiển thị phải đổi sang giờ trung tâm — xem
 *    `thoiDiemDiaPhuong`.
 * 2. `duLieuTruoc` / `duLieuSau` là chuỗi JSON, mỗi hành động một bộ trường khác nhau. Không có
 *    kiểu chung cho chúng ở đây vì khuôn chung đó sẽ là bịa.
 *
 * Giáo viên chỉ nhận được nhật ký của chính mình (backend chặn, không phải giao diện ẩn).
 */

export interface DongNhatKy {
  id: string
  /** UTC, dạng ISO có hậu tố Z. */
  thoiDiemUtc: string
  hanhDong: string
  doiTuong: string
  doiTuongId: string | null
  /** Tên người thực hiện; null khi hệ thống tự làm (seed, tự đồng bộ). */
  nguoiThucHien: string | null
  duLieuTruoc: string | null
  duLieuSau: string | null
  diaChiIp: string | null
}

export interface BoLocNhatKy {
  /** Ngày trọn vẹn theo giờ trung tâm, dạng "2026-10-01". */
  tuNgay?: string
  denNgay?: string
  hanhDong?: string
  doiTuong?: string
  nguoiThucHienId?: string
  trang?: number
  kichThuoc?: number
}

export interface DanhMucNhatKy {
  hanhDong: string[]
  doiTuong: string[]
}

export const NHAT_KY_QUERY_KEY = ['nhat-ky'] as const

export async function layNhatKy(boLoc: BoLocNhatKy): Promise<KetQuaPhanTrang<DongNhatKy>> {
  const { data } = await http.get<KetQuaPhanTrang<DongNhatKy>>('/nhat-ky', { params: boLoc })
  return data
}

export async function layDanhMucNhatKy(): Promise<DanhMucNhatKy> {
  const { data } = await http.get<DanhMucNhatKy>('/nhat-ky/danh-muc')
  return data
}

export function useNhatKy(boLoc: BoLocNhatKy) {
  return useQuery({
    queryKey: [...NHAT_KY_QUERY_KEY, boLoc],
    queryFn: () => layNhatKy(boLoc),
  })
}

export function useDanhMucNhatKy() {
  return useQuery({
    queryKey: [...NHAT_KY_QUERY_KEY, 'danh-muc'],
    queryFn: layDanhMucNhatKy,
    // Danh mục đổi rất chậm (chỉ khi có loại hành động mới) — giữ lại để đỡ gọi lại mỗi lần mở.
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * Tên hành động trong database → câu tiếng Việt cho người đọc. Danh sách này là 16 hành động đang
 * thật sự có trong bảng `NhatKy`; hành động mới thêm mà chưa kịp đặt nhãn thì in nguyên mã (không
 * giấu), để lần sau nhìn là biết cần bổ sung nhãn.
 *
 * Sửa ở đây thì nhớ `GET /api/nhat-ky/danh-muc` là nguồn dựng bộ lọc — nó trả về đúng mã trong
 * database, không phải nhãn hiển thị.
 */
const NHAN_HANH_DONG: Record<string, string> = {
  cho_hoc_sinh_nghi: 'Cho học sinh nghỉ',
  chot_so_hoc_phi: 'Chốt sổ học phí',
  doi_chieu_ngan_hang: 'Đối chiếu ngân hàng',
  dong_bo_lich_google: 'Đồng bộ lịch Google',
  huy_phieu_thu: 'Huỷ phiếu thu',
  mo_chot_so_hoc_phi: 'Mở chốt sổ học phí',
  sua_cai_dat: 'Sửa cài đặt chung',
  sua_diem_danh: 'Sửa điểm danh',
  sua_hoc_sinh: 'Sửa học sinh',
  sua_tai_khoan_nhan_tien: 'Sửa tài khoản nhận tiền',
  tao_giao_vien: 'Tạo giáo viên',
  tao_hoc_sinh: 'Tạo học sinh',
  them_buoi_day_bu: 'Thêm buổi dạy bù',
  thu_hoc_phi: 'Thu học phí',
  tinh_hoc_phi_ky: 'Tính học phí kỳ',
  xoa_su_kien_google: 'Xoá sự kiện Google',
}

export function nhanHanhDong(hanhDong: string): string {
  return NHAN_HANH_DONG[hanhDong] ?? hanhDong
}

/** UTC (ISO) → giờ trung tâm của máy đang xem. */
export function thoiDiemDiaPhuong(iso: string | null | undefined): string {
  if (!iso) return '—'
  const coMuiGio = /(Z|[+-]\d{2}:?\d{2})$/.test(iso)
  const thoiDiem = new Date(coMuiGio ? iso : `${iso}Z`)
  if (Number.isNaN(thoiDiem.getTime())) return iso
  const hai = (so: number) => String(so).padStart(2, '0')
  return (
    `${hai(thoiDiem.getDate())}/${hai(thoiDiem.getMonth() + 1)}/${thoiDiem.getFullYear()} ` +
    `${hai(thoiDiem.getHours())}:${hai(thoiDiem.getMinutes())}:${hai(thoiDiem.getSeconds())}`
  )
}
