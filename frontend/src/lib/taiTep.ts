import type { AxiosInstance } from 'axios'

/**
 * Tải một tệp có xác thực rồi lưu xuống máy người dùng.
 *
 * Không dùng thẻ <a href> trỏ thẳng vào API: trình duyệt sẽ KHÔNG gửi kèm header Authorization, mà
 * access token lại chỉ nằm trong RAM (không phải cookie). Vì vậy phải tải qua axios rồi tự tạo link
 * tạm từ blob.
 */
export async function luuTepVe(client: AxiosInstance, duongDan: string, tenTepGoiY: string): Promise<void> {
  const phanHoi = await client.get<Blob>(duongDan, { responseType: 'blob', timeout: 120_000 })

  const diaChi = URL.createObjectURL(phanHoi.data)
  try {
    const lienKet = document.createElement('a')
    lienKet.href = diaChi
    lienKet.download = tenTepGoiY
    document.body.appendChild(lienKet)
    lienKet.click()
    lienKet.remove()
  } finally {
    // Thu hồi ngay sau khi bấm: blob vẫn được trình duyệt giữ cho lượt tải đang chạy.
    URL.revokeObjectURL(diaChi)
  }
}

/** Đọc tên tệp từ header Content-Disposition của backend (dạng filename*=UTF-8''...). */
export function tenTepTuHeader(header: string | undefined, tenMacDinh: string): string {
  if (!header) return tenMacDinh

  const khop = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (khop?.[1]) {
    try {
      return decodeURIComponent(khop[1])
    } catch {
      return tenMacDinh
    }
  }

  const donGian = /filename="?([^";]+)"?/i.exec(header)
  return donGian?.[1] ?? tenMacDinh
}
