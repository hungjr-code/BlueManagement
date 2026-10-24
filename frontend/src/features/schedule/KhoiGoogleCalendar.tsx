import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Flex,
  Skeleton,
  Space,
  Typography,
} from 'antd'
import { ReloadOutlined, SyncOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useDongBoGoogle, useTrangThaiGoogle } from '../../api/googleCalendar'
import { noiDungLoi, thoiDiemDiaPhuong, tomTatDongBo } from './hienThiLich'

interface KhoiGoogleCalendarProps {
  laAdmin: boolean
}

interface ThamSoDongBo {
  tuNgay?: string
  denNgay?: string
  tatCaGiaoVien?: boolean
}

/**
 * Trạng thái và đồng bộ Google Calendar.
 */
export function KhoiGoogleCalendar({ laAdmin }: KhoiGoogleCalendarProps) {
  const { message } = App.useApp()
  const dieuHuong = useNavigate()
  const trangThai = useTrangThaiGoogle()
  const dongBo = useDongBoGoogle()

  const [dongBoTatCa, setDongBoTatCa] = useState(false)
  const [loiDongBo, setLoiDongBo] = useState<string | null>(null)

  const duLieu = trangThai.data
  const daKetNoi = duLieu?.daKetNoi === true
  const lanCuoi = duLieu?.lanDongBoCuoi ?? null

  const dongBoNgay = async () => {
    setLoiDongBo(null)
    const thamSo: ThamSoDongBo = laAdmin && dongBoTatCa ? { tatCaGiaoVien: true } : {}

    try {
      const ketQua = await dongBo.mutateAsync(thamSo)

      if (ketQua.loi) {
        const cau =
          laAdmin && dongBoTatCa
            ? `Một số giáo viên lỗi: ${ketQua.loi}`
            : `Đồng bộ gặp lỗi: ${ketQua.loi}`

        setLoiDongBo(cau)
        message.warning(cau)
        return
      }

      message.success(`${tomTatDongBo(ketQua)} — hoàn tất đồng bộ`)
    } catch (error) {
      message.error(noiDungLoi(error, 'Không đồng bộ được lên Google Calendar'))
    }
  }

  if (trangThai.isPending) {
    return (
      <Card size="small" title="Google Calendar">
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    )
  }

  if (trangThai.isError || !duLieu) {
    return (
      <Card size="small" title="Google Calendar">
        <Alert
          type="error"
          showIcon
          message="Không đọc được trạng thái Google Calendar"
          description={noiDungLoi(trangThai.error, 'Backend không trả về trạng thái kết nối Google')}
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                void trangThai.refetch()
              }}
            >
              Thử lại
            </Button>
          }
        />
      </Card>
    )
  }

  const nutLamMoi = (
    <Button
      size="small"
      icon={<ReloadOutlined />}
      loading={trangThai.isFetching}
      onClick={() => {
        void trangThai.refetch()
      }}
    >
      Làm mới
    </Button>
  )

  return (
    <Card
      size="small"
      title="Google Calendar"
      extra={
        daKetNoi ? (
          <Space wrap>
            <Button
              size="small"
              type="primary"
              icon={<SyncOutlined />}
              loading={dongBo.isPending}
              onClick={() => {
                void dongBoNgay()
              }}
            >
              Đồng bộ ngay
            </Button>
            {nutLamMoi}
          </Space>
        ) : (
          nutLamMoi
        )
      }
    >
      <Flex vertical gap={12}>
        {duLieu.cheDoGia ? (
          <Alert
            type="info"
            showIcon
            message="Chế độ giả lập máy chủ"
            description="Đang chạy ở chế độ mô phỏng lịch trên máy dev."
          />
        ) : null}

        {!daKetNoi ? (
          <Alert
            type="warning"
            showIcon
            message="Chưa kết nối Google Calendar"
            description="Kết nối tài khoản Google trong phần Cài đặt để lịch dạy được tự động cập nhật lên Google Calendar của bạn."
            action={
              <Button
                size="small"
                onClick={() => {
                  dieuHuong('/settings')
                }}
              >
                Mở Cài đặt
              </Button>
            }
          />
        ) : (
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Tài khoản liên kết">
              {duLieu.taiKhoan ?? 'Đã liên kết'}
            </Descriptions.Item>
            <Descriptions.Item label="Lịch đích">
              {duLieu.calendarId ?? 'Lịch mặc định'}
            </Descriptions.Item>
            <Descriptions.Item label="Đồng bộ gần nhất">
              {lanCuoi ? (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{tomTatDongBo(lanCuoi)}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    lúc {thoiDiemDiaPhuong(lanCuoi.thoiDiemUtc)}
                  </Typography.Text>
                  {lanCuoi.loi ? (
                    <Typography.Text type="danger" style={{ fontSize: 12 }}>
                      Lỗi: {lanCuoi.loi}
                    </Typography.Text>
                  ) : null}
                </Space>
              ) : (
                'Chưa đồng bộ lần nào'
              )}
            </Descriptions.Item>
          </Descriptions>
        )}

        {laAdmin && daKetNoi ? (
          <Checkbox
            checked={dongBoTatCa}
            onChange={(suKien) => {
              setDongBoTatCa(suKien.target.checked)
            }}
          >
            Đồng bộ cho tất cả giáo viên
          </Checkbox>
        ) : null}

        {loiDongBo ? (
          <Alert
            type="warning"
            showIcon
            closable
            onClose={() => {
              setLoiDongBo(null)
            }}
            message={loiDongBo}
          />
        ) : null}
      </Flex>
    </Card>
  )
}
