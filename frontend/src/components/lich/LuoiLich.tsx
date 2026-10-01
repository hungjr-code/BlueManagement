import type { ReactNode } from 'react'
import dayjs from 'dayjs'
import { laHomNay, tenThuNgan, thuCua } from '../../config/lichTuan'

interface LuoiLichProps {
  /**
   * Các ngày của lưới theo thứ tự tăng dần. Độ dài phải là BỘI SỐ CỦA 7 — hàm gọi tự căn cho đủ tuần
   * (xem `tinhKhoangXem` trong `khoangXem.ts`), vì lưới chỉ vẽ được khi đủ cột.
   */
  cacNgay: string[]
  /** Nội dung một ô ngày — thường là danh sách thẻ buổi học. */
  renderNgay: (ngay: string) => ReactNode
  /** Chiều cao tối thiểu của một ô (px). */
  caoO?: number
}

/**
 * Ô lịch: lưới 7 cột (thứ hai → chủ nhật), mỗi ô là một ngày.
 *
 * Cố tình không dùng component lịch của Ant Design: ở đây mỗi ô phải chứa nhiều thẻ học sinh với
 * màu khác nhau, mà lịch có sẵn chỉ nhận một nhãn ngắn cho mỗi ngày.
 */
export function LuoiLich({ cacNgay, renderNgay, caoO = 140 }: LuoiLichProps) {
  // Nhãn cột lấy từ 7 ngày đầu: tuần nào cũng bắt đầu bằng thứ hai.
  const nhanCot = cacNgay.slice(0, 7).map((ngay) => tenThuNgan(thuCua(ngay)))

  return (
    <div className="luoi-lich">
      <div className="luoi-lich-dau">
        {nhanCot.map((nhan, viTri) => (
          <div key={`${nhan}-${viTri}`} className="luoi-lich-o-dau">
            {nhan}
          </div>
        ))}
      </div>

      <div className="luoi-lich-than">
        {cacNgay.map((ngay) => {
          const ngayDayjs = dayjs(ngay)
          const cuoiTuan = ngayDayjs.day() === 0 || ngayDayjs.day() === 6
          const lop = ['luoi-lich-o']
          if (laHomNay(ngay)) lop.push('la-hom-nay')
          if (cuoiTuan) lop.push('la-cuoi-tuan')

          return (
            <div key={ngay} className={lop.join(' ')} style={{ minHeight: caoO }}>
              <div className="luoi-lich-o-ngay">
                {/* Ngày đầu tháng (và ô đầu tiên) hiện thêm tháng để không phải đoán đang xem tháng nào. */}
                {ngayDayjs.date() === 1 || ngay === cacNgay[0]
                  ? `Tháng ${ngayDayjs.month() + 1} · ${ngayDayjs.date()}`
                  : ngayDayjs.date()}
              </div>
              {renderNgay(ngay)}
            </div>
          )
        })}
      </div>
    </div>
  )
}