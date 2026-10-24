import { useState } from 'react'
import { Alert, App, Button, DatePicker, Flex, Form, Input, Modal, Select } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useTaoGiaoVien } from '../../api/teachers'
import { ApiError } from '../../api/http'
import type { VaiTro } from '../../api/types'
import { GHI_CHU_MAT_KHAU, LUA_CHON_VAI_TRO, QUY_TAC_MAT_KHAU } from './nhanGiaoVien'

interface GiaTriThemGiaoVien {
  hoTen: string
  email: string
  soDienThoai?: string
  vaiTro: VaiTro
  matKhauTamThoi: string
  ngayThamGia: Dayjs
  ghiChu?: string
}

/**
 * Thêm tài khoản giáo viên mới.
 */
export function ThemGiaoVienModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm<GiaTriThemGiaoVien>()
  const { message } = App.useApp()
  const taoGiaoVien = useTaoGiaoVien()
  const [loi, setLoi] = useState<string | null>(null)

  const dong = () => {
    form.resetFields()
    setLoi(null)
    onClose()
  }

  const gui = async (giaTri: GiaTriThemGiaoVien) => {
    setLoi(null)
    try {
      const giaoVienMoi = await taoGiaoVien.mutateAsync({
        hoTen: giaTri.hoTen.trim(),
        email: giaTri.email.trim(),
        soDienThoai: giaTri.soDienThoai?.trim() || null,
        vaiTro: giaTri.vaiTro,
        matKhauTamThoi: giaTri.matKhauTamThoi,
        ngayThamGia: giaTri.ngayThamGia.format('YYYY-MM-DD'),
        ghiChu: giaTri.ghiChu?.trim() || null,
      })
      message.success(`Đã tạo tài khoản cho ${giaoVienMoi.hoTen}`)
      dong()
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      setLoi(
        theoField.length > 0
          ? theoField.join(' · ')
          : (loiApi?.message ?? 'Không tạo được tài khoản giáo viên'),
      )
    }
  }

  return (
    <Modal open={open} title="Thêm giáo viên mới" footer={null} width={520} onCancel={dong}>
      <Flex vertical gap={12}>
        {loi ? <Alert type="error" showIcon message={loi} /> : null}

        <Form<GiaTriThemGiaoVien>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ vaiTro: 'giao_vien', ngayThamGia: dayjs() }}
          onFinish={(giaTri) => {
            void gui(giaTri)
          }}
        >
          <Form.Item
            label="Tên giáo viên"
            name="hoTen"
            rules={[
              { required: true, message: 'Nhập tên giáo viên' },
              { min: 2, message: 'Tên giáo viên phải dài ít nhất 2 ký tự' },
            ]}
          >
            <Input placeholder="Ví dụ: Nguyễn Văn A" allowClear />
          </Form.Item>

          <Form.Item
            label="Email đăng nhập"
            name="email"
            rules={[
              { required: true, message: 'Nhập email đăng nhập' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input placeholder="giao.vien@trungtam.vn" autoComplete="off" allowClear />
          </Form.Item>

          <Form.Item label="Số điện thoại" name="soDienThoai" rules={[{ max: 30, message: 'Tối đa 30 ký tự' }]}>
            <Input placeholder="090…" allowClear />
          </Form.Item>

          <Form.Item
            label="Vai trò"
            name="vaiTro"
            rules={[{ required: true, message: 'Chọn vai trò' }]}
          >
            <Select options={LUA_CHON_VAI_TRO} />
          </Form.Item>

          <Form.Item
            label="Mật khẩu khởi tạo"
            name="matKhauTamThoi"
            rules={QUY_TAC_MAT_KHAU}
            extra={GHI_CHU_MAT_KHAU}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            label="Ngày tham gia"
            name="ngayThamGia"
            rules={[{ required: true, message: 'Chọn ngày tham gia' }]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: 180 }} />
          </Form.Item>

          <Form.Item
            label="Ghi chú"
            name="ghiChu"
            rules={[{ max: 1000, message: 'Tối đa 1000 ký tự' }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="Nhập ghi chú (tuỳ chọn)"
              allowClear
            />
          </Form.Item>

          <Flex justify="end" gap={8}>
            <Button onClick={dong}>Huỷ</Button>
            <Button type="primary" htmlType="submit" loading={taoGiaoVien.isPending}>
              Tạo tài khoản
            </Button>
          </Flex>
        </Form>
      </Flex>
    </Modal>
  )
}
