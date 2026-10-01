import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from './http'
import type { CaiDat, SuaCaiDat } from './types'

/**
 * Cấu hình chung của trung tâm. Trước Phase 1 tài khoản nhận tiền nằm trong localStorage
 * của từng máy; giờ nằm ở backend để cả trung tâm dùng đúng một tài khoản.
 */

export const CAI_DAT_QUERY_KEY = ['cai-dat'] as const

export async function layCaiDat(): Promise<CaiDat> {
  const { data } = await http.get<CaiDat>('/settings')
  return data
}

export async function capNhatCaiDat(duLieu: SuaCaiDat): Promise<CaiDat> {
  const { data } = await http.put<CaiDat>('/settings', duLieu)
  return data
}

/** Đọc cấu hình. Mọi tài khoản đã đăng nhập đều đọc được (chỉ admin mới sửa được). */
export function useCaiDat() {
  return useQuery({
    queryKey: CAI_DAT_QUERY_KEY,
    queryFn: layCaiDat,
    staleTime: 60_000,
  })
}

export function useCapNhatCaiDat() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: capNhatCaiDat,
    onSuccess: (duLieu) => {
      queryClient.setQueryData(CAI_DAT_QUERY_KEY, duLieu)
    },
  })
}
