import dayjs from 'dayjs'
import { cuoiTuan, dauTuan, dichTuan, ngayNgan } from '../../config/lichTuan'

/** Bảy ngày của tuần chứa một ngày, bắt đầu từ thứ hai. */
function cacNgayCuaTuan(tuNgay: string): string[] {
  return Array.from({ length: 7 }, (_giaTri, viTri) =>
    dayjs(tuNgay).add(viTri, 'day').format('YYYY-MM-DD'),
  )
}

/**
 * Mọi ngày của lưới tháng chứa một ngày, đã căn đủ tuần ở cả hai đầu (ô của tháng trước/sau vẫn hiện
 * nhưng để trống) — nhờ vậy cột nào cũng đúng thứ, không bị lệch.
 */
function cacNgayCuaThang(ngayBatKy: string): { cacNgay: string[]; tuNgay: string; denNgay: string } {
  const dauThang = dayjs(ngayBatKy).startOf('month')
  const cuoiThang = dayjs(ngayBatKy).endOf('month')
  const dau = dayjs(dauThang).subtract((dauThang.day() + 6) % 7, 'day')
  const cuoi = dayjs(cuoiThang).add((7 - cuoiThang.day()) % 7, 'day')

  const soNgay = cuoi.diff(dau, 'day') + 1
  const cacNgay = Array.from({ length: soNgay }, (_giaTri, viTri) =>
    dau.add(viTri, 'day').format('YYYY-MM-DD'),
  )

  return { cacNgay, tuNgay: cacNgay[0], denNgay: cacNgay[cacNgay.length - 1] }
}

/**
 * Khoảng đang xem của Lịch dạy và Điểm danh: một tuần hoặc một tháng.
 *
 * Đặt ở một chỗ để hai màn hình không bao giờ lệch nhau: cùng `cheDo` + `mocNgay` thì phải ra đúng
 * cùng khoảng ngày gửi lên API, nếu không hai màn hình sẽ nói hai chuyện khác nhau.
 */
export type CheDoXem = 'tuan' | 'thang'

export interface KhoangXem {
  /** Ngày đầu và ngày cuối gửi lên API (đã căn đủ tuần với chế độ tháng). */
  tuNgay: string
  denNgay: string
  /** Đúng các ngày sẽ vẽ trên lưới — bội số của 7. */
  cacNgay: string[]
  /** Câu mô tả ngắn để hiện trên tiêu đề. */
  moTa: string
}

export function tinhKhoangXem(cheDo: CheDoXem, mocNgay: string): KhoangXem {
  if (cheDo === 'tuan') {
    // `mocNgay` là thứ hai của tuần đang xem.
    return {
      tuNgay: mocNgay,
      denNgay: cuoiTuan(mocNgay),
      cacNgay: cacNgayCuaTuan(mocNgay),
      moTa: `Tuần ${ngayNgan(mocNgay)} – ${ngayNgan(cuoiTuan(mocNgay))}`,
    }
  }

  const thang = cacNgayCuaThang(mocNgay)
  return {
    tuNgay: thang.tuNgay,
    denNgay: thang.denNgay,
    cacNgay: thang.cacNgay,
    moTa: `Tháng ${dayjs(mocNgay).format('MM/YYYY')}`,
  }
}

/**
 * Mốc mới sau khi người dùng bấm lùi/tiến. `so = 0` là "về hiện tại": tuần này, hoặc tháng này.
 * Luôn trả về mốc đã chuẩn hoá — thứ hai của tuần, hoặc ngày đầu tháng.
 */
export function chuyenMoc(cheDo: CheDoXem, mocNgay: string, so: number): string {
  if (cheDo === 'tuan') {
    return so === 0 ? dauTuan(dayjs().format('YYYY-MM-DD')) : dichTuan(mocNgay, so).tu
  }

  return dayjs(so === 0 ? undefined : mocNgay)
    .add(so, 'month')
    .startOf('month')
    .format('YYYY-MM-DD')
}

/** Mốc đang xem có phải hôm nay/tuần này/tháng này không — để chỉ hiện nhãn khi thật sự cần. */
export function laHienTai(cheDo: CheDoXem, mocNgay: string): boolean {
  const homNay = dayjs()
  return cheDo === 'tuan'
    ? mocNgay === dauTuan(homNay.format('YYYY-MM-DD'))
    : dayjs(mocNgay).isSame(homNay, 'month')
}
