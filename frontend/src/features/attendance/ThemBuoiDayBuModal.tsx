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
  /** Admin chọn được học sinh của mọi giáo viên, nên nhãn có kèm tên giáo viên. */
  laAdmin: boolean
  /** Đóng hộp thoại mà không thêm gì. */
  onDong: () => void
  /** Thêm xong; trả về ngày của buổi vừa tạo để màn hình mở đúng tuần. */
  onDaThem: (ngay: string) => void
}

/**
 * Hộp thoại thêm một buổi DẠY BÙ ngoài lịch lặp hằng tuần.
 *
 * Buổi này được thêm đúng một lần cho ngày đã chọn và KHÔNG sinh thêm buổi hằng tuần nào: lịch học
 * của học sinh không đổi. Muốn học bù định kỳ thì phải sửa lịch học của học sinh.
 *
 * Component chỉ được mount khi hộp thoại mở, nhờ vậy mỗi lần mở là một form mới — không cần
 * resetFields (gọi reset khi Form chưa mount sẽ cảnh báo của antd).
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
        `Đã thêm buổi dạy bù ${gioNgan(buoi.gioBatDau)}–${gioNgan(buoi.gioKetThuc)} ngày ` +
          `${ngayNgan(buoi.ngay)} cho ${buoi.tenHocSinh}`,
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
      width={560}
      title="Thêm buổi dạy bù"
      okText="Thêm buổi dạy bù"
      cancelText="Huỷ"
      confirmLoading={themBuoiDayBu.isPending}
      onOk={() => {
        form.submit()
      }}
      onCancel={onDong}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Buổi dạy bù không sinh thêm buổi hằng tuần"
        description="Buổi này chỉ được thêm một lần cho đúng ngày đã chọn; lịch học lặp hằng tuần của học sinh không đổi. Buổi mới vẫn ở trạng thái Chưa điểm danh nên nhớ điểm danh sau khi dạy."
      />

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
              : 'Kiểm tra backend rồi mở lại hộp thoại này.'
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
        // Component được mount lại mỗi lần mở nên `dayjs()` ở đây là hôm nay — không phải ngày
        // của lần mở đầu tiên.
        initialValues={{ ngay: dayjs() }}
        onFinish={(giaTri) => {
          void luu(giaTri)
        }}
      >
        <Form.Item
          label="Học sinh"
          name="hocSinhId"
          rules={[{ required: true, message: 'Chọn học sinh học bù' }]}
          extra="Chỉ nên chọn học sinh đang học; học sinh đã nghỉ vẫn hiện nhưng không còn buổi hằng tuần."
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
          <Input.TextArea rows={2} maxLength={1000} showCount placeholder="Ví dụ: dạy bù buổi nghỉ ốm ngày 20/09" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
