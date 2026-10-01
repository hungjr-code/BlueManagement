import { Card, Empty, Flex, Skeleton, Table, Typography } from 'antd'
import type { TableProps } from 'antd'
import { useTongHopTheoGiaoVien } from '../../api/tuition'
import type { TongHopTheoGiaoVien } from '../../api/tuition'
import { formatVnd } from '../../lib/money'
import { moTaKy } from './hienThi'
import { LoiApiAlert } from './LoiApiAlert'

interface TongHopCardProps {
  thang: number
  nam: number
}

const cot: TableProps<TongHopTheoGiaoVien>['columns'] = [
  {
    title: 'Giáo viên',
    dataIndex: 'tenGiaoVien',
    render: (ten: string) => <Typography.Text strong>{ten}</Typography.Text>,
  },
  { title: 'Số học sinh', dataIndex: 'soHocSinh', width: 110 },
  {
    title: 'Phải thu',
    dataIndex: 'phaiThu',
    width: 140,
    align: 'right',
    render: (soTien: number) => formatVnd(soTien),
  },
  {
    title: 'Đã thu',
    dataIndex: 'daThu',
    width: 140,
    align: 'right',
    render: (soTien: number) => formatVnd(soTien),
  },
  {
    title: 'Còn lại',
    dataIndex: 'conLai',
    width: 140,
    align: 'right',
    render: (soTien: number) => (
      <Typography.Text type={soTien > 0 ? 'danger' : undefined}>{formatVnd(soTien)}</Typography.Text>
    ),
  },
]

/**
 * Doanh thu theo giáo viên trong kỳ — chỉ admin thấy toàn trung tâm.
 *
 * Giáo viên gọi endpoint này chỉ nhận đúng dòng của mình, nên khối này chỉ hiện với admin cho khỏi
 * trùng với con số đã có trên bảng sổ học phí.
 */
export function TongHopCard({ thang, nam }: TongHopCardProps) {
  const tongHop = useTongHopTheoGiaoVien({ thang, nam }, true)

  const duLieu = tongHop.data ?? []
  const tongPhaiThu = duLieu.reduce((tong, dong) => tong + dong.phaiThu, 0)
  const tongDaThu = duLieu.reduce((tong, dong) => tong + dong.daThu, 0)
  const tongConLai = duLieu.reduce((tong, dong) => tong + dong.conLai, 0)

  return (
    <Card
      size="small"
      title={`Tổng hợp theo giáo viên — ${moTaKy(thang, nam)}`}
      extra={
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Chỉ admin
        </Typography.Text>
      }
    >
      <Flex vertical gap={12}>
        {tongHop.isError ? (
          <LoiApiAlert
            error={tongHop.error}
            tieuDe="Không đọc được tổng hợp theo giáo viên"
            onThuLai={() => {
              void tongHop.refetch()
            }}
          />
        ) : tongHop.isPending ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <Table<TongHopTheoGiaoVien>
            size="small"
            rowKey="giaoVienId"
            columns={cot}
            dataSource={duLieu}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Kỳ này chưa có dòng học phí nào — bấm “Tính học phí kỳ này” ở khối trên"
                />
              ),
            }}
            summary={() =>
              duLieu.length > 0 ? (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <Typography.Text strong>Tổng cộng</Typography.Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Typography.Text strong>
                      {duLieu.reduce((tong, dong) => tong + dong.soHocSinh, 0)}
                    </Typography.Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <Typography.Text strong>{formatVnd(tongPhaiThu)}</Typography.Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <Typography.Text strong>{formatVnd(tongDaThu)}</Typography.Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Typography.Text strong type={tongConLai > 0 ? 'danger' : undefined}>
                      {formatVnd(tongConLai)}
                    </Typography.Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              ) : null
            }
          />
        )}
      </Flex>
    </Card>
  )
}
