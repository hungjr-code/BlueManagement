import { ApiError } from '../api/http'

/** Một lỗi validate của backend, đã tách theo từng field. */
export interface LoiTheoField {
  field: string
  thongDiep: string
}

/** Lỗi validate của backend tách theo từng field (ProblemDetails.errors). */
export function loiTheoField(error: unknown): LoiTheoField[] {
  const problem = error instanceof ApiError ? error.problem : undefined
  if (!problem?.errors) return []
  return Object.entries(problem.errors).flatMap(([field, danhSach]) =>
    danhSach.map((thongDiep) => ({ field, thongDiep })),
  )
}

/**
 * Một dòng mô tả lỗi để hiện cho người dùng: lỗi theo từng field trước (backend nói rõ sai ở đâu),
 * rồi mới tới message chung. Dùng chung cho mọi màn hình.
 */
export function moTaLoi(error: unknown, macDinh: string): string {
  if (error instanceof ApiError) {
    if (error.fieldMessages.length > 0) return error.fieldMessages.join(' · ')
    return error.message
  }
  return macDinh
}
