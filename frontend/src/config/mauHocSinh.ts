/**
 * Màu của từng học sinh trên ô lịch.
 *
 * Bảng màu cố tình NHẠT (nền rất nhạt, viền mảnh, chữ đậm): ô lịch là chỗ để ĐỌC — ai học lúc nào —
 * nên màu chỉ giúp phân biệt người này với người kia, không phải để trang trí. Mỗi học sinh luôn ra
 * đúng một màu (băm id) nên nhìn sang ô khác vẫn theo dõi được cùng một em.
 */
export interface MauHocSinh {
  /** Nền của thẻ. */
  nen: string
  /** Viền và vạch màu bên trái. */
  vien: string
  /** Màu chữ cho tên học sinh. */
  chu: string
}

const BANG_MAU: MauHocSinh[] = [
  { nen: '#fdf4f4', vien: '#eec4c4', chu: '#8a2c2c' },
  { nen: '#fdf8ef', vien: '#eeddb2', chu: '#7a5410' },
  { nen: '#f6faef', vien: '#d5e6bb', chu: '#47621c' },
  { nen: '#f1f9f4', vien: '#bde2ce', chu: '#1f6b42' },
  { nen: '#eff9f9', vien: '#b7e3e1', chu: '#116057' },
  { nen: '#f0f7fd', vien: '#bfdbf0', chu: '#1d5a8a' },
  { nen: '#f2f4fd', vien: '#c7cef0', chu: '#33418c' },
  { nen: '#f7f3fd', vien: '#d6c9f0', chu: '#5b3a91' },
  { nen: '#fdf3f9', vien: '#f0c5e0', chu: '#8a2b64' },
  { nen: '#faf7f2', vien: '#e4d6c1', chu: '#6b5433' },
  { nen: '#f4f6f8', vien: '#cdd6de', chu: '#3d4b57' },
  { nen: '#fdf5f1', vien: '#f0cebc', chu: '#8a4a2a' },
]

/** Băm chuỗi thành số nguyên dương — chỉ cần ổn định, không cần phân bố đẹp. */
function bam(chuoi: string): number {
  let giaTri = 0
  for (let viTri = 0; viTri < chuoi.length; viTri += 1) {
    giaTri = (giaTri * 31 + chuoi.charCodeAt(viTri)) % 1_000_003
  }
  return giaTri
}

/** Màu cố định của một học sinh. Cùng id thì mọi màn hình ra cùng màu. */
export function mauCuaHocSinh(hocSinhId: string): MauHocSinh {
  return BANG_MAU[bam(hocSinhId) % BANG_MAU.length]
}
