import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from './http'
import type { GiaoVien, KetQuaPhanTrang, SuaGiaoVien, TaoGiaoVien, VaiTro } from './types'

export const GIAO_VIEN_QUERY_KEY = ['giao-vien'] as const

export interface BoLocGiaoVien {
  tuKhoa?: string
  vaiTro?: VaiTro
  trang?: number
  kichThuoc?: number
}

export async function layDanhSachGiaoVien(boLoc: BoLocGiaoVien): Promise<KetQuaPhanTrang<GiaoVien>> {
  const { data } = await http.get<KetQuaPhanTrang<GiaoVien>>('/teachers', { params: boLoc })
  return data
}

/**
 * Admin tạo tài khoản giáo viên. `matKhauTamThoi` là mật khẩu do admin đặt hộ — Phase 2 chưa có
 * kênh gửi email mời nên đành đặt hộ, giáo viên nên đổi lại sau lần đăng nhập đầu.
 */
export async function taoGiaoVien(duLieu: TaoGiaoVien): Promise<GiaoVien> {
  const { data } = await http.post<GiaoVien>('/teachers', duLieu)
  return data
}

export async function suaGiaoVien(id: string, duLieu: SuaGiaoVien): Promise<GiaoVien> {
  const { data } = await http.put<GiaoVien>(`/teachers/${id}`, duLieu)
  return data
}

export async function datLaiMatKhau(id: string, matKhauMoi: string): Promise<void> {
  await http.post(`/teachers/${id}/dat-lai-mat-khau`, { matKhauMoi })
}

export function useDanhSachGiaoVien(boLoc: BoLocGiaoVien) {
  return useQuery({
    queryKey: [...GIAO_VIEN_QUERY_KEY, boLoc],
    queryFn: () => layDanhSachGiaoVien(boLoc),
  })
}

export function useTaoGiaoVien() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: taoGiaoVien,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GIAO_VIEN_QUERY_KEY })
    },
  })
}

export function useSuaGiaoVien() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, duLieu }: { id: string; duLieu: SuaGiaoVien }) => suaGiaoVien(id, duLieu),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GIAO_VIEN_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['hoc-sinh'] })
    },
  })
}

export function useDatLaiMatKhau() {
  return useMutation({
    mutationFn: ({ id, matKhauMoi }: { id: string; matKhauMoi: string }) => datLaiMatKhau(id, matKhauMoi),
  })
}
