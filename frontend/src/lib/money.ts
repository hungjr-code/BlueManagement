/** Định dạng tiền Việt Nam dùng chung: 250000 → "250.000 đ". */
const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'decimal',
  maximumFractionDigits: 0,
})

export function formatVnd(amount: number): string {
  if (!Number.isFinite(amount)) return '—'
  return `${vndFormatter.format(Math.round(amount))} đ`
}
