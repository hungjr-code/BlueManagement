import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  Col,
  DatePicker,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  TimePicker,
  Typography,
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useSuaHocSinh, useTaoHocSinh } from '../../api/students'
import type {
  CachTinhHocPhi,
  GiaoVien,
  HocSinh,
  KhungGioHocYeuCau,
  TaoHocSinh,
  ThuTrongTuan,
  TrangThaiHocSinh,
} from '../../api/types'
import { THU_TRONG_TUAN } from '../../config/lichTuan'
import { LoiApiAlert } from './LoiApiAlert'
import { CACH_TINH_HOC_PHI, TRANG_THAI_HOC_SINH, laLoiTrungTen } from './hienThi'

/** Một tuần chỉ có 7 ngày, nên tối đa 7 khung giờ — backend cũng chặn ở ngưỡng này. */
const SO_KHUNG_GIO_TOI_DA = 7

/** Lịch học trong form: giờ là Dayjs của TimePicker, chưa chắc đã điền đủ. */
interface KhungGioHinhThuc {
  thu?: ThuTrongTuan
  gioBatDau?: Dayjs
  gioKetThuc?: Dayjs
}

interface GiaTriHocSinh {
  hoTen: string
  giaoVienId?: string
  cachTinhHocPhi: CachTinhHocPhi
  donGiaTheoBuoi?: number | null
  hocPhiTheoThang?: number | null
  ngayDenHanDongTien: number
  ngayBatDau: Dayjs
  phuHuynh?: string | null
  soDienThoaiPhuHuynh?: string | null
  lop?: string | null
  ghiChu?: string | null
  trangThai: TrangThaiHocSinh
  lichHoc: KhungGioHinhThuc[]
}

/** Giá trị khởi tạo khi thêm học sinh mới: sẵn một dòng lịch học trống cho dễ hình dung. */
function giaTriTaoMoi(giaoVienMacDinhId?: string): GiaTriHocSinh {
  return {
    hoTen: '',
    giaoVienId: giaoVienMacDinhId,
    cachTinhHocPhi: 'theo_buoi',
    ngayDenHanDongTien: 5,
    ngayBatDau: dayjs(),
    trangThai: 'dang_hoc',
    lichHoc: [{}],
  }
}

/** Đổ học sinh đang sửa vào form: giờ "18:00:00" của backend thành Dayjs cho TimePicker. */
function giaTriTuHocSinh(hocSinh: HocSinh): GiaTriHocSinh {
  return {
    hoTen: hocSinh.hoTen,
    giaoVienId: hocSinh.giaoVienId,
    cachTinhHocPhi: hocSinh.cachTinhHocPhi,
    donGiaTheoBuoi: hocSinh.donGiaTheoBuoi,
    hocPhiTheoThang: hocSinh.hocPhiTheoThang,
    ngayDenHanDongTien: hocSinh.ngayDenHanDongTien,
    ngayBatDau: dayjs(hocSinh.ngayBatDau),
    phuHuynh: hocSinh.phuHuynh,
    soDienThoaiPhuHuynh: hocSinh.soDienThoaiPhuHuynh,
    ghiChu: hocSinh.ghiChu,
    lop: hocSinh.lop,
    trangThai: hocSinh.trangThai,
    lichHoc: hocSinh.lichHoc.map((khung) => ({
      thu: khung.thu,
      gioBatDau: dayjs(khung.gioBatDau, 'HH:mm:ss'),
      gioKetThuc: dayjs(khung.gioKetThuc, 'HH:mm:ss'),
    })),
  }
}

interface KhungGioDaDu {
  thu: ThuTrongTuan
  gioBatDau: Dayjs
  gioKetThuc: Dayjs
}

function laKhungGioDaDu(khung: KhungGioHinhThuc): khung is KhungGioDaDu {
  return khung.thu !== undefined && khung.gioBatDau !== undefined && khung.gioKetThuc !== undefined
}

/**
 * Đổi giá trị form thành payload gửi backend.
 *
 * - Chỉ gửi MỘT trong hai trường tiền: chọn cách tính nào thì gửi trường đó, trường còn lại để null.
 * - `soBuoiMoiTuan` luôn tính lại từ số khung giờ đã điền đủ, không cho nhập tay để khỏi lệch với
 *   `lichHoc` (backend trả 400 nếu lệch).
 * - Chỉ admin gửi `giaoVienId`; giáo viên gửi lên sẽ bị backend từ chối (403), nên bỏ hẳn trường này.
 */
function duLieuGui(giaTri: GiaTriHocSinh, laAdmin: boolean): TaoHocSinh {
  const khungGio: KhungGioHocYeuCau[] = giaTri.lichHoc.filter(laKhungGioDaDu).map((khung) => ({
    thu: khung.thu,
    gioBatDau: khung.gioBatDau.format('HH:mm:ss'),
    gioKetThuc: khung.gioKetThuc.format('HH:mm:ss'),
  }))

  const duLieu: TaoHocSinh = {
    hoTen: giaTri.hoTen.trim(),
    cachTinhHocPhi: giaTri.cachTinhHocPhi,
    donGiaTheoBuoi: giaTri.cachTinhHocPhi === 'theo_buoi' ? (giaTri.donGiaTheoBuoi ?? null) : null,
    hocPhiTheoThang:
      giaTri.cachTinhHocPhi === 'theo_thang' ? (giaTri.hocPhiTheoThang ?? null) : null,
    soBuoiMoiTuan: khungGio.length,
    lichHoc: khungGio,
    ngayDenHanDongTien: giaTri.ngayDenHanDongTien,
    ngayBatDau: giaTri.ngayBatDau.format('YYYY-MM-DD'),
    phuHuynh: giaTri.phuHuynh?.trim() || null,
    soDienThoaiPhuHuynh: giaTri.soDienThoaiPhuHuynh?.trim() || null,
    lop: giaTri.lop?.trim() || null,
    ghiChu: giaTri.ghiChu?.trim() || null,
    trangThai: giaTri.trangThai,
  }

  if (laAdmin && giaTri.giaoVienId) {
    duLieu.giaoVienId = giaTri.giaoVienId
  }

  return duLieu
}

interface FormHocSinhProps {
  open: boolean
  /** null = thêm học sinh mới; có giá trị = đang sửa học sinh đó. */
  hocSinh: HocSinh | null
  /** Chỉ admin thấy và đổi được giáo viên phụ trách. */
  laAdmin: boolean
  danhSachGiaoVien: GiaoVien[]
  /** Giáo viên mặc định khi admin thêm học sinh (thường là chính người đang đăng nhập). */
  giaoVienMacDinhId?: string
  onDong: () => void
}

/**
 * Hộp thoại dùng chung cho thêm và sửa học sinh.
 *
 * Luồng lưu nằm trong này luôn để xử lý được 409 (trùng tên) ngay tại chỗ: backend coi trùng tên là
 * cảnh báo chứ không chặn, nên hỏi lại người dùng rồi gửi lại với `boQuaCanhBaoTrungTen: true`.
 * Không tự động bỏ qua cảnh báo.
 */
export function FormHocSinh({
  open,
  hocSinh,
  laAdmin,
  danhSachGiaoVien,
  giaoVienMacDinhId,
  onDong,
}: FormHocSinhProps) {
  const [form] = Form.useForm<GiaTriHocSinh>()
  const { message, modal } = App.useApp()
  const taoHocSinh = useTaoHocSinh()
  // Hook không được gọi có điều kiện. Khi thêm mới, `hocSinh` là null nên mutation này không được gọi.
  const suaHocSinh = useSuaHocSinh(hocSinh?.id ?? '')
  const [loiLuu, datLoiLuu] = useState<unknown>(null)

  const laSua = hocSinh !== null
  const giaTriBanDau = hocSinh ? giaTriTuHocSinh(hocSinh) : giaTriTaoMoi(giaoVienMacDinhId)
  const cachTinhHocPhi = Form.useWatch('cachTinhHocPhi', form)
  const giaoVienDangChon = Form.useWatch('giaoVienId', form)
  const trangThaiDangChon = Form.useWatch('trangThai', form)
  const lichHocTheoDoi = Form.useWatch('lichHoc', form)

  // useWatch còn undefined ở lần render đầu, lấy tạm số khung giờ hiện có để không nháy "0 buổi".
  const soKhungGio = lichHocTheoDoi?.length ?? hocSinh?.lichHoc.length ?? 1
  const soKhungGioChuaDu = (lichHocTheoDoi ?? []).filter((khung) => !laKhungGioDaDu(khung)).length
  const cachTinhDangChon = cachTinhHocPhi ?? giaTriBanDau.cachTinhHocPhi
  const doiGiaoVien =
    laSua && laAdmin && giaoVienDangChon !== undefined && giaoVienDangChon !== hocSinh.giaoVienId
  const dangLuu = taoHocSinh.isPending || suaHocSinh.isPending

  const dong = () => {
    datLoiLuu(null)
    onDong()
  }

  const hoiTaoDuTrungTen = (duLieu: TaoHocSinh, hoTen: string) => {
    modal.confirm({
      title: 'Đã có học sinh trùng tên',
      content: (
        <Flex vertical gap={8}>
          <Typography.Text>
            Giáo viên phụ trách đã có một học sinh tên{' '}
            <Typography.Text strong>{hoTen}</Typography.Text>.
          </Typography.Text>
          <Typography.Text type="secondary">
            Hai em cùng tên là chuyện bình thường nên hệ thống không chặn, chỉ hỏi lại. Nếu đúng là hai
            học sinh khác nhau thì tiếp tục, còn nếu gõ nhầm thì sửa lại tên.
          </Typography.Text>
        </Flex>
      ),
      okText: 'Vẫn tạo học sinh này',
      cancelText: 'Để tôi xem lại tên',
      onOk: async () => {
        try {
          await taoHocSinh.mutateAsync({ ...duLieu, boQuaCanhBaoTrungTen: true })
          message.success(`Đã thêm học sinh ${hoTen}`)
          dong()
        } catch (error) {
          datLoiLuu(error)
        }
      },
    })
  }

  const luu = async (giaTri: GiaTriHocSinh) => {
    datLoiLuu(null)
    const duLieu = duLieuGui(giaTri, laAdmin)
    const hoTen = giaTri.hoTen.trim()

    try {
      if (hocSinh) {
        await suaHocSinh.mutateAsync(duLieu)
        message.success(`Đã lưu thay đổi của ${hoTen}`)
      } else {
        await taoHocSinh.mutateAsync(duLieu)
        message.success(`Đã thêm học sinh ${hoTen}`)
      }
      dong()
    } catch (error) {
      if (!hocSinh && laLoiTrungTen(error)) {
        hoiTaoDuTrungTen(duLieu, hoTen)
        return
      }
      datLoiLuu(error)
    }
  }

  const nhanLichHoc = {
    validator: (_quyTac: unknown, giaTri: unknown) => {
      const soKhung = Array.isArray(giaTri) ? giaTri.length : 0
      if (soKhung === 0) {
        return Promise.reject(new Error('Khai ít nhất một khung giờ học trong tuần'))
      }
      if (soKhung > SO_KHUNG_GIO_TOI_DA) {
        return Promise.reject(
          new Error(`Mỗi tuần chỉ có ${SO_KHUNG_GIO_TOI_DA} ngày, tối đa ${SO_KHUNG_GIO_TOI_DA} khung giờ`),
        )
      }
      return Promise.resolve()
    },
  }

  return (
    <Modal
      open={open}
      title={hocSinh ? `Sửa học sinh — ${hocSinh.hoTen}` : 'Thêm học sinh'}
      onCancel={dong}
      onOk={() => {
        form.submit()
      }}
      okText={hocSinh ? 'Lưu thay đổi' : 'Thêm học sinh'}
      cancelText="Huỷ"
      confirmLoading={dangLuu}
      maskClosable={false}
      destroyOnHidden
      width={760}
    >
      <Flex vertical gap={12}>
        {loiLuu ? <LoiApiAlert error={loiLuu} tieuDe="Không lưu được học sinh" /> : null}

        {doiGiaoVien ? (
          <Alert
            type="warning"
            showIcon
            message="Đổi giáo viên phụ trách"
            description="Các buổi CHƯA dạy sẽ chuyển sang giáo viên mới, còn buổi đã dạy và học phí đã ghi vẫn giữ nguyên theo giáo viên cũ."
          />
        ) : null}

        <Form<GiaTriHocSinh>
          form={form}
          key={hocSinh?.id ?? 'them-moi'}
          layout="vertical"
          initialValues={giaTriBanDau}
          disabled={dangLuu}
          onFinish={(giaTri) => {
            void luu(giaTri)
          }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                label="Tên học sinh"
                name="hoTen"
                rules={[
                  { required: true, message: 'Nhập tên học sinh' },
                  { max: 200, message: 'Tên dài quá 200 ký tự' },
                ]}
              >
                <Input placeholder="Ví dụ: Nguyễn Văn A" allowClear autoComplete="off" />
              </Form.Item>
            </Col>
            {laAdmin ? (
              <Col span={12}>
                <Form.Item
                  label="Giáo viên phụ trách"
                  name="giaoVienId"
                  rules={[{ required: true, message: 'Chọn giáo viên phụ trách' }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Chọn giáo viên"
                    notFoundContent="Chưa đọc được danh sách giáo viên"
                    options={danhSachGiaoVien.map((giaoVien) => ({
                      value: giaoVien.id,
                      label: giaoVien.hoTen,
                    }))}
                  />
                </Form.Item>
              </Col>
            ) : null}
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                label="Cách tính học phí"
                name="cachTinhHocPhi"
                rules={[{ required: true, message: 'Chọn cách tính học phí' }]}
              >
                <Select
                  options={CACH_TINH_HOC_PHI.map((cachTinh) => ({
                    value: cachTinh.value,
                    label: cachTinh.label,
                  }))}
                />
              </Form.Item>
            </Col>
            {cachTinhDangChon === 'theo_thang' ? (
              <Col span={8}>
                <Form.Item
                  label="Học phí mỗi tháng"
                  name="hocPhiTheoThang"
                  rules={[{ required: true, message: 'Nhập học phí mỗi tháng' }]}
                >
                  <InputNumber<number>
                    min={0}
                    step={100_000}
                    addonAfter="đ"
                    placeholder="1500000"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            ) : (
              <Col span={8}>
                <Form.Item
                  label="Đơn giá mỗi buổi"
                  name="donGiaTheoBuoi"
                  rules={[{ required: true, message: 'Nhập đơn giá mỗi buổi' }]}
                >
                  <InputNumber<number>
                    min={0}
                    step={10_000}
                    addonAfter="đ"
                    placeholder="250000"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            )}
            <Col span={8}>
              <Form.Item
                label="Hạn đóng tiền"
                name="ngayDenHanDongTien"
                rules={[{ required: true, message: 'Nhập ngày đến hạn đóng tiền' }]}
              >
                <InputNumber<number>
                  min={1}
                  max={31}
                  addonBefore="Mùng"
                  addonAfter="hằng tháng"
                  placeholder="5"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                label="Ngày bắt đầu học"
                name="ngayBatDau"
                rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]}
                extra="Hệ thống chỉ sinh buổi học từ ngày này trở đi."
              >
                <DatePicker format="DD/MM/YYYY" placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Lớp / nhóm học"
                name="lop"
                rules={[{ max: 100, message: 'Lớp tối đa 100 ký tự' }]}
                extra="Ví dụ: Lớp 9, Toán 9A, IELTS 5.0 — hiện ngay trên ô lịch cạnh tên học sinh."
              >
                <Input placeholder="Lớp 9" allowClear />
              </Form.Item>

              <Form.Item label="Phụ huynh" name="phuHuynh">
                <Input placeholder="Tên phụ huynh" allowClear />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Số điện thoại phụ huynh" name="soDienThoaiPhuHuynh">
                <Input placeholder="09…" allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Trạng thái"
            name="trangThai"
            rules={[{ required: true, message: 'Chọn trạng thái' }]}
            extra={
              laSua
                ? undefined
                : 'Học sinh mới luôn bắt đầu ở trạng thái Đang học hoặc Tạm nghỉ. Muốn cho nghỉ hẳn thì dùng nút "Cho nghỉ" ở danh sách.'
            }
          >
            <Select
              style={{ maxWidth: 220 }}
              options={TRANG_THAI_HOC_SINH.filter(
                (trangThai) => laSua || trangThai.value !== 'da_nghi',
              ).map((trangThai) => ({ value: trangThai.value, label: trangThai.label }))}
            />
          </Form.Item>

          {laSua && trangThaiDangChon === 'da_nghi' && hocSinh.trangThai !== 'da_nghi' ? (
            <Alert
              type="warning"
              showIcon
              message="Đổi trạng thái ở đây chỉ đổi nhãn"
              description="Nút 'Cho nghỉ' ngoài danh sách mới là thao tác đầy đủ: nó còn bỏ các buổi chưa dạy từ hôm nay để không sinh buổi mới. Cả hai cách đều giữ nguyên lịch sử điểm danh và học phí."
            />
          ) : null}

          <Form.Item label="Ghi chú" name="ghiChu">
            <Input.TextArea
              rows={2}
              allowClear
              placeholder="Ví dụ: học sinh yếu phần hình học, cần kiểm tra bài cũ"
            />
          </Form.Item>

          <Form.Item
            label={`Lịch học hằng tuần — ${soKhungGio} buổi/tuần`}
            required
            extra="Số buổi mỗi tuần luôn bằng số khung giờ khai ở đây, hệ thống tự tính lại khi thêm hoặc xoá khung."
          >
            <Form.List name="lichHoc" rules={[nhanLichHoc]}>
              {(fields, { add, remove }, { errors }) => (
                <Flex vertical gap={4}>
                  {errors.length > 0 ? (
                    <Alert type="error" showIcon message={errors.join(' · ')} />
                  ) : null}

                  {fields.map(({ key, name }) => (
                    <Row key={key} gutter={8} align="bottom">
                      <Col flex="150px">
                        <Form.Item
                          label="Thứ"
                          name={[name, 'thu']}
                          rules={[{ required: true, message: 'Chọn thứ' }]}
                        >
                          <Select
                            placeholder="Chọn thứ"
                            options={THU_TRONG_TUAN.map((thu) => ({
                              value: thu.value,
                              label: thu.label,
                            }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col flex="140px">
                        <Form.Item
                          label="Bắt đầu"
                          name={[name, 'gioBatDau']}
                          rules={[{ required: true, message: 'Chọn giờ bắt đầu' }]}
                        >
                          <TimePicker format="HH:mm" minuteStep={5} needConfirm={false} placeholder="18:00" />
                        </Form.Item>
                      </Col>
                      <Col flex="140px">
                        <Form.Item
                          label="Kết thúc"
                          name={[name, 'gioKetThuc']}
                          rules={[
                            { required: true, message: 'Chọn giờ kết thúc' },
                            ({ getFieldValue }) => ({
                              validator(_quyTac, giaTri: Dayjs | undefined) {
                                const batDau = getFieldValue(['lichHoc', name, 'gioBatDau']) as
                                  | Dayjs
                                  | undefined
                                if (!giaTri || !batDau || giaTri.isAfter(batDau)) {
                                  return Promise.resolve()
                                }
                                return Promise.reject(new Error('Giờ kết thúc phải sau giờ bắt đầu'))
                              },
                            }),
                          ]}
                        >
                          <TimePicker format="HH:mm" minuteStep={5} needConfirm={false} placeholder="19:30" />
                        </Form.Item>
                      </Col>
                      <Col flex="auto">
                        <Form.Item>
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            aria-label={`Xoá khung giờ thứ ${name + 1}`}
                            onClick={() => {
                              remove(name)
                            }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  ))}

                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    disabled={fields.length >= SO_KHUNG_GIO_TOI_DA}
                    onClick={() => {
                      add({})
                    }}
                  >
                    Thêm khung giờ
                  </Button>

                  {soKhungGioChuaDu > 0 ? (
                    <Alert
                      type="warning"
                      showIcon
                      message={`Còn ${soKhungGioChuaDu} khung giờ chưa điền đủ thứ và giờ`}
                      description="Số buổi mỗi tuần phải khớp số khung giờ đã khai; backend sẽ chặn nếu lệch."
                    />
                  ) : null}
                </Flex>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Flex>
    </Modal>
  )
}
