/**
 * Đọc sao kê ngân hàng NGAY TRONG TRÌNH DUYỆT.
 *
 * Backend cố tình không đọc file của ngân hàng nào (mỗi ngân hàng một định dạng, mà file thì đã nằm
 * trong tay người dùng): file .csv được FileReader đọc thành chuỗi ở đây, cắt thành từng dòng rồi mới
 * gửi lên `POST /tuition/doi-chieu/phan-tich`. Không có request nào mang cả file lên server.
 *
 * Cột ngày / số tiền / nội dung / mã giao dịch chỉ được ĐOÁN theo tên tiêu đề — giao diện luôn cho
 * người dùng sửa lại, vì đoán sai mà im lặng thì sổ sẽ sai theo.
 */
import dayjs from 'dayjs'

export interface BangCsv {
  tieuDe: string[]
  dong: string[][]
  /** Ký tự phân cách đoán được từ dòng đầu (nhiều ngân hàng xuất ';' thay vì ','). */
  phanCach: string
}

export interface AnhXaCot {
  ngay: number | null
  soTien: number | null
  noiDung: number | null
  maGiaoDich: number | null
}

const MAU_NGAY = /(ngay|date|thoi gian|posting)/
const MAU_SO_TIEN = /(so tien|amount|credit|ghi co|tien vao|phat sinh)/
const MAU_NOI_DUNG = /(noi dung|dien giai|description|memo|remark|chi tiet|details)/
const MAU_MA_GIAO_DICH = /(ma giao dich|ma gd|ref|trace|ft\d|so lenh|transaction id|code)/

/** Cột chỉ đoán khi không tìm được cột chính: "Số dư" là số dư cuối kỳ, không phải số tiền chuyển. */
const MAU_SO_TIEN_YEU = /(so du|balance)/

/**
 * Bỏ dấu tiếng Việt và hạ chữ thường để so tiêu đề cột: cùng một cột, ngân hàng này ghi "Ngày giao
 * dịch" còn ngân hàng kia xuất "Ngay giao dich". `đ` là ký tự riêng nên phải thay tay (NFD không tách).
 */
function boDau(chuoi: string): string {
  return chuoi
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

function doanPhanCach(dongDau: string): string {
  const ungVien = [',', ';', '\t', '|']
  let totNhat = ','
  let diemCaoNhat = 0

  for (const ky of ungVien) {
    const diem = dongDau.split(ky).length - 1
    if (diem > diemCaoNhat) {
      diemCaoNhat = diem
      totNhat = ky
    }
  }

  return totNhat
}

/** Cắt một dòng thành các ô, tôn trọng ô được bọc trong dấu nháy kép (nội dung chuyển khoản hay có dấu phẩy). */
function tachDong(dong: string, phanCach: string): string[] {
  const o: string[] = []
  let hienTai = ''
  let trongNhay = false

  for (let i = 0; i < dong.length; i++) {
    const kyTu = dong[i]
    if (trongNhay) {
      if (kyTu === '"') {
        if (dong[i + 1] === '"') {
          hienTai += '"'
          i++
        } else {
          trongNhay = false
        }
      } else {
        hienTai += kyTu
      }
      continue
    }

    if (kyTu === '"') {
      trongNhay = true
    } else if (kyTu === phanCach) {
      o.push(hienTai)
      hienTai = ''
    } else {
      hienTai += kyTu
    }
  }

  o.push(hienTai)
  return o.map((giaTri) => giaTri.trim())
}

export function docCsv(noiDung: string): BangCsv {
  const sach = noiDung.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const dongTho = sach.split('\n').filter((dong) => dong.trim().length > 0)
  if (dongTho.length === 0) return { tieuDe: [], dong: [], phanCach: ',' }

  const phanCach = doanPhanCach(dongTho[0])
  const tatCa = dongTho.map((dong) => tachDong(dong, phanCach))
  const tieuDe = tatCa[0].map((o, chiSo) => o || `Cột ${chiSo + 1}`)

  return { tieuDe, dong: tatCa.slice(1), phanCach }
}

function timCot(tieuDe: string[], mau: RegExp, daDung: Set<number>): number | null {
  const chiSo = tieuDe.findIndex(
    (ten, viTri) => !daDung.has(viTri) && mau.test(boDau(ten)),
  )
  if (chiSo < 0) return null
  daDung.add(chiSo)
  return chiSo
}

/**
 * Đoán cột theo tên tiêu đề; trả về null cho cột không nhận ra để người dùng tự chọn.
 *
 * Duyệt theo thứ tự vai trò và khoá dần các cột đã dùng, nên một cột không bị nhận cho hai vai trò.
 * Cột số dư chỉ được dùng khi không có cột "số tiền" thật — ghép số dư cuối kỳ thành tiền chuyển là
 * ghi sai sổ.
 */
export function doanCot(tieuDe: string[]): AnhXaCot {
  const daDung = new Set<number>()
  const ketQua: AnhXaCot = { ngay: null, soTien: null, noiDung: null, maGiaoDich: null }

  ketQua.ngay = timCot(tieuDe, MAU_NGAY, daDung)
  ketQua.soTien = timCot(tieuDe, MAU_SO_TIEN, daDung) ?? timCot(tieuDe, MAU_SO_TIEN_YEU, daDung)
  ketQua.noiDung = timCot(tieuDe, MAU_NOI_DUNG, daDung)
  ketQua.maGiaoDich = timCot(tieuDe, MAU_MA_GIAO_DICH, daDung)

  return ketQua
}

function haiChuSo(so: number): string {
  return String(so).padStart(2, '0')
}

function taoNgay(nam: number, thang: number, ngay: number): string | null {
  if (thang < 1 || thang > 12 || ngay < 1 || ngay > 31) return null
  const moc = dayjs(new Date(nam, thang - 1, ngay))
  // Ngày 31/02 sẽ bị JS tự nhảy sang tháng sau — kiểm lại để không nhận ngày không tồn tại.
  if (moc.year() !== nam || moc.month() !== thang - 1 || moc.date() !== ngay) return null
  return `${moc.year()}-${haiChuSo(moc.month() + 1)}-${haiChuSo(moc.date())}`
}

/**
 * Đọc ngày từ sao kê → "YYYY-MM-DD".
 * Nhận `2026-09-05`, `05/09/2026`, `5-9-26`, `05.09.2026`; bỏ qua phần giờ phía sau nếu có.
 */
export function docNgay(chuoi: string): string | null {
  const sach = chuoi.trim()
  if (!sach) return null

  const kieuIso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(sach)
  if (kieuIso) {
    return taoNgay(Number(kieuIso[1]), Number(kieuIso[2]), Number(kieuIso[3]))
  }

  const kieuVietNam = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(sach)
  if (kieuVietNam) {
    const nam = Number(kieuVietNam[3])
    return taoNgay(nam < 100 ? 2000 + nam : nam, Number(kieuVietNam[2]), Number(kieuVietNam[1]))
  }

  return null
}

/**
 * Đọc số tiền từ sao kê → số đồng.
 *
 * Sai ở đây là ghép sai tiền vào sổ, nên quy tắc phải nói rõ: dấu phân cách xuất hiện SAU CÙNG là dấu
 * thập phân, dấu còn lại là phân cách nghìn. Riêng trường hợp chỉ có một loại dấu mà nhóm đều đúng 3
 * chữ số (`1.500.000` / `1,500,000`) thì đó là phân cách nghìn.
 */
export function docSoTien(chuoi: string): number | null {
  const sach = chuoi.replace(/[^\d.,-]/g, '')
  if (!/\d/.test(sach)) return null

  const am = sach.startsWith('-')
  const so = sach.replace(/-/g, '')
  const coCham = so.includes('.')
  const coPhay = so.includes(',')

  let chuan = so
  if (coCham && coPhay) {
    const dauThapPhan = so.lastIndexOf('.') > so.lastIndexOf(',') ? '.' : ','
    const dauPhanCach = dauThapPhan === '.' ? ',' : '.'
    chuan = so.split(dauPhanCach).join('').replace(dauThapPhan, '.')
  } else if (coCham || coPhay) {
    const dau = coCham ? '.' : ','
    const nhomNghin = new RegExp(`^\\d{1,3}(\\${dau}\\d{3})+$`)
    chuan = nhomNghin.test(so) ? so.split(dau).join('') : so.split(dau).join('.')
  }

  const soTien = Number(chuan)
  if (!Number.isFinite(soTien)) return null
  return am ? -soTien : soTien
}
