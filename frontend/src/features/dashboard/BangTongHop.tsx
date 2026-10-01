import { Card, Empty, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import type { TongHopDiemDanh } from '../../api/types'

const cot: TableProps<TongHopDiemDanh>['columns'] = [
  { title: 'Tên', dataIndex: 'ten', key: 'ten', width: 200 },
  { title: 'Số buổi', dataIndex: 'soBuoi', key: 'soBuoi', width: 90, align: 'right' },
  { title: 'Đi học', dataIndex: 'soDiHoc', key: 'soDiHoc', width: 80, align: 'right' },
  {
    title: 'Nghỉ có phép',
    dataIndex: 'soNghiCoPhep',
    key: 'soNghiCoPhep',
    width: 110,
    align: 'right',
  },
  {
    title: 'Nghỉ không phép',
    dataIndex: 'soNghiKhongPhep',
    key: 'soNghiKhongPhep',
    width: 120,
    align: 'right',
  },
  {
    title: 'Chưa điểm danh',
    dataIndex: 'soChuaDiemDanh',
    key: 'soChuaDiemDanh',
    width: 130,
    align: 'right',
    render: (soChuaDiemDanh: number) =>
      soChuaDiemDanh > 0 ? <Tag color="warning">{soChuaDiemDanh}</Tag> : soChuaDiemDanh,
  },
]

interface BangTongHopProps {
  tieuDe: string
  duLieu: TongHopDiemDanh[]
  ghiChu: string
}

/**
 * Bảng tổng hợp điểm danh cuối tuần. Số liệu do backend đếm từ bảng điểm danh
 * (`tongHopTheoHocSinh` / `tongHopTheoGiaoVien`) — không có số nào nhập tay ở đây.
 */
export function BangTongHop({ tieuDe, duLieu, ghiChu }: BangTongHopProps) {
  return (
    <Card
      size="small"
      title={tieuDe}
      extra={<Tag>{duLieu.length} dòng</Tag>}
      style={{ height: '100%' }}
    >
      {duLieu.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tuần này chưa có buổi học nào" />
      ) : (
        <Table<TongHopDiemDanh>
          size="small"
          rowKey="id"
          columns={cot}
          dataSource={duLieu}
          pagination={false}
          scroll={{ x: 830 }}
        />
      )}
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
        {ghiChu}
      </Typography.Paragraph>
    </Card>
  )
}
