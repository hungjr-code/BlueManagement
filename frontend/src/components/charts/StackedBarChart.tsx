import { useState } from 'react'
import { Empty, Flex, Tooltip, Typography } from 'antd'
import type { DayAttendanceData } from './types'

interface StackedBarChartProps {
  data: DayAttendanceData[]
  height?: number
  title?: string
}

const COLORS = {
  diHoc: '#52c41a',
  nghiCoPhep: '#faad14',
  nghiKhongPhep: '#ff4d4f',
  chuaDiemDanh: '#cbd5e1',
}

export function StackedBarChart({ data, height = 180, title }: StackedBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const maxTotal = Math.max(...data.map((d) => d.tongSo), 1)
  const hasData = data.some((d) => d.tongSo > 0)

  if (!hasData) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Chưa có dữ liệu buổi học trong khoảng này"
      />
    )
  }

  return (
    <Flex vertical gap={8} style={{ width: '100%' }}>
      {title ? (
        <Typography.Text strong style={{ fontSize: 13, color: '#334155' }}>
          {title}
        </Typography.Text>
      ) : null}

      {/* Legend */}
      <Flex gap={12} wrap style={{ fontSize: 11.5, color: '#64748b' }}>
        <Flex align="center" gap={4}>
          <span
            style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS.diHoc }}
          />
          <span>Đi học</span>
        </Flex>
        <Flex align="center" gap={4}>
          <span
            style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS.nghiCoPhep }}
          />
          <span>Nghỉ có phép</span>
        </Flex>
        <Flex align="center" gap={4}>
          <span
            style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS.nghiKhongPhep }}
          />
          <span>Nghỉ không phép</span>
        </Flex>
        <Flex align="center" gap={4}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: COLORS.chuaDiemDanh,
            }}
          />
          <span>Chưa điểm danh</span>
        </Flex>
      </Flex>

      {/* Chart container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height,
          paddingTop: 24,
          paddingBottom: 8,
          borderBottom: '1px solid #e2e8f0',
          gap: 8,
        }}
      >
        {data.map((item, index) => {
          const isHovered = hoveredIndex === index
          const barHeightPercent = item.tongSo > 0 ? (item.tongSo / maxTotal) * 100 : 0

          const pDiHoc = item.tongSo > 0 ? (item.soDiHoc / item.tongSo) * 100 : 0
          const pNghiCP = item.tongSo > 0 ? (item.soNghiCoPhep / item.tongSo) * 100 : 0
          const pNghiKP = item.tongSo > 0 ? (item.soNghiKhongPhep / item.tongSo) * 100 : 0
          const pChuaDD = item.tongSo > 0 ? (item.soChuaDiemDanh / item.tongSo) * 100 : 0

          const tiLeDiHoc =
            item.soDiHoc + item.soNghiCoPhep + item.soNghiKhongPhep > 0
              ? Math.round(
                  (item.soDiHoc / (item.soDiHoc + item.soNghiCoPhep + item.soNghiKhongPhep)) * 100,
                )
              : null

          const tooltipContent = (
            <div style={{ fontSize: 12, minWidth: 150 }}>
              <div style={{ fontWeight: 600, borderBottom: '1px solid #334155', paddingBottom: 4, marginBottom: 4 }}>
                {item.thu} ({item.ngay})
              </div>
              <div>Tổng cộng: <b>{item.tongSo} buổi</b></div>
              <div style={{ color: '#86efac' }}>• Đi học: {item.soDiHoc} buổi</div>
              <div style={{ color: '#fde047' }}>• Nghỉ có phép: {item.soNghiCoPhep} buổi</div>
              <div style={{ color: '#fca5a5' }}>• Nghỉ không phép: {item.soNghiKhongPhep} buổi</div>
              <div style={{ color: '#cbd5e1' }}>• Chưa điểm danh: {item.soChuaDiemDanh} buổi</div>
              {tiLeDiHoc !== null ? (
                <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed #475569', fontWeight: 600 }}>
                  Tỷ lệ đi học: {tiLeDiHoc}%
                </div>
              ) : null}
            </div>
          )

          return (
            <Tooltip key={item.key} title={tooltipContent} placement="top">
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                onMouseEnter={() => {
                  setHoveredIndex(index)
                }}
                onMouseLeave={() => {
                  setHoveredIndex(null)
                }}
              >
                {/* Total label above bar */}
                {item.tongSo > 0 ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isHovered ? '#1e293b' : '#64748b',
                      marginBottom: 4,
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {item.tongSo}
                  </span>
                ) : null}

                {/* Stacked bar */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: 36,
                    height: `${Math.max(barHeightPercent, item.tongSo > 0 ? 8 : 2)}%`,
                    borderRadius: '6px 6px 2px 2px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    backgroundColor: item.tongSo === 0 ? '#f1f5f9' : 'transparent',
                    boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                    transform: isHovered ? 'scaleY(1.03)' : 'none',
                    transformOrigin: 'bottom',
                    transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {item.soDiHoc > 0 ? (
                    <div
                      style={{
                        height: `${pDiHoc}%`,
                        backgroundColor: COLORS.diHoc,
                      }}
                    />
                  ) : null}
                  {item.soNghiCoPhep > 0 ? (
                    <div
                      style={{
                        height: `${pNghiCP}%`,
                        backgroundColor: COLORS.nghiCoPhep,
                      }}
                    />
                  ) : null}
                  {item.soNghiKhongPhep > 0 ? (
                    <div
                      style={{
                        height: `${pNghiKP}%`,
                        backgroundColor: COLORS.nghiKhongPhep,
                      }}
                    />
                  ) : null}
                  {item.soChuaDiemDanh > 0 ? (
                    <div
                      style={{
                        height: `${pChuaDD}%`,
                        backgroundColor: COLORS.chuaDiemDanh,
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </Tooltip>
          )
        })}
      </div>

      {/* X-axis labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        {data.map((item, index) => {
          const isHovered = hoveredIndex === index
          return (
            <div
              key={item.key}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onMouseEnter={() => {
                setHoveredIndex(index)
              }}
              onMouseLeave={() => {
                setHoveredIndex(null)
              }}
            >
              <Typography.Text
                style={{
                  fontSize: 12,
                  fontWeight: isHovered ? 700 : 600,
                  color: isHovered ? '#1d4ed8' : '#334155',
                }}
              >
                {item.thu}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 10.5 }}>
                {item.ngay}
              </Typography.Text>
            </div>
          )
        })}
      </div>
    </Flex>
  )
}
