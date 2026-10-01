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
  Tag,
  Typography,
} from 'antd'
import { ReloadOutlined, SyncOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useDongBoGoogle, useTrangThaiGoogle } from '../../api/googleCalendar'
import { noiDungLoi, thoiDiemDiaPhuong, tomTatDongBo } from './hienThiLich'

interface KhoiGoogleCalendarProps {
  laAdmin: boolean
}

/** Tham số đồng bộ. `tatCaGiaoVien` chỉ admin dùng được; giáo viên gửi lên sẽ ăn 403. */
interface ThamSoDongBo {
  tuNgay?: string
  denNgay?: string
  tatCaGiaoVien?: boolean
}

/**
 * Khối trạng thái Google Calendar trên màn hình Lịch dạy.
 *
 * Kết nối là của TỪNG giáo viên: buổi học của ai thì nằm trên lịch Google của người đó. Ai cũng bấm
 * được "Đồng bộ ngay" cho lịch của chính mình; chưa kết nối thì khối này mời họ sang Cài đặt để tự
 * kết nối (việc kết nối/ngắt/chọn lịch nằm ở đó, không phải ở màn hình này).
 *
 * Điều khối này phải nói thật: đồng bộ là MỘT CHIỀU (hệ thống → Google). Sửa trên Google không
 * quay về hệ thống, vì phần webhook hai chiều chưa làm.
 *
 * `laAdmin` chỉ dùng cho tuỳ chọn đồng bộ cho tất cả giáo viên — giáo viên không thấy tuỳ chọn đó.
 */
export function KhoiGoogleCalendar({ laAdmin }: KhoiGoogleCalendarProps) {
  const { message } = App.useApp()
  const dieuHuong = useNavigate()
  const trangThai = useTrangThaiGoogle()
  const dongBo = useDongBoGoogle()

  const [dongBoTatCa, setDongBoTatCa] = useState(false)
  /** Câu cảnh báo khi một lượt đồng bộ có lỗi — hiện bằng Alert, thay vì báo thành công chung chung. */
  const [loiDongBo, setLoiDongBo] = useState<string | null>(null)

  const duLieu = trangThai.data
  const daKetNoi = duLieu?.daKetNoi === true
  const lanCuoi = duLieu?.lanDongBoCuoi ?? null

  const dongBoNgay = async () => {
    setLoiDongBo(null)

    // Cờ này chỉ admin đặt được; giáo viên gửi lên sẽ bị 403 nên giao diện cũng không hiện cho họ.
    const thamSo: ThamSoDongBo = laAdmin && dongBoTatCa ? { tatCaGiaoVien: true } : {}

    try {
      const ketQua = await dongBo.mutateAsync(thamSo)

      if (ketQua.loi) {
        // Một người lỗi không làm hỏng cả lượt: phải nói rõ lỗi, KHÔNG báo thành công chung chung.
        const cau =
          laAdmin && dongBoTatCa
            ? `Một số giáo viên lỗi: ${ketQua.loi}`
            : `Đồng bộ gặp lỗi: ${ketQua.loi}`

        setLoiDongBo(cau)
        message.warning(cau)
        return
      }

      message.success(`${tomTatDongBo(ketQua)} — đồng bộ từ hôm nay tới hết tháng sau`)
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
            type="warning"
            showIcon
            message="Đang ở CHẾ ĐỘ GIẢ (chỉ máy dev)"
            description="Backend không gọi Google thật: sự kiện chỉ được ghi vào bộ nhớ để thử luồng. Đừng tin số liệu đồng bộ khi đang ở chế độ này."
          />
        ) : null}

        {!daKetNoi ? (
          <Alert
            type="warning"
            showIcon
            message="Bạn chưa kết nối Google Calendar"
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text>
                  Buổi học của ai thì nằm trên lịch Google của người đó. Bạn tự kết nối lịch của mình —
                  không ai, kể cả admin, kết nối hộ hay xem được token của bạn.
                </Typography.Text>
                <Typography.Text type="secondary">
                  Các buổi học vẫn nằm đầy đủ trong hệ thống và vẫn điểm danh bình thường — chỉ chưa có sự
                  kiện nào trên Google Calendar.
                </Typography.Text>
              </Space>
            }
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
            <Descriptions.Item label="Tài khoản Google bạn đã liên kết">
              {duLieu.taiKhoan ?? 'Đã liên kết (backend không trả email)'}
            </Descriptions.Item>
            <Descriptions.Item label="Lịch đích đang ghi">{duLieu.calendarId ?? 'Chưa chọn lịch'}</Descriptions.Item>
            <Descriptions.Item label="Lần đồng bộ gần nhất">
              {lanCuoi ? (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{tomTatDongBo(lanCuoi)}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    lúc {thoiDiemDiaPhuong(lanCuoi.thoiDiemUtc)}
                  </Typography.Text>
                  {lanCuoi.loi ? (
                    <Typography.Text type="danger" style={{ fontSize: 12 }}>
                      Lỗi gần nhất: {lanCuoi.loi}
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
            Đồng bộ cho tất cả giáo viên (mọi người lên lịch của chính họ)
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
            description="Các giáo viên còn lại vẫn được đồng bộ bình thường; người lỗi cần kiểm tra kết nối Google của chính họ."
          />
        ) : null}

        <Alert
          type="info"
          showIcon
          message="Đồng bộ MỘT CHIỀU: hệ thống → Google Calendar"
          description="Sửa hay xoá sự kiện ngay trên Google Calendar sẽ KHÔNG quay về hệ thống. Phần nhận thay đổi từ Google (webhook hai chiều) chưa làm, nên muốn đổi lịch thì sửa trong hệ thống rồi bấm Đồng bộ ngay."
        />

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Mỗi buổi học là một sự kiện riêng (không phải sự kiện lặp hằng tuần), nên nghỉ một buổi hay đổi giờ
          một buổi chỉ ảnh hưởng đúng buổi đó. Buổi đang ở trạng thái <Tag color="warning">Nghỉ</Tag> không được
          đẩy lên Google; nếu trước đó đã đẩy thì sự kiện bị gỡ.
        </Typography.Text>
      </Flex>
    </Card>
  )
}
