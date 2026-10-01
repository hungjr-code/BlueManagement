/**
 * Kiểu dữ liệu dùng chung cho tầng API. Đặt riêng ở đây để `http.ts` và các module khác cùng dùng
 * mà không import lẫn nhau (import vòng làm hỏng thứ tự khởi tạo).
 *
 * Các giá trị chuỗi ("admin", "giao_vien", "theo_buoi", "thu_2"…) PHẢI khớp với enum ở backend
 * (backend/ClassManagement.Api/Entities/Enums.cs). Sửa một bên là phải sửa cả hai.
 */

/* ----------------------------- Tài khoản ----------------------------- */

export type VaiTro = 'admin' | 'giao_vien'

export type TrangThaiGiaoVien = 'dang_lam' | 'tam_nghi' | 'da_nghi'

export interface TaiKhoanNhanTien {
  nganHangBin: string | null
  soTaiKhoan: string | null
  chuTaiKhoan: string | null
  /** Đã khai đủ ngân hàng và số tài khoản để sinh mã QR chưa. */
  daCauHinh: boolean
}

export interface NguoiDung {
  id: string
  hoTen: string
  email: string
  vaiTro: VaiTro
  trangThai: TrangThaiGiaoVien
  /** Tài khoản nhận tiền của chính người đang đăng nhập. */
  taiKhoanNhanTien: TaiKhoanNhanTien
}

export interface KetQuaDangNhap {
  accessToken: string
  hetHanUtc: string
  nguoiDung: NguoiDung
}

/* ------------------------------ Giáo viên ------------------------------ */

export interface GiaoVien {
  id: string
  hoTen: string
  email: string
  soDienThoai: string | null
  vaiTro: VaiTro
  trangThai: TrangThaiGiaoVien
  ngayThamGia: string
  ghiChu: string | null
  /** Đếm từ bảng học sinh, không nhập tay. */
  soHocSinhDangPhuTrach: number
  /** Đếm từ điểm danh trong tháng hiện tại (chỉ buổi đi học). */
  soBuoiDayTrongThang: number
}

export interface TaoGiaoVien {
  hoTen: string
  email: string
  soDienThoai?: string | null
  vaiTro?: VaiTro
  matKhauTamThoi: string
  ngayThamGia?: string | null
  ghiChu?: string | null
}

export interface SuaGiaoVien {
  hoTen: string
  soDienThoai?: string | null
  vaiTro: VaiTro
  trangThai: TrangThaiGiaoVien
  ngayThamGia?: string | null
  ghiChu?: string | null
}

/* ------------------------------ Học sinh ------------------------------ */

export type CachTinhHocPhi = 'theo_buoi' | 'theo_thang'

export type TrangThaiHocSinh = 'dang_hoc' | 'tam_nghi' | 'da_nghi'

/** Thứ trong tuần theo ISO-8601, khớp backend: thu_2 … chu_nhat. */
export type ThuTrongTuan = 'thu_2' | 'thu_3' | 'thu_4' | 'thu_5' | 'thu_6' | 'thu_7' | 'chu_nhat'

export interface KhungGioHoc {
  id: string
  thu: ThuTrongTuan
  /** Dạng "18:00:00" theo TimeOnly của .NET. */
  gioBatDau: string
  gioKetThuc: string
}

export interface HocSinh {
  id: string
  hoTen: string
  giaoVienId: string
  tenGiaoVien: string
  cachTinhHocPhi: CachTinhHocPhi
  donGiaTheoBuoi: number | null
  hocPhiTheoThang: number | null
  soBuoiMoiTuan: number
  ngayDenHanDongTien: number
  ngayBatDau: string
  phuHuynh: string | null
  soDienThoaiPhuHuynh: string | null
  /** Lớp/nhóm học, ví dụ "Lớp 9" — hiện trên ô lịch cạnh tên học sinh. */
  lop: string | null
  ghiChu: string | null
  trangThai: TrangThaiHocSinh
  lichHoc: KhungGioHoc[]
  ngayCapNhatUtc: string
}

export interface KhungGioHocYeuCau {
  thu: ThuTrongTuan
  gioBatDau: string
  gioKetThuc: string
}

export interface TaoHocSinh {
  hoTen: string
  giaoVienId?: string | null
  cachTinhHocPhi: CachTinhHocPhi
  donGiaTheoBuoi?: number | null
  hocPhiTheoThang?: number | null
  soBuoiMoiTuan: number
  lichHoc: KhungGioHocYeuCau[]
  ngayDenHanDongTien: number
  ngayBatDau: string
  phuHuynh?: string | null
  soDienThoaiPhuHuynh?: string | null
  lop?: string | null
  ghiChu?: string | null
  trangThai?: TrangThaiHocSinh
  /** Gửi lại với true khi người dùng đã xác nhận trùng tên (lần đầu backend trả 409). */
  boQuaCanhBaoTrungTen?: boolean
}

export type SuaHocSinh = Omit<TaoHocSinh, 'boQuaCanhBaoTrungTen'>

export interface BoLocHocSinh {
  tuKhoa?: string
  giaoVienId?: string
  trangThai?: TrangThaiHocSinh
  trang?: number
  kichThuoc?: number
}

/* ------------------------ Buổi học và điểm danh ------------------------ */

export type TrangThaiDiemDanh = 'chua_diem_danh' | 'di_hoc' | 'nghi'

export type LyDoNghi = 'co_phep' | 'khong_phep'

export interface BuoiHoc {
  id: string
  hocSinhId: string
  tenHocSinh: string
  /** Lớp/nhóm học của học sinh, backend gửi kèm để ô lịch không phải gọi thêm API. */
  lopHocSinh: string | null
  giaoVienId: string
  tenGiaoVien: string
  ngay: string
  gioBatDau: string
  gioKetThuc: string
  laBuoiDayBu: boolean
  trangThai: TrangThaiDiemDanh
  lyDoNghi: LyDoNghi | null
  ghiChu: string | null
  coTinhTien: boolean
  thoiLuongThucTePhut: number | null
  nguoiDiemDanh: string | null
  thoiDiemDiemDanhUtc: string | null
  /** Buổi này đã có sự kiện tương ứng trên Google Calendar chưa. */
  daDongBoGoogle: boolean
  googleDongBoUtc: string | null
}

export interface TongHopDiemDanh {
  id: string
  ten: string
  soBuoi: number
  soDiHoc: number
  soNghiCoPhep: number
  soNghiKhongPhep: number
  soChuaDiemDanh: number
}

export interface DanhSachBuoiHoc {
  tuNgay: string
  denNgay: string
  duLieu: BuoiHoc[]
  tongHopTheoHocSinh: TongHopDiemDanh[]
  tongHopTheoGiaoVien: TongHopDiemDanh[]
}

export interface BoLocBuoiHoc {
  tuNgay?: string
  denNgay?: string
  hocSinhId?: string
  giaoVienId?: string
  trangThai?: TrangThaiDiemDanh
}

/** Một dòng trong lần lưu điểm danh theo lô. */
export interface LuuDiemDanhItem {
  buoiHocId: string
  trangThai: TrangThaiDiemDanh
  lyDoNghi?: LyDoNghi | null
  ghiChu?: string | null
  /** Bỏ trống thì backend suy ra: đi học tính tiền, nghỉ không tính. */
  coTinhTien?: boolean | null
  thoiLuongThucTePhut?: number | null
}

export interface KetQuaLuuDiemDanh {
  soBuoiDaLuu: number
  soBuoiGhiNhatKy: number
}

export interface BuoiDayBu {
  hocSinhId: string
  ngay: string
  gioBatDau: string
  gioKetThuc: string
  ghiChu?: string | null
}

/* ------------------------------- Tổng quan ------------------------------- */

export interface HomNay {
  ngay: string
  soBuoi: number
  soDaDiemDanh: number
  soChuaDiemDanh: number
  duLieu: BuoiHoc[]
}

export interface TuanNay {
  tuNgay: string
  denNgay: string
  soBuoi: number
  soDiHoc: number
  soNghiCoPhep: number
  soNghiKhongPhep: number
  soChuaDiemDanh: number
  /** Con số dự kiến để nhìn nhanh, không phải công nợ thật (công nợ ở Phase 4). */
  hocPhiDuKienThangNay: number
  duLieu: BuoiHoc[]
  tongHopTheoHocSinh: TongHopDiemDanh[]
  tongHopTheoGiaoVien: TongHopDiemDanh[]
}

/* ------------------------------ Google Calendar ------------------------------ */

/** Kết quả một lần đồng bộ lịch dạy lên Google Calendar. */
export interface KetQuaDongBo {
  soTao: number
  soCapNhat: number
  soXoa: number
  soBoQua: number
  thoiDiemUtc: string
  loi: string | null
}

export interface TrangThaiGoogle {
  /** Backend đã có Client ID/Secret (hoặc đang chạy chế độ giả) chưa. */
  daCauHinh: boolean
  /** true = dùng khách Google giả, chỉ có ở máy dev, KHÔNG gọi Google thật. */
  cheDoGia: boolean
  daKetNoi: boolean
  /** Email Google đang liên kết. */
  taiKhoan: string | null
  calendarId: string | null
  /** Quyền backend sẽ xin — hiện trước khi người dùng bấm kết nối. */
  quyen: string[]
  lanDongBoCuoi: KetQuaDongBo | null
}

export interface DuongDanUyQuyen {
  url: string
  quyen: string[]
  cheDoGia: boolean
}

export interface LichGoogle {
  id: string
  ten: string
  laLichChinh: boolean
}

/* ------------------------------ Cài đặt chung ------------------------------ */

export interface CaiDat {
  mauNoiDungChuyenKhoan: string | null
  vaiTroMacDinh: VaiTro
  nguongCanhBaoSoHocSinh: number
  googleTaiKhoan: string | null
  googleCalendarId: string | null
  googleDaKetNoi: boolean
  muiGio: string
  nhacTruocBaoLauPhut: number
  gioGuiThongBaoHomNay: string
  batThongBaoHomNay: boolean
  kyTuTienTe: string
  dinhDangNgay: string
  /** Số giáo viên đang làm đã khai tài khoản nhận tiền. Chỉ admin thấy; giáo viên nhận null. */
  soGiaoVienDaKhaiTaiKhoanNhanTien: number | null
  /** Số giáo viên đang làm chưa khai tài khoản nhận tiền. Chỉ admin thấy. */
  soGiaoVienChuaKhaiTaiKhoanNhanTien: number | null
  /** Tên những giáo viên chưa khai, để admin biết nhắc ai. Không kèm số tài khoản của ai. */
  tenGiaoVienChuaKhaiTaiKhoanNhanTien: string[] | null
  ngayCapNhatUtc: string
}

export interface SuaCaiDat {
  mauNoiDungChuyenKhoan?: string | null
  nguongCanhBaoSoHocSinh?: number
  googleCalendarId?: string | null
  muiGio?: string
  nhacTruocBaoLauPhut?: number
  gioGuiThongBaoHomNay?: string
  batThongBaoHomNay?: boolean
  kyTuTienTe?: string
  dinhDangNgay?: string
}

/* -------------------------------- Dùng chung -------------------------------- */

/** Kết quả phân trang mà mọi endpoint danh sách trả về. */
export interface KetQuaPhanTrang<T> {
  duLieu: T[]
  tongSo: number
  trang: number
  kichThuoc: number
}
