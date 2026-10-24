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

const KICH_THUOC_MAC_DINH = 10

/**
 * Danh sách giáo viên và tài khoản.
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
      width: 200,
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
        description="Quản lý danh sách giáo viên và phân quyền."
      />
      <Card
        size="small"
        title="Danh sách giáo viên"
        extra={
          <Space wrap>
            <Input.Search
              allowClear
              placeholder="Tìm theo tên hoặc email"
              style={{ width: 260 }}
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
            locale={{ emptyText: 'Không tìm thấy giáo viên nào' }}
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
