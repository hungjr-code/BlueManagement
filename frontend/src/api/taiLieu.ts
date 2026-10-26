import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { env } from '../config/env'
import { http } from './http'

/**
 * Tài liệu giáo viên giao cho học sinh.
 *
 * Tệp nằm trên Google Drive CỦA GIÁO VIÊN nhưng KHÔNG mở công khai: học sinh tải qua app, app đọc hộ
 * tệp bằng token của giáo viên. Vì vậy ở đây chỉ có đường dẫn `tai-ve` của app, không có link Drive
 * cho học sinh.
 */
export const TAI_LIEU_QUERY_KEY = ['tai-lieu'] as const

export interface TaiLieu {
  id: string
  hocSinhId: string
  tenHocSinh: string
  buoiHocId: string | null
  ngayBuoi: string | null
  gioBuoi: string | null
  tieuDe: string
  tenTep: string
  mimeType: string | null
  kichThuocByte: number
  hanNop: string | null
  ghiChu: string | null
  /** Link xem trên Drive — chỉ để giáo viên mở nhanh, không dùng cho học sinh. */
  linkDrive: string | null
  ngayTaoUtc: string
}

export interface GuiTaiLieu {
  tep: File
  hocSinhId: string
  buoiHocId?: string | null
  tieuDe?: string | null
  hanNop?: string | null
  ghiChu?: string | null
}

export async function layDanhSachTaiLieu(thamSo?: {
  hocSinhId?: string
  buoiHocId?: string
}): Promise<TaiLieu[]> {
  const { data } = await http.get<TaiLieu[]>('/tai-lieu/danh-sach', { params: thamSo ?? {} })
  return data
}

/** Gửi tệp lên Drive của giáo viên rồi giao cho học sinh. Dùng multipart/form-data. */
export async function guiTaiLieu(duLieu: GuiTaiLieu): Promise<TaiLieu> {
  const biêuMau = new FormData()
  biêuMau.append('tep', duLieu.tep)
  biêuMau.append('hocSinhId', duLieu.hocSinhId)
  if (duLieu.buoiHocId) biêuMau.append('buoiHocId', duLieu.buoiHocId)
  if (duLieu.tieuDe) biêuMau.append('tieuDe', duLieu.tieuDe)
  if (duLieu.hanNop) biêuMau.append('hanNop', duLieu.hanNop)
  if (duLieu.ghiChu) biêuMau.append('ghiChu', duLieu.ghiChu)

  const { data } = await http.post<TaiLieu>('/tai-lieu', biêuMau, {
    // Để axios tự đặt boundary của multipart; đặt tay sẽ làm hỏng thân request.
    headers: { 'Content-Type': undefined },
    timeout: 120_000,
  })
  return data
}

export async function thuHoiTaiLieu(id: string): Promise<void> {
  await http.delete(`/tai-lieu/${id}`)
}

/**
 * Đường dẫn tải tệp cho giáo viên. Dùng kèm access token đang giữ trong RAM, KHÔNG dùng thẻ <a href>
 * trực tiếp vì trình duyệt sẽ không gửi kèm header Authorization.
 */
export function duongDanTaiVe(id: string): string {
  return `${env.apiBaseUrl}/tai-lieu/${id}/tai-ve`
}

/**
 * `bat = false` để tạm không gọi API — ví dụ màn Lịch dạy chỉ hỏi tài liệu khi đã chọn một buổi, mà
 * hook thì không được gọi có điều kiện.
 */
export function useDanhSachTaiLieu(
  thamSo?: { hocSinhId?: string; buoiHocId?: string },
  bat = true,
) {
  return useQuery({
    queryKey: [...TAI_LIEU_QUERY_KEY, thamSo?.hocSinhId ?? 'tat-ca', thamSo?.buoiHocId ?? 'tat-ca'],
    queryFn: () => layDanhSachTaiLieu(thamSo),
    enabled: bat,
  })
}

export function useGuiTaiLieu() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: guiTaiLieu,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TAI_LIEU_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['buoi-hoc'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useThuHoiTaiLieu() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: thuHoiTaiLieu,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TAI_LIEU_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['buoi-hoc'] })
    },
  })
}
