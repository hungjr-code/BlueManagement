import { useState } from 'react'
import { Alert, App, Button, Flex, Form, Input, Modal, Typography } from 'antd'
import { useHuyPhieuThu } from '../../api/tuition'
import type { PhieuThu } from '../../api/tuition'
import { formatVnd } from '../../lib/money'
import { nhanHinhThuc } from './hienThi'
import { LoiApiAlert } from './LoiApiAlert'

interface GiaTriHuyPhieuThu {
  lyDo: string
}

interface HuyPhieuThuModalProps {
  /** Phiếu thu cần huỷ. Component chỉ được dựng khi đã chọn phiếu (đang có mặt = đang mở). */
  phieuThu: PhieuThu
  tenHocSinh: string
  onClose: () => void
}

/**
 * Huỷ một phiếu thu đã ghi sai.
 *
 * Lý do là **bắt buộc** (backend trả 400 nếu thiếu): tiền đã vào sổ rồi thì việc xoá nó phải giải
 * thích được về sau — nội dung huỷ nằm trong nhật ký thao tác. Huỷ xong backend trả số đã thu về
 * đúng phần còn lại.
 */
export function HuyPhieuThuModal({ phieuThu, tenHocSinh, onClose }: HuyPhieuThuModalProps) {
  const [form] = Form.useForm<GiaTriHuyPhieuThu>()
  const { message } = App.useApp()
  const huy = useHuyPhieuThu()
  const [loi, setLoi] = useState<unknown>(null)

  const gui = async (giaTri: GiaTriHuyPhieuThu) => {
    setLoi(null)
    try {
      await huy.mutateAsync({ phieuThuId: phieuThu.id, lyDo: giaTri.lyDo.trim() })
      message.success(`Đã huỷ phiếu thu ${formatVnd(phieuThu.soTien)} của ${tenHocSinh}`)
      onClose()
    } catch (error) {
      setLoi(error)
    }
  }

  return (
    <Modal
      open
      title={`Huỷ phiếu thu ${formatVnd(phieuThu.soTien)}`}
      footer={null}
      width={520}
      onCancel={onClose}
    >
      <Flex vertical gap={12}>
        <Alert
          type="warning"
          showIcon
          message={`Phiếu thu của ${tenHocSinh}`}
          description={
            <Flex vertical gap={2}>
              <Typography.Text>
                {nhanHinhThuc(phieuThu.hinhThuc)} · ngày thu {phieuThu.ngayThu}
                {phieuThu.maGiaoDichNganHang ? ` · mã ${phieuThu.maGiaoDichNganHang}` : ''}
              </Typography.Text>
              <Typography.Text type="secondary">
                Số tiền này bị trừ khỏi phần đã thu của dòng học phí, và lý do huỷ được ghi vào nhật
                ký. Phiếu thu không xoá được khỏi lịch sử — đây là cách duy nhất gỡ nó khỏi sổ.
              </Typography.Text>
            </Flex>
          }
        />

        {loi ? <LoiApiAlert error={loi} tieuDe="Không huỷ được phiếu thu" /> : null}

        <Form<GiaTriHuyPhieuThu>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(giaTri) => {
            void gui(giaTri)
          }}
        >
          <Form.Item
            label="Lý do huỷ"
            name="lyDo"
            rules={[
              {
                validator(_: unknown, giaTri: string | undefined) {
                  if (!giaTri || giaTri.trim().length === 0) {
                    return Promise.reject(new Error('Phải ghi lý do huỷ phiếu thu'))
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              placeholder="Ví dụ: ghi nhầm sang học sinh khác, đã thu lại đúng người"
            />
          </Form.Item>

          <Flex justify="end" gap={8}>
            <Button onClick={onClose}>Để sau</Button>
            <Button type="primary" danger htmlType="submit" loading={huy.isPending}>
              Huỷ phiếu thu
            </Button>
          </Flex>
        </Form>
      </Flex>
    </Modal>
  )
}
