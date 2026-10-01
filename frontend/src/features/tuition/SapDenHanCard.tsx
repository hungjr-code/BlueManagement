import { useState } from 'react'
import { Alert, Button, Card, Empty, Flex, Skeleton, Space, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import { useSapDenHan } from '../../api/tuition'
import type { HocPhi } from '../../api/tuition'
import { ngayNgan } from '../../config/lichTuan'
import { formatVnd } from '../../lib/money'
import { mauTrangThaiThanhToan, moTaHanDong, moTaKy, nhanTrangThaiThanhToan } from './hienThi'
import { LoiApiAlert } from './LoiApiAlert'

interface SapDenHanCardProps {
  /** Bấm vào một dòng thì mở ngăn kéo chi tiết của dòng đó. */
  onMoDong: (dong: HocPhi) => void
}

interface DongCanhBao {
  dong: HocPhi
  quaHan: boolean
}

const SO_NGAY: ReadonlyArray<{ value: number; label: string }> = [
  { value: 3, label: 'Trong 3 ngày tới' },
  { value: 7, label: 'Trong 7 ngày tới' },
  { value: 14, label: 'Trong 14 ngày tới' },
  { value: 30, label: 'Trong 30 ngày tới' },
]

/**
 * Khối "ai sắp đến hạn đóng tiền / ai đã quá hạn mà chưa thu đủ".
 *
 * Hai nhóm này không phụ thuộc kỳ đang chọn vì công nợ là chuyện của mọi kỳ: học sinh nợ tháng 8 vẫn
 * phải hiện khi đang xem tháng 9. Quá hạn xếp trước vì đó là việc phải làm ngay.
 */
export function SapDenHanCard({ onMoDong }: SapDenHanCardProps) {
  const [soNgay, datSoNgay] = useState(7)
  const sapDenHan = useSapDenHan(soNgay)

  const duLieu = sapDenHan.data
  const quaHan = duLieu?.quaHan ?? []
  const sapToi = duLieu?.sapDenHan ?? []

  const dongCanhBao: DongCanhBao[] = [
    ...quaHan.map((dong) => ({ dong, quaHan: true })),
    ...sapToi.map((dong) => ({ dong, quaHan: false })),
  ]

  const cot: TableProps<DongCanhBao>['columns'] = [
    {
      title: 'Học sinh',
      key: 'hocSinh',
      width: 220,
      render: (_giaTri, muc) => (
        <Flex vertical>
          <Typography.Text strong>{muc.dong.tenHocSinh}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            GV {muc.dong.tenGiaoVien}
          </Typography.Text>
        </Flex>
      ),
    },
    { title: 'Kỳ', key: 'ky', width: 120, render: (_giaTri, muc) => moTaKy(muc.dong.thang, muc.dong.nam) },
    {
      title: 'Hạn đóng',
      key: 'hanDong',
      width: 130,
      render: (_giaTri, muc) => ngayNgan(muc.dong.hanDongTien),
    },
    {
      title: 'Tình trạng',
      key: 'tinhTrang',
      width: 170,
      render: (_giaTri, muc) =>
        muc.quaHan ? (
          <Tag color="red">{moTaHanDong(muc.dong.hanDongTien)}</Tag>
        ) : (
          <Tag color="gold">{moTaHanDong(muc.dong.hanDongTien)}</Tag>
        ),
    },
    {
      title: 'Còn lại',
      key: 'conLai',
      width: 130,
      align: 'right',
      render: (_giaTri, muc) => (
        <Typography.Text type={muc.quaHan ? 'danger' : undefined} strong>
          {formatVnd(muc.dong.conLai)}
        </Typography.Text>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'trangThai',
      width: 130,
      render: (_giaTri, muc) => (
        <Tag color={mauTrangThaiThanhToan(muc.dong.trangThaiThanhToan)}>
          {nhanTrangThaiThanhToan(muc.dong.trangThaiThanhToan)}
        </Tag>
      ),
    },
  ]

  return (
    <Card
      size="small"
      title="Sắp đến hạn / quá hạn"
      extra={
        <Space wrap>
          <Tag color="gold">{sapToi.length} sắp đến hạn</Tag>
          <Tag color={quaHan.length > 0 ? 'red' : 'default'}>{quaHan.length} quá hạn</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Tổng còn lại của các dòng còn nợ: {formatVnd(duLieu?.tongConLai ?? 0)}
          </Typography.Text>
        </Space>
      }
    >
      <Flex vertical gap={12}>
        <Space wrap>
          {SO_NGAY.map((muc) => (
            <Button
              key={muc.value}
              size="small"
              type={soNgay === muc.value ? 'primary' : 'default'}
              onClick={() => {
                datSoNgay(muc.value)
              }}
            >
              {muc.label}
            </Button>
          ))}
        </Space>

        {sapDenHan.isError ? (
          <LoiApiAlert
            error={sapDenHan.error}
            tieuDe="Không đọc được danh sách đến hạn"
            onThuLai={() => {
              void sapDenHan.refetch()
            }}
          />
        ) : sapDenHan.isPending ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <Flex vertical gap={12}>
            {quaHan.length > 0 ? (
              <Alert
                type="error"
                showIcon
                message={`${quaHan.length} dòng đã QUÁ HẠN mà chưa thu đủ`}
                description={`Tổng còn lại của các dòng còn nợ (mọi kỳ): ${formatVnd(
                  duLieu?.tongConLai ?? 0,
                )}. Nhắc phụ huynh trước khi dạy thêm buổi mới.`}
              />
            ) : null}

            {quaHan.length === 0 && sapToi.length > 0 ? (
              <Alert
                type="warning"
                showIcon
                message={`${sapToi.length} dòng sắp đến hạn trong ${soNgay} ngày tới`}
                description={`Tổng còn lại của các dòng còn nợ (mọi kỳ): ${formatVnd(duLieu?.tongConLai ?? 0)}.`}
              />
            ) : null}

            {dongCanhBao.length === 0 ? (
              <Alert
                type="success"
                showIcon
                message={`Không có ai quá hạn hay đến hạn trong ${soNgay} ngày tới`}
                description="Mọi dòng học phí đã thu đủ, hoặc chưa tới hạn đóng."
              />
            ) : (
              <Table<DongCanhBao>
                size="small"
                rowKey={(muc) => muc.dong.id}
                columns={cot}
                dataSource={dongCanhBao}
                pagination={{ pageSize: 5, hideOnSinglePage: true, size: 'small' }}
                scroll={{ x: 'max-content' }}
                onRow={(muc) => ({
                  onClick: () => {
                    onMoDong(muc.dong)
                  },
                  style: { cursor: 'pointer' },
                })}
                locale={{
                  emptyText: (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có dòng nào cần nhắc" />
                  ),
                }}
              />
            )}

            {dongCanhBao.length > 0 ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Bấm vào một dòng để xem chi tiết và thu tiền. Số ngày còn lại tính theo ngày đóng tiền đã
                khai của học sinh, không phải ngày phát sinh buổi học.
              </Typography.Text>
            ) : null}
          </Flex>
        )}
      </Flex>
    </Card>
  )
}
