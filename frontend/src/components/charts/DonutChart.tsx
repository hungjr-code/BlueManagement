import { useMemo, useState } from 'react'
import { Flex, Tooltip, Typography } from 'antd'
import type { ChartSegment } from './types'

interface DonutChartProps {
  data: ChartSegment[]
  centerValue?: string | number
  centerLabel?: string
  centerSubtext?: string
  size?: number
  thickness?: number
  showLegend?: boolean
  legendPosition?: 'bottom' | 'right'
}

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  centerSubtext,
  size = 200,
  thickness = 26,
  showLegend = true,
  legendPosition = 'right',
}: DonutChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const total = data.reduce((sum, item) => sum + item.value, 0)
  const validData = useMemo(() => data.filter((item) => item.value > 0), [data])

  const cx = 100
  const cy = 100
  const outerR = 82
  const innerR = outerR - thickness

  // Compute angles for each segment
  const segmentsWithAngles = useMemo(() => {
    const cumulativeSums: number[] = [0]
    for (let i = 0; i < validData.length; i++) {
      cumulativeSums.push(cumulativeSums[i] + validData[i].value)
    }

    return validData.map((item, index) => {
      const fraction = total > 0 ? item.value / total : 0
      const startFraction = total > 0 ? cumulativeSums[index] / total : 0
      let delta = fraction * 2 * Math.PI
      if (validData.length === 1 && delta >= 2 * Math.PI) {
        // SVG arc cannot have start === end, keep 99.999%
        delta = 2 * Math.PI - 0.001
      }
      const startAngle = -Math.PI / 2 + startFraction * 2 * Math.PI
      const endAngle = startAngle + delta
      const percent = total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0

      return {
        ...item,
        startAngle,
        endAngle,
        fraction,
        percent,
      }
    })
  }, [validData, total])

  const renderPaths = () => {
    if (total === 0 || validData.length === 0) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={(outerR + innerR) / 2}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={thickness}
        />
      )
    }

    return segmentsWithAngles.map((item) => {
      const isHovered = hoveredKey === item.key
      const R = isHovered ? outerR + 3 : outerR
      const r = isHovered ? innerR - 2 : innerR

      const x1 = cx + R * Math.cos(item.startAngle)
      const y1 = cy + R * Math.sin(item.startAngle)
      const x2 = cx + R * Math.cos(item.endAngle)
      const y2 = cy + R * Math.sin(item.endAngle)

      const x3 = cx + r * Math.cos(item.endAngle)
      const y3 = cy + r * Math.sin(item.endAngle)
      const x4 = cx + r * Math.cos(item.startAngle)
      const y4 = cy + r * Math.sin(item.startAngle)

      const largeArc = item.endAngle - item.startAngle > Math.PI ? 1 : 0
      const d = `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${largeArc} 0 ${x4} ${y4} Z`

      const tooltipContent = (
        <div style={{ fontSize: 12 }}>
          <div style={{ fontWeight: 600 }}>{item.label}</div>
          <div>
            {item.value} buổi ({item.percent}%)
          </div>
          {item.description ? (
            <div style={{ opacity: 0.8, fontSize: 11 }}>{item.description}</div>
          ) : null}
        </div>
      )

      return (
        <Tooltip key={item.key} title={tooltipContent} placement="top">
          <path
            d={d}
            fill={item.color}
            stroke="#ffffff"
            strokeWidth={1.5}
            style={{
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              filter: isHovered ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.18))' : 'none',
              opacity: hoveredKey && !isHovered ? 0.6 : 1,
            }}
            onMouseEnter={() => {
              setHoveredKey(item.key)
            }}
            onMouseLeave={() => {
              setHoveredKey(null)
            }}
          />
        </Tooltip>
      )
    })
  }

  const legend = (
    <Flex
      vertical={legendPosition === 'right'}
      gap={legendPosition === 'right' ? 8 : 12}
      wrap="wrap"
      style={{
        minWidth: legendPosition === 'right' ? 170 : undefined,
        justifyContent: 'center',
      }}
    >
      {data.map((item) => {
        const percent = total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0
        const isHovered = hoveredKey === item.key

        return (
          <Flex
            key={item.key}
            align="center"
            gap={8}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              background: isHovered ? '#f1f5f9' : 'transparent',
              transition: 'background 0.15s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={() => {
              setHoveredKey(item.key)
            }}
            onMouseLeave={() => {
              setHoveredKey(null)
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: item.color,
                flexShrink: 0,
              }}
            />
            <Flex vertical style={{ lineHeight: 1.2 }}>
              <Typography.Text
                style={{
                  fontSize: 12.5,
                  fontWeight: isHovered ? 600 : 500,
                  color: isHovered ? '#0f172a' : '#475569',
                }}
              >
                {item.label}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {item.value} buổi · {percent}%
              </Typography.Text>
            </Flex>
          </Flex>
        )
      })}
    </Flex>
  )

  return (
    <Flex
      vertical={legendPosition === 'bottom'}
      align="center"
      justify="center"
      gap={legendPosition === 'bottom' ? 14 : 20}
      wrap="wrap"
    >
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        <svg
          viewBox="0 0 200 200"
          width={size}
          height={size}
          style={{ overflow: 'visible', transform: 'rotate(0deg)' }}
        >
          {renderPaths()}
        </svg>

        {/* Center label & percentage */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: 8,
          }}
        >
          {centerValue !== undefined ? (
            <span
              style={{
                fontSize: size >= 180 ? 24 : 18,
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              {centerValue}
            </span>
          ) : null}
          {centerLabel ? (
            <span
              style={{
                fontSize: size >= 180 ? 12 : 10.5,
                fontWeight: 500,
                color: '#64748b',
                marginTop: 2,
              }}
            >
              {centerLabel}
            </span>
          ) : null}
          {centerSubtext ? (
            <span
              style={{
                fontSize: 10,
                color: '#94a3b8',
                marginTop: 2,
              }}
            >
              {centerSubtext}
            </span>
          ) : null}
        </div>
      </div>

      {showLegend ? legend : null}
    </Flex>
  )
}
