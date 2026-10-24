import { useState } from 'react'
import { Alert, App, Button, Card, Divider, Flex, Form, Input, Typography } from 'antd'
import { CalendarOutlined, GoogleOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePhien } from '../../app/session'
import { ApiError } from '../../api/http'
import { layDuongDanDangNhapGoogle, layTuyChonDangNhap } from '../../api/auth'
import { env } from '../../config/env'

interface GiaTriDangNhap {
  email: string
  matKhau: string
}

interface ViTriCoDuongDanQuayLai {
  tu?: string
}

/**
 * Trang đăng nhập tối giản.
 */
export function LoginPage() {
  const { nguoiDung, dangNhap } = usePhien()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const viTri = useLocation()
  const [thamSo, datThamSo] = useSearchParams()

  const tuyChon = useQuery({
    queryKey: ['tuy-chon-dang-nhap'],
    queryFn: layTuyChonDangNhap,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const cheDoGiaGoogle = tuyChon.data?.googleCheDoGia === true
  const googleChuaCauHinh = tuyChon.data != null && !tuyChon.data.googleDaCauHinh && !cheDoGiaGoogle
  const [dangGui, setDangGui] = useState(false)
  const [dangMoGoogle, datDangMoGoogle] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  const loiTuGoogle =
    thamSo.get('google') === 'loi'
      ? (thamSo.get('thongBao') ?? 'Đăng nhập bằng Google không thành công.')
      : null
  const [daDongLoiGoogle, datDaDongLoiGoogle] = useState(false)
  const loiDangHien = loi ?? (daDongLoiGoogle ? null : loiTuGoogle)

  if (nguoiDung) {
    return <Navigate to="/" replace />
  }

  const moTrangGoogle = async () => {
    datDangMoGoogle(true)
    setLoi(null)
    try {
      const { url } = await layDuongDanDangNhapGoogle()
      window.location.assign(url)
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      setLoi(loiApi?.message ?? 'Không mở được trang đăng nhập Google')
      datDangMoGoogle(false)
    }
  }

  const gui = async (giaTri: GiaTriDangNhap) => {
    setDangGui(true)
    setLoi(null)
    try {
      await dangNhap(giaTri.email.trim(), giaTri.matKhau)
      message.success('Đăng nhập thành công')
      const quayLai = (viTri.state as ViTriCoDuongDanQuayLai | null)?.tu ?? '/'
      navigate(quayLai, { replace: true })
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      setLoi(theoField.length > 0 ? theoField.join(' · ') : (loiApi?.message ?? 'Không đăng nhập được'))
    } finally {
      setDangGui(false)
    }
  }

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
          width: 400,
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
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Đăng nhập để quản lý lớp học và lịch dạy
          </Typography.Text>
        </Flex>

        {loiDangHien ? (
          <Alert
            type="error"
            showIcon
            message={loiDangHien}
            style={{ marginBottom: 16 }}
            closable
            onClose={() => {
              setLoi(null)
              datDaDongLoiGoogle(true)
              datThamSo({}, { replace: true })
            }}
          />
        ) : null}

        <Form<GiaTriDangNhap>
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
              { required: true, message: 'Nhập email đăng nhập' },
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

          <Form.Item
            label="Mật khẩu"
            name="matKhau"
            rules={[{ required: true, message: 'Nhập mật khẩu' }]}
            extra={
              <Flex justify="flex-end" style={{ marginTop: 4 }}>
                <Link to="/quen-mat-khau" style={{ fontSize: 12 }}>Quên mật khẩu?</Link>
              </Flex>
            }
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined style={{ color: '#94A3B8', marginInlineEnd: 6 }} />}
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
            />
          </Form.Item>

          <Button type="primary" size="large" htmlType="submit" block loading={dangGui}>
            Đăng nhập
          </Button>
        </Form>

        <Divider plain style={{ marginBlock: 20 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            hoặc
          </Typography.Text>
        </Divider>

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
          Đăng nhập bằng Google
        </Button>

        <Flex justify="center" gap={6} style={{ marginTop: 20 }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Chưa có tài khoản?
          </Typography.Text>
          <Link to="/dang-ky" style={{ fontSize: 13 }}>Tạo tài khoản</Link>
        </Flex>
      </Card>
    </Flex>
  )
}
