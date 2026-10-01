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
 * Admin sửa hồ sơ giáo viên: tên, SĐT, vai trò, trạng thái, ngày tham gia, ghi chú.
 *
 * Hai thay đổi nguy hiểm được cảnh báo ngay trong form:
 * - **Đổi vai trò** là đổi phạm vi dữ liệu người này nhìn thấy, backend ghi vào nhật ký.
 * - **Chuyển trạng thái khỏi "đang làm"** làm tài khoản bị khoá đăng nhập và đăng xuất mọi phiên
 *   đang mở. Hồ sơ KHÔNG bị xoá — còn phải tra cứu lịch sử dạy và học phí.
 *
 * Email không sửa được vì `PUT /api/teachers/{id}` không nhận trường đó.
 */
export function SuaGiaoVienModal({ giaoVien, onClose }: SuaGiaoVienModalProps) {
  const [form] = Form.useForm<GiaTriSuaGiaoVien>()
  const { message } = App.useApp()
  const suaGiaoVien = useSuaGiaoVien()
  const [loi, setLoi] = useState<string | null>(null)

  // Ban đầu form chưa có giá trị thì lấy theo hồ sơ đang sửa, tránh nháy cảnh báo vô cớ.
  const vaiTroDangChon = Form.useWatch('vaiTro', form)
  const trangThaiDangChon = Form.useWatch('trangThai', form)
  const vaiTroMoi = vaiTroDangChon ?? giaoVien?.vaiTro
  const trangThaiMoi = trangThaiDangChon ?? giaoVien?.trangThai

  const doiVaiTro = giaoVien !== null && vaiTroMoi !== giaoVien.vaiTro
  const seKhoaDangNhap = trangThaiMoi !== undefined && trangThaiMoi !== 'dang_lam'
  const doiTrangThai = giaoVien !== null && trangThaiMoi !== giaoVien.trangThai

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
      width={560}
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
          <Form.Item label="Email đăng nhập">
            <Typography.Text>{giaoVien?.email ?? '—'}</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              Không sửa được email: backend không nhận trường này trong API sửa hồ sơ.
            </Typography.Text>
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
              message="Đang đổi vai trò"
              description="Đổi vai trò là đổi phạm vi dữ liệu người này nhìn thấy (admin thấy toàn bộ, giáo viên chỉ thấy học sinh của mình). Hành động này được ghi vào nhật ký, và backend không cho admin cuối cùng tự hạ quyền."
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
              type={doiTrangThai ? 'warning' : 'info'}
              showIcon
              message="Trạng thái này khoá đăng nhập"
              description="Tài khoản bị khoá đăng nhập và mọi phiên đang mở bị đăng xuất ngay. Hồ sơ KHÔNG bị xoá: lịch sử dạy, điểm danh và học phí vẫn giữ nguyên để tra cứu."
            />
          ) : null}

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
            <Input.TextArea rows={2} allowClear />
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
