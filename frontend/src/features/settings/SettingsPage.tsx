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
 * Cài đặt hệ thống và tài khoản nhận tiền.
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
          ? 'Đã lưu tài khoản nhận tiền thành công'
          : 'Đã gỡ thông tin tài khoản nhận tiền',
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
        description="Cấu hình hệ thống và tài khoản nhận tiền."
      />
      <Flex vertical gap={16}>
        <Card
          size="small"
          title="Tài khoản nhận tiền của tôi"
          extra={
            daCauHinhTaiKhoan(taiKhoan) ? (
              <Tag color="blue">
                {tenNganHang(taiKhoan?.nganHangBin)} — {taiKhoan?.soTaiKhoan}
              </Tag>
            ) : (
              <Tag color="default">Chưa thiết lập</Tag>
            )
          }
        >
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
              <Input placeholder="Tên in hoa không dấu, ví dụ NGUYEN VAN A" allowClear />
            </Form.Item>

            <Space wrap>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={dangLuuTaiKhoan}
              >
                Lưu tài khoản
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
                style={{ width: 220 }}
              />
            </Space>
          </Form>
        </Card>

        {laAdmin ? (
          <Card
            size="small"
            title="Tình trạng tài khoản giáo viên"
            extra={
              <Tag color={soChuaKhai === 0 ? 'success' : 'warning'}>
                {soDaKhai ?? 0}/{tongGiaoVien ?? 0} giáo viên đã khai
              </Tag>
            }
          >
            <Flex vertical gap={12}>
              {caiDat.isPending ? (
                <Typography.Text type="secondary">Đang tải dữ liệu…</Typography.Text>
              ) : (
                <Space size="large" wrap>
                  <Statistic title="Đã khai tài khoản" value={soDaKhai ?? 0} />
                  <Statistic title="Chưa khai" value={soChuaKhai ?? 0} />
                </Space>
              )}

              {tenChuaKhai.length > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message={`${tenChuaKhai.length} giáo viên chưa cập nhật tài khoản nhận tiền`}
                  description={
                    <List
                      size="small"
                      dataSource={tenChuaKhai}
                      renderItem={(ten) => <List.Item>{ten}</List.Item>}
                    />
                  }
                />
              ) : null}
            </Flex>
          </Card>
        ) : null}

        {loiCauHinh ? <Alert type="error" showIcon message={loiCauHinh} closable /> : null}

        {caiDat.isError ? (
          <Alert
            type="error"
            showIcon
            message="Không đọc được cấu hình chung"
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
              {laAdmin ? <Tag color="blue">Quản trị viên</Tag> : <Tag>Chỉ xem</Tag>}
            </Space>
          }
        >
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
              extra="Gợi ý: {tenHocSinh} cho tên học sinh và {thang} cho kỳ học phí."
            >
              <Input placeholder="{tenHocSinh} - Hoc phi {thang}" allowClear />
            </Form.Item>

            <Form.Item
              label="Nhắc trước buổi học"
              name="nhacTruocBaoLauPhut"
              rules={[{ required: true, message: 'Nhập số phút nhắc trước' }]}
            >
              <InputNumber min={0} max={1440} style={{ width: 180 }} addonAfter="phút" />
            </Form.Item>

            <Form.Item
              label="Ngưỡng cảnh báo số học sinh mỗi giáo viên"
              name="nguongCanhBaoSoHocSinh"
              rules={[{ required: true, message: 'Nhập ngưỡng cảnh báo' }]}
            >
              <InputNumber min={1} max={200} style={{ width: 180 }} addonAfter="học sinh" />
            </Form.Item>

            <Form.Item label="Giờ gửi thông báo lịch dạy hôm nay" name="gioGuiThongBaoHomNay">
              <TimePicker format="HH:mm" minuteStep={5} style={{ width: 160 }} needConfirm={false} />
            </Form.Item>

            <Form.Item
              label="Bật thông báo lịch dạy hôm nay"
              name="batThongBaoHomNay"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            {laAdmin ? (
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={capNhat.isPending}
              >
                Lưu cấu hình
              </Button>
            ) : null}
          </Form>

          <Descriptions size="small" column={1} bordered style={{ marginTop: 16, maxWidth: 520 }}>
            <Descriptions.Item label="Múi giờ">{duLieu?.muiGio ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Định dạng">
              {duLieu ? `${duLieu.kyTuTienTe} · ${duLieu.dinhDangNgay}` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Vai trò mặc định">
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
