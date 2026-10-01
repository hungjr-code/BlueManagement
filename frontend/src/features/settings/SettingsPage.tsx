import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Select,
  Space,
  Statistic,
  Switch,
  Tag,
  TimePicker,
  Typography,
} from 'antd'
import { QrcodeOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { PageHeader } from '../../components/page'
import { PaymentQrModal } from '../../components/PaymentQrModal'
import { NGAN_HANG_PHO_BIEN, daCauHinhTaiKhoan, tenNganHang } from '../../config/nganHang'
import { useCaiDat, useCapNhatCaiDat } from '../../api/settings'
import { capNhatTaiKhoanNhanTien } from '../../api/auth'
import { ApiError } from '../../api/http'
import { usePhien } from '../../app/session'
import { TheGoogleCalendar } from './TheGoogleCalendar'

const SO_TIEN_THU_MAC_DINH = 500_000

interface GiaTriTaiKhoan {
  nganHangBin?: string
  soTaiKhoan?: string
  chuTaiKhoan?: string
}

interface GiaTriCauHinh {
  mauNoiDungChuyenKhoan?: string
  nhacTruocBaoLauPhut: number
  nguongCanhBaoSoHocSinh: number
  gioGuiThongBaoHomNay: Dayjs
  batThongBaoHomNay: boolean
}

/**
 * Cài đặt của trung tâm, chia làm hai phần rõ ràng:
 *
 * - **Tài khoản nhận tiền là của từng giáo viên** — ai cũng tự khai tài khoản của mình, không ai
 *   khai hộ ai. Admin chỉ thấy số lượng đã khai / chưa khai, không đọc được số tài khoản.
 * - **Cấu hình chung** (mẫu nội dung chuyển khoản, múi giờ, nhắc lịch) do admin sửa, giáo viên chỉ đọc.
 */
export function SettingsPage() {
  const [formTaiKhoan] = Form.useForm<GiaTriTaiKhoan>()
  const [formCauHinh] = Form.useForm<GiaTriCauHinh>()
  const { message } = App.useApp()
  const { nguoiDung, datNguoiDung } = usePhien()
  const caiDat = useCaiDat()
  const capNhat = useCapNhatCaiDat()

  const [dangLuuTaiKhoan, setDangLuuTaiKhoan] = useState(false)
  const [loiTaiKhoan, setLoiTaiKhoan] = useState<string | null>(null)
  const [loiCauHinh, setLoiCauHinh] = useState<string | null>(null)
  const [moQrThu, setMoQrThu] = useState(false)
  const [soTienThu, setSoTienThu] = useState<number>(SO_TIEN_THU_MAC_DINH)

  const laAdmin = nguoiDung?.vaiTro === 'admin'
  const taiKhoan = nguoiDung?.taiKhoanNhanTien
  const duLieu = caiDat.data

  const soDaKhai = duLieu?.soGiaoVienDaKhaiTaiKhoanNhanTien ?? null
  const soChuaKhai = duLieu?.soGiaoVienChuaKhaiTaiKhoanNhanTien ?? null
  const tenChuaKhai = duLieu?.tenGiaoVienChuaKhaiTaiKhoanNhanTien ?? []
  const tongGiaoVien = soDaKhai !== null && soChuaKhai !== null ? soDaKhai + soChuaKhai : null

  const luuTaiKhoan = async (giaTri: GiaTriTaiKhoan) => {
    setLoiTaiKhoan(null)
    setDangLuuTaiKhoan(true)
    try {
      const ketQua = await capNhatTaiKhoanNhanTien({
        nganHangBin: giaTri.nganHangBin?.trim() ?? null,
        soTaiKhoan: giaTri.soTaiKhoan?.trim() ?? null,
        chuTaiKhoan: giaTri.chuTaiKhoan?.trim() ?? null,
      })
      if (nguoiDung) {
        datNguoiDung({ ...nguoiDung, taiKhoanNhanTien: ketQua })
      }
      void caiDat.refetch()
      message.success(
        ketQua.daCauHinh
          ? 'Đã lưu tài khoản nhận tiền của bạn'
          : 'Đã gỡ tài khoản nhận tiền của bạn',
      )
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      setLoiTaiKhoan(theoField.length > 0 ? theoField.join(' · ') : (loiApi?.message ?? 'Không lưu được tài khoản'))
    } finally {
      setDangLuuTaiKhoan(false)
    }
  }

  const luuCauHinh = async (giaTri: GiaTriCauHinh) => {
    setLoiCauHinh(null)
    try {
      await capNhat.mutateAsync({
        mauNoiDungChuyenKhoan: giaTri.mauNoiDungChuyenKhoan?.trim() ?? null,
        nhacTruocBaoLauPhut: giaTri.nhacTruocBaoLauPhut,
        nguongCanhBaoSoHocSinh: giaTri.nguongCanhBaoSoHocSinh,
        gioGuiThongBaoHomNay: giaTri.gioGuiThongBaoHomNay.format('HH:mm:ss'),
        batThongBaoHomNay: giaTri.batThongBaoHomNay,
      })
      message.success('Đã lưu cấu hình chung')
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      setLoiCauHinh(theoField.length > 0 ? theoField.join(' · ') : (loiApi?.message ?? 'Không lưu được cấu hình'))
    }
  }

  return (
    <>
      <PageHeader
        title="Cài đặt"
        description="Tài khoản nhận tiền của bạn (mỗi giáo viên tự khai), cấu hình chung của trung tâm, và kết nối Google Calendar — xem trạng thái thật, chọn lịch đích, đồng bộ ngay, ngắt kết nối (chỉ admin làm được, giáo viên chỉ xem)."
      />
      <Flex vertical gap={16}>
        <Alert
          type="warning"
          showIcon
          message="Không nhập Client Secret hay mật khẩu ngân hàng trên giao diện web"
          description="Google Client Secret chỉ nằm ở biến môi trường phía backend. Trang này cũng không có ô nhập mật khẩu Google hay mật khẩu internet banking — chỉ cần số tài khoản để sinh mã QR nhận tiền."
        />

        <Card
          size="small"
          title="Tài khoản nhận tiền của tôi"
          extra={
            daCauHinhTaiKhoan(taiKhoan) ? (
              <Typography.Text type="secondary">
                Đang dùng: {tenNganHang(taiKhoan?.nganHangBin)} — {taiKhoan?.soTaiKhoan}
              </Typography.Text>
            ) : (
              <Typography.Text type="danger">Chưa khai</Typography.Text>
            )
          }
        >
          {!daCauHinhTaiKhoan(taiKhoan) ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Khai tài khoản để thu học phí bằng mã QR"
              description="Mã QR ở trang Học phí dùng tài khoản của giáo viên dạy học sinh đó. Bạn chưa khai thì chưa sinh được mã QR cho học sinh của mình."
            />
          ) : null}

          {loiTaiKhoan ? (
            <Alert type="error" showIcon message={loiTaiKhoan} closable style={{ marginBottom: 16 }} />
          ) : null}

          <Form<GiaTriTaiKhoan>
            form={formTaiKhoan}
            layout="vertical"
            initialValues={{
              nganHangBin: taiKhoan?.nganHangBin ?? undefined,
              soTaiKhoan: taiKhoan?.soTaiKhoan ?? undefined,
              chuTaiKhoan: taiKhoan?.chuTaiKhoan ?? undefined,
            }}
            key={`${nguoiDung?.id ?? 'chua-dang-nhap'}-${duLieu?.ngayCapNhatUtc ?? ''}`}
            onFinish={(giaTri) => {
              void luuTaiKhoan(giaTri)
            }}
            style={{ maxWidth: 460 }}
          >
            <Form.Item
              label="Ngân hàng"
              name="nganHangBin"
              rules={[{ required: true, message: 'Chọn ngân hàng nhận tiền' }]}
            >
              <Select
                placeholder="Chọn ngân hàng"
                options={NGAN_HANG_PHO_BIEN.map((item) => ({
                  value: item.bin,
                  label: `${item.ten} — ${item.bin}`,
                }))}
                showSearch
                optionFilterProp="label"
                allowClear
              />
            </Form.Item>

            <Form.Item
              label="Số tài khoản"
              name="soTaiKhoan"
              rules={[{ required: true, message: 'Nhập số tài khoản nhận tiền' }]}
            >
              <Input placeholder="Ví dụ 0123456789" allowClear />
            </Form.Item>

            <Form.Item label="Chủ tài khoản" name="chuTaiKhoan">
              <Input placeholder="Tên không dấu, ví dụ NGUYEN VAN A" allowClear />
            </Form.Item>

            <Space wrap>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={dangLuuTaiKhoan}
              >
                Lưu tài khoản của tôi
              </Button>
              <Button
                icon={<QrcodeOutlined />}
                disabled={!daCauHinhTaiKhoan(taiKhoan)}
                onClick={() => {
                  setMoQrThu(true)
                }}
              >
                Xem thử mã QR
              </Button>
              <InputNumber<number>
                addonBefore="Số tiền thử"
                addonAfter="đ"
                min={0}
                step={50_000}
                value={soTienThu}
                onChange={(value) => {
                  setSoTienThu(value ?? 0)
                }}
                style={{ width: 240 }}
              />
            </Space>
          </Form>

          <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
            Lưu bằng <Typography.Text code>PUT /api/teachers/me/tai-khoan-nhan-tien</Typography.Text>.
            Số tài khoản chỉ đi kèm phiên đăng nhập của bạn: giáo viên khác và admin đều không đọc được.
            Xoá cả ngân hàng lẫn số tài khoản rồi lưu là gỡ tài khoản đã khai.
          </Typography.Paragraph>
        </Card>

        {laAdmin ? (
          <Card
            size="small"
            title="Giáo viên đã khai tài khoản nhận tiền"
            extra={
              <Tag color={soChuaKhai === 0 ? 'success' : 'warning'}>
                {soDaKhai ?? 0}/{tongGiaoVien ?? 0} giáo viên
              </Tag>
            }
          >
            <Flex vertical gap={12}>
              {caiDat.isPending ? (
                <Typography.Text type="secondary">Đang đọc số liệu…</Typography.Text>
              ) : (
                <Space size="large" wrap>
                  <Statistic title="Đã khai" value={soDaKhai ?? 0} />
                  <Statistic title="Chưa khai" value={soChuaKhai ?? 0} />
                </Space>
              )}

              {tenChuaKhai.length > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message={`${tenChuaKhai.length} giáo viên chưa khai tài khoản nhận tiền`}
                  description={
                    <List
                      size="small"
                      dataSource={tenChuaKhai}
                      renderItem={(ten) => <List.Item>{ten}</List.Item>}
                    />
                  }
                />
              ) : (
                <Alert
                  type="success"
                  showIcon
                  message="Mọi giáo viên đang làm đều đã khai tài khoản nhận tiền"
                />
              )}

              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Màn hình này chỉ đếm. Số tài khoản của từng giáo viên là việc riêng của người đó —
                muốn đổi thì chính họ khai lại ở Cài đặt, admin không sửa hộ được.
              </Typography.Text>
            </Flex>
          </Card>
        ) : null}

        {loiCauHinh ? <Alert type="error" showIcon message={loiCauHinh} closable /> : null}

        {caiDat.isError ? (
          <Alert
            type="error"
            showIcon
            message="Không đọc được cấu hình chung từ backend"
            description={caiDat.error instanceof Error ? caiDat.error.message : 'Lỗi không xác định'}
            action={
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => {
                  void caiDat.refetch()
                }}
              >
                Thử lại
              </Button>
            }
          />
        ) : null}

        <Card
          size="small"
          title={
            <Space>
              Cấu hình chung của trung tâm
              {laAdmin ? <Tag color="gold">admin sửa được</Tag> : <Tag>chỉ đọc</Tag>}
            </Space>
          }
        >
          {!laAdmin ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Chỉ admin sửa được cấu hình chung"
              description="Bạn xem được cấu hình đang dùng, nhưng muốn đổi thì nhờ chủ trung tâm."
            />
          ) : null}

          <Form<GiaTriCauHinh>
            form={formCauHinh}
            layout="vertical"
            disabled={!laAdmin || caiDat.isPending}
            initialValues={
              duLieu
                ? {
                    mauNoiDungChuyenKhoan: duLieu.mauNoiDungChuyenKhoan ?? undefined,
                    nhacTruocBaoLauPhut: duLieu.nhacTruocBaoLauPhut,
                    nguongCanhBaoSoHocSinh: duLieu.nguongCanhBaoSoHocSinh,
                    gioGuiThongBaoHomNay: dayjs(duLieu.gioGuiThongBaoHomNay, 'HH:mm:ss'),
                    batThongBaoHomNay: duLieu.batThongBaoHomNay,
                  }
                : undefined
            }
            key={duLieu?.ngayCapNhatUtc ?? 'dang-tai'}
            onFinish={(giaTri) => {
              void luuCauHinh(giaTri)
            }}
            style={{ maxWidth: 520 }}
          >
            <Form.Item
              label="Mẫu nội dung chuyển khoản"
              name="mauNoiDungChuyenKhoan"
              extra="Dùng {tenHocSinh} cho tên học sinh và {thang} cho kỳ học phí. Để trống thì dùng dạng mặc định."
            >
              <Input placeholder="{tenHocSinh} - Hoc phi {thang}" allowClear />
            </Form.Item>

            <Form.Item
              label="Nhắc trước buổi học (phút)"
              name="nhacTruocBaoLauPhut"
              rules={[{ required: true, message: 'Nhập số phút nhắc trước' }]}
            >
              <InputNumber min={0} max={1440} style={{ width: 200 }} addonAfter="phút" />
            </Form.Item>

            <Form.Item
              label="Ngưỡng cảnh báo số học sinh mỗi giáo viên"
              name="nguongCanhBaoSoHocSinh"
              rules={[{ required: true, message: 'Nhập ngưỡng cảnh báo' }]}
            >
              <InputNumber min={1} max={200} style={{ width: 200 }} addonAfter="học sinh" />
            </Form.Item>

            <Form.Item label="Giờ tổng hợp 'hôm nay dạy ai'" name="gioGuiThongBaoHomNay">
              <TimePicker format="HH:mm" minuteStep={5} style={{ width: 160 }} needConfirm={false} />
            </Form.Item>

            <Form.Item
              label="Bật khối thông báo lịch dạy hôm nay"
              name="batThongBaoHomNay"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={capNhat.isPending}
              disabled={!laAdmin}
            >
              Lưu cấu hình chung
            </Button>
          </Form>

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Ba giá trị dưới đây backend trả về, không sửa được từ màn hình này.
          </Typography.Text>

          <Descriptions size="small" column={1} bordered style={{ marginTop: 8, maxWidth: 520 }}>
            <Descriptions.Item label="Múi giờ của trung tâm">{duLieu?.muiGio ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Định dạng hiển thị">
              {duLieu ? `${duLieu.kyTuTienTe} · ${duLieu.dinhDangNgay}` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Vai trò mặc định khi tạo người dùng mới">
              {duLieu?.vaiTroMacDinh ?? '—'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <TheGoogleCalendar laAdmin={laAdmin} />
      </Flex>

      <PaymentQrModal
        open={moQrThu}
        onClose={() => {
          setMoQrThu(false)
        }}
        tenHocSinh="Học sinh (thử)"
        soTien={soTienThu}
        kyHocPhi="Thử mã QR"
        taiKhoan={taiKhoan}
        mauNoiDungChuyenKhoan={duLieu?.mauNoiDungChuyenKhoan}
        tenGiaoVienNhanTien={nguoiDung?.hoTen}
      />
    </>
  )
}
