import { useMemo, useState } from 'react'
import {
  App,
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
import { EditOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons'
import { PageHeader } from '../../components/page'
import { useChoHocSinhNghi, useDanhSachHocSinh } from '../../api/students'
import { useDanhSachGiaoVien } from '../../api/teachers'
import type { BoLocHocSinh, HocSinh, TrangThaiHocSinh } from '../../api/types'
import { usePhien } from '../../app/session'
import { formatVnd } from '../../lib/money'
import { FormHocSinh } from './FormHocSinh'
import { LoiApiAlert } from '../../components/LoiApiAlert'
import {
  SO_TUAN_MOI_THANG,
  TRANG_THAI_HOC_SINH,
  hocPhiDuKienThang,
  mauCachTinhHocPhi,
  mauTrangThai,
  moTaDonGia,
  moTaHanDong,
  moTaLichHoc,
  nhanCachTinhHocPhi,
  nhanTrangThai,
} from './hienThi'

const KICH_THUOC_MAC_DINH = 20

/**
 * Danh sách học sinh.
 */
export function StudentsPage() {
  const { message, modal } = App.useApp()
  const { nguoiDung } = usePhien()
  const laAdmin = nguoiDung?.vaiTro === 'admin'

  const [oNhapTuKhoa, datONhapTuKhoa] = useState('')
  const [tuKhoa, datTuKhoa] = useState('')
  const [trangThaiLoc, datTrangThaiLoc] = useState<TrangThaiHocSinh | undefined>(undefined)
  const [giaoVienLoc, datGiaoVienLoc] = useState<string | undefined>(undefined)
  const [trang, datTrang] = useState(1)
  const [kichThuoc, datKichThuoc] = useState(KICH_THUOC_MAC_DINH)

  const [dangMoForm, datDangMoForm] = useState(false)
  const [hocSinhDangSua, datHocSinhDangSua] = useState<HocSinh | null>(null)
  const [loiThaoTac, datLoiThaoTac] = useState<unknown>(null)

  const boLoc = useMemo<BoLocHocSinh>(
    () => ({
      tuKhoa: tuKhoa || undefined,
      trangThai: trangThaiLoc,
      giaoVienId: laAdmin ? giaoVienLoc : undefined,
      trang,
      kichThuoc,
    }),
    [tuKhoa, trangThaiLoc, giaoVienLoc, laAdmin, trang, kichThuoc],
  )

  const danhSach = useDanhSachHocSinh(boLoc)
  const choNghi = useChoHocSinhNghi()
  const danhSachGiaoVien = useDanhSachGiaoVien({ kichThuoc: 200 })
  const giaoVien = danhSachGiaoVien.data?.duLieu ?? []

  const coBoLoc = tuKhoa !== '' || trangThaiLoc !== undefined || giaoVienLoc !== undefined

  const moFormThem = () => {
    datHocSinhDangSua(null)
    datDangMoForm(true)
  }

  const moFormSua = (hocSinh: HocSinh) => {
    datHocSinhDangSua(hocSinh)
    datDangMoForm(true)
  }

  const dongForm = () => {
    datDangMoForm(false)
    datHocSinhDangSua(null)
  }

  const xoaBoLoc = () => {
    datONhapTuKhoa('')
    datTuKhoa('')
    datTrangThaiLoc(undefined)
    datGiaoVienLoc(undefined)
    datTrang(1)
  }

  const hoiChoNghi = (hocSinh: HocSinh) => {
    modal.confirm({
      title: `Cho ${hocSinh.hoTen} nghỉ học?`,
      content: (
        <Flex vertical gap={6}>
          <Typography.Text>
            Học sinh sẽ được chuyển sang trạng thái <strong>Đã nghỉ</strong> và dừng lịch học kể từ hôm nay.
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Dữ liệu điểm danh và học phí trước đó vẫn được lưu trữ đầy đủ.
          </Typography.Text>
        </Flex>
      ),
      okText: 'Xác nhận cho nghỉ',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      onOk: async () => {
        datLoiThaoTac(null)
        try {
          await choNghi.mutateAsync(hocSinh.id)
          message.success(`Đã cập nhật trạng thái nghỉ cho ${hocSinh.hoTen}`)
        } catch (error) {
          datLoiThaoTac(error)
        }
      },
    })
  }

  const cot: TableProps<HocSinh>['columns'] = [
    {
      title: 'Tên học sinh',
      dataIndex: 'hoTen',
      width: 200,
      render: (_giaTri, hocSinh) => (
        <Flex vertical>
          <Typography.Text strong>{hocSinh.hoTen}</Typography.Text>
          {hocSinh.phuHuynh || hocSinh.soDienThoaiPhuHuynh ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {[hocSinh.phuHuynh, hocSinh.soDienThoaiPhuHuynh].filter(Boolean).join(' · ')}
            </Typography.Text>
          ) : null}
        </Flex>
      ),
    },
    {
      title: 'Lớp',
      dataIndex: 'lop',
      width: 120,
      render: (lop: string | null) => lop ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Giáo viên',
      dataIndex: 'tenGiaoVien',
      width: 160,
    },
    {
      title: 'Cách tính học phí',
      key: 'cachTinhHocPhi',
      width: 180,
      render: (_giaTri, hocSinh) => (
        <Flex vertical gap={4} align="flex-start">
          <Tag color={mauCachTinhHocPhi(hocSinh.cachTinhHocPhi)}>
            {nhanCachTinhHocPhi(hocSinh.cachTinhHocPhi)}
          </Tag>
          <Typography.Text>{moTaDonGia(hocSinh)}</Typography.Text>
        </Flex>
      ),
    },
    {
      title: 'Buổi/tuần',
      dataIndex: 'soBuoiMoiTuan',
      width: 100,
      render: (soBuoi: number) => `${soBuoi} buổi`,
    },
    {
      title: 'Lịch học',
      key: 'lichHoc',
      width: 220,
      render: (_giaTri, hocSinh) => moTaLichHoc(hocSinh.lichHoc),
    },
    {
      title: 'Hạn đóng',
      dataIndex: 'ngayDenHanDongTien',
      width: 140,
      render: (ngay: number) => moTaHanDong(ngay),
    },
    {
      title: 'Học phí dự kiến',
      key: 'hocPhiDuKien',
      width: 170,
      render: (_giaTri, hocSinh) => {
        const duKien = hocPhiDuKienThang(hocSinh)
        if (duKien === null) {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        return (
          <Flex vertical>
            <Typography.Text strong>{formatVnd(duKien)}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {hocSinh.cachTinhHocPhi === 'theo_buoi'
                ? `${hocSinh.soBuoiMoiTuan} buổi × ${SO_TUAN_MOI_THANG} tuần`
                : 'Mức tháng'}
            </Typography.Text>
          </Flex>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trangThai',
      width: 120,
      render: (trangThai: TrangThaiHocSinh) => (
        <Tag color={mauTrangThai(trangThai)}>{nhanTrangThai(trangThai)}</Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'thaoTac',
      width: 160,
      fixed: 'right',
      render: (_giaTri, hocSinh) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              moFormSua(hocSinh)
            }}
          >
            Sửa
          </Button>
          <Button
            size="small"
            danger
            icon={<StopOutlined />}
            disabled={hocSinh.trangThai === 'da_nghi'}
            onClick={() => {
              hoiChoNghi(hocSinh)
            }}
          >
            Cho nghỉ
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Học sinh"
        description="Quản lý danh sách học sinh và lịch học."
      />
      <Flex vertical gap={16}>
        <Card
          size="small"
          title="Danh sách học sinh"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                moFormThem()
              }}
            >
              Thêm học sinh
            </Button>
          }
        >
          <Flex vertical gap={12}>
            <Space wrap>
              <Input.Search
                value={oNhapTuKhoa}
                placeholder="Tìm theo tên học sinh"
                allowClear
                style={{ width: 240 }}
                onChange={(suKien) => {
                  datONhapTuKhoa(suKien.target.value)
                }}
                onSearch={(giaTri) => {
                  datONhapTuKhoa(giaTri)
                  datTuKhoa(giaTri.trim())
                  datTrang(1)
                }}
              />
              <Select<TrangThaiHocSinh>
                allowClear
                placeholder="Tất cả trạng thái"
                style={{ width: 170 }}
                value={trangThaiLoc}
                options={TRANG_THAI_HOC_SINH.map((trangThai) => ({
                  value: trangThai.value,
                  label: trangThai.label,
                }))}
                onChange={(giaTri) => {
                  datTrangThaiLoc(giaTri)
                  datTrang(1)
                }}
              />
              {laAdmin ? (
                <Select<string>
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tất cả giáo viên"
                  style={{ width: 200 }}
                  value={giaoVienLoc}
                  loading={danhSachGiaoVien.isPending}
                  notFoundContent="Chưa đọc được danh sách giáo viên"
                  options={giaoVien.map((giaoVienItem) => ({
                    value: giaoVienItem.id,
                    label: giaoVienItem.hoTen,
                  }))}
                  onChange={(giaTri) => {
                    datGiaoVienLoc(giaTri)
                    datTrang(1)
                  }}
                />
              ) : null}
              {coBoLoc ? (
                <Button onClick={xoaBoLoc}>
                  Xoá bộ lọc
                </Button>
              ) : null}
            </Space>

            {loiThaoTac ? (
              <LoiApiAlert error={loiThaoTac} tieuDe="Không thực hiện được thao tác" />
            ) : null}

            {danhSach.isError ? (
              <LoiApiAlert
                error={danhSach.error}
                tieuDe="Không đọc được danh sách học sinh"
                onThuLai={() => {
                  void danhSach.refetch()
                }}
              />
            ) : danhSach.isPending ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <Table<HocSinh>
                rowKey="id"
                size="small"
                columns={cot}
                dataSource={danhSach.data.duLieu}
                loading={danhSach.isFetching}
                scroll={{ x: 'max-content' }}
                locale={{
                  emptyText: (
                    <Flex vertical gap={4} style={{ padding: 24, textAlign: 'center' }}>
                      <Typography.Text>Chưa có học sinh nào</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {coBoLoc
                          ? 'Thử xoá bộ lọc để xem toàn bộ danh sách.'
                          : 'Bấm "Thêm học sinh" để tạo hồ sơ đầu tiên.'}
                      </Typography.Text>
                    </Flex>
                  ),
                }}
                pagination={{
                  current: trang,
                  pageSize: kichThuoc,
                  total: danhSach.data.tongSo,
                  showSizeChanger: true,
                  pageSizeOptions: [10, 20, 50],
                  showTotal: (tongSo) => `${tongSo} học sinh`,
                }}
                onChange={(phanTrang) => {
                  datTrang(phanTrang.current ?? 1)
                  datKichThuoc(phanTrang.pageSize ?? KICH_THUOC_MAC_DINH)
                }}
              />
            )}
          </Flex>
        </Card>
      </Flex>

      <FormHocSinh
        open={dangMoForm}
        hocSinh={hocSinhDangSua}
        laAdmin={laAdmin}
        danhSachGiaoVien={giaoVien}
        giaoVienMacDinhId={nguoiDung?.id}
        onDong={dongForm}
      />
    </>
  )
}
