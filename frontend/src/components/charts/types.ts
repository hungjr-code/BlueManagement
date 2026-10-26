export interface ChartSegment {
  key: string
  label: string
  value: number
  color: string
  description?: string
}

export interface DayAttendanceData {
  key: string
  ngay: string
  thu: string
  soDiHoc: number
  soNghiCoPhep: number
  soNghiKhongPhep: number
  soChuaDiemDanh: number
  tongSo: number
}
