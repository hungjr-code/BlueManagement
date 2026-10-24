import { useState } from 'react'
import { Alert, App, Button, Flex, Form, Input, Modal } from 'antd'
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
 * Đặt lại mật khẩu cho giáo viên.
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
      message.success(`Đã đặt lại mật khẩu cho ${giaoVien.hoTen}`)
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
      width={460}
      onCancel={dong}
    >
      <Flex vertical gap={12}>
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
            label="Xác nhận mật khẩu mới"
            name="xacNhanMatKhauMoi"
            dependencies={['matKhauMoi']}
            rules={[
              { required: true, message: 'Nhập lại mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator(_: unknown, giaTri: string) {
                  if (!giaTri || getFieldValue('matKhauMoi') === giaTri) return Promise.resolve()
                  return Promise.reject(new Error('Hai lần nhập mật khẩu không khớp'))
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
      </Flex>
    </Modal>
  )
}
