import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from './http'
import type {
  DuongDanUyQuyen,
  KetQuaDongBo,
  KetQuaDongBoVe,
  LichGoogle,
  TrangThaiGoogle,
} from './types'

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

/** Đẩy lịch dạy lên Google. Bỏ trống khoảng ngày thì backend lấy từ hôm nay tới hết tháng sau. */
export async function dongBoGoogle(thamSo?: { tuNgay?: string; denNgay?: string }): Promise<KetQuaDongBo> {
  const { data } = await http.post<KetQuaDongBo>('/google-calendar/dong-bo', thamSo ?? {})
  return data
}

/**
 * KÉO thay đổi từ Google về app (chiều ngược lại): giáo viên đổi giờ hay huỷ buổi ngay trên Google
 * thì lần kéo này đưa thay đổi đó vào app.
 *
 * `chiKhiQuaHan = true` dùng cho việc TỰ đồng bộ khi mở màn Lịch dạy: máy chủ tự bỏ qua nếu lần
 * trước chưa quá 10 phút, nên mở đi mở lại vài lần không gọi Google liên tục. Nút "Đồng bộ lại"
 * truyền false để chạy ngay.
 */
export async function dongBoVeGoogle(thamSo?: {
  tuNgay?: string
  denNgay?: string
  chiKhiQuaHan?: boolean
}): Promise<KetQuaDongBoVe> {
  const { data } = await http.post<KetQuaDongBoVe>('/google-calendar/dong-bo-ve', thamSo ?? {})
  return data
}

/** Bật/tắt tự kéo thay đổi từ Google về khi mở màn Lịch dạy — của chính người đang đăng nhập. */
export async function datTuDongDongBo(bat: boolean): Promise<void> {
  await http.put('/google-calendar/tu-dong-dong-bo', { bat })
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

export function useDongBoVeGoogle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: dongBoVeGoogle,
    onSuccess: (ketQua) => {
      // Bỏ qua (chưa quá 10 phút) thì không có gì đổi, khỏi tải lại lịch cho nặng.
      if (ketQua.boQua) return

      void queryClient.invalidateQueries({ queryKey: GOOGLE_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['buoi-hoc'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDatTuDongDongBo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: datTuDongDongBo,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GOOGLE_QUERY_KEY })
    },
  })
}
