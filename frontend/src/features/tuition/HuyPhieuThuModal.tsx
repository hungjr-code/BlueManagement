import { useState } from 'react'
import { Alert, App, Button, Flex, Form, Input, Modal, Typography } from 'antd'
import { useHuyPhieuThu } from '../../api/tuition'
import type { PhieuThu } from '../../api/tuition'
import { formatVnd } from '../../lib/money'
import { nhanHinhThuc } from './hienThi'
import { LoiApiAlert } from '../../components/LoiApiAlert'

interface GiaTriHuyPhieuThu {
  lyDo: string
}

interface HuyPhieuThuModalProps {
  phieuThu: PhieuThu
  tenHocSinh: string
  onClose: () => void
}

/**
 * Huỷ phiếu thu đã ghi.
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
      title={`Huỷ phiếu thu — ${formatVnd(phieuThu.soTien)}`}
      footer={null}
      width={480}
      onCancel={onClose}
    >
      <Flex vertical gap={12}>
        <Alert
          type="warning"
          showIcon
          message={`Phiếu thu của ${tenHocSinh}`}
          description={
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {nhanHinhThuc(phieuThu.hinhThuc)} · Ngày thu {phieuThu.ngayThu}
              {phieuThu.maGiaoDichNganHang ? ` · Mã GD: ${phieuThu.maGiaoDichNganHang}` : ''}
            </Typography.Text>
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
                    return Promise.reject(new Error('Vui lòng nhập lý do huỷ phiếu thu'))
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <Input.TextArea
              rows={3}
              maxLength={500}
              placeholder="Nhập lý do huỷ phiếu thu"
            />
          </Form.Item>

          <Flex justify="end" gap={8}>
            <Button onClick={onClose}>Huỷ</Button>
            <Button type="primary" danger htmlType="submit" loading={huy.isPending}>
              Xác nhận huỷ
            </Button>
          </Flex>
        </Form>
      </Flex>
    </Modal>
  )
}
