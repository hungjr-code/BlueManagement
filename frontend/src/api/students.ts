import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from './http'
import type {
  BoLocHocSinh,
  HocSinh,
  KetQuaPhanTrang,
  SuaHocSinh,
  TaoHocSinh,
} from './types'

export const HOC_SINH_QUERY_KEY = ['hoc-sinh'] as const

export async function layDanhSachHocSinh(boLoc: BoLocHocSinh): Promise<KetQuaPhanTrang<HocSinh>> {
  const { data } = await http.get<KetQuaPhanTrang<HocSinh>>('/students', { params: boLoc })
  return data
}

export async function layHocSinh(id: string): Promise<HocSinh> {
  const { data } = await http.get<HocSinh>(`/students/${id}`)
  return data
}

/**
 * Thêm học sinh. Nếu trùng tên với học sinh đã có của cùng giáo viên, backend trả 409 — người dùng
 * xác nhận rồi gọi lại với `boQuaCanhBaoTrungTen: true`.
 */
export async function taoHocSinh(duLieu: TaoHocSinh): Promise<HocSinh> {
  const { data } = await http.post<HocSinh>('/students', duLieu)
  return data
}

export async function suaHocSinh(id: string, duLieu: SuaHocSinh): Promise<HocSinh> {
  const { data } = await http.put<HocSinh>(`/students/${id}`, duLieu)
  return data
}

/** Cho học sinh nghỉ: backend đổi trạng thái chứ không xoá hồ sơ. */
export async function choHocSinhNghi(id: string): Promise<void> {
  await http.delete(`/students/${id}`)
}

export function useDanhSachHocSinh(boLoc: BoLocHocSinh) {
  return useQuery({
    queryKey: [...HOC_SINH_QUERY_KEY, boLoc],
    queryFn: () => layDanhSachHocSinh(boLoc),
  })
}

function lamMoiDanhSach(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: HOC_SINH_QUERY_KEY })
  // Sửa lịch học có thể làm đổi buổi học trong tuần, nên dọn cả dữ liệu điểm danh và tổng quan.
  void queryClient.invalidateQueries({ queryKey: ['buoi-hoc'] })
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

export function useTaoHocSinh() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: taoHocSinh,
    onSuccess: () => {
      lamMoiDanhSach(queryClient)
    },
  })
}

export function useSuaHocSinh(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (duLieu: SuaHocSinh) => suaHocSinh(id, duLieu),
    onSuccess: () => {
      lamMoiDanhSach(queryClient)
    },
  })
}

export function useChoHocSinhNghi() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: choHocSinhNghi,
    onSuccess: () => {
      lamMoiDanhSach(queryClient)
    },
  })
}
