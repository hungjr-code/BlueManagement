import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from './http'
import type { CachTinhHocPhi, LyDoNghi, TrangThaiDiemDanh } from './types'

/**
 * Tầng gọi API cho sổ học phí (Phase 4). Hợp đồng khớp
 * `backend/ClassManagement.Api/Controllers/TuitionController.cs` và `Dtos/HocPhiDtos.cs`.
 *
 * Ba điểm của backend phải nhớ khi đọc file này:
 *
 * 1. Số buổi và thành tiền luôn ĐẾM/TÍNH TỪ ĐIỂM DANH — không có hàm nào ở đây gửi số buổi lên.
 * 2. `soBuoiChuaDiemDanh` không nằm trong database: backend đếm lại mỗi lần đọc, nên con số có thể
 *    đổi giữa hai lần mở màn hình (và thành tiền theo buổi cũng đổi theo khi buổi đó được điểm danh).
 * 3. Đối chiếu ngân hàng là "máy đề xuất, người xác nhận": `phanTichDoiChieu` không ghi gì vào sổ.
 *
 * `DateOnly` của .NET đi trên JSON dạng chuỗi `"2026-09-05"` (chỉ ngày, không giờ, KHÔNG phải UTC),
 * nên mọi trường ngày ở đây giữ nguyên chuỗi đó và để dayjs lo phần hiển thị.
 */

/* ---------------------------------- Kiểu ---------------------------------- */

export type TrangThaiThanhToan = 'chua_thu' | 'thu_mot_phan' | 'da_thu'

export type HinhThucThanhToan = 'tien_mat' | 'chuyen_khoan'

/** Mức độ khớp của một đề xuất ghép giao dịch ngân hàng với một dòng học phí. */
export type MucDoKhop =
  | 'khop_chac'
  | 'khop_mot_phan'
  | 'chi_khop_so_tien'
  | 'da_ghep_truoc_do'
  | 'khong_khop'

/** Một dòng học phí của một học sinh trong một kỳ. */
export interface HocPhi {
  id: string
  hocSinhId: string
  tenHocSinh: string
  giaoVienId: string
  tenGiaoVien: string
  thang: number
  nam: number
  /** "2026-09-05" — hạn đóng tiền của kỳ, lấy theo ngày đến hạn của học sinh. */
  hanDongTien: string
  soBuoiDiHoc: number
  soBuoiNghiCoPhep: number
  soBuoiNghiKhongPhep: number
  /** Buổi chưa điểm danh trong kỳ. Khác 0 thì thành tiền còn có thể thay đổi. */
  soBuoiChuaDiemDanh: number
  cachTinhHocPhi: CachTinhHocPhi
  donGiaApDung: number
  thanhTien: number
  soTienDaThu: number
  conLai: number
  trangThaiThanhToan: TrangThaiThanhToan
  daChotSo: boolean
  ngayChotUtc: string | null
}

/** Một buổi học trong kỳ, để đối chiếu bằng mắt ra con số thành tiền. */
export interface BuoiTrongKy {
  id: string
  /** "2026-09-03" */
  ngay: string
  /** Đã ghép sẵn "18:00 – 19:30" ở backend, không phải chuỗi giờ thô. */
  gio: string
  laBuoiDayBu: boolean
  trangThai: TrangThaiDiemDanh
  lyDoNghi: LyDoNghi | null
  ghiChu: string | null
}

export interface PhieuThu {
  id: string
  soTien: number
  /** "2026-09-05" */
  ngayThu: string
  hinhThuc: HinhThucThanhToan
  maGiaoDichNganHang: string | null
  tenNguoiThu: string | null
  ghiChu: string | null
  ngayTaoUtc: string
}

/** Chi tiết một dòng học phí: kèm danh sách buổi và danh sách phiếu thu. */
export interface HocPhiChiTiet {
  hocPhi: HocPhi
  danhSachBuoi: BuoiTrongKy[]
  danhSachPhieuThu: PhieuThu[]
}

export interface KyHocPhi {
  thang: number
  nam: number
}

export interface BoLocHocPhi extends KyHocPhi {
  trangThai?: TrangThaiThanhToan
}

export interface KetQuaTinhKy extends KyHocPhi {
  soTao: number
  soCapNhat: number
  /** Dòng đã chốt sổ nên giữ nguyên con số đã chốt, không tính lại. */
  soBoQuaDaChot: number
  tongThanhTien: number
  loi: string | null
}

export interface SapDenHan {
  sapDenHan: HocPhi[]
  quaHan: HocPhi[]
  /** Tổng còn lại của tất cả các dòng còn nợ (mọi kỳ, không chỉ kỳ đang xem). */
  tongConLai: number
}

export interface ThuTienYeuCau {
  soTien: number
  /** Bỏ trống thì backend lấy ngày hôm nay. Không được ở tương lai. */
  ngayThu?: string | null
  hinhThuc: HinhThucThanhToan
  ghiChu?: string | null
}

export interface CanhBaoChuaDiemDanh {
  tenHocSinh: string
  soBuoiChuaDiemDanh: number
}

/** Cảnh báo trước khi chốt sổ: còn buổi chưa điểm danh, còn ai chưa được tính tiền. */
export interface CanhBaoChotSo extends KyHocPhi {
  soDongHocPhi: number
  tongPhaiThu: number
  tongDaThu: number
  tongConLai: number
  chuaDiemDanh: CanhBaoChuaDiemDanh[]
  soHocSinhChuaTinhTien: number
  /** Backend tính sẵn: còn cảnh báo nào không. */
  coCanhBao: boolean
}

export interface KetQuaChotSo extends KyHocPhi {
  soDong: number
  tongPhaiThu: number
  tongDaThu: number
}

export interface TongHopTheoGiaoVien {
  giaoVienId: string
  tenGiaoVien: string
  soHocSinh: number
  phaiThu: number
  daThu: number
  conLai: number
}

/** Một dòng giao dịch do NGƯỜI DÙNG đọc từ file sao kê rồi gửi lên; backend không tự đọc file. */
export interface GiaoDichNganHang {
  /** "2026-09-05" */
  ngay: string
  soTien: number
  noiDung: string | null
  maGiaoDich: string | null
}

export interface DeXuatDoiChieu {
  giaoDich: GiaoDichNganHang
  mucDoKhop: MucDoKhop
  lyDo: string
  hocPhiId: string | null
  tenHocSinh: string | null
  conLai: number | null
}

export interface CapDoiChieu {
  hocPhiId: string
  soTien: number
  /** "2026-09-05" */
  ngayThu: string
  maGiaoDichNganHang?: string | null
  /** Ghi đè khi mã giao dịch đã có trong sổ (backend chặn nếu không khai báo). */
  boQuaTrungMaGiaoDich?: boolean
}

export interface KetQuaDoiChieu {
  soDaGhi: number
  tongDaGhi: number
  /** Những cặp không ghi được, kèm lý do — hiện lên cho người dùng, không im lặng bỏ qua. */
  boQua: string[]
}

export interface TepExcel {
  blob: Blob
  tenTep: string
}

/** Tiền tố chung của mọi queryKey liên quan học phí, để một lần invalidate là dọn sạch. */
export const HOC_PHI_QUERY_KEY = ['hoc-phi'] as const

/* -------------------------------- Lời gọi -------------------------------- */

export async function laySoHocPhiKy(boLoc: BoLocHocPhi): Promise<HocPhi[]> {
  const { data } = await http.get<HocPhi[]>('/tuition/ky', { params: boLoc })
  return data
}

/** Tính (hoặc tính lại) học phí của kỳ từ điểm danh. Dòng đã chốt sổ được giữ nguyên. */
export async function tinhKyHocPhi(ky: KyHocPhi): Promise<KetQuaTinhKy> {
  const { data } = await http.post<KetQuaTinhKy>('/tuition/tinh-ky', ky)
  return data
}

export async function laySapDenHan(soNgay: number): Promise<SapDenHan> {
  const { data } = await http.get<SapDenHan>('/tuition/sap-den-han', { params: { soNgay } })
  return data
}

export async function layChiTietHocPhi(id: string): Promise<HocPhiChiTiet> {
  const { data } = await http.get<HocPhiChiTiet>(`/tuition/${id}`)
  return data
}

/** Ghi một lần thu tiền. Thu nhiều lần được; thu vượt số còn lại bị backend chặn (400). */
export async function thuTienHocPhi(id: string, yeuCau: ThuTienYeuCau): Promise<PhieuThu> {
  const { data } = await http.post<PhieuThu>(`/tuition/${id}/thu-tien`, yeuCau)
  return data
}

/** Huỷ phiếu thu đã ghi sai. Bắt buộc có lý do; backend trả 204 khi xong. */
export async function huyPhieuThu(phieuThuId: string, lyDo: string): Promise<void> {
  await http.post(`/tuition/phieu-thu/${phieuThuId}/huy`, { lyDo })
}

export async function xemTruocChotSo(ky: KyHocPhi): Promise<CanhBaoChotSo> {
  const { data } = await http.get<CanhBaoChotSo>('/tuition/chot-so/xem-truoc', { params: ky })
  return data
}

/**
 * Chốt sổ kỳ — khoá con số của kỳ lại. Chỉ admin.
 *
 * Còn buổi chưa điểm danh mà `boQuaCanhBao` không bật thì backend trả **409** kèm lời giải thích;
 * giao diện phải cho người dùng tích xác nhận trước khi gửi `true`, không tự bật hộ.
 */
export async function chotSoHocPhi(ky: KyHocPhi & { boQuaCanhBao: boolean }): Promise<KetQuaChotSo> {
  const { data } = await http.post<KetQuaChotSo>('/tuition/chot-so', ky)
  return data
}

/** Mở lại sổ đã chốt. Chỉ admin, và bắt buộc nêu lý do (backend ghi cả ảnh chụp số liệu vào nhật ký). */
export async function moChotSoHocPhi(ky: KyHocPhi & { lyDo: string }): Promise<KetQuaChotSo> {
  const { data } = await http.post<KetQuaChotSo>('/tuition/mo-chot-so', ky)
  return data
}

/** Phân tích sao kê thành đề xuất ghép. KHÔNG ghi gì vào sổ. */
export async function phanTichDoiChieu(
  giaoDich: GiaoDichNganHang[],
): Promise<DeXuatDoiChieu[]> {
  const { data } = await http.post<DeXuatDoiChieu[]>('/tuition/doi-chieu/phan-tich', giaoDich)
  return data
}

/** Ghi những cặp đã được người dùng xác nhận thành phiếu thu chuyển khoản. */
export async function xacNhanDoiChieu(cacCap: CapDoiChieu[]): Promise<KetQuaDoiChieu> {
  const { data } = await http.post<KetQuaDoiChieu>('/tuition/doi-chieu/xac-nhan', { cacCap })
  return data
}

export async function layTongHopTheoGiaoVien(ky: KyHocPhi): Promise<TongHopTheoGiaoVien[]> {
  const { data } = await http.get<TongHopTheoGiaoVien[]>('/tuition/tong-hop', { params: ky })
  return data
}

/** Tên file do backend đặt (`hoc-phi-09-2026.xlsx`) nằm ở header Content-Disposition. */
function tenTepTuHeader(header: unknown): string | null {
  if (typeof header !== 'string') return null
  const khop = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)
  if (!khop) return null
  try {
    return decodeURIComponent(khop[1].trim())
  } catch {
    return khop[1].trim()
  }
}

/** Tải sổ học phí của kỳ dưới dạng .xlsx (3 sheet: chi tiết, tổng hợp theo giáo viên, phiếu thu). */
export async function xuatExcelHocPhi(ky: KyHocPhi): Promise<TepExcel> {
  const phanHoi = await http.get<Blob>('/tuition/xuat-excel', {
    params: ky,
    responseType: 'blob',
  })

  const header = (phanHoi.headers as unknown as Record<string, string | undefined>)[
    'content-disposition'
  ]

  return {
    blob: phanHoi.data,
    tenTep:
      tenTepTuHeader(header) ?? `hoc-phi-${String(ky.thang).padStart(2, '0')}-${ky.nam}.xlsx`,
  }
}

/* ---------------------------------- Hook ---------------------------------- */

/** Mọi thay đổi tiền nợ đều dọn cả nhánh `hoc-phi` (sổ kỳ, sắp đến hạn, chi tiết, chốt sổ, tổng hợp). */
function lamMoiHocPhi(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: HOC_PHI_QUERY_KEY })
}

export function useSoHocPhiKy(boLoc: BoLocHocPhi) {
  return useQuery({
    queryKey: [...HOC_PHI_QUERY_KEY, 'ky', boLoc],
    queryFn: () => laySoHocPhiKy(boLoc),
  })
}

export function useSapDenHan(soNgay: number) {
  return useQuery({
    queryKey: [...HOC_PHI_QUERY_KEY, 'sap-den-han', soNgay],
    queryFn: () => laySapDenHan(soNgay),
  })
}

/** Chi tiết chỉ hỏi khi đã chọn một dòng (`id` khác null). */
export function useChiTietHocPhi(id: string | null) {
  return useQuery({
    queryKey: [...HOC_PHI_QUERY_KEY, 'chi-tiet', id],
    queryFn: () => layChiTietHocPhi(id ?? ''),
    enabled: id !== null,
  })
}

export function useXemTruocChotSo(ky: KyHocPhi, bat: boolean) {
  return useQuery({
    queryKey: [...HOC_PHI_QUERY_KEY, 'chot-so-xem-truoc', ky],
    queryFn: () => xemTruocChotSo(ky),
    enabled: bat,
  })
}

export function useTongHopTheoGiaoVien(ky: KyHocPhi, bat: boolean) {
  return useQuery({
    queryKey: [...HOC_PHI_QUERY_KEY, 'tong-hop', ky],
    queryFn: () => layTongHopTheoGiaoVien(ky),
    enabled: bat,
  })
}

export function useTinhKyHocPhi() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: tinhKyHocPhi,
    onSuccess: () => {
      lamMoiHocPhi(queryClient)
    },
  })
}

export function useThuTienHocPhi(hocPhiId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (yeuCau: ThuTienYeuCau) => thuTienHocPhi(hocPhiId, yeuCau),
    onSuccess: () => {
      lamMoiHocPhi(queryClient)
    },
  })
}

export function useHuyPhieuThu() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ phieuThuId, lyDo }: { phieuThuId: string; lyDo: string }) =>
      huyPhieuThu(phieuThuId, lyDo),
    onSuccess: () => {
      lamMoiHocPhi(queryClient)
    },
  })
}

export function useChotSoHocPhi() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: chotSoHocPhi,
    onSuccess: () => {
      lamMoiHocPhi(queryClient)
    },
  })
}

export function useMoChotSoHocPhi() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: moChotSoHocPhi,
    onSuccess: () => {
      lamMoiHocPhi(queryClient)
    },
  })
}

export function usePhanTichDoiChieu() {
  return useMutation({
    mutationFn: phanTichDoiChieu,
  })
}

export function useXacNhanDoiChieu() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: xacNhanDoiChieu,
    onSuccess: () => {
      lamMoiHocPhi(queryClient)
    },
  })
}

export function useXuatExcelHocPhi() {
  return useMutation({
    mutationFn: xuatExcelHocPhi,
  })
}
