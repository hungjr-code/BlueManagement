import { useQuery } from '@tanstack/react-query'
import { http } from './http'
import type { HomNay, TuanNay } from './types'

export const DASHBOARD_QUERY_KEY = ['dashboard'] as const

export async function layHomNay(giaoVienId?: string): Promise<HomNay> {
  const { data } = await http.get<HomNay>('/dashboard/hom-nay', {
    params: giaoVienId ? { giaoVienId } : undefined,
  })
  return data
}

export async function layTuanNay(giaoVienId?: string): Promise<TuanNay> {
  const { data } = await http.get<TuanNay>('/dashboard/tuan-nay', {
    params: giaoVienId ? { giaoVienId } : undefined,
  })
  return data
}

export function useHomNay(giaoVienId?: string) {
  return useQuery({
    queryKey: [...DASHBOARD_QUERY_KEY, 'hom-nay', giaoVienId ?? 'tat-ca'],
    queryFn: () => layHomNay(giaoVienId),
  })
}

export function useTuanNay(giaoVienId?: string) {
  return useQuery({
    queryKey: [...DASHBOARD_QUERY_KEY, 'tuan-nay', giaoVienId ?? 'tat-ca'],
    queryFn: () => layTuanNay(giaoVienId),
  })
}
