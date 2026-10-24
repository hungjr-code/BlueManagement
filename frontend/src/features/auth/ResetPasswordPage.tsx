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
 * Đặt mật khẩu mới.
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
      <KhungTaiKhoan tieuDe="Đặt lại mật khẩu" moTa="Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn">
        <Result
          status="error"
          title="Liên kết không hợp lệ"
          subTitle="Vui lòng kiểm tra lại liên kết trong email hoặc gửi lại yêu cầu mới."
          extra={[
            <Link key="quen" to="/quen-mat-khau">
              <Button type="primary">Gửi lại yêu cầu</Button>
            </Link>,
          ]}
        />
      </KhungTaiKhoan>
    )
  }

  if (xong) {
    return (
      <KhungTaiKhoan tieuDe="Đặt lại mật khẩu" moTa="Mật khẩu của bạn đã được cập nhật thành công">
        <Result
          status="success"
          title="Đổi mật khẩu thành công"
          subTitle="Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ."
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
    <KhungTaiKhoan tieuDe="Đặt mật khẩu mới" moTa="Thiết lập mật khẩu mới cho tài khoản của bạn">
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
            prefix={<LockOutlined style={{ color: '#94A3B8', marginInlineEnd: 6 }} />}
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
            { required: true, message: 'Xác nhận lại mật khẩu mới' },
            ({ getFieldValue }) => ({
              validator: (_, giaTri: string) =>
                !giaTri || getFieldValue('matKhauMoi') === giaTri
                  ? Promise.resolve()
                  : Promise.reject(new Error('Hai lần nhập mật khẩu không khớp')),
            }),
          ]}
        >
          <Input.Password
            size="large"
            prefix={<LockOutlined style={{ color: '#94A3B8', marginInlineEnd: 6 }} />}
            placeholder="Nhập lại mật khẩu mới"
            autoComplete="new-password"
          />
        </Form.Item>

        <Button type="primary" size="large" htmlType="submit" block loading={dangGui}>
          Cập nhật mật khẩu
        </Button>
      </Form>

      <Flex justify="center" gap={6} style={{ marginTop: 20 }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>Liên kết hết hạn?</Typography.Text>
        <Link to="/quen-mat-khau" style={{ fontSize: 13 }}>Gửi lại yêu cầu</Link>
      </Flex>
    </KhungTaiKhoan>
  )
}
