import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { env } from '../config/env'
import type { KetQuaDangNhap } from './types'

/* ------------------------------------------------------------------ *
 * 1. Chuẩn hoá lỗi
 * ------------------------------------------------------------------ */

/** Khớp với định dạng ProblemDetails chuẩn của ASP.NET Core. */
export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  /** Lỗi validate theo từng field (ModelState / FluentValidation). */
  errors?: Record<string, string[]>
  traceId?: string
}

/**
 * Mọi lỗi từ HTTP client đều được quy về ApiError để tầng UI chỉ cần đọc
 * message/status, không phải phân biệt lỗi axios, lỗi mạng hay lỗi nghiệp vụ.
 */
export class ApiError extends Error {
  readonly status: number
  readonly problem?: ProblemDetails

  constructor(message: string, status: number, problem?: ProblemDetails) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }

  /** true khi không gọi được backend (backend chưa chạy, sai cổng, mất mạng). */
  get isNetworkError(): boolean {
    return this.status === 0
  }

  /** Gộp lỗi của tất cả field thành danh sách để hiển thị cho người dùng. */
  get fieldMessages(): string[] {
    if (!this.problem?.errors) return []
    return Object.values(this.problem.errors).flat()
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      const timedOut = error.code === 'ECONNABORTED'
      return new ApiError(
        timedOut
          ? 'Backend phản hồi quá chậm (quá 20 giây).'
          : 'Không kết nối được backend. Kiểm tra API đã chạy chưa.',
        0,
      )
    }

    const status = error.response.status
    const data: unknown = error.response.data
    const problem = data && typeof data === 'object' ? (data as ProblemDetails) : undefined
    const message = problem?.title || problem?.detail || `Lỗi HTTP ${status}`

    return new ApiError(message, status, problem)
  }

  if (error instanceof Error) return new ApiError(error.message, 0)
  return new ApiError('Lỗi không xác định', 0)
}

/* ------------------------------------------------------------------ *
 * 2. Access token (chỉ trong RAM)
 * ------------------------------------------------------------------ */

/**
 * Access token chỉ giữ trong bộ nhớ, KHÔNG lưu localStorage/sessionStorage:
 * localStorage đọc được bằng JavaScript nên chỉ cần một lỗ hổng XSS là mất token.
 *
 * Refresh token nằm trong cookie httpOnly do backend set — JavaScript không đọc được,
 * trình duyệt tự gửi kèm nhờ withCredentials.
 * Đổi lại: F5 là mất access token, phải gọi /api/auth/refresh để lấy lại.
 */
let accessToken: string | null = null
const tokenListeners = new Set<(token: string | null) => void>()

function applyToken(next: string | null): void {
  accessToken = next
  tokenListeners.forEach((listener) => listener(next))
}

export const tokenStore = {
  get(): string | null {
    return accessToken
  },
  set(token: string | null): void {
    applyToken(token)
  },
  clear(): void {
    applyToken(null)
  },
  /** Cho phép router guard phản ứng ngay khi phiên đăng nhập thay đổi. */
  subscribe(listener: (token: string | null) => void): () => void {
    tokenListeners.add(listener)
    return () => {
      tokenListeners.delete(listener)
    }
  },
}

/* ------------------------------------------------------------------ *
 * 3. HTTP client
 * ------------------------------------------------------------------ */

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
  // Gửi kèm cookie httpOnly chứa refresh token.
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

/* ------------------------------------------------------------------ *
 * 4. Làm mới phiên
 * ------------------------------------------------------------------ */

let dangLamMoi: Promise<KetQuaDangNhap | null> | null = null

/**
 * Gọi POST /api/auth/refresh đúng MỘT lần cho dù nhiều nơi cùng hỏi một lúc
 * (React StrictMode gọi effect hai lần, nhiều request cùng nhận 401…).
 *
 * Gộp lại là bắt buộc chứ không phải cho gọn: backend xoay vòng refresh token và coi việc
 * dùng lại token cũ là dấu hiệu bị lộ, nên hai request làm mới song song sẽ bị đăng xuất oan.
 * Dùng axios trực tiếp (không qua `http`) để không đi qua interceptor của chính nó.
 */
export function lamMoiPhienMotLan(): Promise<KetQuaDangNhap | null> {
  if (!dangLamMoi) {
    dangLamMoi = axios
      .post<KetQuaDangNhap>(`${env.apiBaseUrl}/auth/refresh`, null, {
        withCredentials: true,
        timeout: 20_000,
        headers: { 'Content-Type': 'application/json' },
      })
      .then((phanHoi) => {
        tokenStore.set(phanHoi.data.accessToken)
        return phanHoi.data
      })
      .catch(() => {
        tokenStore.clear()
        return null
      })
      .finally(() => {
        dangLamMoi = null
      })
  }

  return dangLamMoi
}

/* ------------------------------------------------------------------ *
 * 5. Interceptor
 * ------------------------------------------------------------------ */

type CauHinhCoCoLamMoi = InternalAxiosRequestConfig & { daThuLamMoi?: boolean }

http.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  if (env.apiDebug) {
    console.debug('[api] →', config.method?.toUpperCase(), config.url)
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    if (env.apiDebug) {
      console.debug('[api] ←', response.status, response.config.url)
    }
    return response
  },
  async (error: unknown) => {
    const apiError = toApiError(error)
    const cauHinh = (error as AxiosError).config as CauHinhCoCoLamMoi | undefined

    if (apiError.status === 401) {
      const laGoiAuth = cauHinh?.url?.startsWith('/auth/') ?? false

      // Access token hết hạn (30 phút) là chuyện bình thường: làm mới rồi chạy lại request cũ,
      // mỗi request chỉ thử một lần. Bỏ qua chính các endpoint /auth để không lặp vô tận.
      if (cauHinh && !cauHinh.daThuLamMoi && !laGoiAuth && tokenStore.get()) {
        cauHinh.daThuLamMoi = true
        const ketQua = await lamMoiPhienMotLan()
        if (ketQua) {
          cauHinh.headers.set('Authorization', `Bearer ${ketQua.accessToken}`)
          return await http.request(cauHinh)
        }
      }

      // Không làm mới được thì phiên đã hết: xoá token để router guard đưa về trang đăng nhập.
      tokenStore.clear()
    }

    return await Promise.reject(apiError)
  },
)
