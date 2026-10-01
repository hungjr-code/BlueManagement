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
  /** Tên học sinh, cũng là phần đầu của nội dung chuyển khoản. */
  tenHocSinh: string
  soTien: number
  /** Kỳ học phí, ví dụ "Học phí tháng 09/2026". */
  kyHocPhi: string
  /**
   * Tài khoản nhận tiền của giáo viên dạy học sinh này. Mỗi giáo viên dùng tài khoản của mình,
   * nên hộp thoại nhận tài khoản từ bên ngoài thay vì tự đi tìm một tài khoản chung.
   */
  taiKhoan: TaiKhoanNhanTien | undefined
  /** Mẫu nội dung chuyển khoản của trung tâm (ở Cài đặt). */
  mauNoiDungChuyenKhoan?: string | null
  /** Tên giáo viên nhận tiền, hiện cho rõ tiền chuyển vào tài khoản của ai. */
  tenGiaoVienNhanTien?: string
}

/**
 * Hộp thoại thu tiền: hiện mã QR kèm đúng số tiền cần thu.
 *
 * Mã QR lấy từ vietqr.io dựa trên tài khoản giáo viên đã khai ở Cài đặt, để ngân hàng tự
 * điền số tài khoản, số tiền và nội dung — giảm sai sót khi chuyển khoản tay.
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
      message.error('Trình duyệt không cho sao chép tự động, bạn chọn và copy thủ công nhé')
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Thu tiền — ${tenHocSinh}`}
      footer={null}
      width={460}
    >
      {!daCauHinh ? (
        <Alert
          type="warning"
          showIcon
          message="Chưa có tài khoản nhận tiền"
          description={
            <>
              Mã QR cần biết tiền vào tài khoản nào. Mỗi giáo viên tự khai tài khoản của mình ở{' '}
              <Typography.Text code>Cài đặt</Typography.Text> — khai giúp người khác không được, kể
              cả admin.
            </>
          }
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
            <Typography.Text type="secondary">Số tiền cần thu</Typography.Text>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {formatVnd(soTien)}
            </Typography.Title>
            {tenGiaoVienNhanTien ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Chuyển cho giáo viên {tenGiaoVienNhanTien}
              </Typography.Text>
            ) : null}
          </div>

          {anhLoi ? (
            <Alert
              type="error"
              showIcon
              message="Không tải được ảnh mã QR"
              description="Mã QR lấy từ vietqr.io nên cần kết nối mạng. Kiểm tra mạng rồi thử lại."
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
                width={260}
                height={260}
                style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}
                onError={() => {
                  setAnhLoi(true)
                }}
              />
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Quét bằng app ngân hàng — số tiền và nội dung đã điền sẵn
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
            <Descriptions.Item label="Nội dung chuyển khoản">
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

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Mã QR chỉ để khách quét. Ghi phiếu thu làm ở nút “Thu tiền” (trang Học phí) để lần thu có
            số tiền, ngày và hình thức thanh toán.
          </Typography.Text>
        </Flex>
      )}
    </Modal>
  )
}
