import type { ReactNode } from 'react'
import { Flex, Typography } from 'antd'

interface PageHeaderProps {
  title: string
  description?: string
  extra?: ReactNode
}

/**
 * Tiêu đề trang dùng chung để mọi màn hình có cùng khoảng cách và cỡ chữ.
 *
 * Trước đây file này còn `ScaffoldPage` — khung màn hình kèm bảng "Trường dữ liệu" và danh sách
 * "Việc sẽ làm" từ thời còn viết đặc tả trước khi có API. Mọi màn hình đã nối API thật nên bảng đó
 * chỉ làm rối mắt người dùng; đã bỏ hẳn.
 */
export function PageHeader({ title, description, extra }: PageHeaderProps) {
  return (
    <Flex align="flex-start" justify="space-between" gap={16} wrap style={{ marginBottom: 20 }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {description ? (
          <Typography.Text type="secondary">{description}</Typography.Text>
        ) : null}
      </div>
      {extra}
    </Flex>
  )
}
