import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
import { CalculatorOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSoHocPhiKy, useTinhKyHocPhi, useXuatExcelHocPhi } from '../../api/tuition'
import type { HocPhi, TrangThaiThanhToan } from '../../api/tuition'
import { ApiError } from '../../api/http'
import { PageHeader } from '../../components/page'
import { usePhien } from '../../app/session'
import { ngayNgan } from '../../config/lichTuan'
import { formatVnd } from '../../lib/money'
import { ChiTietDrawer } from './ChiTietDrawer'
import { ChotSoCard } from './ChotSoCard'
import { DoiChieuNganHang } from './DoiChieuNganHang'
import { LoiApiAlert } from './LoiApiAlert'
import { SapDenHanCard } from './SapDenHanCard'
import { TongHopCard } from './TongHopCard'
import {
  TRANG_THAI_THANH_TOAN,
  mauCachTinh,
  mauTrangThaiThanhToan,
  moTaLoi,
  moTaKy,
  nhanCachTinh,
  nhanTrangThaiThanhToan,
  taiTepXuong,
} from './hienThi'

const THANG: { value: number; label: string }[] = Array.from(
  { length: 12 },
  (_o, chiSo) => ({ value: chiSo + 1, label: `Tháng ${String(chiSo + 1).padStart(2, '0')}` }),
)

const NAM_HIEN_TAI = dayjs().year()
const NAM: { value: number; label: string }[] = [
  NAM_HIEN_TAI - 3,
  NAM_HIEN_TAI - 2,
  NAM_HIEN_TAI - 1,
  NAM_HIEN_TAI,
  NAM_HIEN_TAI + 1,
].map((nam) => ({ value: nam, label: String(nam) }))

/**
 * Khi Xuất Excel lỗi, backend trả ProblemDetails nhưng axios đã đọc theo `responseType: 'blob'`, nên
 * lời giải thích nằm trong Blob chứ không phải một object có `title`/`detail`. Đọc ra để không hiện
 * mỗi câu "Lỗi HTTP 400".
 */
async function moTaLoiXuatExcel(loi: unknown): Promise<string> {
  if (loi instanceof ApiError && loi.problem instanceof Blob) {
    try {
      const duLieu: unknown = JSON.parse(await loi.problem.text())
      if (duLieu && typeof duLieu === 'object') {
        const problem = duLieu as { title?: string; detail?: string; errors?: Record<string, string[]> }
        const theoField = Object.values(problem.errors ?? {}).flat()
        if (theoField.length > 0) return theoField.join(' · ')
        return problem.detail ?? problem.title ?? loi.message
      }
    } catch {
      return loi.message
    }
  }
  return moTaLoi(loi, 'Không xuất được file Excel')
}

/**
 * Màn hình Học phí (Phase 4) dùng API thật.
 *
 * Bốn việc, theo đúng thứ tự người dùng làm hằng tháng: tính học phí kỳ từ điểm danh → nhìn ai sắp đến
 * hạn/quá hạn → thu tiền (mở ngăn kéo chi tiết để đối chiếu từng buổi và từng phiếu thu) → đối chiếu
 * sao kê, rồi admin chốt sổ và xuất Excel.
 *
 * Nguyên tắc xuyên suốt: số buổi và thành tiền KHÔNG nhập tay — muốn đổi thì sửa điểm danh rồi tính
 * lại kỳ. Vì vậy màn hình chỉ hiển thị và ghi nhận tiền đã thu, không cho sửa con số.
 */
export function TuitionPage() {
  const { message } = App.useApp()
  const { nguoiDung } = usePhien()
  const laAdmin = nguoiDung?.vaiTro === 'admin'

  const [thang, datThang] = useState(dayjs().month() + 1)
  const [nam, datNam] = useState(NAM_HIEN_TAI)
  const [trangThaiLoc, datTrangThaiLoc] = useState<TrangThaiThanhToan | undefined>(undefined)
  const [dongDangMo, datDongDangMo] = useState<HocPhi | null>(null)
  const [loiTinh, datLoiTinh] = useState<unknown>(null)
  const [loiXuat, datLoiXuat] = useState<string | null>(null)

  const boLoc = useMemo(() => ({ thang, nam, trangThai: trangThaiLoc }), [thang, nam, trangThaiLoc])

  const soHocPhi = useSoHocPhiKy(boLoc)
  const tinhKy = useTinhKyHocPhi()
  const xuatExcel = useXuatExcelHocPhi()

  const danhSach = soHocPhi.data ?? []
  const tongPhaiThu = danhSach.reduce((tong, dong) => tong + dong.thanhTien, 0)
  const tongDaThu = danhSach.reduce((tong, dong) => tong + dong.soTienDaThu, 0)
  const tongConLai = danhSach.reduce((tong, dong) => tong + dong.conLai, 0)
  const soDongChuaDiemDanh = danhSach.filter((dong) => dong.soBuoiChuaDiemDanh > 0).length

  const chayTinhKy = async () => {
    datLoiTinh(null)
    try {
      const ketQua = await tinhKy.mutateAsync({ thang, nam })
      message.success(
        `Đã tính học phí ${moTaKy(thang, nam)}: tạo ${ketQua.soTao} dòng, cập nhật ${ketQua.soCapNhat} dòng, bỏ qua ${ketQua.soBoQuaDaChot} dòng đã chốt · tổng ${formatVnd(ketQua.tongThanhTien)}`,
      )
      if (ketQua.loi) message.warning(ketQua.loi)
    } catch (error) {
      datLoiTinh(error)
    }
  }

  const chayXuatExcel = async () => {
    datLoiXuat(null)
    try {
      const tep = await xuatExcel.mutateAsync({ thang, nam })
      taiTepXuong(tep)
      message.success(
        `Đã tạo file ${tep.tenTep} (3 sheet: sổ chi tiết, tổng hợp theo giáo viên, phiếu thu)`,
      )
    } catch (error) {
      datLoiXuat(await moTaLoiXuatExcel(error))
    }
  }

  const cot: TableProps<HocPhi>['columns'] = [
    {
      title: 'Học sinh',
      key: 'hocSinh',
      width: 190,
      fixed: 'left',
      render: (_giaTri, dong) => (
        <Flex vertical>
          <Typography.Text strong>{dong.tenHocSinh}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            GV {dong.tenGiaoVien}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: 'Hạn đóng',
      key: 'hanDong',
      width: 110,
      render: (_giaTri, dong) => ngayNgan(dong.hanDongTien),
    },
    {
      title: 'Số buổi',
      key: 'soBuoi',
      width: 260,
      render: (_giaTri, dong) => (
        <Flex vertical gap={2}>
          <Typography.Text>
            {dong.soBuoiDiHoc} đi học · {dong.soBuoiNghiCoPhep} nghỉ có phép ·{' '}
            {dong.soBuoiNghiKhongPhep} nghỉ không phép
          </Typography.Text>
          {dong.soBuoiChuaDiemDanh > 0 ? (
            <Typography.Text type="warning" style={{ fontSize: 12 }}>
              Còn {dong.soBuoiChuaDiemDanh} buổi chưa điểm danh — con số có thể còn thay đổi
            </Typography.Text>
          ) : null}
        </Flex>
      ),
    },
    {
      title: 'Cách tính',
      key: 'cachTinh',
      width: 120,
      render: (_giaTri, dong) => (
        <Tag color={mauCachTinh(dong.cachTinhHocPhi)}>{nhanCachTinh(dong.cachTinhHocPhi)}</Tag>
      ),
    },
    {
      title: 'Đơn giá',
      dataIndex: 'donGiaApDung',
      width: 120,
      align: 'right',
      render: (soTien: number) => formatVnd(soTien),
    },
    {
      title: 'Thành tiền',
      dataIndex: 'thanhTien',
      width: 130,
      align: 'right',
      render: (soTien: number) => <Typography.Text strong>{formatVnd(soTien)}</Typography.Text>,
    },
    {
      title: 'Đã thu',
      dataIndex: 'soTienDaThu',
      width: 130,
      align: 'right',
      render: (soTien: number) => formatVnd(soTien),
    },
    {
      title: 'Còn lại',
      dataIndex: 'conLai',
      width: 130,
      align: 'right',
      render: (soTien: number) =>
        soTien > 0 ? (
          <Typography.Text type="danger">{formatVnd(soTien)}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">Đã đủ</Typography.Text>
        ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trangThaiThanhToan',
      width: 140,
      render: (trangThai: TrangThaiThanhToan) => (
        <Tag color={mauTrangThaiThanhToan(trangThai)}>{nhanTrangThaiThanhToan(trangThai)}</Tag>
      ),
    },
    {
      title: 'Đã chốt sổ',
      key: 'daChotSo',
      width: 120,
      render: (_giaTri, dong) =>
        dong.daChotSo ? (
          <Tag color="blue">Đã chốt</Tag>
        ) : (
          <Typography.Text type="secondary">Chưa</Typography.Text>
        ),
    },
    {
      title: 'Thao tác',
      key: 'thaoTac',
      width: 110,
      fixed: 'right',
      render: (_giaTri, dong) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={(suKien) => {
            suKien.stopPropagation()
            datDongDangMo(dong)
          }}
        >
          Chi tiết
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Học phí"
        description="Tính học phí kỳ từ điểm danh, thu tiền nhiều lần, đối chiếu sao kê ngân hàng, chốt sổ và xuất Excel."
      />

      <Flex vertical gap={16}>
        <Alert
          type="info"
          showIcon
          message="Số buổi và thành tiền đếm từ điểm danh — không nhập tay"
          description={
            <Flex vertical gap={4}>
              <Typography.Text>
                Theo buổi: đơn giá × (số buổi đi học + số buổi nghỉ không phép, nếu trung tâm bật tính
                tiền nghỉ không phép). Nghỉ có phép không bao giờ tính tiền. Theo tháng: thu đủ mức
                tháng, không phụ thuộc số buổi.
              </Typography.Text>
              <Typography.Text type="secondary">
                Buổi chưa điểm danh chưa được tính tiền nên thành tiền của kỳ đang mở còn có thể thay
                đổi. Muốn đổi số tiền thì sửa điểm danh rồi bấm “Tính học phí kỳ này”.
              </Typography.Text>
            </Flex>
          }
        />

        <Card size="small" title="Kỳ học phí">
          <Space wrap>
            <Select<number>
              style={{ width: 150 }}
              value={thang}
              options={THANG}
              onChange={(giaTri) => {
                datThang(giaTri)
              }}
            />
            <Select<number>
              style={{ width: 110 }}
              value={nam}
              options={NAM}
              onChange={(giaTri) => {
                datNam(giaTri)
              }}
            />
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              loading={tinhKy.isPending}
              onClick={() => {
                void chayTinhKy()
              }}
            >
              Tính học phí kỳ này
            </Button>
            <Button
              icon={<DownloadOutlined />}
              loading={xuatExcel.isPending}
              onClick={() => {
                void chayXuatExcel()
              }}
            >
              Xuất Excel
            </Button>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              File .xlsx gồm sổ chi tiết, tổng hợp theo giáo viên và danh sách phiếu thu của kỳ.
            </Typography.Text>
          </Space>
        </Card>

        {loiTinh ? (
          <LoiApiAlert
            error={loiTinh}
            tieuDe="Không tính được học phí kỳ này"
            onThuLai={() => {
              void chayTinhKy()
            }}
          />
        ) : null}

        {loiXuat ? (
          <Alert type="error" showIcon message="Không xuất được file Excel" description={loiXuat} />
        ) : null}

        <SapDenHanCard
          onMoDong={(dong) => {
            datDongDangMo(dong)
          }}
        />

        <Card
          size="small"
          title={`Sổ học phí — ${moTaKy(thang, nam)}`}
          extra={
            <Space wrap>
              <Select<TrangThaiThanhToan>
                allowClear
                placeholder="Trạng thái: tất cả"
                style={{ width: 190 }}
                value={trangThaiLoc}
                options={TRANG_THAI_THANH_TOAN.map((muc) => ({ value: muc.value, label: muc.label }))}
                onChange={(giaTri) => {
                  datTrangThaiLoc(giaTri)
                }}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {danhSach.length} dòng · {soDongChuaDiemDanh} dòng còn buổi chưa điểm danh
              </Typography.Text>
            </Space>
          }
        >
          <Flex vertical gap={12}>
            {soHocPhi.isError ? (
              <LoiApiAlert
                error={soHocPhi.error}
                tieuDe="Không đọc được sổ học phí của kỳ"
                onThuLai={() => {
                  void soHocPhi.refetch()
                }}
              />
            ) : soHocPhi.isPending ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <Table<HocPhi>
                size="small"
                rowKey="id"
                columns={cot}
                dataSource={danhSach}
                loading={soHocPhi.isFetching}
                scroll={{ x: 'max-content' }}
                onRow={(dong) => ({
                  onClick: () => {
                    datDongDangMo(dong)
                  },
                  style: { cursor: 'pointer' },
                })}
                locale={{
                  emptyText: (
                    <Flex vertical gap={4} style={{ padding: 24 }}>
                      <Typography.Text>
                        {trangThaiLoc
                          ? 'Không có dòng nào ở trạng thái này trong kỳ'
                          : 'Kỳ này chưa có dòng học phí nào'}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {trangThaiLoc
                          ? 'Bỏ bộ lọc trạng thái để xem toàn bộ sổ của kỳ.'
                          : 'Bấm “Tính học phí kỳ này” để tính từ điểm danh — hệ thống không cho nhập tay số buổi.'}
                      </Typography.Text>
                    </Flex>
                  ),
                }}
                summary={() =>
                  danhSach.length > 0 ? (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}>
                        <Typography.Text strong>Tổng cộng ({danhSach.length} học sinh)</Typography.Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} />
                      <Table.Summary.Cell index={2} />
                      <Table.Summary.Cell index={3} />
                      <Table.Summary.Cell index={4} />
                      <Table.Summary.Cell index={5} align="right">
                        <Typography.Text strong>{formatVnd(tongPhaiThu)}</Typography.Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={6} align="right">
                        <Typography.Text strong>{formatVnd(tongDaThu)}</Typography.Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={7} align="right">
                        <Typography.Text strong type={tongConLai > 0 ? 'danger' : undefined}>
                          {formatVnd(tongConLai)}
                        </Typography.Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={8} />
                      <Table.Summary.Cell index={9} />
                      <Table.Summary.Cell index={10} />
                    </Table.Summary.Row>
                  ) : null
                }
              />
            )}

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Bấm vào một dòng để mở ngăn kéo chi tiết: từng buổi trong kỳ (kể cả buổi dạy bù), từng
              phiếu thu đã ghi, và chỗ để thu tiền hoặc huỷ phiếu thu.
            </Typography.Text>
          </Flex>
        </Card>

        <DoiChieuNganHang />

        {laAdmin ? <ChotSoCard key={`${thang}-${nam}`} thang={thang} nam={nam} /> : null}

        {laAdmin ? <TongHopCard key={`${thang}-${nam}`} thang={thang} nam={nam} /> : null}
      </Flex>

      <ChiTietDrawer
        hocPhi={dongDangMo}
        onClose={() => {
          datDongDangMo(null)
        }}
      />
    </>
  )
}
