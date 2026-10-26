import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useMutation, useQuery } from '@tanstack/react-query'
import { env } from '../config/env'
import { toApiError } from './http'

/**
 * Cổng thông tin của HỌC SINH: đăng nhập bằng mã học sinh, xem lịch học + điểm danh + bài tập của
 * chính mình.
 *
 * Dùng axios RIÊNG với client của giáo viên, vì ba thứ khác hẳn nhau:
 *  - cookie phiên là `cm_phien_hs` (chỉ gửi tới /api/hoc-sinh/auth), không phải `cm_phien`;
 *  - endpoint làm mới phiên là của học sinh;
 *  - access token nằm trong ô nhớ riêng, nên mở app giáo viên và app học sinh cùng lúc trên một
 *    trình duyệt cũng không đè lên nhau.
 */

export interface HocSinhToi {
  id: string
  hoTen: string
  maHocSinh: string | null
  lop: string | null
  giaoVienId: string
  tenGiaoVien: string
}

export interface KetQuaDangNhapHocSinh {
  accessToken: string
  hetHanUtc: string
  hocSinh: HocSinhToi
}

export interface BaiTapCuaHocSinh {
  id: string
  tieuDe: string
  tenTep: string
  mimeType: string | null
  kichThuocByte: number
  hanNop: string | null
  ghiChu: string | null
  tenGiaoVien: string
  buoiHocId: string | null
  ngayBuoi: string | null
  gioBuoi: string | null
  quaHan: boolean
  ngayTaoUtc: string
}

export interface BuoiHocCuaHocSinh {
  id: string
  ngay: string
  gioBatDau: string
  gioKetThuc: string
  laBuoiDayBu: boolean
  trangThai: 'chua_diem_danh' | 'di_hoc' | 'nghi'
  lyDoNghi: 'co_phep' | 'khong_phep' | null
  ghiChuDiemDanh: string | null
  lop: string | null
  tenGiaoVien: string
  soTaiLieu: number
  daQua: boolean
}

/* ------------------------------------------------------------------ *
 * Access token (chỉ trong RAM, giống phía giáo viên)
 * ------------------------------------------------------------------ */

let accessToken: string | null = null
const tokenListeners = new Set<(token: string | null) => void>()

function datToken(token: string | null): void {
  accessToken = token
  tokenListeners.forEach((listener) => listener(token))
}

export const tokenHocSinh = {
  get(): string | null {
    return accessToken
  },
  set(token: string | null): void {
    datToken(token)
  },
  clear(): void {
    datToken(null)
  },
  subscribe(listener: (token: string | null) => void): () => void {
    tokenListeners.add(listener)
    return () => {
      tokenListeners.delete(listener)
    }
  },
}

export const httpHocSinh = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

httpHocSinh.interceptors.request.use((cauHinh) => {
  const token = tokenHocSinh.get()
  if (token) cauHinh.headers.set('Authorization', `Bearer ${token}`)
  return cauHinh
})

let dangLamMoi: Promise<KetQuaDangNhapHocSinh | null> | null = null

/** Làm mới phiên học sinh đúng MỘT lần dù nhiều nơi cùng hỏi (StrictMode gọi effect hai lần). */
export function lamMoiPhienHocSinhMotLan(): Promise<KetQuaDangNhapHocSinh | null> {
  if (!dangLamMoi) {
    dangLamMoi = axios
      .post<KetQuaDangNhapHocSinh>(`${env.apiBaseUrl}/hoc-sinh/auth/refresh`, null, {
        withCredentials: true,
        timeout: 30_000,
      })
      .then((phanHoi) => {
        tokenHocSinh.set(phanHoi.data.accessToken)
        return phanHoi.data
      })
      .catch(() => {
        tokenHocSinh.clear()
        return null
      })
      .finally(() => {
        dangLamMoi = null
      })
  }

  return dangLamMoi
}

type CauHinhCoCoLamMoi = InternalAxiosRequestConfig & { daThuLamMoi?: boolean }

httpHocSinh.interceptors.response.use(
  (phanHoi) => phanHoi,
  async (loi: unknown) => {
    const loiApi = toApiError(loi)
    const cauHinh = (loi as AxiosError).config as CauHinhCoCoLamMoi | undefined

    if (loiApi.status === 401) {
      const laGoiAuth = cauHinh?.url?.startsWith('/hoc-sinh/auth/') ?? false

      if (cauHinh && !cauHinh.daThuLamMoi && !laGoiAuth && tokenHocSinh.get()) {
        cauHinh.daThuLamMoi = true
        const ketQua = await lamMoiPhienHocSinhMotLan()
        if (ketQua) {
          cauHinh.headers.set('Authorization', `Bearer ${ketQua.accessToken}`)
          return await httpHocSinh.request(cauHinh)
        }
      }

      tokenHocSinh.clear()
    }

    return await Promise.reject(loiApi)
  },
)

/* ------------------------------------------------------------------ *
 * Gọi API
 * ------------------------------------------------------------------ */

export async function dangNhapHocSinh(maHocSinh: string, matKhau: string): Promise<KetQuaDangNhapHocSinh> {
  const { data } = await httpHocSinh.post<KetQuaDangNhapHocSinh>('/hoc-sinh/auth/login', { maHocSinh, matKhau })
  return data
}

export async function dangXuatHocSinh(): Promise<void> {
  await httpHocSinh.post('/hoc-sinh/auth/logout')
}

export async function doiMatKhauHocSinh(matKhauHienTai: string, matKhauMoi: string): Promise<void> {
  await httpHocSinh.post('/hoc-sinh/auth/doi-mat-khau', { matKhauHienTai, matKhauMoi })
}

export async function layHocSinhHienTai(): Promise<HocSinhToi> {
  const { data } = await httpHocSinh.get<HocSinhToi>('/hoc-sinh/toi')
  return data
}

export async function layBaiTap(): Promise<BaiTapCuaHocSinh[]> {
  const { data } = await httpHocSinh.get<BaiTapCuaHocSinh[]>('/hoc-sinh/bai-tap')
  return data
}

export async function layLichHocCuaHocSinh(tuNgay: string, denNgay: string): Promise<BuoiHocCuaHocSinh[]> {
  const { data } = await httpHocSinh.get<BuoiHocCuaHocSinh[]>('/hoc-sinh/lich-hoc', {
    params: { tuNgay, denNgay },
  })
  return data
}

export function duongDanTaiBaiTap(id: string): string {
  return `/hoc-sinh/bai-tap/${id}/tai-ve`
}

export const BAI_TAP_QUERY_KEY = ['hoc-sinh', 'bai-tap'] as const

export function useBaiTap() {
  return useQuery({ queryKey: BAI_TAP_QUERY_KEY, queryFn: layBaiTap })
}

export function useLichHocCuaHocSinh(tuNgay: string, denNgay: string) {
  return useQuery({
    queryKey: ['hoc-sinh', 'lich-hoc', tuNgay, denNgay],
    queryFn: () => layLichHocCuaHocSinh(tuNgay, denNgay),
  })
}

export function useDoiMatKhauHocSinh() {
  return useMutation({ mutationFn: (duLieu: { matKhauHienTai: string; matKhauMoi: string }) =>
    doiMatKhauHocSinh(duLieu.matKhauHienTai, duLieu.matKhauMoi) })
}
