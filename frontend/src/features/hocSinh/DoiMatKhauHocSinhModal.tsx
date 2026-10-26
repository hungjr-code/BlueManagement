import { App, Form, Input, Modal } from 'antd'
import { useDoiMatKhauHocSinh } from '../../api/hocSinhPortal'
import { ApiError } from '../../api/http'

interface Props {
  open: boolean
  onClose: () => void
}

interface BieuMau {
  matKhauHienTai: string
  matKhauMoi: string
  nhapLai: string
}

/** Học sinh tự đổi mật khẩu. Đổi xong thì các phiên khác bị cắt, phiên đang dùng vẫn giữ. */
export function DoiMatKhauHocSinhModal({ open, onClose }: Props) {
  const { message } = App.useApp()
  const [bieuMau] = Form.useForm<BieuMau>()
  const doiMatKhau = useDoiMatKhauHocSinh()

  const luu = async (giaTri: BieuMau) => {
    try {
      await doiMatKhau.mutateAsync({
        matKhauHienTai: giaTri.matKhauHienTai,
        matKhauMoi: giaTri.matKhauMoi,
      })
      message.success('Đã đổi mật khẩu')
      bieuMau.resetFields()
      onClose()
    } catch (error) {
      const noiDung =
        error instanceof ApiError
          ? error.fieldMessages.join(' · ') || error.problem?.detail || error.message
          : 'Không đổi được mật khẩu'
      message.error(noiDung)
    }
  }

  return (
    <Modal
      open={open}
      title="Đổi mật khẩu"
      okText="Đổi mật khẩu"
      cancelText="Huỷ"
      confirmLoading={doiMatKhau.isPending}
      onCancel={onClose}
      onOk={() => {
        void bieuMau.submit()
      }}
      destroyOnHidden
    >
      <Form<BieuMau>
        form={bieuMau}
        layout="vertical"
        onFinish={(giaTri) => {
          void luu(giaTri)
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
          extra="Ít nhất 6 ký tự, có cả chữ và số."
          rules={[
            { required: true, message: 'Nhập mật khẩu mới' },
            { min: 6, message: 'Mật khẩu phải dài ít nhất 6 ký tự' },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          label="Nhập lại mật khẩu mới"
          name="nhapLai"
          dependencies={['matKhauMoi']}
          rules={[
            { required: true, message: 'Nhập lại mật khẩu mới' },
            ({ getFieldValue }) => ({
              validator(_giaTri, giaTri) {
                return giaTri === getFieldValue('matKhauMoi')
                  ? Promise.resolve()
                  : Promise.reject(new Error('Hai lần nhập không khớp'))
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
