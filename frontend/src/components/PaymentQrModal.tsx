import { useState } from 'react'
import { Alert, App, Button, Descriptions, Flex, Modal, Space, Typography } from 'antd'
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { buildVietQrUrl, daCauHinhTaiKhoan, dungMauNoiDung, tenNganHang } from '../config/nganHang'
import type { TaiKhoanNhanTien } from '../api/types'
import { formatVnd } from '../lib/money'

interface PaymentQrModalProps {
  open: boolean
  onClose: () => void
  tenHocSinh: string
  soTien: number
  kyHocPhi: string
  taiKhoan: TaiKhoanNhanTien | undefined
  mauNoiDungChuyenKhoan?: string | null
  tenGiaoVienNhanTien?: string
}

/**
 * Hộp thoại hiển thị mã QR thu tiền.
 */
export function PaymentQrModal({
  open,
  onClose,
  tenHocSinh,
  soTien,
  kyHocPhi,
  taiKhoan,
  mauNoiDungChuyenKhoan,
  tenGiaoVienNhanTien,
}: PaymentQrModalProps) {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [anhLoi, setAnhLoi] = useState(false)

  const noiDungChuyenKhoan = dungMauNoiDung(mauNoiDungChuyenKhoan, tenHocSinh, kyHocPhi)
  const qrUrl = buildVietQrUrl(taiKhoan, soTien, noiDungChuyenKhoan)
  const daCauHinh = daCauHinhTaiKhoan(taiKhoan)

  const saoChepNoiDung = async () => {
    try {
      await navigator.clipboard.writeText(noiDungChuyenKhoan)
      message.success('Đã sao chép nội dung chuyển khoản')
    } catch {
      message.error('Không thể sao chép tự động')
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Thu tiền — ${tenHocSinh}`}
      footer={null}
      width={440}
    >
      {!daCauHinh ? (
        <Alert
          type="warning"
          showIcon
          message="Chưa thiết lập tài khoản nhận tiền"
          description="Vui lòng thiết lập tài khoản nhận tiền trong phần Cài đặt trước khi tạo mã QR."
          action={
            <Button
              size="small"
              type="primary"
              onClick={() => {
                navigate('/settings')
              }}
            >
              Mở Cài đặt
            </Button>
          }
        />
      ) : (
        <Flex vertical gap={16}>
          <div style={{ textAlign: 'center' }}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>Số tiền cần thu</Typography.Text>
            <Typography.Title level={3} style={{ margin: 0, color: '#5B8DEF' }}>
              {formatVnd(soTien)}
            </Typography.Title>
            {tenGiaoVienNhanTien ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Người nhận: {tenGiaoVienNhanTien}
              </Typography.Text>
            ) : null}
          </div>

          {anhLoi ? (
            <Alert
              type="error"
              showIcon
              message="Không tải được ảnh mã QR"
              action={
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setAnhLoi(false)
                  }}
                >
                  Thử lại
                </Button>
              }
            />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <img
                src={qrUrl ?? ''}
                alt={`Mã QR thu ${formatVnd(soTien)} của ${tenHocSinh}`}
                width={240}
                height={240}
                style={{ border: '1px solid #E6EDF5', borderRadius: 12, padding: 8 }}
                onError={() => {
                  setAnhLoi(true)
                }}
              />
              <div style={{ marginTop: 6 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Quét mã qua ứng dụng ngân hàng
                </Typography.Text>
              </div>
            </div>
          )}

          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Ngân hàng">
              {tenNganHang(taiKhoan?.nganHangBin)}
            </Descriptions.Item>
            <Descriptions.Item label="Số tài khoản">
              <Typography.Text copyable>{taiKhoan?.soTaiKhoan ?? '—'}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Chủ tài khoản">
              {taiKhoan?.chuTaiKhoan || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Nội dung">
              <Space>
                <Typography.Text>{noiDungChuyenKhoan}</Typography.Text>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    void saoChepNoiDung()
                  }}
                >
                  Sao chép
                </Button>
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </Flex>
      )}
    </Modal>
  )
}
