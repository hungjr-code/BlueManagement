import { useState } from 'react'
import { Alert, App, Button, DatePicker, Form, Input, Modal, Select, TimePicker, Typography } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { ReloadOutlined } from '@ant-design/icons'
import { useThemBuoiDayBu } from '../../api/attendance'
import { useDanhSachHocSinh } from '../../api/students'
import { ApiError } from '../../api/http'
import { gioNgan, ngayNgan } from '../../config/lichTuan'

interface GiaTriDayBu {
  hocSinhId: string
  ngay: Dayjs
  gioBatDau: Dayjs
  gioKetThuc: Dayjs
  ghiChu?: string
}

interface ThemBuoiDayBuModalProps {
  laAdmin: boolean
  onDong: () => void
  onDaThem: (ngay: string) => void
}

/**
 * Hộp thoại thêm buổi dạy bù ngoài lịch học hằng tuần.
 */
export function ThemBuoiDayBuModal({ laAdmin, onDong, onDaThem }: ThemBuoiDayBuModalProps) {
  const [form] = Form.useForm<GiaTriDayBu>()
  const { message } = App.useApp()
  const hocSinh = useDanhSachHocSinh({ kichThuoc: 200 })
  const themBuoiDayBu = useThemBuoiDayBu()
  const [loi, setLoi] = useState<string | null>(null)

  const danhSach = hocSinh.data?.duLieu ?? []

  const luu = async (giaTri: GiaTriDayBu) => {
    setLoi(null)

    if (!giaTri.gioKetThuc.isAfter(giaTri.gioBatDau)) {
      setLoi('Giờ kết thúc phải sau giờ bắt đầu.')
      return
    }

    try {
      const buoi = await themBuoiDayBu.mutateAsync({
        hocSinhId: giaTri.hocSinhId,
        ngay: giaTri.ngay.format('YYYY-MM-DD'),
        gioBatDau: giaTri.gioBatDau.format('HH:mm:ss'),
        gioKetThuc: giaTri.gioKetThuc.format('HH:mm:ss'),
        ghiChu: giaTri.ghiChu?.trim() ? giaTri.ghiChu.trim() : null,
      })

      message.success(
        `Đã thêm buổi dạy bù ${gioNgan(buoi.gioBatDau)} – ${gioNgan(buoi.gioKetThuc)} ngày ${ngayNgan(buoi.ngay)}`,
      )
      onDaThem(buoi.ngay)
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      setLoi(theoField.length > 0 ? theoField.join(' · ') : (loiApi?.message ?? 'Không thêm được buổi dạy bù'))
    }
  }

  return (
    <Modal
      open
      width={500}
      title="Thêm buổi dạy bù"
      okText="Thêm buổi dạy bù"
      cancelText="Huỷ"
      confirmLoading={themBuoiDayBu.isPending}
      onOk={() => {
        form.submit()
      }}
      onCancel={onDong}
    >
      {loi ? <Alert type="error" showIcon message={loi} closable style={{ marginBottom: 16 }} onClose={() => { setLoi(null) }} /> : null}

      {hocSinh.isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Không đọc được danh sách học sinh"
          description={
            hocSinh.error instanceof ApiError
              ? hocSinh.error.message
              : 'Kiểm tra backend rồi thử lại.'
          }
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                void hocSinh.refetch()
              }}
            >
              Thử lại
            </Button>
          }
        />
      ) : null}

      <Form<GiaTriDayBu>
        form={form}
        layout="vertical"
        initialValues={{ ngay: dayjs() }}
        onFinish={(giaTri) => {
          void luu(giaTri)
        }}
      >
        <Form.Item
          label="Học sinh"
          name="hocSinhId"
          rules={[{ required: true, message: 'Chọn học sinh học bù' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={hocSinh.isPending}
            placeholder={hocSinh.isPending ? 'Đang tải danh sách học sinh…' : 'Chọn học sinh'}
            options={danhSach.map((item) => ({
              value: item.id,
              label: laAdmin ? `${item.hoTen} — ${item.tenGiaoVien}` : item.hoTen,
            }))}
            notFoundContent={
              hocSinh.isPending ? null : <Typography.Text type="secondary">Chưa có học sinh nào</Typography.Text>
            }
          />
        </Form.Item>

        <Form.Item label="Ngày học bù" name="ngay" rules={[{ required: true, message: 'Chọn ngày học bù' }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày" />
        </Form.Item>

        <Form.Item
          label="Giờ bắt đầu"
          name="gioBatDau"
          rules={[{ required: true, message: 'Chọn giờ bắt đầu' }]}
        >
          <TimePicker format="HH:mm" minuteStep={5} needConfirm={false} style={{ width: 160 }} placeholder="18:00" />
        </Form.Item>

        <Form.Item
          label="Giờ kết thúc"
          name="gioKetThuc"
          rules={[{ required: true, message: 'Chọn giờ kết thúc' }]}
        >
          <TimePicker format="HH:mm" minuteStep={5} needConfirm={false} style={{ width: 160 }} placeholder="19:30" />
        </Form.Item>

        <Form.Item label="Ghi chú" name="ghiChu">
          <Input.TextArea rows={2} maxLength={1000} placeholder="Ví dụ: Dạy bù buổi nghỉ ốm" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
