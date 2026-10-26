import { useMemo, useState } from 'react'
import {
  Card,
  Col,
  Empty,
  Flex,
  Progress,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSoHocPhiKy, useTongHopTheoGiaoVien } from '../../api/tuition'
import type { HocPhi, TrangThaiThanhToan } from '../../api/tuition'
import { formatVnd } from '../../lib/money'
import { ngayNgan } from '../../config/lichTuan'
import {
  mauCachTinh,
  mauTrangThaiThanhToan,
  moTaKy,
  nhanCachTinh,
  nhanTrangThaiThanhToan,
} from '../tuition/hienThi'

interface TomTatThuNhapGiaoVienProps {
  giaoVienId: string
  tenGiaoVien: string
  laToi?: boolean
  macDinhThang?: number
  macDinhNam?: number
  hienBangHocSinh?: boolean
  hienBoChonThang?: boolean
  compact?: boolean
}

const THANG: { value: number; label: string }[] = Array.from(
  { length: 12 },
  (_o, chiSo) => ({ value: chiSo + 1, label: `Tháng ${String(chiSo + 1).padStart(2, '0')}` }),
)

const NAM_HIEN_TAI = dayjs().year()
const NAM: { value: number; label: string }[] = [
  NAM_HIEN_TAI - 2,
  NAM_HIEN_TAI - 1,
  NAM_HIEN_TAI,
  NAM_HIEN_TAI + 1,
].map((nam) => ({ value: nam, label: String(nam) }))

export function TomTatThuNhapGiaoVien({
  giaoVienId,
  tenGiaoVien,
  laToi = false,
  macDinhThang = dayjs().month() + 1,
  macDinhNam = NAM_HIEN_TAI,
  hienBangHocSinh = true,
  hienBoChonThang = true,
  compact = false,
}: TomTatThuNhapGiaoVienProps) {
  const [thang, setThang] = useState(macDinhThang)
  const [nam, setNam] = useState(macDinhNam)
  const [trangThaiLoc, setTrangThaiLoc] = useState<TrangThaiThanhToan | undefined>(undefined)

  const ky = useMemo(() => ({ thang, nam }), [thang, nam])

  // Lấy tổng hợp doanh thu của giáo viên trong kỳ
  const tongHopQuery = useTongHopTheoGiaoVien(ky, true)
  const dongTongHop = (tongHopQuery.data ?? []).find((x) => x.giaoVienId === giaoVienId)

  // Lấy danh sách học phí chi tiết các học sinh của giáo viên
  const soHocPhiQuery = useSoHocPhiKy({
    thang,
    nam,
    giaoVienId,
    trangThai: trangThaiLoc,
  })

  const danhSachHocPhi = soHocPhiQuery.data ?? []

  const phaiThu = dongTongHop?.phaiThu ?? danhSachHocPhi.reduce((s, h) => s + h.thanhTien, 0)
  const daThu = dongTongHop?.daThu ?? danhSachHocPhi.reduce((s, h) => s + h.soTienDaThu, 0)
  const conLai = dongTongHop?.conLai ?? Math.max(phaiThu - daThu, 0)
  const soHocSinh = dongTongHop?.soHocSinh ?? danhSachHocPhi.length

  const tiLeThu = phaiThu > 0 ? Math.round((daThu / phaiThu) * 1000) / 10 : 0

  const cotHocPhi: TableProps<HocPhi>['columns'] = [
    {
      title: 'Học sinh',
      dataIndex: 'tenHocSinh',
      key: 'tenHocSinh',
      width: 170,
      render: (ten: string) => <Typography.Text strong>{ten}</Typography.Text>,
    },
    {
      title: 'Cách tính',
      dataIndex: 'cachTinhHocPhi',
      key: 'cachTinhHocPhi',
      width: 120,
      render: (cach: HocPhi['cachTinhHocPhi']) => (
        <Tag color={mauCachTinh(cach)}>{nhanCachTinh(cach)}</Tag>
      ),
    },
    {
      title: 'Buổi học',
      key: 'buoiHoc',
      width: 130,
      render: (_: unknown, dong: HocPhi) => (
        <Space size={4}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {dong.soBuoiDiHoc} học
            {dong.soBuoiNghiCoPhep > 0 ? ` · ${dong.soBuoiNghiCoPhep} phép` : ''}
            {dong.soBuoiNghiKhongPhep > 0 ? ` · ${dong.soBuoiNghiKhongPhep} K.phép` : ''}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Thành tiền',
      dataIndex: 'thanhTien',
      key: 'thanhTien',
      width: 130,
      align: 'right',
      render: (tien: number) => <Typography.Text strong>{formatVnd(tien)}</Typography.Text>,
    },
    {
      title: 'Đã thu',
      dataIndex: 'soTienDaThu',
      key: 'soTienDaThu',
      width: 130,
      align: 'right',
      render: (tien: number) => (
        <Typography.Text style={{ color: '#15803d', fontWeight: 600 }}>
          {formatVnd(tien)}
        </Typography.Text>
      ),
    },
    {
      title: 'Còn lại',
      dataIndex: 'conLai',
      key: 'conLai',
      width: 130,
      align: 'right',
      render: (tien: number) =>
        tien > 0 ? (
          <Typography.Text type="danger" strong>
            {formatVnd(tien)}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">0 ₫</Typography.Text>
        ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trangThaiThanhToan',
      key: 'trangThaiThanhToan',
      width: 130,
      render: (trangThai: TrangThaiThanhToan) => (
        <Tag color={mauTrangThaiThanhToan(trangThai)}>{nhanTrangThaiThanhToan(trangThai)}</Tag>
      ),
    },
    {
      title: 'Hạn đóng',
      dataIndex: 'hanDongTien',
      key: 'hanDongTien',
      width: 110,
      render: (han: string) => ngayNgan(han),
    },
    {
      title: 'Chốt sổ',
      key: 'daChotSo',
      width: 100,
      render: (_: unknown, dong: HocPhi) =>
        dong.daChotSo ? (
          <Tag color="blue">Đã chốt</Tag>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ]

  return (
    <Card
      size="small"
      style={{
        background: compact ? '#fafcff' : '#ffffff',
        border: compact ? '1px solid #dbeafe' : undefined,
        borderRadius: 10,
      }}
      title={
        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
          <Space align="center" size={8}>
            <DollarOutlined style={{ color: '#2563eb', fontSize: 16 }} />
            <Typography.Text strong style={{ fontSize: compact ? 13.5 : 15 }}>
              {laToi ? 'Tóm tắt thu nhập của bạn' : `Tóm tắt thu nhập · ${tenGiaoVien}`}
            </Typography.Text>
            <Tag color="blue">{moTaKy(thang, nam)}</Tag>
          </Space>

          {hienBoChonThang ? (
            <Space size={6} wrap>
              <Select<number>
                size="small"
                style={{ width: 110 }}
                value={thang}
                options={THANG}
                onChange={setThang}
              />
              <Select<number>
                size="small"
                style={{ width: 90 }}
                value={nam}
                options={NAM}
                onChange={setNam}
              />
            </Space>
          ) : null}
        </Flex>
      }
    >
      <Flex vertical gap={16}>
        {/* Statistics cards */}
        {tongHopQuery.isPending && soHocPhiQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12} md={6}>
              <Card
                size="small"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                }}
              >
                <Statistic
                  title={
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Tổng học phí phải thu
                    </Typography.Text>
                  }
                  value={formatVnd(phaiThu)}
                  valueStyle={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}
                  prefix={<DollarOutlined style={{ color: '#3b82f6', fontSize: 16 }} />}
                />
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {soHocSinh} học sinh phụ trách
                </Typography.Text>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card
                size="small"
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 8,
                }}
              >
                <Statistic
                  title={
                    <Typography.Text style={{ fontSize: 12, color: '#166534' }}>
                      Thực nhận (Đã thu)
                    </Typography.Text>
                  }
                  value={formatVnd(daThu)}
                  valueStyle={{ fontSize: 18, fontWeight: 700, color: '#15803d' }}
                  prefix={<CheckCircleOutlined style={{ color: '#22c55e', fontSize: 16 }} />}
                />
                <Typography.Text style={{ fontSize: 11, color: '#16a34a' }}>
                  Đã thanh toán vào sổ
                </Typography.Text>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card
                size="small"
                style={{
                  background: conLai > 0 ? '#fef2f2' : '#f8fafc',
                  border: conLai > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
                  borderRadius: 8,
                }}
              >
                <Statistic
                  title={
                    <Typography.Text
                      style={{
                        fontSize: 12,
                        color: conLai > 0 ? '#991b1b' : '#64748b',
                      }}
                    >
                      Còn nợ (Chưa thu)
                    </Typography.Text>
                  }
                  value={formatVnd(conLai)}
                  valueStyle={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: conLai > 0 ? '#dc2626' : '#64748b',
                  }}
                  prefix={
                    <ClockCircleOutlined
                      style={{ color: conLai > 0 ? '#ef4444' : '#94a3b8', fontSize: 16 }}
                    />
                  }
                />
                <Typography.Text
                  style={{
                    fontSize: 11,
                    color: conLai > 0 ? '#b91c1c' : '#94a3b8',
                  }}
                >
                  {conLai > 0 ? 'Cần thu tiếp từ học sinh' : 'Đã thu đủ 100%'}
                </Typography.Text>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card
                size="small"
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 8,
                }}
              >
                <Flex justify="space-between" align="baseline">
                  <Typography.Text style={{ fontSize: 12, color: '#1e40af' }}>
                    Tỷ lệ thu học phí
                  </Typography.Text>
                  <Typography.Text strong style={{ fontSize: 18, color: '#1d4ed8' }}>
                    {tiLeThu}%
                  </Typography.Text>
                </Flex>
                <Progress
                  percent={tiLeThu}
                  strokeColor={{
                    '0%': '#3b82f6',
                    '100%': '#10b981',
                  }}
                  size="small"
                  showInfo={false}
                  style={{ margin: '8px 0 4px 0' }}
                />
                <Typography.Text style={{ fontSize: 11, color: '#3b82f6' }}>
                  {tiLeThu === 100
                    ? 'Hoàn thành 100%'
                    : `${formatVnd(daThu)} / ${formatVnd(phaiThu)}`}
                </Typography.Text>
              </Card>
            </Col>
          </Row>
        )}

        {/* Student list */}
        {hienBangHocSinh ? (
          <div>
            <Flex
              justify="space-between"
              align="center"
              wrap="wrap"
              gap={8}
              style={{ marginBottom: 8 }}
            >
              <Typography.Text strong style={{ fontSize: 13, color: '#334155' }}>
                <UserOutlined style={{ marginRight: 6 }} />
                Danh sách học sinh kỳ {moTaKy(thang, nam)} ({danhSachHocPhi.length} học sinh)
              </Typography.Text>

              <Select<TrangThaiThanhToan>
                size="small"
                allowClear
                placeholder="Lọc trạng thái thanh toán"
                style={{ width: 190 }}
                value={trangThaiLoc}
                onChange={setTrangThaiLoc}
                options={[
                  { value: 'da_thu', label: 'Đã thu đủ' },
                  { value: 'thu_mot_phan', label: 'Thu một phần' },
                  { value: 'chua_thu', label: 'Chưa thu' },
                ]}
              />
            </Flex>

            {soHocPhiQuery.isPending ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : danhSachHocPhi.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  trangThaiLoc
                    ? 'Không có học sinh nào theo bộ lọc này'
                    : `Chưa có dữ liệu học phí cho kỳ ${moTaKy(thang, nam)}. Hãy bấm "Tính học phí kỳ này" tại trang Học phí.`
                }
              />
            ) : (
              <Table<HocPhi>
                size="small"
                rowKey="id"
                columns={cotHocPhi}
                dataSource={danhSachHocPhi}
                pagination={false}
                scroll={{ x: 1000 }}
              />
            )}
          </div>
        ) : null}
      </Flex>
    </Card>
  )
}
