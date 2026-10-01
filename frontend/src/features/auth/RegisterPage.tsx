import { useState } from 'react'
import { Alert, App, Button, Divider, Flex, Form, Input, Typography } from 'antd'
import { GoogleOutlined, LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { usePhien } from '../../app/session'
import { ApiError } from '../../api/http'
import { useQuery } from '@tanstack/react-query'
import { layDuongDanDangNhapGoogle, layTuyChonDangNhap } from '../../api/auth'
import { KhungTaiKhoan } from './khungTach'

interface GiaTriDangKy {
  hoTen: string
  email: string
  matKhau: string
  xacNhan: string
}

/**
 * Tự tạo tài khoản bằng email và mật khẩu, hoặc bằng Google.
 *
 * Tài khoản tự tạo LUÔN là giáo viên: mở cho tự đăng ký nhưng không mở luôn quyền quản trị, nên
 * người lạ có đăng ký cũng không đụng được vào dữ liệu của người khác.
 */
export function RegisterPage() {
  const { nguoiDung, dangKy } = usePhien()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const tuyChon = useQuery({
    queryKey: ['tuy-chon-dang-nhap'],
    queryFn: layTuyChonDangNhap,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const [dangGui, setDangGui] = useState(false)
  const [dangMoGoogle, datDangMoGoogle] = useState(false)
  const cheDoGiaGoogle = tuyChon.data?.googleCheDoGia === true
  const googleChuaCauHinh = tuyChon.data != null && !tuyChon.data.googleDaCauHinh && !cheDoGiaGoogle
  const [loi, setLoi] = useState<string | null>(null)

  if (nguoiDung) {
    return <Navigate to="/" replace />
  }

  const gui = async (giaTri: GiaTriDangKy) => {
    setDangGui(true)
    setLoi(null)
    try {
      await dangKy(giaTri.hoTen.trim(), giaTri.email.trim(), giaTri.matKhau)
      message.success('Đã tạo tài khoản và đăng nhập')
      navigate('/', { replace: true })
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      setLoi(theoField.length > 0 ? theoField.join(' · ') : (loiApi?.message ?? 'Không tạo được tài khoản'))
    } finally {
      setDangGui(false)
    }
  }

  const moTrangGoogle = async () => {
    datDangMoGoogle(true)
    setLoi(null)
    try {
      const { url } = await layDuongDanDangNhapGoogle()
      window.location.assign(url)
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      setLoi(loiApi?.message ?? 'Không mở được trang đăng ký Google')
      datDangMoGoogle(false)
    }
  }

  return (
    <KhungTaiKhoan
      tieuDe="Tạo tài khoản mới"
      moTa="Tài khoản do bạn tự tạo luôn là tài khoản giáo viên. Admin sẽ gán học sinh cho bạn sau."
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

      <Form<GiaTriDangKy>
        layout="vertical"
        requiredMark={false}
        onFinish={(giaTri) => {
          void gui(giaTri)
        }}
      >
        <Form.Item label="Tên của bạn" name="hoTen" rules={[{ required: true, message: 'Nhập tên của bạn' }]}>
          <Input
            size="large"
            prefix={<UserOutlined style={{ marginInlineEnd: 6 }} />}
            placeholder="Nguyễn Thu Hà"
            autoComplete="name"
            autoFocus
          />
        </Form.Item>

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
          />
        </Form.Item>

        <Form.Item
          label="Mật khẩu"
          name="matKhau"
          rules={[
            { required: true, message: 'Nhập mật khẩu' },
            { min: 8, message: 'Mật khẩu phải từ 8 ký tự' },
          ]}
          extra="Từ 8 ký tự, có ít nhất một chữ số."
        >
          <Input.Password
            size="large"
            prefix={<LockOutlined style={{ marginInlineEnd: 6 }} />}
            placeholder="Mật khẩu"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          label="Nhập lại mật khẩu"
          name="xacNhan"
          dependencies={['matKhau']}
          rules={[
            { required: true, message: 'Nhập lại mật khẩu' },
            ({ getFieldValue }) => ({
              validator: (_, giaTri: string) =>
                !giaTri || getFieldValue('matKhau') === giaTri
                  ? Promise.resolve()
                  : Promise.reject(new Error('Hai lần nhập mật khẩu không giống nhau')),
            }),
          ]}
        >
          <Input.Password
            size="large"
            prefix={<LockOutlined style={{ marginInlineEnd: 6 }} />}
            placeholder="Nhập lại mật khẩu"
            autoComplete="new-password"
          />
        </Form.Item>

        <Button type="primary" size="large" htmlType="submit" block loading={dangGui}>
          Tạo tài khoản
        </Button>
      </Form>

      <Divider plain style={{ marginBlock: 16 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          hoặc
        </Typography.Text>
      </Divider>

      {cheDoGiaGoogle ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Chế độ giả của máy dev — KHÔNG phải Google thật"
          description="Nút dưới đây không mở trang của Google mà tự nhận một tài khoản cố định để thử luồng ở máy dev."
        />
      ) : null}

      {googleChuaCauHinh ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Máy chủ chưa cấu hình Google"
          description="Chưa có ClientId/ClientSecret nên chưa đăng ký bằng Google được. Dùng email và mật khẩu ở trên, hoặc nhờ quản trị máy chủ cấu hình."
        />
      ) : null}

      <Button
        size="large"
        block
        icon={<GoogleOutlined style={{ marginInlineEnd: 6 }} />}
        loading={dangMoGoogle}
        disabled={googleChuaCauHinh}
        onClick={() => {
          void moTrangGoogle()
        }}
      >
        Đăng ký bằng Google
      </Button>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 10 }}>
        Đăng ký bằng Google thì không cần đặt mật khẩu: lần sau cứ bấm nút Google là vào. Muốn có mật
        khẩu thì dùng chức năng quên mật khẩu để đặt.
      </Typography.Paragraph>

      <Flex justify="center" gap={6}>
        <Typography.Text type="secondary">Đã có tài khoản?</Typography.Text>
        <Link to="/login">Đăng nhập</Link>
      </Flex>
    </KhungTaiKhoan>
  )
}
