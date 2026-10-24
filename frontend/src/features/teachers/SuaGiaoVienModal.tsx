import { useState } from 'react'
import { Alert, App, Button, DatePicker, Flex, Form, Input, Modal, Select, Typography } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useSuaGiaoVien } from '../../api/teachers'
import { ApiError } from '../../api/http'
import type { GiaoVien, TrangThaiGiaoVien, VaiTro } from '../../api/types'
import { LUA_CHON_TRANG_THAI, LUA_CHON_VAI_TRO } from './nhanGiaoVien'

interface GiaTriSuaGiaoVien {
  hoTen: string
  soDienThoai?: string
  vaiTro: VaiTro
  trangThai: TrangThaiGiaoVien
  ngayThamGia: Dayjs
  ghiChu?: string
}

interface SuaGiaoVienModalProps {
  giaoVien: GiaoVien | null
  onClose: () => void
}

/**
 * Chỉnh sửa hồ sơ giáo viên.
 */
export function SuaGiaoVienModal({ giaoVien, onClose }: SuaGiaoVienModalProps) {
  const [form] = Form.useForm<GiaTriSuaGiaoVien>()
  const { message } = App.useApp()
  const suaGiaoVien = useSuaGiaoVien()
  const [loi, setLoi] = useState<string | null>(null)

  const vaiTroDangChon = Form.useWatch('vaiTro', form)
  const trangThaiDangChon = Form.useWatch('trangThai', form)
  const vaiTroMoi = vaiTroDangChon ?? giaoVien?.vaiTro
  const trangThaiMoi = trangThaiDangChon ?? giaoVien?.trangThai

  const doiVaiTro = giaoVien !== null && vaiTroMoi !== giaoVien.vaiTro
  const seKhoaDangNhap = trangThaiMoi !== undefined && trangThaiMoi !== 'dang_lam'

  const dong = () => {
    form.resetFields()
    setLoi(null)
    onClose()
  }

  const gui = async (giaTri: GiaTriSuaGiaoVien) => {
    if (!giaoVien) return
    setLoi(null)
    try {
      await suaGiaoVien.mutateAsync({
        id: giaoVien.id,
        duLieu: {
          hoTen: giaTri.hoTen.trim(),
          soDienThoai: giaTri.soDienThoai?.trim() || null,
          vaiTro: giaTri.vaiTro,
          trangThai: giaTri.trangThai,
          ngayThamGia: giaTri.ngayThamGia.format('YYYY-MM-DD'),
          ghiChu: giaTri.ghiChu?.trim() || null,
        },
      })
      message.success(`Đã lưu hồ sơ ${giaTri.hoTen.trim()}`)
      dong()
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      setLoi(
        theoField.length > 0 ? theoField.join(' · ') : (loiApi?.message ?? 'Không lưu được hồ sơ'),
      )
    }
  }

  return (
    <Modal
      open={giaoVien !== null}
      title={giaoVien ? `Sửa hồ sơ — ${giaoVien.hoTen}` : 'Sửa hồ sơ giáo viên'}
      footer={null}
      width={520}
      onCancel={dong}
    >
      <Flex vertical gap={12}>
        {loi ? <Alert type="error" showIcon message={loi} /> : null}

        <Form<GiaTriSuaGiaoVien>
          form={form}
          layout="vertical"
          requiredMark={false}
          key={giaoVien?.id ?? 'chua-chon'}
          initialValues={{
            hoTen: giaoVien?.hoTen,
            soDienThoai: giaoVien?.soDienThoai ?? undefined,
            vaiTro: giaoVien?.vaiTro,
            trangThai: giaoVien?.trangThai,
            ngayThamGia: giaoVien ? dayjs(giaoVien.ngayThamGia) : dayjs(),
            ghiChu: giaoVien?.ghiChu ?? undefined,
          }}
          onFinish={(giaTri) => {
            void gui(giaTri)
          }}
        >
          <Form.Item label="Email">
            <Typography.Text strong>{giaoVien?.email ?? '—'}</Typography.Text>
          </Form.Item>

          <Form.Item
            label="Tên giáo viên"
            name="hoTen"
            rules={[
              { required: true, message: 'Nhập tên giáo viên' },
              { min: 2, message: 'Tên giáo viên phải dài ít nhất 2 ký tự' },
            ]}
          >
            <Input allowClear />
          </Form.Item>

          <Form.Item
            label="Số điện thoại"
            name="soDienThoai"
            rules={[{ max: 30, message: 'Tối đa 30 ký tự' }]}
          >
            <Input allowClear />
          </Form.Item>

          <Form.Item
            label="Vai trò"
            name="vaiTro"
            rules={[{ required: true, message: 'Chọn vai trò' }]}
          >
            <Select options={LUA_CHON_VAI_TRO} />
          </Form.Item>

          {doiVaiTro ? (
            <Alert
              type="warning"
              showIcon
              message="Đang thay đổi vai trò tài khoản"
            />
          ) : null}

          <Form.Item
            label="Trạng thái"
            name="trangThai"
            rules={[{ required: true, message: 'Chọn trạng thái' }]}
          >
            <Select options={LUA_CHON_TRANG_THAI} />
          </Form.Item>

          {seKhoaDangNhap ? (
            <Alert
              type="warning"
              showIcon
              message="Trạng thái này sẽ tạm khoá quyền đăng nhập của giáo viên"
            />
          ) : null}

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
            <Input.TextArea rows={2} allowClear placeholder="Nhập ghi chú (tuỳ chọn)" />
          </Form.Item>

          <Flex justify="end" gap={8}>
            <Button onClick={dong}>Huỷ</Button>
            <Button type="primary" htmlType="submit" loading={suaGiaoVien.isPending}>
              Lưu thay đổi
            </Button>
          </Flex>
        </Form>
      </Flex>
    </Modal>
  )
}
