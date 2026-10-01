import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
import { DeleteOutlined, DollarOutlined, QrcodeOutlined } from '@ant-design/icons'
import { useChiTietHocPhi } from '../../api/tuition'
import type { BuoiTrongKy, HocPhi, PhieuThu } from '../../api/tuition'
import { useCaiDat } from '../../api/settings'
import { usePhien } from '../../app/session'
import { PaymentQrModal } from '../../components/PaymentQrModal'
import { ngayNgan, tenThuNgan, thuCua } from '../../config/lichTuan'
import { formatVnd } from '../../lib/money'
import {
  mauCachTinh,
  mauTrangThaiBuoi,
  mauTrangThaiThanhToan,
  moTaKy,
  nhanCachTinh,
  nhanHinhThuc,
  nhanTrangThaiBuoi,
  nhanTrangThaiThanhToan,
  tenKyHocPhi,
} from './hienThi'
import { LoiApiAlert } from './LoiApiAlert'
import { HuyPhieuThuModal } from './HuyPhieuThuModal'
import { ThuTienModal } from './ThuTienModal'

interface ChiTietDrawerProps {
  /** Dòng học phí đang xem (lấy ngay từ bảng cho khỏi chờ). null = đóng ngăn kéo. */
  hocPhi: HocPhi | null
  onClose: () => void
}

/** Diễn giải công thức thành tiền của dòng này bằng chữ, để đối chiếu được với số buổi bên dưới. */
function moTaCongThuc(dong: HocPhi): string {
  if (dong.cachTinhHocPhi === 'theo_thang') {
    return `${formatVnd(dong.donGiaApDung)} / tháng (thu đủ tháng, không phụ thuộc số buổi)`
  }
  return `${formatVnd(dong.donGiaApDung)} / buổi × (${dong.soBuoiDiHoc} đi học${
    dong.soBuoiNghiKhongPhep > 0 ? ` + ${dong.soBuoiNghiKhongPhep} nghỉ không phép` : ''
  })`
}

/**
 * Ngăn kéo chi tiết một dòng học phí.
 *
 * Đây là chỗ trả lời câu "vì sao ra con số này": liệt kê từng buổi trong kỳ (kèm buổi dạy bù) và
 * từng phiếu thu đã ghi — học phí tính từ điểm danh nên phải mở ra xem được, không tin vào một con số
 * tổng. Mọi thay đổi tiền đều làm ở đây: thu tiền, huỷ phiếu thu, và xem mã QR.
 */
export function ChiTietDrawer({ hocPhi, onClose }: ChiTietDrawerProps) {
  const { nguoiDung } = usePhien()
  const caiDat = useCaiDat()
  const chiTiet = useChiTietHocPhi(hocPhi?.id ?? null)

  const [moThuTien, datMoThuTien] = useState(false)
  const [moQr, datMoQr] = useState(false)
  const [phieuThuDangHuy, datPhieuThuDangHuy] = useState<PhieuThu | null>(null)

  // Bản mới nhất từ API ưu tiên hơn dòng trên bảng: sau khi thu tiền, số đã thu phải đổi ngay.
  const dong = chiTiet.data?.hocPhi ?? hocPhi
  const danhSachBuoi = chiTiet.data?.danhSachBuoi ?? []
  const danhSachPhieuThu = chiTiet.data?.danhSachPhieuThu ?? []
  const tongPhieuThu = danhSachPhieuThu.reduce((tong, phieu) => tong + phieu.soTien, 0)

  // Tài khoản nhận tiền là của TỪNG giáo viên và chỉ người sở hữu đọc được (GET /auth/me), nên mã QR
  // chỉ sinh được cho học sinh của chính mình — kể cả admin cũng không sinh hộ người khác.
  const laCuaToi = dong !== null && dong.giaoVienId === nguoiDung?.id

  const cotBuoi: TableProps<BuoiTrongKy>['columns'] = [
    {
      title: 'Ngày',
      key: 'ngay',
      width: 160,
      render: (_giaTri, buoi) => `${tenThuNgan(thuCua(buoi.ngay))} ${ngayNgan(buoi.ngay)}`,
    },
    // Backend đã ghép sẵn chuỗi giờ dạng "18:00 – 19:30", không cần cắt lại ở đây.
    { title: 'Giờ', dataIndex: 'gio', width: 130 },
    {
      title: 'Điểm danh',
      key: 'trangThai',
      width: 160,
      render: (_giaTri, buoi) => (
        <Space size={4} wrap>
          <Tag color={mauTrangThaiBuoi(buoi)}>{nhanTrangThaiBuoi(buoi)}</Tag>
          {buoi.laBuoiDayBu ? <Tag color="cyan">Dạy bù</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghiChu',
      render: (ghiChu: string | null) => ghiChu ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
  ]

  const cotPhieuThu: TableProps<PhieuThu>['columns'] = [
    { title: 'Ngày thu', dataIndex: 'ngayThu', width: 110, render: (ngay: string) => ngayNgan(ngay) },
    {
      title: 'Số tiền',
      dataIndex: 'soTien',
      width: 120,
      align: 'right',
      render: (soTien: number) => formatVnd(soTien),
    },
    { title: 'Hình thức', dataIndex: 'hinhThuc', width: 120, render: nhanHinhThuc },
    {
      title: 'Mã giao dịch',
      dataIndex: 'maGiaoDichNganHang',
      width: 150,
      render: (ma: string | null) =>
        ma ? <Typography.Text code>{ma}</Typography.Text> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Người thu',
      dataIndex: 'tenNguoiThu',
      width: 130,
      render: (ten: string | null) => ten ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghiChu',
      render: (ghiChu: string | null) => ghiChu ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Thao tác',
      key: 'thaoTac',
      width: 130,
      fixed: 'right',
      render: (_giaTri, phieu) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            datPhieuThuDangHuy(phieu)
          }}
        >
          Huỷ phiếu
        </Button>
      ),
    },
  ]

  const dongHet = () => {
    datMoThuTien(false)
    datMoQr(false)
    datPhieuThuDangHuy(null)
    onClose()
  }

  return (
    <Drawer
      open={hocPhi !== null}
      onClose={dongHet}
      width={860}
      title={dong ? `Học phí — ${dong.tenHocSinh} · ${moTaKy(dong.thang, dong.nam)}` : 'Chi tiết học phí'}
      extra={
        dong ? (
          <Space>
            <Button
              type="primary"
              icon={<DollarOutlined />}
              disabled={dong.conLai <= 0}
              onClick={() => {
                datMoThuTien(true)
              }}
            >
              Thu tiền
            </Button>
            {laCuaToi ? (
              <Button
                icon={<QrcodeOutlined />}
                disabled={dong.conLai <= 0}
                onClick={() => {
                  datMoQr(true)
                }}
              >
                Mã QR
              </Button>
            ) : (
              <Tooltip title="Mã QR dùng tài khoản nhận tiền của giáo viên dạy học sinh này; chỉ giáo viên đó sinh được mã, admin cũng không sinh hộ.">
                <Button icon={<QrcodeOutlined />} disabled>
                  Mã QR
                </Button>
              </Tooltip>
            )}
          </Space>
        ) : null
      }
    >
      {chiTiet.isError ? (
        <LoiApiAlert
          error={chiTiet.error}
          tieuDe="Không đọc được chi tiết dòng học phí"
          onThuLai={() => {
            void chiTiet.refetch()
          }}
        />
      ) : !dong || chiTiet.isPending ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Flex vertical gap={16}>
          {dong.soBuoiChuaDiemDanh > 0 ? (
            <Alert
              type="warning"
              showIcon
              message={`Còn ${dong.soBuoiChuaDiemDanh} buổi trong kỳ chưa điểm danh`}
              description="Thành tiền chỉ tính những buổi đã điểm danh, nên con số dưới đây có thể còn thay đổi. Điểm danh nốt ở màn hình Điểm danh rồi bấm “Tính học phí kỳ này” để cập nhật."
            />
          ) : null}

          {dong.daChotSo ? (
            <Alert
              type="success"
              showIcon
              message="Dòng này đã chốt sổ"
              description="Con số đã chốt được giữ nguyên, lần “Tính học phí kỳ này” sau sẽ bỏ qua dòng này. Muốn tính lại thì admin phải mở chốt sổ."
            />
          ) : null}

          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Học sinh">{dong.tenHocSinh}</Descriptions.Item>
            <Descriptions.Item label="Giáo viên">{dong.tenGiaoVien}</Descriptions.Item>
            <Descriptions.Item label="Kỳ">{moTaKy(dong.thang, dong.nam)}</Descriptions.Item>
            <Descriptions.Item label="Hạn đóng tiền">{ngayNgan(dong.hanDongTien)}</Descriptions.Item>
            <Descriptions.Item label="Cách tính">
              <Tag color={mauCachTinh(dong.cachTinhHocPhi)}>{nhanCachTinh(dong.cachTinhHocPhi)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Đơn giá">{formatVnd(dong.donGiaApDung)}</Descriptions.Item>
            <Descriptions.Item label="Số buổi">
              {dong.soBuoiDiHoc} đi học · {dong.soBuoiNghiCoPhep} nghỉ có phép ·{' '}
              {dong.soBuoiNghiKhongPhep} nghỉ không phép · {dong.soBuoiChuaDiemDanh} chưa điểm danh
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={mauTrangThaiThanhToan(dong.trangThaiThanhToan)}>
                {nhanTrangThaiThanhToan(dong.trangThaiThanhToan)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Thành tiền">
              <Typography.Text strong>{formatVnd(dong.thanhTien)}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                {moTaCongThuc(dong)}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Đã thu / còn lại">
              {formatVnd(dong.soTienDaThu)} /{' '}
              <Typography.Text type={dong.conLai > 0 ? 'danger' : undefined}>
                {formatVnd(dong.conLai)}
              </Typography.Text>
            </Descriptions.Item>
          </Descriptions>

          <Card
            size="small"
            title={`Các buổi trong kỳ (${danhSachBuoi.length})`}
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Buổi chưa điểm danh chưa được tính tiền
              </Typography.Text>
            }
          >
            <Table<BuoiTrongKy>
              size="small"
              rowKey="id"
              columns={cotBuoi}
              dataSource={danhSachBuoi}
              pagination={false}
              scroll={{ y: 260 }}
              locale={{
                emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Kỳ này chưa có buổi học nào" />,
              }}
            />
          </Card>

          {Math.abs(tongPhieuThu - dong.soTienDaThu) > 0.5 ? (
            <Alert
              type="warning"
              showIcon
              message="Tổng phiếu thu không khớp số đã thu của dòng"
              description={`Tổng phiếu thu ${formatVnd(tongPhieuThu)} nhưng dòng học phí ghi đã thu ${formatVnd(
                dong.soTienDaThu,
              )}. Số liệu lệch nhau, nên báo lại người quản trị trước khi thu thêm.`}
            />
          ) : null}

          <Card
            size="small"
            title={`Phiếu thu đã ghi (${danhSachPhieuThu.length})`}
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Tổng: {formatVnd(tongPhieuThu)}
              </Typography.Text>
            }
          >
            <Table<PhieuThu>
              size="small"
              rowKey="id"
              columns={cotPhieuThu}
              dataSource={danhSachPhieuThu}
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Chưa ghi phiếu thu nào cho kỳ này"
                  />
                ),
              }}
            />
          </Card>

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Số buổi và thành tiền đếm từ điểm danh, không sửa tay được: muốn đổi tiền thì sửa điểm danh
            rồi tính lại kỳ. Thu vượt số còn lại bị chặn, huỷ phiếu thu bắt buộc nêu lý do.
          </Typography.Text>
        </Flex>
      )}

      {/* Chỉ dựng hộp thoại khi thật sự mở: form khởi tạo đúng theo dòng đang thu, không cần effect. */}
      {moThuTien && dong ? (
        <ThuTienModal
          hocPhi={dong}
          onClose={() => {
            datMoThuTien(false)
          }}
        />
      ) : null}

      {phieuThuDangHuy ? (
        <HuyPhieuThuModal
          phieuThu={phieuThuDangHuy}
          tenHocSinh={dong?.tenHocSinh ?? ''}
          onClose={() => {
            datPhieuThuDangHuy(null)
          }}
        />
      ) : null}

      {laCuaToi && dong ? (
        <PaymentQrModal
          open={moQr}
          onClose={() => {
            datMoQr(false)
          }}
          tenHocSinh={dong.tenHocSinh}
          soTien={dong.conLai}
          kyHocPhi={tenKyHocPhi(dong.thang, dong.nam)}
          taiKhoan={nguoiDung?.taiKhoanNhanTien}
          mauNoiDungChuyenKhoan={caiDat.data?.mauNoiDungChuyenKhoan}
          tenGiaoVienNhanTien={nguoiDung?.hoTen}
        />
      ) : null}
    </Drawer>
  )
}
