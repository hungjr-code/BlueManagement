import { useState } from 'react'
import { Alert, Button, Flex, Form, Input, Result, Typography } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../../api/http'
import { layTuyChonDangNhap, quenMatKhau } from '../../api/auth'
import { KhungTaiKhoan } from './khungTach'

/**
 * Xin thư đặt lại mật khẩu.
 *
 * Câu trả lời CỐ TÌNH giống nhau dù email có tài khoản hay không — nói khác nhau là để người ngoài
 * dò ra email nào đã đăng ký trong hệ thống.
 */
export function ForgotPasswordPage() {
  const tuyChon = useQuery({
    queryKey: ['tuy-chon-dang-nhap'],
    queryFn: layTuyChonDangNhap,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
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
      <KhungTaiKhoan tieuDe="Kiểm tra hộp thư" moTa="Yêu cầu đặt lại mật khẩu đã được ghi nhận.">
        <Result
          status="success"
          title="Nếu email này có tài khoản, thư hướng dẫn đã được gửi"
          subTitle="Thư có liên kết đặt lại mật khẩu, dùng được một lần trong 30 phút. Kiểm tra cả hộp thư rác nếu không thấy."
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
      moTa="Nhập email của tài khoản, hệ thống sẽ gửi thư để bạn đặt mật khẩu mới."
    >
      {tuyChon.data?.emailCheDoGia ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Chế độ giả của máy dev — thư không đi đâu cả"
          description="Máy chủ đang bật Email:CheDoGia nên thư đặt lại mật khẩu chỉ nằm trong bộ nhớ của máy chủ, không tới hộp thư của bạn. Muốn thử đường thật thì cấu hình SMTP rồi tắt CheDoGia."
        />
      ) : null}

      {tuyChon.data != null && !tuyChon.data.emailDaCauHinh && !tuyChon.data.emailCheDoGia ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Máy chủ chưa cấu hình gửi thư"
          description="Chưa có Email:SmtpHost và Email:TuDiaChi nên hệ thống không gửi được thư đặt lại mật khẩu. Nhờ quản trị máy chủ cấu hình SMTP (xem README backend)."
        />
      ) : null}

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
            prefix={<MailOutlined style={{ marginInlineEnd: 6 }} />}
            placeholder="ten@trungtam.vn"
            autoComplete="username"
            autoFocus
          />
        </Form.Item>

        <Button type="primary" size="large" htmlType="submit" block loading={dangGui}>
          Gửi thư đặt lại mật khẩu
        </Button>
      </Form>

      <Flex justify="center" gap={6} style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">Nhớ ra mật khẩu rồi?</Typography.Text>
        <Link to="/login">Đăng nhập</Link>
      </Flex>
    </KhungTaiKhoan>
  )
}
