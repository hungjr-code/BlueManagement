import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Flex,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import {
  DisconnectOutlined,
  ExclamationCircleOutlined,
  GoogleOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { http } from '../../api/http'
import {
  useChonLichGoogle,
  useDanhSachLichGoogle,
  useDatTuDongDongBo,
  useDongBoGoogle,
  useDongBoVeGoogle,
  useLayDuongDanUyQuyen,
  useNgatKetNoiGoogle,
  useTrangThaiGoogle,
} from '../../api/googleCalendar'
import { laLoiChuaCauHinh, noiDungLoi, thoiDiemDiaPhuong, tomTatDongBo, tomTatDongBoVe } from './hienThiGoogle'

interface TheGoogleCalendarProps {
  laAdmin: boolean
}

interface TongHopGoogle {
  soGiaoVienDangLam: number
  soDaKetNoi: number
  soChuaKetNoi: number
  tenChuaKetNoi: string[]
}

interface ThamSoDongBo {
  tuNgay?: string
  denNgay?: string
  tatCaGiaoVien?: boolean
}

async function layTongHopGoogle(): Promise<TongHopGoogle> {
  const { data } = await http.get<TongHopGoogle>('/google-calendar/tong-hop')
  return data
}

function useTongHopGoogle(laAdmin: boolean) {
  return useQuery({
    queryKey: ['google-calendar', 'tong-hop'],
    queryFn: layTongHopGoogle,
    enabled: laAdmin,
    staleTime: 30_000,
  })
}

/**
 * Quản lý kết nối và đồng bộ Google Calendar.
 */
export function TheGoogleCalendar({ laAdmin }: TheGoogleCalendarProps) {
  const { message, modal } = App.useApp()
  const [searchParams, setSearchParams] = useSearchParams()

  const trangThai = useTrangThaiGoogle()
  const layDuongDan = useLayDuongDanUyQuyen()
  const chonLich = useChonLichGoogle()
  const dongBo = useDongBoGoogle()
  const dongBoVe = useDongBoVeGoogle()
  const datTuDong = useDatTuDongDongBo()
  const ngatKetNoi = useNgatKetNoiGoogle()
  const tongHop = useTongHopGoogle(laAdmin)

  const [loiKetNoi, setLoiKetNoi] = useState<unknown>(null)
  const [dongBoTatCa, setDongBoTatCa] = useState(false)
  const [loiDongBo, setLoiDongBo] = useState<string | null>(null)

  const duLieu = trangThai.data
  const daKetNoi = duLieu?.daKetNoi === true
  const danhSachLich = useDanhSachLichGoogle(daKetNoi)
  const lanCuoi = duLieu?.lanDongBoCuoi ?? null

  const daHienThongBao = useRef(false)

  useEffect(() => {
    const ketQua = searchParams.get('google')
    if (!ketQua || daHienThongBao.current) return

    daHienThongBao.current = true
    const thongBao = searchParams.get('thongBao')

    if (ketQua === 'ket-noi-thanh-cong') {
      message.success('Đã kết nối Google Calendar thành công')
    } else if (ketQua === 'loi') {
      message.error(
        thongBao ? `Kết nối Google Calendar thất bại: ${thongBao}` : 'Kết nối Google Calendar thất bại',
      )
    }

    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, message])

  const refetchTrangThai = trangThai.refetch
  const dangChoKetNoi = duLieu ? !duLieu.daKetNoi : false

  useEffect(() => {
    if (!dangChoKetNoi) return undefined

    const khiHienLai = () => {
      if (document.visibilityState === 'visible') void refetchTrangThai()
    }

    document.addEventListener('visibilitychange', khiHienLai)
    return () => {
      document.removeEventListener('visibilitychange', khiHienLai)
    }
  }, [dangChoKetNoi, refetchTrangThai])

  const moTrangCapQuyen = async () => {
    setLoiKetNoi(null)

    try {
      const duongDan = await layDuongDan.mutateAsync()
      window.open(duongDan.url, '_blank', 'noopener')
      message.info('Đã mở trang đăng nhập Google trong tab mới. Hãy hoàn tất và quay lại đây.')
    } catch (error) {
      setLoiKetNoi(error)
    }
  }

  const doiLich = async (calendarId: string) => {
    try {
      await chonLich.mutateAsync(calendarId)
      message.success('Đã đổi lịch đích thành công')
    } catch (error) {
      message.error(noiDungLoi(error, 'Không chọn được lịch đích'))
    }
  }

  /**
   * "Đồng bộ lại" = đẩy lên TRƯỚC rồi kéo về SAU, đúng thứ tự đó:
   *  - đẩy lên trước để những gì vừa sửa trong app có mặt trên Google;
   *  - kéo về sau để lấy những gì giáo viên sửa trực tiếp trên Google (đổi giờ, huỷ buổi).
   *
   * Ngược thứ tự sẽ khiến thay đổi cũ trên Google ghi đè thay đổi vừa làm trong app.
   */
  const dongBoLai = async () => {
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

      const ve = await dongBoVe.mutateAsync({ chiKhiQuaHan: false })

      const phanKeoVe = [
        ve.soDoiGio > 0 ? `cập nhật giờ ${ve.soDoiGio} buổi` : null,
        ve.soDanhDauNghi > 0 ? `đánh dấu nghỉ ${ve.soDanhDauNghi} buổi` : null,
        ve.soCanhBao > 0 ? `${ve.soCanhBao} chỗ cần xem lại` : null,
      ]
        .filter(Boolean)
        .join(', ')

      message.success(
        `${tomTatDongBo(ketQua)} — đã đẩy lên. Kéo về: ${phanKeoVe || 'không có gì thay đổi'}.`,
      )
    } catch (error) {
      message.error(noiDungLoi(error, 'Không đồng bộ được với Google Calendar'))
    }
  }

  const thucHienNgat = async (xoaSuKienDaTao: boolean) => {
    try {
      const ketQua = await ngatKetNoi.mutateAsync(xoaSuKienDaTao)

      if (xoaSuKienDaTao) {
        message.success(
          ketQua
            ? `Đã ngắt kết nối và xoá ${ketQua.soXoa} sự kiện trên Google`
            : 'Đã ngắt kết nối Google Calendar',
        )
      } else {
        message.success('Đã ngắt kết nối Google Calendar')
      }
    } catch (error) {
      message.error(noiDungLoi(error, 'Không ngắt được kết nối Google Calendar'))
    }
  }

  const hoiNgatKetNoi = () => {
    modal.confirm({
      title: 'Ngắt kết nối Google Calendar?',
      icon: <ExclamationCircleOutlined />,
      okText: 'Xoá sự kiện trên Google',
      cancelText: 'Giữ lại sự kiện trên Google',
      closable: false,
      keyboard: false,
      mask: { closable: false },
      content: (
        <Typography.Text>
          Bạn có muốn xoá các sự kiện lịch dạy đã đồng bộ trên Google Calendar trước khi ngắt kết nối không?
        </Typography.Text>
      ),
      onOk: () => thucHienNgat(true),
      onCancel: () => thucHienNgat(false),
    })
  }

  if (trangThai.isPending) {
    return (
      <Card size="small" title="Google Calendar">
        <Skeleton active paragraph={{ rows: 4 }} />
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
          description={noiDungLoi(trangThai.error, 'Lỗi kết nối máy chủ')}
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

  return (
    <Card
      size="small"
      title={
        <Space wrap>
          Google Calendar
          {daKetNoi ? <Tag color="success">Đã kết nối</Tag> : <Tag color="default">Chưa kết nối</Tag>}
        </Space>
      }
      extra={
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
      }
    >
      <Flex vertical gap={16}>
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="Trạng thái tài khoản">
            {daKetNoi ? (
              <Typography.Text strong>{duLieu.taiKhoan ?? 'Đã liên kết'}</Typography.Text>
            ) : (
              <Typography.Text type="secondary">Chưa liên kết tài khoản Google</Typography.Text>
            )}
          </Descriptions.Item>
          {daKetNoi ? (
            <Descriptions.Item label="Lịch đích ghi sự kiện">{duLieu.calendarId ?? 'Lịch mặc định'}</Descriptions.Item>
          ) : null}
          <Descriptions.Item label="Lần kéo thay đổi từ Google về">
            {duLieu.lanDongBoVeCuoi ? (
              <Space direction="vertical" size={2}>
                <Typography.Text>{tomTatDongBoVe(duLieu.lanDongBoVeCuoi)}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  lúc {thoiDiemDiaPhuong(duLieu.lanDongBoVeCuoi.thoiDiemUtc)}
                </Typography.Text>
              </Space>
            ) : (
              'Chưa kéo về lần nào'
            )}
          </Descriptions.Item>

          <Descriptions.Item label="Lần đẩy lên Google gần nhất">
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

        {daKetNoi ? (
          <Flex vertical gap={6}>
            <Space size={8} wrap>
              <Switch
                checked={duLieu.tuDongDongBo}
                loading={datTuDong.isPending}
                onChange={(bat: boolean) => {
                  datTuDong.mutate(bat, {
                    onSuccess: () => {
                      message.success(
                        bat
                          ? 'Đã bật: mở màn Lịch dạy sẽ tự kéo thay đổi từ Google về'
                          : 'Đã tắt tự động kéo thay đổi từ Google về',
                      )
                    },
                    onError: (error: unknown) => {
                      message.error(noiDungLoi(error, 'Không đổi được cài đặt tự đồng bộ'))
                    },
                  })
                }}
              />
              <Typography.Text>Tự kéo thay đổi từ Google về khi mở màn Lịch dạy</Typography.Text>
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Cách nhau ít nhất 10 phút, nên mở đi mở lại vài lần không gọi Google liên tục. Muốn chạy
              ngay thì bấm Đồng bộ lại.
            </Typography.Text>
          </Flex>
        ) : null}

        {daKetNoi && !duLieu.coQuyenDrive ? (
          <Alert
            type="warning"
            showIcon
            message="Chưa có quyền gửi tài liệu lên Drive"
            description="Tài khoản Google này kết nối từ trước khi có tính năng giao bài. Bấm Ngắt kết nối rồi Kết nối Google Calendar lại để cấp thêm quyền Drive."
          />
        ) : null}

        {laAdmin && tongHop.data ? (
          <Card size="small" type="inner" title="Tổng hợp kết nối của giáo viên">
            <Flex vertical gap={8}>
              <Space wrap size={16}>
                <Typography.Text>
                  Tổng giáo viên: <strong>{tongHop.data.soGiaoVienDangLam}</strong>
                </Typography.Text>
                <Tag color="success">Đã kết nối {tongHop.data.soDaKetNoi}</Tag>
                {tongHop.data.soChuaKetNoi > 0 ? (
                  <Tag color="warning">Chưa kết nối {tongHop.data.soChuaKetNoi}</Tag>
                ) : null}
              </Space>
            </Flex>
          </Card>
        ) : null}

        {loiKetNoi ? (
          <Alert
            type={laLoiChuaCauHinh(loiKetNoi) ? 'warning' : 'error'}
            showIcon
            closable
            onClose={() => {
              setLoiKetNoi(null)
            }}
            message="Chưa thể kết nối Google Calendar"
            description={noiDungLoi(loiKetNoi, 'Vui lòng kiểm tra lại cấu hình hoặc thử lại sau')}
          />
        ) : null}

        {!daKetNoi ? (
          <Space wrap>
            <Button
              type="primary"
              icon={<GoogleOutlined />}
              loading={layDuongDan.isPending}
              onClick={() => {
                void moTrangCapQuyen()
              }}
            >
              Kết nối Google Calendar
            </Button>
          </Space>
        ) : (
          <Flex vertical gap={12}>
            <Space wrap align="center">
              <Typography.Text strong>Lịch đích:</Typography.Text>
              <Select
                style={{ minWidth: 260 }}
                value={duLieu.calendarId ?? undefined}
                placeholder="Chọn lịch để ghi sự kiện"
                loading={danhSachLich.isPending || chonLich.isPending}
                options={(danhSachLich.data ?? []).map((lich) => ({
                  value: lich.id,
                  label: lich.laLichChinh ? `${lich.ten} (chính)` : lich.ten,
                }))}
                onChange={(giaTri: string) => {
                  void doiLich(giaTri)
                }}
              />
              <Button
                type="primary"
                icon={<SyncOutlined />}
                loading={dongBo.isPending || dongBoVe.isPending}
                onClick={() => {
                  void dongBoLai()
                }}
              >
                Đồng bộ lại
              </Button>
              <Button danger icon={<DisconnectOutlined />} onClick={hoiNgatKetNoi}>
                Ngắt kết nối
              </Button>
            </Space>

            {laAdmin ? (
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
        )}
      </Flex>
    </Card>
  )
}
