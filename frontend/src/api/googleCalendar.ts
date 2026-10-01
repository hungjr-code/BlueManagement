import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from './http'
import type { DuongDanUyQuyen, KetQuaDongBo, LichGoogle, TrangThaiGoogle } from './types'

/**
 * Kết nối Google Calendar và đồng bộ lịch dạy.
 *
 * Tài khoản Google là của cả trung tâm nên chỉ admin kết nối/ngắt/chọn lịch; giáo viên vẫn đọc được
 * trạng thái để biết lịch dạy của mình đã lên Google chưa.
 */
export const GOOGLE_QUERY_KEY = ['google-calendar'] as const

export async function layTrangThaiGoogle(): Promise<TrangThaiGoogle> {
  const { data } = await http.get<TrangThaiGoogle>('/google-calendar/trang-thai')
  return data
}

/**
 * Lấy đường dẫn cấp quyền để mở ở tab mới. Backend KHÔNG tự chuyển hướng người dùng, vì việc mở
 * tab do giao diện quyết định — và ở chế độ giả thì đường dẫn này trỏ về chính backend.
 */
export async function layDuongDanUyQuyen(): Promise<DuongDanUyQuyen> {
  const { data } = await http.get<DuongDanUyQuyen>('/google-calendar/duong-dan-uy-quyen')
  return data
}

/** Ngắt kết nối. `xoaSuKienDaTao` = có xoá luôn các sự kiện đã tạo trên Google hay không. */
export async function ngatKetNoiGoogle(xoaSuKienDaTao: boolean): Promise<KetQuaDongBo | null> {
  const { data } = await http.post<KetQuaDongBo | null>('/google-calendar/ngat-ket-noi', {
    xoaSuKienDaTao,
  })
  return data
}

export async function layDanhSachLichGoogle(): Promise<LichGoogle[]> {
  const { data } = await http.get<LichGoogle[]>('/google-calendar/danh-sach-lich')
  return data
}

export async function chonLichGoogle(calendarId: string): Promise<void> {
  await http.put('/google-calendar/chon-lich', { calendarId })
}

/** Đồng bộ ngay. Bỏ trống khoảng ngày thì backend đồng bộ từ hôm nay tới hết tháng sau. */
export async function dongBoGoogle(thamSo?: { tuNgay?: string; denNgay?: string }): Promise<KetQuaDongBo> {
  const { data } = await http.post<KetQuaDongBo>('/google-calendar/dong-bo', thamSo ?? {})
  return data
}

export function useTrangThaiGoogle() {
  return useQuery({
    queryKey: GOOGLE_QUERY_KEY,
    queryFn: layTrangThaiGoogle,
    staleTime: 30_000,
  })
}

export function useLayDuongDanUyQuyen() {
  return useMutation({ mutationFn: layDuongDanUyQuyen })
}

export function useDanhSachLichGoogle(dangKetNoi: boolean) {
  return useQuery({
    queryKey: [...GOOGLE_QUERY_KEY, 'danh-sach-lich'],
    queryFn: layDanhSachLichGoogle,
    enabled: dangKetNoi,
  })
}

export function useNgatKetNoiGoogle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ngatKetNoiGoogle,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GOOGLE_QUERY_KEY })
    },
  })
}

export function useChonLichGoogle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: chonLichGoogle,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GOOGLE_QUERY_KEY })
    },
  })
}

export function useDongBoGoogle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: dongBoGoogle,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GOOGLE_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['buoi-hoc'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
