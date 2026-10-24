/**
 * Bảng màu pastel nhẹ nhàng cho từng học sinh trên ô lịch.
 * Nền pastel trang nhã, viền mảnh thanh lịch, chữ sắc nét dễ đọc.
 * Mỗi học sinh có một mã màu ổn định (băm id) xuyên suốt các màn hình.
 */
export interface MauHocSinh {
  /** Nền của thẻ */
  nen: string
  /** Viền và vạch màu */
  vien: string
  /** Màu chữ cho tên học sinh */
  chu: string
}

const BANG_MAU: MauHocSinh[] = [
  { nen: '#F0F6FE', vien: '#CCE0FA', chu: '#1E40AF' }, // Sky Pastel
  { nen: '#F2F4FE', vien: '#D0D7FB', chu: '#3730A3' }, // Indigo Pastel
  { nen: '#F0FDFB', vien: '#CCF5F0', chu: '#115E59' }, // Teal Pastel
  { nen: '#F2FAF5', vien: '#CDEBD9', chu: '#166534' }, // Emerald Pastel
  { nen: '#FFF1F2', vien: '#FECDD3', chu: '#9F1239' }, // Rose Pastel
  { nen: '#F5F3FF', vien: '#DDD6FE', chu: '#5B21B6' }, // Lavender Pastel
  { nen: '#FFFBEB', vien: '#FDE68A', chu: '#92400E' }, // Amber Pastel
  { nen: '#ECFEFF', vien: '#BAE6FD', chu: '#075985' }, // Cyan Pastel
  { nen: '#F8FAFC', vien: '#CBD5E1', chu: '#334155' }, // Slate Pastel
  { nen: '#FFF7ED', vien: '#FED7AA', chu: '#9A3412' }, // Warm Coral Pastel
  { nen: '#FAF5FF', vien: '#E9D5FF', chu: '#6B21A8' }, // Purple Pastel
  { nen: '#F1F5F9', vien: '#CBD5E1', chu: '#1E293B' }, // Cool Gray Pastel
]

/** Băm chuỗi thành số nguyên dương ổn định. */
function bam(chuoi: string): number {
  let giaTri = 0
  for (let viTri = 0; viTri < chuoi.length; viTri += 1) {
    giaTri = (giaTri * 31 + chuoi.charCodeAt(viTri)) % 1_000_003
  }
  return giaTri
}

/** Màu cố định của một học sinh theo ID. */
export function mauCuaHocSinh(hocSinhId: string): MauHocSinh {
  return BANG_MAU[bam(hocSinhId) % BANG_MAU.length]
}
