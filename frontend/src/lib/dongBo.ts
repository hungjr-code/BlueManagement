import type { KetQuaDongBo } from '../api/types'

/** Tóm tắt một lần đồng bộ lịch: tạo mấy, cập nhật mấy, xoá mấy, bỏ qua mấy buổi. */
export function tomTatDongBo(ketQua: KetQuaDongBo): string {
  return `Tạo ${ketQua.soTao}, cập nhật ${ketQua.soCapNhat}, xoá ${ketQua.soXoa}, bỏ qua ${ketQua.soBoQua} buổi`
}
