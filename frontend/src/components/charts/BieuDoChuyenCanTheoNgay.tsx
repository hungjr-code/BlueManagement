import { useMemo } from 'react'
import { Card, Flex, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import type { BuoiHoc } from '../../api/types'
import { StackedBarChart } from './StackedBarChart'
import type { DayAttendanceData } from './types'

interface BieuDoChuyenCanTheoNgayProps {
  buoiHoc: BuoiHoc[]
  tuNgay?: string
  denNgay?: string
  title?: string
  subTitle?: string
}

const NHAN_THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

export function BieuDoChuyenCanTheoNgay({
  buoiHoc,
  tuNgay,
  denNgay,
  title = 'Phân bổ điểm danh theo ngày',
  subTitle,
}: BieuDoChuyenCanTheoNgayProps) {
  const duLieuNgay = useMemo<DayAttendanceData[]>(() => {
    // If tuNgay and denNgay are provided, generate sequence of days
    if (tuNgay && denNgay) {
      const start = dayjs(tuNgay)
      const end = dayjs(denNgay)
      const diff = end.diff(start, 'day')

      if (diff >= 0 && diff <= 14) {
        const days: DayAttendanceData[] = []
        for (let i = 0; i <= diff; i++) {
          const current = start.add(i, 'day')
          const dateStr = current.format('YYYY-MM-DD')
          const daySessions = buoiHoc.filter((b) => b.ngay === dateStr)

          const soDiHoc = daySessions.filter((b) => b.trangThai === 'di_hoc').length
          const soNghiCoPhep = daySessions.filter(
            (b) => b.trangThai === 'nghi' && b.lyDoNghi === 'co_phep',
          ).length
          const soNghiKhongPhep = daySessions.filter(
            (b) => b.trangThai === 'nghi' && b.lyDoNghi !== 'co_phep',
          ).length
          const soChuaDiemDanh = daySessions.filter(
            (b) => b.trangThai === 'chua_diem_danh',
          ).length

          days.push({
            key: dateStr,
            ngay: current.format('DD/MM'),
            thu: NHAN_THU[current.day()],
            soDiHoc,
            soNghiCoPhep,
            soNghiKhongPhep,
            soChuaDiemDanh,
            tongSo: daySessions.length,
          })
        }
        return days
      }
    }

    // Otherwise group by unique dates found in buoiHoc
    const map = new Map<string, BuoiHoc[]>()
    for (const b of buoiHoc) {
      const list = map.get(b.ngay) ?? []
      list.push(b)
      map.set(b.ngay, list)
    }

    const sortedDates = Array.from(map.keys()).sort()
    return sortedDates.map((dateStr) => {
      const current = dayjs(dateStr)
      const daySessions = map.get(dateStr) ?? []
      const soDiHoc = daySessions.filter((b) => b.trangThai === 'di_hoc').length
      const soNghiCoPhep = daySessions.filter(
        (b) => b.trangThai === 'nghi' && b.lyDoNghi === 'co_phep',
      ).length
      const soNghiKhongPhep = daySessions.filter(
        (b) => b.trangThai === 'nghi' && b.lyDoNghi !== 'co_phep',
      ).length
      const soChuaDiemDanh = daySessions.filter(
        (b) => b.trangThai === 'chua_diem_danh',
      ).length

      return {
        key: dateStr,
        ngay: current.format('DD/MM'),
        thu: NHAN_THU[current.day()],
        soDiHoc,
        soNghiCoPhep,
        soNghiKhongPhep,
        soChuaDiemDanh,
        tongSo: daySessions.length,
      }
    })
  }, [buoiHoc, tuNgay, denNgay])

  const tongBuoi = buoiHoc.length
  const soDiHoc = buoiHoc.filter((b) => b.trangThai === 'di_hoc').length
  const soNghi = buoiHoc.filter((b) => b.trangThai === 'nghi').length

  return (
    <Card
      size="small"
      title={
        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
          <Flex vertical>
            <Typography.Text strong style={{ fontSize: 14 }}>
              {title}
            </Typography.Text>
            {subTitle ? (
              <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                {subTitle}
              </Typography.Text>
            ) : null}
          </Flex>
          <Space size={6}>
            <Tag color="blue">{tongBuoi} buổi</Tag>
            {soDiHoc > 0 ? <Tag color="success">{soDiHoc} đi học</Tag> : null}
            {soNghi > 0 ? <Tag color="error">{soNghi} vắng</Tag> : null}
          </Space>
        </Flex>
      }
      style={{ height: '100%' }}
    >
      <StackedBarChart data={duLieuNgay} height={180} />
    </Card>
  )
}
