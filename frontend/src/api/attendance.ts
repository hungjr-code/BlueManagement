import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from './http'
import type {
  BoLocBuoiHoc,
  BuoiDayBu,
  BuoiHoc,
  DanhSachBuoiHoc,
  KetQuaLuuDiemDanh,
  LuuDiemDanhItem,
} from './types'

export const BUOI_HOC_QUERY_KEY = ['buoi-hoc'] as const

export async function layBuoiHoc(boLoc: BoLocBuoiHoc): Promise<DanhSachBuoiHoc> {
  const { data } = await http.get<DanhSachBuoiHoc>('/attendance', { params: boLoc })
  return data
}

/** Lưu điểm danh theo lô: bấm Lưu một lần cho cả tuần thay vì mỗi buổi một request. */
export async function luuDiemDanh(duLieu: LuuDiemDanhItem[]): Promise<KetQuaLuuDiemDanh> {
  const { data } = await http.post<KetQuaLuuDiemDanh>('/attendance/luu-hang-loat', { duLieu })
  return data
}

/** Thêm buổi dạy bù ngoài lịch lặp hằng tuần. */
export async function themBuoiDayBu(duLieu: BuoiDayBu): Promise<BuoiHoc> {
  const { data } = await http.post<BuoiHoc>('/attendance/buoi-day-bu', duLieu)
  return data
}

export function useBuoiHoc(boLoc: BoLocBuoiHoc) {
  return useQuery({
    queryKey: [...BUOI_HOC_QUERY_KEY, boLoc],
    queryFn: () => layBuoiHoc(boLoc),
  })
}

export function useLuuDiemDanh() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: luuDiemDanh,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BUOI_HOC_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useThemBuoiDayBu() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: themBuoiDayBu,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BUOI_HOC_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
