import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './http'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dữ liệu bảng biểu không cần tươi từng giây; 30s tránh gọi API trùng lặp.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Không thử lại lỗi 4xx (sai quyền, không tìm thấy) — chỉ thử lại lỗi mạng/5xx.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})
