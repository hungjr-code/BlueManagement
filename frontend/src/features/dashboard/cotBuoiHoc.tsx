import { Space, Tag } from 'antd'
import type { TableProps } from 'antd'
import { Link } from 'react-router-dom'
import type { BuoiHoc } from '../../api/types'
import { gioNgan } from '../../config/lichTuan'
import { nhanCuaBuoi } from './nhanDiemDanh'

/**
 * Cột cho bảng buổi học, dùng chung cho khối "Hôm nay dạy ai" và bảng lịch dạy tuần này —
 * hai bảng chỉ khác nhau ở chỗ bảng tuần được nhóm theo ngày bên ngoài bảng.
 */
export function taoCotBuoiHoc(): TableProps<BuoiHoc>['columns'] {
  return [
    {
      title: 'Giờ',
      key: 'gio',
      width: 130,
      render: (_, buoi) => `${gioNgan(buoi.gioBatDau)} – ${gioNgan(buoi.gioKetThuc)}`,
    },
    {
      title: 'Học sinh',
      key: 'hocSinh',
      render: (_, buoi) => (
        <Space size={4}>
          <span>{buoi.tenHocSinh}</span>
          {buoi.laBuoiDayBu ? <Tag color="purple">Dạy bù</Tag> : null}
        </Space>
      ),
    },
    { title: 'Giáo viên', dataIndex: 'tenGiaoVien', key: 'giaoVien', width: 180 },
    {
      title: 'Trạng thái',
      key: 'trangThai',
      width: 160,
      render: (_, buoi) => {
        const nhan = nhanCuaBuoi(buoi)
        return <Tag color={nhan.mau}>{nhan.nhan}</Tag>
      },
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghiChu',
      key: 'ghiChu',
      ellipsis: true,
      render: (ghiChu: string | null) => (ghiChu ? ghiChu : '—'),
    },
    {
      title: 'Việc cần làm',
      key: 'hanhDong',
      width: 120,
      render: (_, buoi) => (
        <Link to="/attendance">
          {buoi.trangThai === 'chua_diem_danh' ? 'Điểm danh' : 'Xem lại'}
        </Link>
      ),
    },
  ]
}
