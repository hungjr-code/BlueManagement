import { useState } from 'react'
import { Alert, App, Button, DatePicker, Flex, Form, Input, Modal, Select, Typography } from 'antd'
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
 * Admin tạo tài khoản giáo viên mới.
 *
 * Admin đặt mật khẩu đầu tiên hộ giáo viên (giáo viên nên đổi lại sau lần đăng nhập đầu; quên thì dùng
 * luồng "Quên mật khẩu" ở trang đăng nhập) —
 * form nói thẳng điều đó thay vì để người dùng tưởng hệ thống tự gửi thư.
 * Vai trò mặc định luôn là giáo viên, không bao giờ mặc định thành admin.
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
      message.success(
        `Đã tạo tài khoản cho ${giaoVienMoi.hoTen}. Hãy gửi mật khẩu đầu tiên cho họ và nhắc đổi lại sau lần đăng nhập đầu.`,
      )
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
    <Modal open={open} title="Thêm giáo viên" footer={null} width={560} onCancel={dong}>
      <Flex vertical gap={12}>
        <Alert
          type="info"
          showIcon
          message="Chưa có kênh gửi email mời đặt mật khẩu"
          description="Vì vậy admin đặt mật khẩu đầu tiên hộ giáo viên. Hãy gửi mật khẩu này cho họ qua kênh khác (không gửi qua email này) và nhắc họ đổi lại ngay sau lần đăng nhập đầu."
        />

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
            <Input placeholder="Ví dụ Nguyễn Văn A" allowClear />
          </Form.Item>

          <Form.Item
            label="Email đăng nhập"
            name="email"
            rules={[
              { required: true, message: 'Nhập email đăng nhập' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
            extra="Email là tên đăng nhập nên không cho trùng giữa các giáo viên. Backend không có API đổi email — muốn đổi phải tạo tài khoản mới."
          >
            <Input placeholder="giao.vien@example.com" autoComplete="off" allowClear />
          </Form.Item>

          <Form.Item label="Số điện thoại" name="soDienThoai" rules={[{ max: 30, message: 'Tối đa 30 ký tự' }]}>
            <Input placeholder="0900000000" allowClear />
          </Form.Item>

          <Form.Item
            label="Vai trò"
            name="vaiTro"
            rules={[{ required: true, message: 'Chọn vai trò' }]}
            extra="Mặc định là giáo viên. Chỉ chọn admin khi người này thực sự quản lý cả trung tâm — vai trò quyết định phạm vi dữ liệu nhìn thấy."
          >
            <Select options={LUA_CHON_VAI_TRO} />
          </Form.Item>

          <Form.Item
            label="Mật khẩu đầu tiên"
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
            <DatePicker format="DD/MM/YYYY" style={{ width: 200 }} />
          </Form.Item>

          <Form.Item
            label="Ghi chú"
            name="ghiChu"
            rules={[{ max: 1000, message: 'Tối đa 1000 ký tự' }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="Ví dụ: dạy được toán lớp 12, chỉ dạy buổi tối"
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

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Tài khoản tạo xong ở trạng thái “Đang làm”. Không có chức năng tự đăng ký thành admin: tài
          khoản đầu tiên do seed tạo, các tài khoản sau do admin tạo ở đây.
        </Typography.Text>
      </Flex>
    </Modal>
  )
}
