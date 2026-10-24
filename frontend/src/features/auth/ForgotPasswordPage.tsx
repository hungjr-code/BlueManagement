import { useState } from 'react'
import { Alert, Button, Flex, Form, Input, Result, Typography } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/http'
import { quenMatKhau } from '../../api/auth'
import { KhungTaiKhoan } from './khungTach'

/**
 * Yêu cầu đặt lại mật khẩu qua email.
 */
export function ForgotPasswordPage() {
  const [dangGui, setDangGui] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [daGui, setDaGui] = useState(false)

  const gui = async (giaTri: { email: string }) => {
    setDangGui(true)
    setLoi(null)
    try {
      await quenMatKhau(giaTri.email.trim())
      setDaGui(true)
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      setLoi(theoField.length > 0 ? theoField.join(' · ') : (loiApi?.message ?? 'Không gửi được yêu cầu'))
    } finally {
      setDangGui(false)
    }
  }

  if (daGui) {
    return (
      <KhungTaiKhoan tieuDe="Kiểm tra hộp thư" moTa="Yêu cầu đặt lại mật khẩu đã được ghi nhận">
        <Result
          status="success"
          title="Đã gửi thư hướng dẫn"
          subTitle="Vui lòng kiểm tra hộp thư (kể cả thư mục spam) để nhận liên kết đặt lại mật khẩu trong 30 phút."
          extra={[
            <Link key="dang-nhap" to="/login">
              <Button type="primary">Về trang đăng nhập</Button>
            </Link>,
          ]}
        />
      </KhungTaiKhoan>
    )
  }

  return (
    <KhungTaiKhoan
      tieuDe="Quên mật khẩu"
      moTa="Nhập email của bạn để nhận liên kết đặt lại mật khẩu"
    >
      {loi ? (
        <Alert
          type="error"
          showIcon
          message={loi}
          style={{ marginBottom: 16 }}
          closable
          onClose={() => {
            setLoi(null)
          }}
        />
      ) : null}

      <Form<{ email: string }>
        layout="vertical"
        requiredMark={false}
        onFinish={(giaTri) => {
          void gui(giaTri)
        }}
      >
        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: 'Nhập email' },
            { type: 'email', message: 'Email không hợp lệ' },
          ]}
        >
          <Input
            size="large"
            prefix={<MailOutlined style={{ color: '#94A3B8', marginInlineEnd: 6 }} />}
            placeholder="ten@trungtam.vn"
            autoComplete="username"
            autoFocus
          />
        </Form.Item>

        <Button type="primary" size="large" htmlType="submit" block loading={dangGui}>
          Gửi yêu cầu
        </Button>
      </Form>

      <Flex justify="center" gap={6} style={{ marginTop: 20 }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>Nhớ lại mật khẩu?</Typography.Text>
        <Link to="/login" style={{ fontSize: 13 }}>Đăng nhập</Link>
      </Flex>
    </KhungTaiKhoan>
  )
}
