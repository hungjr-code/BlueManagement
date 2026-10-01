import { useState } from 'react'
import { Alert, Button, Card, Input, Skeleton, Space, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import { EditOutlined, KeyOutlined, ReloadOutlined, UserAddOutlined } from '@ant-design/icons'
import { PageHeader } from '../../components/page'
import { useDanhSachGiaoVien } from '../../api/teachers'
import { usePhien } from '../../app/session'
import type { GiaoVien } from '../../api/types'
import { ngayNgan } from '../../config/lichTuan'
import { NHAN_TRANG_THAI, NHAN_VAI_TRO } from './nhanGiaoVien'
import { ThemGiaoVienModal } from './ThemGiaoVienModal'
import { SuaGiaoVienModal } from './SuaGiaoVienModal'
import { DatLaiMatKhauModal } from './DatLaiMatKhauModal'

interface DongPhamVi {
  key: string
  quyen: string
  admin: string
  giaoVien: string
}

const phamVi: DongPhamVi[] = [
  {
    key: '1',
    quyen: 'Xem học sinh',
    admin: 'Tất cả học sinh, lọc được theo giáo viên',
    giaoVien: 'Chỉ học sinh do mình phụ trách',
  },
  {
    key: '2',
    quyen: 'Thêm / sửa học sinh',
    admin: 'Mọi học sinh, gán được giáo viên phụ trách',
    giaoVien: 'Chỉ học sinh của mình, không đổi được giáo viên phụ trách',
  },
  {
    key: '3',
    quyen: 'Điểm danh',
    admin: 'Xem tất cả, sửa được và mọi thay đổi vào nhật ký',
    giaoVien: 'Chỉ điểm danh buổi học của mình',
  },
  {
    key: '4',
    quyen: 'Học phí',
    admin: 'Toàn bộ, xem được tổng thu và doanh thu theo giáo viên',
    giaoVien: 'Chỉ học phí của học sinh mình dạy',
  },
  {
    key: '5',
    quyen: 'Quản lý giáo viên',
    admin: 'Thêm, gán vai trò, vô hiệu hoá tài khoản',
    giaoVien: 'Chỉ xem hồ sơ của chính mình',
  },
]

const cotPhamVi: TableProps<DongPhamVi>['columns'] = [
  { title: 'Quyền', dataIndex: 'quyen', width: 200 },
  {
    title: (
      <Space>
        Admin (chủ)
        <Tag color="gold">toàn quyền</Tag>
      </Space>
    ),
    dataIndex: 'admin',
  },
  {
    title: (
      <Space>
        Giáo viên
        <Tag color="blue">giới hạn</Tag>
      </Space>
    ),
    dataIndex: 'giaoVien',
  },
]

const KICH_THUOC_MAC_DINH = 10

/**
 * Danh sách giáo viên thật từ `GET /api/teachers` (phân trang phía server).
 *
 * Chỉ admin thấy nút thêm / sửa / đặt lại mật khẩu. Giáo viên vào chỉ thấy đúng hồ sơ của mình —
 * backend đã chặn, việc ẩn nút ở đây chỉ để gọn mắt.
 */
export function TeachersPage() {
  const { nguoiDung } = usePhien()
  const laAdmin = nguoiDung?.vaiTro === 'admin'

  const [tuKhoa, setTuKhoa] = useState('')
  const [trang, setTrang] = useState(1)
  const [kichThuoc, setKichThuoc] = useState(KICH_THUOC_MAC_DINH)

  const [moThemMoi, setMoThemMoi] = useState(false)
  const [dangSua, setDangSua] = useState<GiaoVien | null>(null)
  const [dangDatLaiMatKhau, setDangDatLaiMatKhau] = useState<GiaoVien | null>(null)

  const danhSach = useDanhSachGiaoVien({
    tuKhoa: tuKhoa.trim() || undefined,
    trang,
    kichThuoc,
  })

  const cot: NonNullable<TableProps<GiaoVien>['columns']> = [
    {
      title: 'Tên',
      dataIndex: 'hoTen',
      key: 'hoTen',
      width: 200,
      render: (hoTen: string, giaoVien: GiaoVien) => (
        <Space size={4}>
          <Typography.Text strong>{hoTen}</Typography.Text>
          {giaoVien.id === nguoiDung?.id ? <Tag color="cyan">bạn</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      ellipsis: true,
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'soDienThoai',
      key: 'soDienThoai',
      width: 140,
      render: (soDienThoai: string | null) => soDienThoai ?? '—',
    },
    {
      title: 'Vai trò',
      dataIndex: 'vaiTro',
      key: 'vaiTro',
      width: 130,
      render: (_: unknown, giaoVien: GiaoVien) => (
        <Tag color={NHAN_VAI_TRO[giaoVien.vaiTro].mau}>{NHAN_VAI_TRO[giaoVien.vaiTro].nhan}</Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trangThai',
      key: 'trangThai',
      width: 130,
      render: (_: unknown, giaoVien: GiaoVien) => (
        <Tag color={NHAN_TRANG_THAI[giaoVien.trangThai].mau}>
          {NHAN_TRANG_THAI[giaoVien.trangThai].nhan}
        </Tag>
      ),
    },
    {
      title: 'Học sinh phụ trách',
      dataIndex: 'soHocSinhDangPhuTrach',
      key: 'soHocSinhDangPhuTrach',
      width: 150,
      align: 'right',
    },
    {
      title: 'Buổi dạy tháng này',
      dataIndex: 'soBuoiDayTrongThang',
      key: 'soBuoiDayTrongThang',
      width: 160,
      align: 'right',
    },
    {
      title: 'Ngày tham gia',
      dataIndex: 'ngayThamGia',
      key: 'ngayThamGia',
      width: 140,
      render: (ngayThamGia: string) => ngayNgan(ngayThamGia),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghiChu',
      key: 'ghiChu',
      ellipsis: true,
      render: (ghiChu: string | null) => ghiChu ?? '—',
    },
  ]

  if (laAdmin) {
    cot.push({
      title: 'Thao tác',
      key: 'thaoTac',
      width: 250,
      fixed: 'right',
      render: (_: unknown, giaoVien: GiaoVien) => (
        <Space size={4}>
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
            Đặt lại mật khẩu
          </Button>
        </Space>
      ),
    })
  }

  return (
    <>
      <PageHeader
        title="Giáo viên"
        description="Danh sách giáo viên đọc từ backend: vai trò, số học sinh đang phụ trách và số buổi đã dạy trong tháng. Chỉ admin thêm, sửa và đặt lại mật khẩu."
      />
      <Card
        size="small"
        title="Danh sách giáo viên"
        extra={
          <Space wrap>
            <Input.Search
              allowClear
              enterButton="Tìm"
              placeholder="Tìm theo tên hoặc email"
              style={{ width: 300 }}
              onSearch={(giaTri) => {
                setTuKhoa(giaTri.trim())
                setTrang(1)
              }}
            />
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
        {!laAdmin ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Chỉ admin quản lý tài khoản giáo viên"
            description="Bạn đang xem hồ sơ của chính mình. Nút thêm / sửa / đặt lại mật khẩu được ẩn ở đây chỉ để gọn mắt — quyền được chặn ở backend: gọi thẳng API của người khác vẫn bị từ chối."
          />
        ) : null}

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
            loading={danhSach.isFetching}
            scroll={{ x: 1400 }}
            locale={{ emptyText: 'Không tìm thấy giáo viên nào khớp từ khoá' }}
            pagination={{
              current: danhSach.data?.trang ?? trang,
              pageSize: danhSach.data?.kichThuoc ?? kichThuoc,
              total: danhSach.data?.tongSo ?? 0,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 200],
              showTotal: (tongSo) => `${tongSo} giáo viên`,
              onChange: (trangMoi, kichThuocMoi) => {
                setTrang(trangMoi)
                setKichThuoc(kichThuocMoi)
              },
            }}
          />
        )}

        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
          Số học sinh đang phụ trách và số buổi đã dạy trong tháng do backend đếm (từ bảng học sinh và
          điểm danh) — không nhập tay, nên con số dùng để tính lương sau này không gõ sai được.
        </Typography.Paragraph>
      </Card>

      <Card
        size="small"
        title="Phạm vi dữ liệu theo vai trò"
        extra={<Tag color="purple">2 vai trò</Tag>}
      >
        <Table<DongPhamVi>
          size="small"
          rowKey="key"
          columns={cotPhamVi}
          dataSource={phamVi}
          pagination={false}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          Nguyên tắc: frontend ẩn nút chỉ là để gọn mắt. Mọi kiểm tra quyền phải làm ở backend —
          giáo viên gọi thẳng API của người khác vẫn phải bị chặn.
        </Typography.Paragraph>
      </Card>

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
