import { useState } from 'react'
import { Alert, App, Button, Flex, Form, Input, Modal, Typography } from 'antd'
import { doiMatKhau } from '../../api/auth'
import { ApiError } from '../../api/http'

interface GiaTriDoiMatKhau {
  matKhauHienTai: string
  matKhauMoi: string
  xacNhanMatKhauMoi: string
}

/**
 * Đổi mật khẩu của chính mình. Backend đổi xong sẽ thu hồi mọi phiên khác, chỉ giữ phiên
 * đang dùng — nên không bị văng ra ngoài ngay sau khi đổi.
 */
export function DoiMatKhauModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm<GiaTriDoiMatKhau>()
  const { message } = App.useApp()
  const [dangGui, setDangGui] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  const gui = async (giaTri: GiaTriDoiMatKhau) => {
    setDangGui(true)
    setLoi(null)
    try {
      await doiMatKhau(giaTri.matKhauHienTai, giaTri.matKhauMoi)
      message.success('Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.')
      form.resetFields()
      onClose()
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      setLoi(theoField.length > 0 ? theoField.join(' · ') : (loiApi?.message ?? 'Không đổi được mật khẩu'))
    } finally {
      setDangGui(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Đổi mật khẩu"
      footer={null}
      onCancel={() => {
        form.resetFields()
        setLoi(null)
        onClose()
      }}
    >
      <Flex vertical gap={12}>
        {loi ? <Alert type="error" showIcon message={loi} /> : null}

        <Form<GiaTriDoiMatKhau>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(giaTri) => {
            void gui(giaTri)
          }}
        >
          <Form.Item
            label="Mật khẩu đang dùng"
            name="matKhauHienTai"
            rules={[{ required: true, message: 'Nhập mật khẩu đang dùng' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>

          <Form.Item
            label="Mật khẩu mới"
            name="matKhauMoi"
            rules={[
              { required: true, message: 'Nhập mật khẩu mới' },
              { min: 8, message: 'Mật khẩu mới phải dài ít nhất 8 ký tự' },
            ]}
            extra="Ít nhất 8 ký tự, có chữ và có số."
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
                validator(_: unknown, value: string) {
                  if (!value || getFieldValue('matKhauMoi') === value) return Promise.resolve()
                  return Promise.reject(new Error('Hai lần nhập không giống nhau'))
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Flex justify="end" gap={8}>
            <Button
              onClick={() => {
                form.resetFields()
                setLoi(null)
                onClose()
              }}
            >
              Huỷ
            </Button>
            <Button type="primary" htmlType="submit" loading={dangGui}>
              Đổi mật khẩu
            </Button>
          </Flex>
        </Form>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Đổi mật khẩu sẽ đăng xuất các thiết bị khác đang dùng tài khoản này.
        </Typography.Text>
      </Flex>
    </Modal>
  )
}
