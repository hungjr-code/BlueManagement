import { useEffect, useRef } from 'react'
import { App } from 'antd'
import { useDongBoVeGoogle, useTrangThaiGoogle } from '../../api/googleCalendar'
import { tomTatDongBoVe } from '../../lib/dongBo'

/**
 * Tự kéo thay đổi từ Google Calendar về khi mở màn Lịch dạy.
 *
 * Ba điều kiện, thiếu một là không chạy: đã kết nối Google, công tắc tự đồng bộ đang bật, và lần
 * đồng bộ trước đã quá 10 phút (máy chủ tự kiểm tra điều kiện cuối nhờ `chiKhiQuaHan`, nên mở đi mở
 * lại nhiều lần cũng không gọi Google liên tục).
 *
 * Chỉ báo cho người dùng khi THẬT SỰ có gì thay đổi: im lặng là bình thường, thông báo "không có gì
 * mới" mỗi lần mở trang chỉ làm ồn.
 */
export function useDongBoTuDong(): { dangChay: boolean } {
  const { message } = App.useApp()
  const trangThai = useTrangThaiGoogle()
  const dongBoVe = useDongBoVeGoogle()

  // StrictMode gọi effect hai lần ở máy dev: chặn để không gọi hai lần trong cùng một lượt mở trang.
  const daGoi = useRef(false)

  const sanSang = trangThai.data?.daKetNoi === true && trangThai.data.tuDongDongBo === true
  const batDau = dongBoVe.mutateAsync

  useEffect(() => {
    if (!sanSang || daGoi.current) return

    daGoi.current = true
    void batDau({ chiKhiQuaHan: true })
      .then((ketQua) => {
        if (ketQua.boQua) return

        const coThayDoi = ketQua.soDoiGio > 0 || ketQua.soDanhDauNghi > 0 || ketQua.soCanhBao > 0
        if (!coThayDoi) return

        const tomTat = `Đã kéo thay đổi từ Google: ${tomTatDongBoVe(ketQua)}`

        if (ketQua.soCanhBao > 0) {
          message.warning(`${tomTat}. Mở chi tiết buổi có dấu cảnh báo để xem.`)
        } else {
          message.info(tomTat)
        }
      })
      .catch(() => {
        // Tự đồng bộ là việc phụ: Google lỗi thì im lặng, nút "Đồng bộ lại" vẫn báo lỗi rõ ràng.
      })
  }, [sanSang, batDau, message])

  return { dangChay: dongBoVe.isPending }
}
