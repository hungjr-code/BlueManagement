import { useState } from 'react'
import { Alert, App, Button, Card, Divider, Flex, Form, Input, Typography } from 'antd'
import { GoogleOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
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
 * Trang đăng nhập. Tài khoản do admin tạo, không có chức năng tự đăng ký: admin đầu tiên sinh bằng
 * seed ở backend khi khởi động lần đầu.
 *
 * Đăng nhập bằng Google cũng chỉ dành cho tài khoản đã có sẵn (so khớp theo email): có Gmail không
 * có nghĩa là được vào hệ thống. Đổi lại, một lần cấp quyền vừa đăng nhập vừa nối luôn lịch Google
 * của người đó, nên buổi học của họ lên lịch được ngay từ bước này.
 */
export function LoginPage() {
  const { nguoiDung, dangNhap } = usePhien()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const viTri = useLocation()
  const [thamSo, datThamSo] = useSearchParams()
  // Máy chủ có đang cấu hình Google thật không: chưa cấu hình thì nút Google chỉ dẫn tới lỗi, còn
  // đang ở chế độ giả thì phải nói thẳng ra — nếu không người dùng tưởng mình vừa đăng nhập bằng Google.
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

  // Google trả người dùng về kèm kết quả trong query string, nên chính query string là nguồn sự
  // thật — không cần state riêng cho nó.
  const loiTuGoogle =
    thamSo.get('google') === 'loi'
      ? (thamSo.get('thongBao') ?? 'Đăng nhập bằng Google không thành công.')
      : null
  const [daDongLoiGoogle, datDaDongLoiGoogle] = useState(false)
  const loiDangHien = loi ?? (daDongLoiGoogle ? null : loiTuGoogle)

  if (nguoiDung) {
    return <Navigate to="/" replace />
  }

  /** Mở màn hình đồng ý của Google ở tab mới, không rời trang đăng nhập. */
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
    <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 16 }}>
      <Card style={{ width: 420 }} variant="outlined">
        <Flex vertical gap={4} style={{ marginBottom: 20 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {env.appName}
          </Typography.Title>
          <Typography.Text type="secondary">
            Quản lý dạy kèm: lịch dạy, điểm danh, học phí và thu tiền bằng mã QR.
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
            label="Email đăng nhập"
            name="email"
            rules={[
              { required: true, message: 'Nhập email đăng nhập' },
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

          <Form.Item
            label="Mật khẩu"
            name="matKhau"
            rules={[{ required: true, message: 'Nhập mật khẩu' }]}
            extra={
              <Flex justify="flex-end">
                <Link to="/quen-mat-khau">Quên mật khẩu?</Link>
              </Flex>
            }
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined style={{ marginInlineEnd: 6 }} />}
              placeholder="Mật khẩu do admin cấp"
              autoComplete="current-password"
            />
          </Form.Item>

          <Button type="primary" size="large" htmlType="submit" block loading={dangGui}>
            Đăng nhập
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
            description="Máy chủ đang bật GoogleCalendar:CheDoGia. Nút dưới đây không mở trang của Google mà đăng nhập thẳng một tài khoản cố định để thử luồng ở máy dev. Muốn đăng nhập bằng Google thật thì đặt ClientId/ClientSecret rồi tắt CheDoGia."
          />
        ) : null}

        {googleChuaCauHinh ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Máy chủ chưa cấu hình Google"
            description="Chưa có GoogleCalendar:ClientId và ClientSecret nên chưa đăng nhập bằng Google được. Đặt hai khoá đó trong user-secrets của backend rồi chạy lại API (xem README backend, mục đăng nhập bằng Google)."
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
          {cheDoGiaGoogle ? 'Đăng nhập bằng Google (chế độ giả)' : 'Đăng nhập bằng Google'}
        </Button>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
          Google sẽ hỏi quyền xem email và quyền quản lý sự kiện trên lịch. Một lần đồng ý là xong: vừa
          đăng nhập, vừa nối luôn lịch để buổi học của bạn tự lên đó. Lần đầu đăng nhập bằng email Google
          nào thì hệ thống tạo tài khoản giáo viên cho email đó.
        </Typography.Paragraph>

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="Chưa có tài khoản?"
          description={
            <Flex vertical gap={4}>
              <span>
                Bạn tự tạo được tài khoản giáo viên bằng email hoặc bằng Google — nhưng{' '}
                <strong>không tự phong được mình làm admin</strong>. Quyền quản trị chỉ do admin hiện có
                đặt, hoặc sinh bằng seed ở máy chủ.
              </span>
              <Link to="/dang-ky">Tạo tài khoản mới</Link>
            </Flex>
          }
        />
      </Card>
    </Flex>
  )
}
