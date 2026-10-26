import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Flex,
  Input,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
import {
  DollarOutlined,
  DownOutlined,
  EditOutlined,
  KeyOutlined,
  ReloadOutlined,
  RightOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { PageHeader } from '../../components/page'
import { useDanhSachGiaoVien } from '../../api/teachers'
import { useTongHopTheoGiaoVien } from '../../api/tuition'
import { usePhien } from '../../app/session'
import type { GiaoVien } from '../../api/types'
import { ngayNgan } from '../../config/lichTuan'
import { formatVnd } from '../../lib/money'
import { NHAN_TRANG_THAI, NHAN_VAI_TRO } from './nhanGiaoVien'
import { ThemGiaoVienModal } from './ThemGiaoVienModal'
import { SuaGiaoVienModal } from './SuaGiaoVienModal'
import { DatLaiMatKhauModal } from './DatLaiMatKhauModal'
import { TomTatThuNhapGiaoVien } from './TomTatThuNhapGiaoVien'

const KICH_THUOC_MAC_DINH = 10

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

/**
 * Danh sách giáo viên, hồ sơ và tóm tắt thu nhập.
 */
export function TeachersPage() {
  const { nguoiDung } = usePhien()
  const laAdmin = nguoiDung?.vaiTro === 'admin'

  const [thang, setThang] = useState(dayjs().month() + 1)
  const [nam, setNam] = useState(NAM_HIEN_TAI)
  const [tuKhoa, setTuKhoa] = useState('')
  const [trang, setTrang] = useState(1)
  const [kichThuoc, setKichThuoc] = useState(KICH_THUOC_MAC_DINH)
  const [expandedRowKeys, setExpandedRowKeys] = useState<readonly React.Key[]>([])

  const [moThemMoi, setMoThemMoi] = useState(false)
  const [dangSua, setDangSua] = useState<GiaoVien | null>(null)
  const [dangDatLaiMatKhau, setDangDatLaiMatKhau] = useState<GiaoVien | null>(null)

  const danhSach = useDanhSachGiaoVien({
    tuKhoa: tuKhoa.trim() || undefined,
    trang,
    kichThuoc,
  })

  // Lấy tổng hợp học phí/thu nhập theo giáo viên trong kỳ
  const tongHopKy = useTongHopTheoGiaoVien({ thang, nam }, true)
  const mapTongHop = useMemo(() => {
    const m = new Map<string, { phaiThu: number; daThu: number; conLai: number; soHocSinh: number }>()
    for (const item of tongHopKy.data ?? []) {
      m.set(item.giaoVienId, item)
    }
    return m
  }, [tongHopKy.data])

  const toggleExpand = (id: string) => {
    setExpandedRowKeys((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id],
    )
  }

  const cot: NonNullable<TableProps<GiaoVien>['columns']> = [
    {
      title: 'Tên',
      dataIndex: 'hoTen',
      key: 'hoTen',
      width: 190,
      render: (hoTen: string, giaoVien: GiaoVien) => (
        <Space size={6}>
          <Typography.Text strong>{hoTen}</Typography.Text>
          {giaoVien.id === nguoiDung?.id ? <Tag color="blue">Bạn</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'soDienThoai',
      key: 'soDienThoai',
      width: 130,
      render: (soDienThoai: string | null) => soDienThoai ?? '—',
    },
    {
      title: 'Vai trò',
      dataIndex: 'vaiTro',
      key: 'vaiTro',
      width: 120,
      render: (_: unknown, giaoVien: GiaoVien) => (
        <Tag color={NHAN_VAI_TRO[giaoVien.vaiTro].mau}>{NHAN_VAI_TRO[giaoVien.vaiTro].nhan}</Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trangThai',
      key: 'trangThai',
      width: 120,
      render: (_: unknown, giaoVien: GiaoVien) => (
        <Tag color={NHAN_TRANG_THAI[giaoVien.trangThai].mau}>
          {NHAN_TRANG_THAI[giaoVien.trangThai].nhan}
        </Tag>
      ),
    },
    {
      title: 'Học sinh',
      dataIndex: 'soHocSinhDangPhuTrach',
      key: 'soHocSinhDangPhuTrach',
      width: 100,
      align: 'right',
    },
    {
      title: 'Buổi dạy tháng này',
      dataIndex: 'soBuoiDayTrongThang',
      key: 'soBuoiDayTrongThang',
      width: 140,
      align: 'right',
      render: (soBuoi: number) => (
        <Typography.Text strong style={{ color: '#2563eb' }}>
          {soBuoi} buổi
        </Typography.Text>
      ),
    },
    {
      title: `Thu nhập T${thang}/${nam}`,
      key: 'thuNhap',
      width: 230,
      render: (_: unknown, giaoVien: GiaoVien) => {
        const th = mapTongHop.get(giaoVien.id)
        if (!th) {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        const tiLe = th.phaiThu > 0 ? Math.round((th.daThu / th.phaiThu) * 100) : 0
        return (
          <Flex vertical gap={2}>
            <Space size={6} wrap>
              <Typography.Text strong style={{ color: '#15803d', fontSize: 12.5 }}>
                {formatVnd(th.daThu)}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                / {formatVnd(th.phaiThu)}
              </Typography.Text>
            </Space>
            <Flex align="center" gap={6} wrap>
              {th.conLai > 0 ? (
                <Tag color="warning" style={{ fontSize: 10.5, margin: 0 }}>
                  Còn nợ: {formatVnd(th.conLai)}
                </Tag>
              ) : (
                <Tag color="success" style={{ fontSize: 10.5, margin: 0 }}>
                  Đã thu đủ ({tiLe}%)
                </Tag>
              )}
            </Flex>
          </Flex>
        )
      },
    },
    {
      title: 'Ngày tham gia',
      dataIndex: 'ngayThamGia',
      key: 'ngayThamGia',
      width: 130,
      render: (ngayThamGia: string) => ngayNgan(ngayThamGia),
    },
    {
      title: 'Thao tác',
      key: 'thaoTac',
      width: laAdmin ? 250 : 130,
      fixed: 'right',
      render: (_: unknown, giaoVien: GiaoVien) => {
        const isExpanded = expandedRowKeys.includes(giaoVien.id)
        return (
          <Space size={4} wrap>
            <Button
              type="link"
              size="small"
              icon={isExpanded ? <DownOutlined /> : <RightOutlined />}
              onClick={() => {
                toggleExpand(giaoVien.id)
              }}
            >
              {isExpanded ? 'Đóng' : 'Thu nhập'}
            </Button>
            {laAdmin ? (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setDangSua(giaoVien)
                  }}
                >
                  Sửa
                </Button>
                <Button
                  type="link"
                  size="small"
                  icon={<KeyOutlined />}
                  onClick={() => {
                    setDangDatLaiMatKhau(giaoVien)
                  }}
                >
                  Đặt lại MK
                </Button>
              </>
            ) : null}
          </Space>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title={laAdmin ? 'Giáo viên' : 'Hồ sơ & Thu nhập'}
        description={
          laAdmin
            ? 'Quản lý danh sách giáo viên, phân quyền và theo dõi thu nhập từng giáo viên.'
            : 'Hồ sơ cá nhân và tóm tắt chi tiết thu nhập của bạn theo từng kỳ học.'
        }
      />

      <Flex vertical gap={16}>
        {/* Banner tóm tắt thu nhập cho giáo viên đang đăng nhập */}
        {nguoiDung && !laAdmin ? (
          <TomTatThuNhapGiaoVien
            giaoVienId={nguoiDung.id}
            tenGiaoVien={nguoiDung.hoTen}
            laToi
            macDinhThang={thang}
            macDinhNam={nam}
          />
        ) : null}

        <Card
          size="small"
          title={
            <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
              <Typography.Text strong style={{ fontSize: 14 }}>
                {laAdmin ? 'Danh sách giáo viên' : 'Thông tin tài khoản giáo viên'}
              </Typography.Text>

              {/* Bộ chọn kỳ cho cột thu nhập */}
              <Space size={6} wrap>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  <DollarOutlined style={{ marginRight: 4, color: '#2563eb' }} />
                  Kỳ thu nhập:
                </Typography.Text>
                <Select<number>
                  size="small"
                  style={{ width: 105 }}
                  value={thang}
                  options={THANG}
                  onChange={setThang}
                />
                <Select<number>
                  size="small"
                  style={{ width: 85 }}
                  value={nam}
                  options={NAM}
                  onChange={setNam}
                />
              </Space>
            </Flex>
          }
          extra={
            <Space wrap>
              {laAdmin ? (
                <Input.Search
                  allowClear
                  placeholder="Tìm theo tên hoặc email"
                  style={{ width: 220 }}
                  onSearch={(giaTri) => {
                    setTuKhoa(giaTri.trim())
                    setTrang(1)
                  }}
                />
              ) : null}
              {laAdmin ? (
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={() => {
                    setMoThemMoi(true)
                  }}
                >
                  Thêm giáo viên
                </Button>
              ) : null}
            </Space>
          }
        >
          {danhSach.isPending ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : danhSach.isError ? (
            <Alert
              type="error"
              showIcon
              message="Không đọc được danh sách giáo viên"
              description={
                danhSach.error instanceof Error ? danhSach.error.message : 'Lỗi không xác định'
              }
              action={
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    void danhSach.refetch()
                  }}
                >
                  Thử lại
                </Button>
              }
            />
          ) : (
            <Table<GiaoVien>
              size="small"
              rowKey="id"
              columns={cot}
              dataSource={danhSach.data?.duLieu ?? []}
              loading={danhSach.isFetching || tongHopKy.isFetching}
              scroll={{ x: 1500 }}
              locale={{ emptyText: 'Không tìm thấy giáo viên nào' }}
              expandable={{
                expandedRowKeys,
                onExpandedRowsChange: setExpandedRowKeys,
                expandedRowRender: (record) => (
                  <div style={{ margin: '8px 0' }}>
                    <TomTatThuNhapGiaoVien
                      giaoVienId={record.id}
                      tenGiaoVien={record.hoTen}
                      laToi={record.id === nguoiDung?.id}
                      macDinhThang={thang}
                      macDinhNam={nam}
                      compact
                    />
                  </div>
                ),
                rowExpandable: () => true,
              }}
              pagination={{
                current: danhSach.data?.trang ?? trang,
                pageSize: danhSach.data?.kichThuoc ?? kichThuoc,
                total: danhSach.data?.tongSo ?? 0,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50],
                showTotal: (tongSo) => `${tongSo} giáo viên`,
                onChange: (trangMoi, kichThuocMoi) => {
                  setTrang(trangMoi)
                  setKichThuoc(kichThuocMoi)
                },
              }}
            />
          )}
        </Card>
      </Flex>

      {laAdmin ? (
        <>
          <ThemGiaoVienModal
            open={moThemMoi}
            onClose={() => {
              setMoThemMoi(false)
            }}
          />
          <SuaGiaoVienModal
            giaoVien={dangSua}
            onClose={() => {
              setDangSua(null)
            }}
          />
          <DatLaiMatKhauModal
            giaoVien={dangDatLaiMatKhau}
            onClose={() => {
              setDangDatLaiMatKhau(null)
            }}
          />
        </>
      ) : null}
    </>
  )
}
