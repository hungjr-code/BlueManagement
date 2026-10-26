import type { KetQuaDongBo, KetQuaDongBoVe } from '../api/types'

/** Tóm tắt một lần đồng bộ lịch: tạo mấy, cập nhật mấy, xoá mấy, bỏ qua mấy buổi. */
export function tomTatDongBo(ketQua: KetQuaDongBo): string {
  return `Tạo ${ketQua.soTao}, cập nhật ${ketQua.soCapNhat}, xoá ${ketQua.soXoa}, bỏ qua ${ketQua.soBoQua} buổi`
}

/** Tóm tắt một lần KÉO thay đổi từ Google về: xét mấy buổi, đổi giờ mấy, đánh dấu nghỉ mấy. */
export function tomTatDongBoVe(ketQua: KetQuaDongBoVe): string {
  const phan = [`xét ${ketQua.soDaXet} buổi`]

  if (ketQua.soDoiGio > 0) phan.push(`cập nhật giờ ${ketQua.soDoiGio}`)
  if (ketQua.soDanhDauNghi > 0) phan.push(`đánh dấu nghỉ ${ketQua.soDanhDauNghi}`)
  if (ketQua.soCanhBao > 0) phan.push(`${ketQua.soCanhBao} chỗ cần xem lại`)

  return phan.join(', ')
}
