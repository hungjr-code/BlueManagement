/**
 * Điểm duy nhất đọc biến môi trường.
 * Code nghiệp vụ không gọi trực tiếp import.meta.env để tránh rải rác khắp nơi.
 */
export const env = {
  appName: import.meta.env.VITE_APP_NAME || 'ClassManagement',
  /** Dev là "/api" (đi qua proxy của Vite). Prod sẽ trỏ tới domain API thật. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  apiDebug: import.meta.env.VITE_API_DEBUG === 'true',
} as const
