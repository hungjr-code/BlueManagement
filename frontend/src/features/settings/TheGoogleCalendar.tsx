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
  List,
  Select,
  Skeleton,
  Space,
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
  useDongBoGoogle,
  useLayDuongDanUyQuyen,
  useNgatKetNoiGoogle,
  useTrangThaiGoogle,
} from '../../api/googleCalendar'
import { laLoiChuaCauHinh, noiDungLoi, tenQuyen, thoiDiemDiaPhuong, tomTatDongBo } from './hienThiGoogle'

interface TheGoogleCalendarProps {
  laAdmin: boolean
}

/** Số liệu tổng hợp admin đọc từ `GET /api/google-calendar/tong-hop`. */
interface TongHopGoogle {
  soGiaoVienDangLam: number
  soDaKetNoi: number
  soChuaKetNoi: number
  /** Tên những giáo viên chưa kết nối, để admin nhắc. Không kèm email/token của ai. */
  tenChuaKetNoi: string[]
}

/** Tham số đồng bộ. `tatCaGiaoVien` chỉ admin dùng được; giáo viên gửi lên sẽ ăn 403. */
interface ThamSoDongBo {
  tuNgay?: string
  denNgay?: string
  tatCaGiaoVien?: boolean
}

async function layTongHopGoogle(): Promise<TongHopGoogle> {
  const { data } = await http.get<TongHopGoogle>('/google-calendar/tong-hop')
  return data
}

/**
 * Số liệu tổng hợp cho admin, viết ngay trong file này vì `src/api/**` không thuộc phạm vi lượt sửa
 * này. `enabled: laAdmin` để giáo viên không gọi — endpoint đó chỉ admin đọc được (403 nếu không).
 */
function useTongHopGoogle(laAdmin: boolean) {
  return useQuery({
    queryKey: ['google-calendar', 'tong-hop'],
    queryFn: layTongHopGoogle,
    enabled: laAdmin,
    staleTime: 30_000,
  })
}

/**
 * Thẻ Google Calendar ở màn hình Cài đặt.
 *
 * Bốn việc thẻ này phải làm đúng:
 *
 * 1. **Kết nối là của TỪNG giáo viên**: ai cũng kết nối / chọn lịch / đồng bộ / ngắt kết nối được cho
 *    chính mình — kể cả khi họ không phải admin. Không ai, kể cả admin, kết nối hộ hay xem token của
 *    người khác.
 * 2. **Nói thật trạng thái**: đã cấu hình chưa, đã kết nối chưa, đang liên kết email nào, ghi vào
 *    lịch nào, lần đồng bộ gần nhất ra sao. Không có số liệu nào là chữ tĩnh.
 * 3. **Không giấu chế độ giả**: chạy máy dev với `GoogleCalendar:CheDoGia` thì backend không gọi
 *    Google thật, nên phải có băng cảnh báo vàng để không ai tin nhầm là đã lên lịch thật.
 * 4. **Ngắt kết nối là quyết định hai nhánh**: xoá sự kiện đã tạo trên Google, hay giữ lại. Hai hệ
 *    quả khác hẳn nhau nên hộp thoại hỏi rõ từng nhánh, và chỉ hai nút đó là đường thoát (không đóng
 *    bằng ESC hay bấm ra ngoài) — bấm nhầm nút "giữ lại" khi định xoá là chuyện không sửa được.
 *
 * `laAdmin` CHỈ dùng cho hai phần dành riêng cho admin: khối số liệu tổng hợp và tuỳ chọn đồng bộ cho
 * tất cả giáo viên. Mọi nút khác của thẻ không phụ thuộc vai trò.
 */
export function TheGoogleCalendar({ laAdmin }: TheGoogleCalendarProps) {
  const { message, modal } = App.useApp()
  const [searchParams, setSearchParams] = useSearchParams()

  const trangThai = useTrangThaiGoogle()
  const layDuongDan = useLayDuongDanUyQuyen()
  const chonLich = useChonLichGoogle()
  const dongBo = useDongBoGoogle()
  const ngatKetNoi = useNgatKetNoiGoogle()
  const tongHop = useTongHopGoogle(laAdmin)

  const [loiKetNoi, setLoiKetNoi] = useState<unknown>(null)
  const [dongBoTatCa, setDongBoTatCa] = useState(false)
  /** Câu cảnh báo khi một lượt đồng bộ có lỗi — hiện bằng Alert, thay vì báo thành công chung chung. */
  const [loiDongBo, setLoiDongBo] = useState<string | null>(null)

  const duLieu = trangThai.data
  const daKetNoi = duLieu?.daKetNoi === true

  // Danh sách lịch là của CHÍNH người đang đăng nhập, nên chỉ hỏi khi người đó đã kết nối.
  const danhSachLich = useDanhSachLichGoogle(daKetNoi)

  const lanCuoi = duLieu?.lanDongBoCuoi ?? null

  /** Chặn hiện thông báo hai lần khi React StrictMode chạy effect hai lượt ở máy dev. */
  const daHienThongBao = useRef(false)

  /**
   * Google trả người dùng về `/settings?google=…` (backend chuyển hướng sau khi cấp quyền).
   * Hiện thông báo đúng một lần rồi xoá tham số khỏi URL để F5 không lặp lại thông báo cũ.
   */
  useEffect(() => {
    const ketQua = searchParams.get('google')
    if (!ketQua || daHienThongBao.current) return

    daHienThongBao.current = true
    const thongBao = searchParams.get('thongBao')

    if (ketQua === 'ket-noi-thanh-cong') {
      message.success('Đã kết nối Google Calendar')
    } else if (ketQua === 'loi') {
      message.error(
        thongBao ? `Kết nối Google Calendar thất bại: ${thongBao}` : 'Kết nối Google Calendar thất bại',
      )
    } else {
      message.warning(`Google Calendar trả về kết quả không rõ: ${ketQua}`)
    }

    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, message])

  /**
   * Cấp quyền xong thì người dùng quay lại tab Cài đặt đang mở sẵn — tab đó không tự biết là đã kết
   * nối (`refetchOnWindowFocus` bị tắt để đỡ gọi API). Chỉ khi CHƯA kết nối mới tự hỏi lại lúc tab
   * hiện ra, vì đó đúng là lúc đang chờ kết quả từ tab Google.
   */
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
      // Mở tab mới, KHÔNG điều hướng trang hiện tại: người dùng có thể huỷ giữa đường mà vẫn
      // còn nguyên màn hình Cài đặt để bấm lại.
      //
      // Kèm "noopener" để trang Google không với tới được window.opener. Đổi lại, trình duyệt trả về
      // null cho lời gọi này kể cả khi tab mở thành công, nên KHÔNG dùng giá trị trả về để đoán xem
      // tab có bị chặn hay không — chỉ nhắc người dùng kiểm tra nếu không thấy tab nào hiện ra.
      window.open(duongDan.url, '_blank', 'noopener')

      message.info(
        duongDan.cheDoGia
          ? 'Đã mở trang cấp quyền ở chế độ giả trong tab mới — bấm cấp quyền ở đó rồi quay lại đây. Nếu không thấy tab nào mở ra, hãy cho phép cửa sổ bật lên cho trang này rồi bấm lại.'
          : 'Đã mở trang đăng nhập Google trong tab mới — đồng ý cấp quyền cho lịch của bạn rồi quay lại đây. Nếu không thấy tab nào mở ra, hãy cho phép cửa sổ bật lên cho trang này rồi bấm lại.',
      )
    } catch (error) {
      setLoiKetNoi(error)
    }
  }

  const doiLich = async (calendarId: string) => {
    try {
      await chonLich.mutateAsync(calendarId)
      message.success('Đã đổi lịch đích để ghi sự kiện')
    } catch (error) {
      message.error(noiDungLoi(error, 'Không chọn được lịch đích'))
    }
  }

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

  const thucHienNgat = async (xoaSuKienDaTao: boolean) => {
    try {
      const ketQua = await ngatKetNoi.mutateAsync(xoaSuKienDaTao)

      if (xoaSuKienDaTao) {
        message.success(
          ketQua
            ? `Đã ngắt kết nối và xoá ${ketQua.soXoa} sự kiện đã tạo trên Google`
            : 'Đã ngắt kết nối Google Calendar',
        )
      } else {
        message.success('Đã ngắt kết nối, giữ nguyên các sự kiện đã tạo trên Google')
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
      cancelText: 'Giữ lại trên Google',
      // Hai nút là hai quyết định khác hẳn nhau, nên không cho thoát bằng ESC hay bấm ra ngoài.
      closable: false,
      keyboard: false,
      mask: { closable: false },
      content: (
        <Space direction="vertical" size={6}>
          <Typography.Text>
            Dù chọn cách nào, backend cũng xoá refresh token đã lưu của CHÍNH BẠN: lịch dạy của bạn sẽ
            không được đẩy lên Google nữa cho tới khi bạn kết nối lại. Kết nối của giáo viên khác không bị
            ảnh hưởng.
          </Typography.Text>
          <Typography.Text>
            <Typography.Text strong>Xoá sự kiện trên Google</Typography.Text>: gỡ khỏi lịch Google những sự
            kiện mà hệ thống đã tạo. Buổi học và điểm danh trong hệ thống vẫn còn nguyên.
          </Typography.Text>
          <Typography.Text>
            <Typography.Text strong>Giữ lại trên Google</Typography.Text>: sự kiện vẫn nằm trên lịch Google
            nhưng hệ thống không còn theo dõi; kết nối lại rồi đồng bộ sẽ tạo sự kiện mới, dễ bị trùng.
          </Typography.Text>
        </Space>
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

  const quyen = duLieu.quyen ?? []

  return (
    <Card
      size="small"
      title={
        <Space wrap>
          Google Calendar
          {daKetNoi ? <Tag color="success">Đã kết nối</Tag> : <Tag color="warning">Chưa kết nối</Tag>}
          {duLieu.cheDoGia ? <Tag color="gold">chế độ giả</Tag> : null}
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
        {duLieu.cheDoGia ? (
          <Alert
            type="warning"
            showIcon
            message="Đang ở CHẾ ĐỘ GIẢ (chỉ máy dev): backend không gọi Google thật, sự kiện chỉ được ghi vào bộ nhớ để thử luồng."
            description="Số liệu tạo/cập nhật/xoá ở đây không phải trên Google thật. Muốn dùng thật thì đặt GoogleCalendar:ClientId và GoogleCalendar:ClientSecret rồi tắt GoogleCalendar:CheDoGia (xem backend/README.md, mục Google Calendar)."
          />
        ) : null}

        <Alert
          type="info"
          showIcon
          message="Buổi học của ai thì nằm trên lịch Google của người đó."
          description="Mỗi giáo viên tự kết nối lịch của mình; không ai — kể cả admin — kết nối hộ hay xem được token của người khác."
        />

        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="Cấu hình phía backend">
            {duLieu.daCauHinh ? (
              <Typography.Text>Đã có Client ID/Secret (hoặc đang chạy chế độ giả)</Typography.Text>
            ) : (
              <Typography.Text type="danger">
                Chưa có GoogleCalendar:ClientId / ClientSecret
              </Typography.Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Kết nối của bạn">
            {daKetNoi ? (
              <Typography.Text strong>Đã kết nối</Typography.Text>
            ) : (
              <Typography.Text type="secondary">Bạn chưa kết nối tài khoản Google nào</Typography.Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Tài khoản Google bạn đã liên kết">
            {daKetNoi ? (duLieu.taiKhoan ?? 'Đã liên kết (backend không trả email)') : '—'}
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

        {laAdmin ? (
          <Card size="small" type="inner" title="Tổng hợp kết nối Google của giáo viên (chỉ admin)">
            {tongHop.isPending ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : tongHop.isError ? (
              <Alert
                type="error"
                showIcon
                message="Không đọc được số liệu tổng hợp"
                description={noiDungLoi(tongHop.error, 'Backend không trả về số liệu tổng hợp Google Calendar')}
                action={
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      void tongHop.refetch()
                    }}
                  >
                    Thử lại
                  </Button>
                }
              />
            ) : tongHop.data ? (
              <Flex vertical gap={8}>
                <Space wrap size={12}>
                  <Typography.Text>
                    Giáo viên đang làm:{' '}
                    <Typography.Text strong>{tongHop.data.soGiaoVienDangLam}</Typography.Text>
                  </Typography.Text>
                  <Tag color="success">Đã kết nối {tongHop.data.soDaKetNoi}</Tag>
                  <Tag color="warning">Chưa kết nối {tongHop.data.soChuaKetNoi}</Tag>
                </Space>

                {tongHop.data.tenChuaKetNoi.length > 0 ? (
                  <Flex vertical gap={4}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Những người chưa kết nối — chỉ họ tự kết nối được, admin không kết nối hộ:
                    </Typography.Text>
                    <Space wrap size={[6, 6]}>
                      {tongHop.data.tenChuaKetNoi.map((ten) => (
                        <Tag key={ten}>{ten}</Tag>
                      ))}
                    </Space>
                  </Flex>
                ) : (
                  <Typography.Text type="secondary">
                    Tất cả giáo viên đang làm đều đã kết nối lịch Google của mình.
                  </Typography.Text>
                )}
              </Flex>
            ) : null}
          </Card>
        ) : null}

        <Alert
          type="info"
          showIcon
          message="Chỉ xin 2 quyền hẹp: đọc/ghi sự kiện và xem danh sách lịch"
          description={
            <Space direction="vertical" size={4}>
              <Typography.Text type="secondary">
                Không xin quyền đọc Gmail, Drive hay đọc toàn bộ Google Calendar.
              </Typography.Text>
              {quyen.length > 0 ? (
                <List
                  size="small"
                  split={false}
                  dataSource={quyen}
                  renderItem={(item) => <List.Item style={{ paddingInline: 0 }}>{tenQuyen(item)}</List.Item>}
                />
              ) : (
                <Typography.Text type="secondary">Backend chưa trả về danh sách quyền.</Typography.Text>
              )}
            </Space>
          }
        />

        {loiKetNoi ? (
          laLoiChuaCauHinh(loiKetNoi) ? (
            <Alert
              type="warning"
              showIcon
              closable
              onClose={() => {
                setLoiKetNoi(null)
              }}
              message="Chưa cấu hình Google Calendar ở backend"
              description={
                <Space direction="vertical" size={4}>
                  <Typography.Text>
                    Backend chưa có Client ID/Secret nên không dựng được đường dẫn cấp quyền. Đặt bằng
                    user-secrets trong thư mục backend (xem backend/README.md):
                  </Typography.Text>
                  <Typography.Text code>
                    dotnet user-secrets set &quot;GoogleCalendar:ClientId&quot; &quot;&lt;client id&gt;.apps.googleusercontent.com&quot;
                  </Typography.Text>
                  <Typography.Text code>
                    dotnet user-secrets set &quot;GoogleCalendar:ClientSecret&quot; &quot;&lt;client secret&gt;&quot;
                  </Typography.Text>
                  <Typography.Text>
                    Hoặc chạy máy dev với <Typography.Text code>GoogleCalendar:CheDoGia = true</Typography.Text> để
                    thử luồng kết nối mà không cần tài khoản Google thật.
                  </Typography.Text>
                </Space>
              }
            />
          ) : (
            <Alert
              type="error"
              showIcon
              closable
              onClose={() => {
                setLoiKetNoi(null)
              }}
              message="Không mở được trang cấp quyền Google"
              description={noiDungLoi(loiKetNoi, 'Lỗi không xác định')}
            />
          )
        ) : null}

        {!daKetNoi ? (
          <Flex vertical gap={8}>
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
              <Typography.Text type="secondary">
                Mở tab mới để đăng nhập Google, trang này không bị chuyển đi.
              </Typography.Text>
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Bấm kết nối ở đây là nối lịch Google của chính bạn — mỗi giáo viên làm một lần cho mình. Lịch
              dạy chỉ được đẩy lên Google khi đã kết nối và đã chọn lịch đích; chưa kết nối thì mọi thứ vẫn
              hoạt động bình thường trong hệ thống.
            </Typography.Text>
          </Flex>
        ) : (
          <Flex vertical gap={12}>
            <Space wrap align="center">
              <Typography.Text strong>Lịch đích</Typography.Text>
              <Select
                style={{ minWidth: 320 }}
                value={duLieu.calendarId ?? undefined}
                placeholder="Chọn lịch để ghi sự kiện"
                loading={danhSachLich.isPending || chonLich.isPending}
                options={(danhSachLich.data ?? []).map((lich) => ({
                  value: lich.id,
                  label: lich.laLichChinh ? `${lich.ten} — lịch chính` : lich.ten,
                }))}
                onChange={(giaTri: string) => {
                  void doiLich(giaTri)
                }}
              />
              <Button
                type="primary"
                icon={<SyncOutlined />}
                loading={dongBo.isPending}
                onClick={() => {
                  void dongBoNgay()
                }}
              >
                Đồng bộ ngay
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
                Đồng bộ cho tất cả giáo viên (mọi người lên lịch của chính họ)
              </Checkbox>
            ) : null}

            {danhSachLich.isError ? (
              <Alert
                type="error"
                showIcon
                message="Không đọc được danh sách lịch của tài khoản Google"
                description={noiDungLoi(
                  danhSachLich.error,
                  'Thử làm mới, hoặc ngắt kết nối rồi kết nối lại nếu token đã hết hiệu lực.',
                )}
              />
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

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              “Đồng bộ ngay” đẩy các buổi từ hôm nay tới hết tháng sau lên lịch đang chọn. Đồng bộ MỘT CHIỀU
              (hệ thống → Google): sửa sự kiện ngay trên Google sẽ không quay về hệ thống vì phần webhook hai
              chiều chưa làm. Nên tạo một lịch riêng tên “Dạy kèm” thay vì ghi vào lịch chính.
            </Typography.Text>
          </Flex>
        )}
      </Flex>
    </Card>
  )
}
