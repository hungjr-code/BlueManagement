import type { ReactNode } from 'react'
import { Flex, Typography } from 'antd'

interface PageHeaderProps {
  title: string
  description?: string
  extra?: ReactNode
}

/**
 * Tiêu đề trang dùng chung để mọi màn hình có khoảng cách và phân cấp typography tối giản, đồng bộ.
 */
export function PageHeader({ title, description, extra }: PageHeaderProps) {
  return (
    <Flex align="flex-start" justify="space-between" gap={16} wrap style={{ marginBottom: 24 }}>
      <div>
        <Typography.Title
          level={4}
          style={{
            margin: 0,
            fontWeight: 600,
            fontSize: 20,
            letterSpacing: '-0.015em',
            color: '#0F172A',
          }}
        >
          {title}
        </Typography.Title>
        {description ? (
          <Typography.Text
            type="secondary"
            style={{ fontSize: 13, color: '#64748B', display: 'inline-block', marginTop: 2 }}
          >
            {description}
          </Typography.Text>
        ) : null}
      </div>
      {extra ? <div style={{ display: 'flex', alignItems: 'center' }}>{extra}</div> : null}
    </Flex>
  )
}
