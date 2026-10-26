import { useMemo, useState } from 'react'
import { Alert, Badge, Button, Empty, Flex, Segmented, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useLichHocCuaHocSinh } from '../../api/hocSinhPortal'
import type { BuoiHocCuaHocSinh } from '../../api/hocSinhPortal'

type KhoangXem = 'sap-toi' | 'da-qua'

const nhanTrangThai: Record<
  BuoiHocCuaHocSinh['trangThai'],
  { nhan: string; mau: 'default' | 'success' | 'error' }
> = {
  chua_diem_danh: { nhan: 'Chưa điểm danh', mau: 'default' },
  di_hoc: { nhan: 'Đã đi học', mau: 'success' },
  nghi: { nhan: 'Nghỉ', mau: 'error' },
}

/**
 * "Lịch học của em": các buổi sắp tới và tình trạng đi học của chính em.
 *
 * Học sinh chỉ thấy ba thứ của mình: giờ học, đã đi học hay nghỉ, và buổi đó có bài tập hay chưa —
 * không thấy học phí, không thấy học sinh khác.
 */
export function HocSinhLichHocPage() {
  const [khoang, datKhoang] = useState<KhoangXem>('sap-toi')

  const [tuNgay, denNgay] = useMemo(() => {
    const homNay = dayjs()
    if (khoang === 'sap-toi') {
      return [homNay.format('YYYY-MM-DD'), homNay.add(60, 'day').format('YYYY-MM-DD')] as const
    }
    return [homNay.subtract(45, 'day').format('YYYY-MM-DD'), homNay.format('YYYY-MM-DD')] as const
  }, [khoang])

  const lichHoc = useLichHocCuaHocSinh(tuNgay, denNgay)
  const duLieu = lichHoc.data ?? []

  const cot: ColumnsType<BuoiHocCuaHocSinh> = [
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      width: 150,
      render: (giaTri: string) => (
        <Flex vertical gap={2}>
          <Typography.Text strong>
            {dayjs(giaTri).format('dddd')}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(giaTri).format('DD/MM/YYYY')}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: 'Giờ học',
      key: 'gio',
      width: 140,
      render: (_giaTri, dong) => `${dong.gioBatDau.slice(0, 5)} – ${dong.gioKetThuc.slice(0, 5)}`,
    },
    {
      title: 'Tình trạng',
      key: 'trangThai',
      width: 190,
      render: (_giaTri, dong) => (
        <Space size={6} wrap>
          <Tag color={nhanTrangThai[dong.trangThai].mau}>{nhanTrangThai[dong.trangThai].nhan}</Tag>
          {dong.trangThai === 'nghi' && dong.lyDoNghi ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {dong.lyDoNghi === 'co_phep' ? 'có phép' : 'không phép'}
            </Typography.Text>
          ) : null}
          {dong.laBuoiDayBu ? <Tag color="purple">Dạy bù</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Bài tập',
      dataIndex: 'soTaiLieu',
      width: 120,
      render: (so: number) =>
        so > 0 ? <Badge count={so} color="geekblue" overflowCount={9} /> : <span>—</span>,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghiChuDiemDanh',
      render: (giaTri: string | null) => giaTri ?? '—',
    },
  ]

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center" wrap gap={12}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Lịch học của em
          </Typography.Title>
          <Typography.Text type="secondary">
            Giáo viên: {duLieu[0]?.tenGiaoVien ?? '—'}
          </Typography.Text>
        </div>

        <Space>
          <Segmented<KhoangXem>
            value={khoang}
            onChange={(giaTri) => {
              datKhoang(giaTri)
            }}
            options={[
              { label: 'Sắp tới', value: 'sap-toi' },
              { label: 'Đã học gần đây', value: 'da-qua' },
            ]}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={lichHoc.isFetching}
            onClick={() => {
              void lichHoc.refetch()
            }}
          >
            Tải lại
          </Button>
        </Space>
      </Flex>

      {lichHoc.isError ? (
        <Alert type="error" showIcon message="Không đọc được lịch học" description={lichHoc.error?.message} />
      ) : null}

      <Table<BuoiHocCuaHocSinh>
        rowKey="id"
        size="middle"
        loading={lichHoc.isPending}
        columns={cot}
        dataSource={duLieu}
        pagination={false}
        locale={{
          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có buổi học nào" />,
        }}
      />
    </Flex>
  )
}
