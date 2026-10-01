import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  DatePicker,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useThuTienHocPhi } from '../../api/tuition'
import type { HinhThucThanhToan, HocPhi } from '../../api/tuition'
import { formatVnd } from '../../lib/money'
import { HINH_THUC_THANH_TOAN, moTaKy } from './hienThi'
import { LoiApiAlert } from './LoiApiAlert'

interface GiaTriThuTien {
  soTien: number
  hinhThuc: HinhThucThanhToan
  ngayThu: Dayjs
  ghiChu?: string
}

interface ThuTienModalProps {
  /** Dòng học phí đang thu. Component chỉ được dựng khi đã chọn dòng (đang có mặt = đang mở). */
  hocPhi: HocPhi
  onClose: () => void
}

/**
 * Ghi một lần thu tiền cho một dòng học phí.
 *
 * Số tiền mặc định là **số còn lại** vì phần lớn lần thu là thu trọn; thu vượt số còn lại bị backend
 * chặn (400) nên chặn luôn ở đây cho người dùng biết trước. Ngày thu mặc định hôm nay và không cho
 * chọn ngày tương lai — sổ không ghi tiền chưa nhận.
 *
 * Giá trị mặc định đặt bằng `initialValues` chứ không bằng effect: hộp thoại được gắn kèm dòng học phí
 * nên mỗi lần mở là một lần dựng mới, form luôn khởi tạo đúng theo dòng đang thu.
 */
export function ThuTienModal({ hocPhi, onClose }: ThuTienModalProps) {
  const [form] = Form.useForm<GiaTriThuTien>()
  const { message } = App.useApp()
  const thuTien = useThuTienHocPhi(hocPhi.id)
  const [loi, setLoi] = useState<unknown>(null)

  const conLai = hocPhi.conLai

  const gui = async (giaTri: GiaTriThuTien) => {
    setLoi(null)
    try {
      const phieuThu = await thuTien.mutateAsync({
        soTien: giaTri.soTien,
        hinhThuc: giaTri.hinhThuc,
        ngayThu: giaTri.ngayThu.format('YYYY-MM-DD'),
        ghiChu: giaTri.ghiChu?.trim() ? giaTri.ghiChu.trim() : null,
      })
      message.success(`Đã ghi phiếu thu ${formatVnd(phieuThu.soTien)} cho ${hocPhi.tenHocSinh}`)
      onClose()
    } catch (error) {
      setLoi(error)
    }
  }

  return (
    <Modal
      open
      title={`Thu tiền — ${hocPhi.tenHocSinh}`}
      footer={null}
      width={480}
      onCancel={onClose}
    >
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">
          {moTaKy(hocPhi.thang, hocPhi.nam)} · thành tiền {formatVnd(hocPhi.thanhTien)} · đã thu{' '}
          {formatVnd(hocPhi.soTienDaThu)} · còn lại{' '}
          <Typography.Text strong>{formatVnd(hocPhi.conLai)}</Typography.Text>
        </Typography.Text>

        {conLai <= 0 ? (
          <Alert
            type="success"
            showIcon
            message="Dòng này đã thu đủ"
            description="Không còn gì để thu. Thu thừa bị chặn — muốn thu thêm thì phải sửa điểm danh để học phí tăng lên trước."
          />
        ) : null}

        {loi ? <LoiApiAlert error={loi} tieuDe="Không ghi được phiếu thu" /> : null}

        <Form<GiaTriThuTien>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ soTien: conLai, hinhThuc: 'tien_mat', ngayThu: dayjs(), ghiChu: '' }}
          onFinish={(giaTri) => {
            void gui(giaTri)
          }}
        >
          <Form.Item
            label="Số tiền thu"
            name="soTien"
            rules={[
              { required: true, message: 'Nhập số tiền thu' },
              {
                validator(_: unknown, giaTri: number) {
                  if (giaTri === undefined || giaTri === null) return Promise.resolve()
                  if (giaTri <= 0) return Promise.reject(new Error('Số tiền phải lớn hơn 0'))
                  if (giaTri > conLai) {
                    return Promise.reject(
                      new Error(
                        `Số tiền vượt quá số còn lại (${formatVnd(conLai)}). Thu thừa thì phải sửa học phí trước.`,
                      ),
                    )
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={0}
              max={conLai}
              step={50_000}
              formatter={(giaTri) =>
                giaTri === undefined ? '' : `${new Intl.NumberFormat('vi-VN').format(giaTri)} đ`
              }
              parser={(chuoi) => {
                const so = Number((chuoi ?? '').replace(/[^\d]/g, ''))
                return Number.isFinite(so) ? so : 0
              }}
            />
          </Form.Item>

          <Form.Item
            label="Hình thức"
            name="hinhThuc"
            rules={[{ required: true, message: 'Chọn hình thức thu tiền' }]}
          >
            <Select<HinhThucThanhToan>
              options={HINH_THUC_THANH_TOAN.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Ngày thu"
            name="ngayThu"
            rules={[{ required: true, message: 'Chọn ngày thu' }]}
            extra="Không ghi được ngày ở tương lai."
          >
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              disabledDate={(ngay) => ngay.isAfter(dayjs(), 'day')}
            />
          </Form.Item>

          <Form.Item label="Ghi chú" name="ghiChu">
            <Input.TextArea rows={2} placeholder="Ví dụ: phụ huynh chuyển khoản trước 3 ngày" />
          </Form.Item>

          <Flex justify="end" gap={8}>
            <Button onClick={onClose}>Huỷ</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={thuTien.isPending}
              disabled={conLai <= 0}
            >
              Thu tiền
            </Button>
          </Flex>
        </Form>
      </Flex>
    </Modal>
  )
}
