/// <reference types="vite/client" />

/**
 * Khai báo kiểu cho biến môi trường của Vite.
 * Nhờ đây, gõ sai tên biến sẽ bị TypeScript báo lỗi ngay lúc build.
 */
interface ImportMetaEnv {
  /** Base URL của backend API. Dev dùng "/api" để đi qua proxy của Vite. */
  readonly VITE_API_BASE_URL?: string
  /** Tên hiển thị trên giao diện. */
  readonly VITE_APP_NAME?: string
  /** Backend mà Vite proxy tới trong lúc dev. */
  readonly VITE_PROXY_TARGET?: string
  /** Cổng của Vite dev server. */
  readonly VITE_PORT?: string
  /** "true" để in log request/response ra console trình duyệt. */
  readonly VITE_API_DEBUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
