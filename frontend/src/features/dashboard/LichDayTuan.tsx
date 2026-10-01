import { Button, Card, Empty, Flex, Space, Table, Tag, Typography } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { BuoiHoc, TuanNay } from '../../api/types'
import { laHomNay, ngayNgan, tenThu, thuCua } from '../../config/lichTuan'
import { taoCotBuoiHoc } from './cotBuoiHoc'

interface NhomNgay {
  ngay: string
  buoi: BuoiHoc[]
}

/** Buổi học xếp theo ngày rồi theo giờ — đúng thứ tự người dạy đọc lịch. */
function nhomTheoNgay(duLieu: BuoiHoc[]): NhomNgay[] {
  const sapXep = [...duLieu].sort(
    (a, b) =>
      a.ngay.localeCompare(b.ngay) ||
      a.gioBatDau.localeCompare(b.gioBatDau) ||
      a.tenHocSinh.localeCompare(b.tenHocSinh),
  )

  const nhom = new Map<string, BuoiHoc[]>()
  for (const buoi of sapXep) {
    const daCo = nhom.get(buoi.ngay)
    if (daCo) {
      daCo.push(buoi)
    } else {
      nhom.set(buoi.ngay, [buoi])
    }
  }

  return [...nhom].map(([ngay, buoi]) => ({ ngay, buoi }))
}

interface LichDayTuanProps {
  tuan: TuanNay
  /** Tên giáo viên đang lọc (chỉ admin), để câu chữ khỏi nói sai khi bảng đang bị lọc. */
  tenGiaoVienLoc?: string | null
}

/**
 * Lịch dạy của tuần hiện tại, nhóm theo từng ngày. Dữ liệu từ `GET /api/dashboard/tuan-nay`:
 * số buổi ở đây là buổi thật backend sinh ra từ lịch học hằng tuần của học sinh.
 */
export function LichDayTuan({ tuan, tenGiaoVienLoc }: LichDayTuanProps) {
  const dieuHuong = useNavigate()
  const cot = taoCotBuoiHoc()
  const nhom = nhomTheoNgay(tuan.duLieu)

  return (
    <Card
      size="small"
      title={`Lịch dạy tuần này (${dayjs(tuan.tuNgay).format('DD/MM')} – ${dayjs(tuan.denNgay).format('DD/MM/YYYY')})`}
      extra={
        <Space wrap>
          <Typography.Text type="secondary">
            {tuan.soBuoi} buổi · {tuan.soChuaDiemDanh} chưa điểm danh
          </Typography.Text>
          <Button
            size="small"
            onClick={() => {
              dieuHuong('/schedule')
            }}
          >
            Mở lịch tuần
          </Button>
        </Space>
      }
    >
      {nhom.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            tenGiaoVienLoc
              ? `Tuần này ${tenGiaoVienLoc} không có buổi học nào`
              : 'Tuần này không có buổi học nào'
          }
        />
      ) : (
        <Flex vertical gap={20}>
          {nhom.map((dong) => (
            <div key={dong.ngay}>
              <Space wrap style={{ marginBottom: 8 }}>
                <CalendarOutlined />
                <Typography.Text strong>
                  {tenThu(thuCua(dong.ngay))}, {ngayNgan(dong.ngay)}
                </Typography.Text>
                {laHomNay(dong.ngay) ? <Tag color="blue">Hôm nay</Tag> : null}
                <Tag>{dong.buoi.length} buổi</Tag>
              </Space>
              <Table<BuoiHoc>
                size="small"
                rowKey="id"
                columns={cot}
                dataSource={dong.buoi}
                pagination={false}
                scroll={{ x: 900 }}
              />
            </div>
          ))}
        </Flex>
      )}

      <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
        Buổi học do backend sinh ra từ lịch học lặp hằng tuần của học sinh. Chưa điểm danh KHÁC với
        nghỉ: buổi bỏ trống chưa sinh ra tiền và vẫn phải xử lý trước khi chốt sổ tháng.
      </Typography.Paragraph>
    </Card>
  )
}
