import type { ReactNode } from 'react'
import { Card, Flex, Typography } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import { env } from '../../config/env'

/**
 * Khung chung cho các màn hình xác thực (đăng nhập, đăng ký, quên mật khẩu, đặt lại mật khẩu).
 */
export function KhungTaiKhoan({
  tieuDe,
  moTa,
  children,
}: {
  tieuDe: string
  moTa: string
  children: ReactNode
}) {
  return (
    <Flex
      align="center"
      justify="center"
      style={{
        minHeight: '100vh',
        padding: 24,
        background: 'linear-gradient(180deg, #F0F5FD 0%, #F8FAFD 100%)',
      }}
    >
      <Card
        style={{
          width: 420,
          borderRadius: 16,
          border: '1px solid #E6EDF5',
          boxShadow: '0 8px 30px -4px rgba(91, 141, 239, 0.12)',
        }}
        variant="outlined"
      >
        <Flex vertical gap={6} align="center" style={{ marginBottom: 24, textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#EDF4FD',
              color: '#4377D9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              marginBottom: 4,
            }}
          >
            <CalendarOutlined />
          </div>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {env.appName}
          </Typography.Title>
          <Typography.Text strong style={{ fontSize: 16, color: '#334155' }}>
            {tieuDe}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13, maxWidth: 320 }}>
            {moTa}
          </Typography.Text>
        </Flex>
        {children}
      </Card>
    </Flex>
  )
}
