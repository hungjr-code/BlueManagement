import { http } from './http'

/**
 * Hợp đồng dữ liệu với endpoint GET /api/health của backend.
 *
 * Đây là endpoint duy nhất hiện có, dùng để chứng minh FE và BE đã nối thông.
 * Phase 1 sẽ thay bằng type sinh tự động từ OpenAPI để không phải chép tay thế này.
 */
export interface HealthResponse {
  status: string
  service: string
  version: string
  environment: string
  serverTimeUtc: string
  database: {
    canConnect: boolean
    provider: string
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await http.get<HealthResponse>('/health')
  return data
}
