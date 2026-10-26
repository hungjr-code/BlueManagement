import { useState } from 'react'
import { Alert, App, Button, Card, Form, Input, Space, Typography } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/http'
import { usePhienHocSinh } from './hocSinhSession'

interface BieuMauDangNhap {
  maHocSinh: string
  matKhau: string
}

/**
 * Đăng nhập của học sinh: mã học sinh (giáo viên đọc cho) và mật khẩu.
 *
 * Cố tình KHÔNG dùng email như giáo viên: học sinh nhỏ không có email, mà mã HS-0007 thì đọc qua
 * điện thoại là gõ được.
 */
export function HocSinhLoginPage() {
  const { message } = App.useApp()
  const { dangNhap } = usePhienHocSinh()
  const dieuHuong = useNavigate()

  const [dangGui, datDangGui] = useState(false)
  const [loi, datLoi] = useState<unknown>(null)

  const gui = async (giaTri: BieuMauDangNhap) => {
    datDangGui(true)
    datLoi(null)

    try {
      await dangNhap(giaTri.maHocSinh.trim(), giaTri.matKhau)
      message.success('Đăng nhập thành công')
      dieuHuong('/hoc-sinh', { replace: true })
    } catch (error) {
      datLoi(error)
    } finally {
      datDangGui(false)
    }
  }

  const noiDungLoi = (error: unknown): string => {
    if (error instanceof ApiError) {
      const chiTiet = error.problem?.detail
      return chiTiet || error.message
    }
    return 'Không đăng nhập được. Kiểm tra lại mã học sinh và mật khẩu.'
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 16px' }}>
      <Card style={{ width: 420 }}>
        <Space direction="vertical" size={4} style={{ marginBottom: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Đăng nhập cho học sinh
          </Typography.Title>
          <Typography.Text type="secondary">
            Dùng mã học sinh giáo viên đã đọc cho em (ví dụ HS-0007).
          </Typography.Text>
        </Space>

        {loi ? (
          <Alert type="error" showIcon style={{ marginBottom: 16 }} message={noiDungLoi(loi)} />
        ) : null}

        <Form<BieuMauDangNhap>
          layout="vertical"
          onFinish={(giaTri) => {
            void gui(giaTri)
          }}
          autoComplete="off"
        >
          <Form.Item
            label="Mã học sinh"
            name="maHocSinh"
            rules={[{ required: true, message: 'Nhập mã học sinh' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="HS-0007"
              size="large"
              autoCapitalize="characters"
            />
          </Form.Item>

          <Form.Item label="Mật khẩu" name="matKhau" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" size="large" />
          </Form.Item>

          <Button type="primary" htmlType="submit" size="large" block loading={dangGui}>
            Đăng nhập
          </Button>
        </Form>

        <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 13 }}>
          Quên mật khẩu thì nhờ giáo viên cấp lại. Giáo viên, chủ trung tâm dùng{' '}
          <Link to="/login">trang đăng nhập của giáo viên</Link>.
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
