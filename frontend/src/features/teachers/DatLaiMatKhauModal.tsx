import { useState } from 'react'
import { Alert, App, Button, Flex, Form, Input, Modal, Typography } from 'antd'
import { useDatLaiMatKhau } from '../../api/teachers'
import { ApiError } from '../../api/http'
import type { GiaoVien } from '../../api/types'
import { GHI_CHU_MAT_KHAU, QUY_TAC_MAT_KHAU } from './nhanGiaoVien'

interface GiaTriDatLaiMatKhau {
  matKhauMoi: string
  xacNhanMatKhauMoi: string
}

interface DatLaiMatKhauModalProps {
  giaoVien: GiaoVien | null
  onClose: () => void
}

/**
 * Admin đặt lại mật khẩu cho một giáo viên.
 *
 * Backend đặt lại xong cũng **mở khoá tài khoản** (dùng cho người vừa được cho nghỉ rồi quay lại),
 * nên modal nói rõ điều đó. Mật khẩu mới phải tự gửi cho giáo viên vì chưa có kênh email mời.
 */
export function DatLaiMatKhauModal({ giaoVien, onClose }: DatLaiMatKhauModalProps) {
  const [form] = Form.useForm<GiaTriDatLaiMatKhau>()
  const { message } = App.useApp()
  const datLaiMatKhau = useDatLaiMatKhau()
  const [loi, setLoi] = useState<string | null>(null)

  const dong = () => {
    form.resetFields()
    setLoi(null)
    onClose()
  }

  const gui = async (giaTri: GiaTriDatLaiMatKhau) => {
    if (!giaoVien) return
    setLoi(null)
    try {
      await datLaiMatKhau.mutateAsync({ id: giaoVien.id, matKhauMoi: giaTri.matKhauMoi })
      message.success(
        `Đã đặt lại mật khẩu cho ${giaoVien.hoTen}. Tài khoản cũng đã được mở khoá đăng nhập.`,
      )
      dong()
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      setLoi(
        theoField.length > 0
          ? theoField.join(' · ')
          : (loiApi?.message ?? 'Không đặt lại được mật khẩu'),
      )
    }
  }

  return (
    <Modal
      open={giaoVien !== null}
      title={giaoVien ? `Đặt lại mật khẩu — ${giaoVien.hoTen}` : 'Đặt lại mật khẩu'}
      footer={null}
      width={480}
      onCancel={dong}
    >
      <Flex vertical gap={12}>
        <Alert
          type="warning"
          showIcon
          message="Admin đang đặt mật khẩu hộ giáo viên"
          description="Chưa có kênh gửi email mời, nên bạn phải tự gửi mật khẩu mới cho giáo viên. Đặt lại cũng mở khoá đăng nhập cho tài khoản này."
        />

        {loi ? <Alert type="error" showIcon message={loi} /> : null}

        <Form<GiaTriDatLaiMatKhau>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(giaTri) => {
            void gui(giaTri)
          }}
        >
          <Form.Item
            label="Mật khẩu mới"
            name="matKhauMoi"
            rules={QUY_TAC_MAT_KHAU}
            extra={GHI_CHU_MAT_KHAU}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            label="Nhập lại mật khẩu mới"
            name="xacNhanMatKhauMoi"
            dependencies={['matKhauMoi']}
            rules={[
              { required: true, message: 'Nhập lại mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator(_: unknown, giaTri: string) {
                  if (!giaTri || getFieldValue('matKhauMoi') === giaTri) return Promise.resolve()
                  return Promise.reject(new Error('Hai lần nhập không giống nhau'))
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Flex justify="end" gap={8}>
            <Button onClick={dong}>Huỷ</Button>
            <Button type="primary" htmlType="submit" loading={datLaiMatKhau.isPending}>
              Đặt lại mật khẩu
            </Button>
          </Flex>
        </Form>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Không hiện mật khẩu dạng chữ ở đâu trong ứng dụng: sau khi lưu, mật khẩu không đọc lại được
          nữa — quên thì đặt lại lần nữa. Giáo viên nên tự đổi mật khẩu sau khi đăng nhập.
        </Typography.Text>
      </Flex>
    </Modal>
  )
}
