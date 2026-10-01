import { useState } from 'react'
import { Alert, Button, Flex, Form, Input, Result, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/http'
import { datLaiMatKhau } from '../../api/auth'
import { KhungTaiKhoan } from './khungTach'

interface GiaTriDatLai {
  matKhauMoi: string
  xacNhan: string
}

/**
 * Đặt mật khẩu mới bằng mã trong thư. Mã chỉ dùng được một lần và hết hạn sau 30 phút.
 * Đổi xong thì backend thu hồi mọi phiên đang mở, nên phải đăng nhập lại bằng mật khẩu mới.
 */
export function ResetPasswordPage() {
  const [thamSo] = useSearchParams()
  const navigate = useNavigate()
  const [dangGui, setDangGui] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [xong, setXong] = useState(false)

  const ma = thamSo.get('token')

  const gui = async (giaTri: GiaTriDatLai) => {
    if (!ma) return
    setDangGui(true)
    setLoi(null)
    try {
      await datLaiMatKhau(ma, giaTri.matKhauMoi)
      setXong(true)
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      setLoi(theoField.length > 0 ? theoField.join(' · ') : (loiApi?.message ?? 'Không đặt được mật khẩu mới'))
    } finally {
      setDangGui(false)
    }
  }

  if (!ma) {
    return (
      <KhungTaiKhoan tieuDe="Đặt lại mật khẩu" moTa="Liên kết này thiếu mã đặt lại mật khẩu.">
        <Result
          status="error"
          title="Liên kết không hợp lệ"
          subTitle="Nên mở liên kết đúng từ thư đặt lại mật khẩu, hoặc xin một thư mới."
          extra={[
            <Link key="quen" to="/quen-mat-khau">
              <Button type="primary">Xin thư mới</Button>
            </Link>,
          ]}
        />
      </KhungTaiKhoan>
    )
  }

  if (xong) {
    return (
      <KhungTaiKhoan tieuDe="Đặt lại mật khẩu" moTa="Mật khẩu đã được đổi.">
        <Result
          status="success"
          title="Đã đặt mật khẩu mới"
          subTitle="Vì an toàn, mọi phiên đang mở của tài khoản này đã bị đăng xuất hết. Đăng nhập lại bằng mật khẩu mới."
          extra={[
            <Button
              key="dang-nhap"
              type="primary"
              onClick={() => {
                navigate('/login', { replace: true })
              }}
            >
              Về trang đăng nhập
            </Button>,
          ]}
        />
      </KhungTaiKhoan>
    )
  }

  return (
    <KhungTaiKhoan tieuDe="Đặt mật khẩu mới" moTa="Mật khẩu mới dùng để đăng nhập bằng email.">
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

      <Form<GiaTriDatLai>
        layout="vertical"
        requiredMark={false}
        onFinish={(giaTri) => {
          void gui(giaTri)
        }}
      >
        <Form.Item
          label="Mật khẩu mới"
          name="matKhauMoi"
          rules={[
            { required: true, message: 'Nhập mật khẩu mới' },
            { min: 8, message: 'Mật khẩu phải từ 8 ký tự' },
          ]}
          extra="Từ 8 ký tự, có ít nhất một chữ số."
        >
          <Input.Password
            size="large"
            prefix={<LockOutlined style={{ marginInlineEnd: 6 }} />}
            placeholder="Mật khẩu mới"
            autoComplete="new-password"
            autoFocus
          />
        </Form.Item>

        <Form.Item
          label="Nhập lại mật khẩu mới"
          name="xacNhan"
          dependencies={['matKhauMoi']}
          rules={[
            { required: true, message: 'Nhập lại mật khẩu mới' },
            ({ getFieldValue }) => ({
              validator: (_, giaTri: string) =>
                !giaTri || getFieldValue('matKhauMoi') === giaTri
                  ? Promise.resolve()
                  : Promise.reject(new Error('Hai lần nhập mật khẩu không giống nhau')),
            }),
          ]}
        >
          <Input.Password
            size="large"
            prefix={<LockOutlined style={{ marginInlineEnd: 6 }} />}
            placeholder="Nhập lại mật khẩu mới"
            autoComplete="new-password"
          />
        </Form.Item>

        <Button type="primary" size="large" htmlType="submit" block loading={dangGui}>
          Đặt mật khẩu mới
        </Button>
      </Form>

      <Flex justify="center" gap={6} style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">Liên kết hết hạn?</Typography.Text>
        <Link to="/quen-mat-khau">Xin thư mới</Link>
      </Flex>
    </KhungTaiKhoan>
  )
}
