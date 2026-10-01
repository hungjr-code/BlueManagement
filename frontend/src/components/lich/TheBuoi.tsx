import type { ReactNode } from 'react'
import type { BuoiHoc, TrangThaiDiemDanh } from '../../api/types'
import { gioNgan } from '../../config/lichTuan'
import { mauCuaHocSinh } from '../../config/mauHocSinh'

interface TheBuoiProps {
  buoi: BuoiHoc
  /** Chỉ admin cần thấy tên giáo viên: giáo viên chỉ có buổi của chính mình. */
  hienGiaoVien?: boolean
  /**
   * Trạng thái ĐANG NHẬP (có thể khác dữ liệu đã lưu). Bỏ trống thì lấy trạng thái đã lưu.
   * "Chưa điểm danh" khác hẳn "nghỉ" nên chấm trạng thái phải phân biệt được ba thứ.
   */
  trangThai?: TrangThaiDiemDanh
  /** Buổi này đã bị sửa nhưng chưa lưu. */
  daSua?: boolean
  /** Nút hành động nhỏ (màn hình Điểm danh mới truyền). */
  hanhDong?: ReactNode
  /** Bấm vào thẻ — màn hình Lịch dạy mở chi tiết. */
  onBam?: () => void
}

/**
 * Một buổi học trên ô lịch: giờ, tên học sinh, lớp, và chấm trạng thái điểm danh.
 * Màu lấy theo học sinh nên cùng một em luôn cùng màu ở mọi ô.
 */
export function TheBuoi({ buoi, hienGiaoVien, trangThai, daSua, hanhDong, onBam }: TheBuoiProps) {
  const mau = mauCuaHocSinh(buoi.hocSinhId)
  const trangThaiHien = trangThai ?? buoi.trangThai

  return (
    <div
      className={onBam ? 'the-buoi co-bam' : 'the-buoi'}
      style={{ background: mau.nen, borderColor: mau.vien }}
      {...(onBam
        ? {
            onClick: onBam,
            role: 'button',
            tabIndex: 0,
            onKeyDown: (suKien) => {
              if (suKien.key === 'Enter' || suKien.key === ' ') {
                suKien.preventDefault()
                onBam()
              }
            },
          }
        : {})}
    >
      <div className="the-buoi-dong">
        <span className="the-buoi-gio">
          {gioNgan(buoi.gioBatDau)}–{gioNgan(buoi.gioKetThuc)}
        </span>
        {buoi.laBuoiDayBu ? <span className="the-buoi-nhan">bù</span> : null}
        {daSua ? <span className="cham-sua" title="Chưa lưu" /> : null}
        <span
          className={`cham ${trangThaiHien}`}
          title={
            trangThaiHien === 'di_hoc'
              ? 'Đi học'
              : trangThaiHien === 'nghi'
                ? `Nghỉ${buoi.lyDoNghi === 'khong_phep' ? ' không phép' : ' có phép'}`
                : 'Chưa điểm danh'
          }
        />
      </div>

      <div className="the-buoi-ten" style={{ color: mau.chu }} title={buoi.tenHocSinh}>
        {buoi.tenHocSinh}
      </div>

      <div className="the-buoi-phu">
        {buoi.lopHocSinh ? buoi.lopHocSinh : <span className="mo">chưa khai lớp</span>}
        {hienGiaoVien ? ` · ${buoi.tenGiaoVien}` : ''}
      </div>

      {hanhDong ? <div className="the-buoi-hanh-dong">{hanhDong}</div> : null}
    </div>
  )
}
