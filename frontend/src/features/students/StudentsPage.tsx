import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
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
import { LoiApiAlert } from './LoiApiAlert'
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
 * Danh sách học sinh dùng API thật của backend.
 *
 * Phân trang làm ở phía server (`trang`/`kichThuoc`, tổng số ở `tongSo`) vì số học sinh của cả trung
 * tâm có thể lớn. Giáo viên chỉ nhận được học sinh của mình — việc chặn quyền nằm ở backend, ở đây
 * chỉ ẩn bớt nút cho gọn mắt.
 */
export function StudentsPage() {
  const { message, modal } = App.useApp()
  const { nguoiDung } = usePhien()
  const laAdmin = nguoiDung?.vaiTro === 'admin'

  const [oNhapTuKhoa, datONhapTuKhoa] = useState('')
  // Từ khoá đã chốt để gọi API: chỉ đổi khi bấm Enter hoặc xoá ô tìm, không gọi API theo từng ký tự.
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
  // Hook không gọi có điều kiện; với giáo viên backend chỉ trả về chính họ nên Select không dùng tới.
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

  /**
   * Cho nghỉ = đổi trạng thái ở backend, KHÔNG xoá hồ sơ: điểm danh và học phí đã ghi vẫn tra cứu
   * được về sau. Nói rõ điều đó trước khi người dùng bấm.
   */
  const hoiChoNghi = (hocSinh: HocSinh) => {
    modal.confirm({
      title: `Cho ${hocSinh.hoTen} nghỉ học?`,
      content: (
        <Flex vertical gap={8}>
          <Typography.Text>Hồ sơ học sinh KHÔNG bị xoá. Hệ thống chỉ:</Typography.Text>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              Chuyển trạng thái sang <Tag>Đã nghỉ</Tag>
            </li>
            <li>Bỏ các buổi chưa dạy từ hôm nay trở đi, để không sinh buổi mới nữa</li>
          </ul>
          <Typography.Text type="secondary">
            Điểm danh và học phí đã ghi giữ nguyên, sau này cần tra cứu vẫn xem được.
          </Typography.Text>
        </Flex>
      ),
      okText: 'Cho nghỉ',
      okButtonProps: { danger: true },
      cancelText: 'Để sau',
      onOk: async () => {
        datLoiThaoTac(null)
        try {
          await choNghi.mutateAsync(hocSinh.id)
          message.success(`Đã cho ${hocSinh.hoTen} nghỉ học`)
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
      width: 130,
      render: (lop: string | null) => lop ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Giáo viên phụ trách',
      dataIndex: 'tenGiaoVien',
      width: 160,
    },
    {
      title: 'Cách tính học phí',
      key: 'cachTinhHocPhi',
      width: 190,
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
      title: 'Số buổi/tuần',
      dataIndex: 'soBuoiMoiTuan',
      width: 110,
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
      width: 150,
      render: (ngay: number) => moTaHanDong(ngay),
    },
    {
      title: 'Học phí dự kiến/tháng',
      key: 'hocPhiDuKien',
      width: 200,
      render: (_giaTri, hocSinh) => {
        const duKien = hocPhiDuKienThang(hocSinh)
        if (duKien === null) {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        return (
          <Flex vertical>
            <Typography.Text strong>{formatVnd(duKien)}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {hocSinh.cachTinhHocPhi === 'theo_buoi'
                ? `${hocSinh.soBuoiMoiTuan} buổi × ${SO_TUAN_MOI_THANG} tuần · dự kiến`
                : 'mức tháng đã khai · dự kiến'}
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
      width: 180,
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
        description="Nhập tên học sinh, giáo viên phụ trách, cách tính học phí và số buổi học mỗi tuần; kèm danh sách, bộ lọc và cho nghỉ."
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
                style={{ width: 260 }}
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
                placeholder="Trạng thái: tất cả"
                style={{ width: 180 }}
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
                  placeholder="Giáo viên: tất cả"
                  style={{ width: 220 }}
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
              <Button disabled={!coBoLoc} onClick={xoaBoLoc}>
                Xoá bộ lọc
              </Button>
            </Space>

            {laAdmin && danhSachGiaoVien.isError ? (
              <Alert
                type="warning"
                showIcon
                message="Không đọc được danh sách giáo viên"
                description="Bộ lọc theo giáo viên tạm thời để trống; danh sách học sinh vẫn xem bình thường."
              />
            ) : null}

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
                    <Flex vertical gap={4} style={{ padding: 24 }}>
                      <Typography.Text>Chưa có học sinh nào khớp bộ lọc</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {coBoLoc
                          ? 'Thử xoá bộ lọc để xem toàn bộ danh sách.'
                          : 'Bấm "Thêm học sinh" để nhập em đầu tiên.'}
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

        <Card size="small" title="Học phí dự kiến tính thế nào">
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Theo buổi">
              <Typography.Text code>
                số buổi mỗi tuần × {SO_TUAN_MOI_THANG} tuần × đơn giá theo buổi
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Theo tháng">
              <Typography.Text code>học phí theo tháng, không phụ thuộc số buổi</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Vì sao ghi “dự kiến”">
              Cột Học phí dự kiến/tháng là con số ước lượng để nhìn nhanh, chưa trừ buổi nghỉ — buổi nghỉ
              chỉ trừ được khi đã điểm danh. Công nợ thật và phiếu thu nằm ở trang Học phí.
            </Descriptions.Item>
            <Descriptions.Item label="Khi nghỉ">
              Buổi nghỉ không tính tiền nếu là nghỉ theo cách tính "theo buổi". Với "theo tháng" thì giữ
              nguyên mức tháng, chỉ ghi nhận để biết số buổi thực dạy.
            </Descriptions.Item>
            <Descriptions.Item label="Đến hạn đóng tiền">
              Ngày đến hạn dùng để nhắc: học sinh vào danh sách "sắp đến hạn" trước hạn 3 ngày và bị tô
              đỏ khi quá hạn. <Tag color="blue">nuôi trang Học phí</Tag>
            </Descriptions.Item>
          </Descriptions>
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
