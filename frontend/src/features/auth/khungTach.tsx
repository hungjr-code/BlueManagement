import type { ReactNode } from 'react'
import { Card, Flex, Typography } from 'antd'
import { env } from '../../config/env'

/**
 * Khung chung cho các màn hình tài khoản (đăng nhập, đăng ký, quên mật khẩu, đặt lại mật khẩu):
 * một thẻ giữa màn hình, tiêu đề và mô tả ngắn. Giữ ở một chỗ để bốn màn hình không lệch nhau.
 */
export function KhungTaiKhoan({ tieuDe, moTa, children }: { tieuDe: string; moTa: string; children: ReactNode }) {
  return (
    <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 16 }}>
      <Card style={{ width: 420 }} variant="outlined">
        <Flex vertical gap={4} style={{ marginBottom: 20 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {env.appName}
          </Typography.Title>
          <Typography.Text strong>{tieuDe}</Typography.Text>
          <Typography.Text type="secondary">{moTa}</Typography.Text>
        </Flex>
        {children}
      </Card>
    </Flex>
  )
}
