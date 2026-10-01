import { useState } from 'react'
import {
  Alert,
  Button,
  Collapse,
  Drawer,
  Empty,
  Flex,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd'
import { LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/page'
import { LuoiLich } from '../../components/lich/LuoiLich'
import { TheBuoi } from '../../components/lich/TheBuoi'
import { chuyenMoc, laHienTai, tinhKhoangXem } from '../../components/lich/khoangXem'
import type { CheDoXem } from '../../components/lich/khoangXem'
import { useBuoiHoc } from '../../api/attendance'
import { useDanhSachGiaoVien } from '../../api/teachers'
import { ApiError } from '../../api/http'
import type { BuoiHoc } from '../../api/types'
import { usePhien } from '../../app/session'
import { gioNgan, ngayNgan, tenThu, thuCua } from '../../config/lichTuan'
import { KhoiGoogleCalendar } from './KhoiGoogleCalendar'
import { nhanTrangThaiBuoi, thoiDiemDiaPhuong } from './hienThiLich'

/**
 * Lịch dạy dạng ô lịch: tuần hoặc tháng, mỗi ô một ngày, trong ô là các thẻ học sinh có màu riêng.
 *
 * Dữ liệu vẫn lấy từ `GET /api/attendance?tuNgay=&denNgay=` — đúng nguồn màn hình Điểm danh đang dùng,
 * nên lịch và điểm danh không bao giờ lệch nhau. Mở khoảng nào thì backend tự sinh bù buổi của khoảng
 * đó từ lịch học lặp hằng tuần.
 */
export function SchedulePage() {
  const { nguoiDung } = usePhien()
  const laAdmin = nguoiDung?.vaiTro === 'admin'
  const dieuHuong = useNavigate()

  const [cheDo, datCheDo] = useState<CheDoXem>('tuan')
  const [mocNgay, datMocNgay] = useState(chuyenMoc('tuan', '', 0))
  const [giaoVienId, datGiaoVienId] = useState<string | undefined>(undefined)
  const [chiTiet, datChiTiet] = useState<BuoiHoc | null>(null)

  const khoang = tinhKhoangXem(cheDo, mocNgay)
  const buoiHoc = useBuoiHoc({
    tuNgay: khoang.tuNgay,
    denNgay: khoang.denNgay,
    // Giáo viên đã bị backend giới hạn theo chính họ; chỉ admin mới lọc được người khác.
    ...(laAdmin && giaoVienId ? { giaoVienId } : {}),
  })
  const danhSachGiaoVien = useDanhSachGiaoVien({ kichThuoc: 200 })
  const duLieu = buoiHoc.data?.duLieu ?? []

  /** Buổi của từng ngày, xếp theo giờ rồi tới tên — trong ô lịch phải theo thứ tự thời gian. */
  const theoNgay = new Map<string, BuoiHoc[]>()
  for (const buoi of [...duLieu].sort(
    (a, b) => a.gioBatDau.localeCompare(b.gioBatDau) || a.tenHocSinh.localeCompare(b.tenHocSinh),
  )) {
    const daCo = theoNgay.get(buoi.ngay)
    if (daCo) daCo.push(buoi)
    else theoNgay.set(buoi.ngay, [buoi])
  }

  const doiCheDo = (moi: CheDoXem) => {
    datCheDo(moi)
    datMocNgay(chuyenMoc(moi, mocNgay, 0))
  }

  return (
    <>
      <PageHeader
        title="Lịch dạy"
        description={`${khoang.moTa} · ${duLieu.length} buổi${laHienTai(cheDo, mocNgay) ? ' · đang xem hiện tại' : ''}`}
        extra={
          <Space size={8} wrap>
            <Segmented<CheDoXem>
              value={cheDo}
              onChange={doiCheDo}
              options={[
                { label: 'Tuần', value: 'tuan' },
                { label: 'Tháng', value: 'thang' },
              ]}
            />
            <Button
              icon={<LeftOutlined />}
              aria-label={cheDo === 'tuan' ? 'Tuần trước' : 'Tháng trước'}
              onClick={() => {
                datMocNgay(chuyenMoc(cheDo, mocNgay, -1))
              }}
            />
            <Button
              onClick={() => {
                datMocNgay(chuyenMoc(cheDo, mocNgay, 0))
              }}
              disabled={laHienTai(cheDo, mocNgay)}
            >
              Hôm nay
            </Button>
            <Button
              icon={<RightOutlined />}
              aria-label={cheDo === 'tuan' ? 'Tuần sau' : 'Tháng sau'}
              onClick={() => {
                datMocNgay(chuyenMoc(cheDo, mocNgay, 1))
              }}
            />
            {laAdmin ? (
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Mọi giáo viên"
                style={{ width: 200 }}
                value={giaoVienId}
                loading={danhSachGiaoVien.isPending}
                options={(danhSachGiaoVien.data?.duLieu ?? []).map((giaoVien) => ({
                  value: giaoVien.id,
                  label: giaoVien.hoTen,
                }))}
                onChange={(giaTri: string | undefined) => {
                  datGiaoVienId(giaTri)
                }}
              />
            ) : null}
            <Button
              icon={<ReloadOutlined />}
              loading={buoiHoc.isFetching}
              aria-label="Tải lại"
              onClick={() => {
                void buoiHoc.refetch()
              }}
            />
          </Space>
        }
      />

      {buoiHoc.isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Không đọc được lịch dạy"
          description={
            buoiHoc.error instanceof ApiError && buoiHoc.error.isNetworkError
              ? 'Không kết nối được backend. Kiểm tra API đã chạy ở cổng 5080 chưa rồi thử lại.'
              : (buoiHoc.error?.message ?? 'Lỗi không xác định')
          }
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                void buoiHoc.refetch()
              }}
            >
              Thử lại
            </Button>
          }
        />
      ) : null}

      {buoiHoc.isPending ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : !buoiHoc.isError && duLieu.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Typography.Text type="secondary">
              {khoang.moTa} chưa có buổi học nào. Buổi học được sinh từ lịch học lặp hằng tuần của học
              sinh đang học — có thể học sinh chưa khai lịch, hoặc lịch không rơi vào ngày nào của
              khoảng này.
            </Typography.Text>
          }
        >
          <Button
            type="primary"
            onClick={() => {
              dieuHuong('/attendance')
            }}
          >
            Sang màn hình Điểm danh
          </Button>
        </Empty>
      ) : null}

      {!buoiHoc.isPending && !buoiHoc.isError && duLieu.length > 0 ? (
        <LuoiLich
          cacNgay={khoang.cacNgay}
          caoO={cheDo === 'tuan' ? 220 : 150}
          renderNgay={(ngay) => {
            const buoiTrongNgay = theoNgay.get(ngay) ?? []

            return (
              <Flex vertical gap={6}>
                {buoiTrongNgay.map((buoi) => (
                  <TheBuoi
                    key={buoi.id}
                    buoi={buoi}
                    hienGiaoVien={laAdmin}
                    onBam={() => {
                      datChiTiet(buoi)
                    }}
                  />
                ))}
              </Flex>
            )
          }}
        />
      ) : null}

      {!buoiHoc.isPending && !buoiHoc.isError && duLieu.length > 0 ? (
        <Flex vertical gap={8} style={{ marginTop: 20 }}>
          <Collapse
            ghost
            items={[
              {
                key: 'google',
                label: <Typography.Text type="secondary">Google Calendar</Typography.Text>,
                children: <KhoiGoogleCalendar laAdmin={laAdmin} />,
              },
            ]}
          />
        </Flex>
      ) : null}

      <Drawer
        open={chiTiet !== null}
        onClose={() => {
          datChiTiet(null)
        }}
        width={380}
        title="Chi tiết buổi học"
        extra={
          <Button
            type="primary"
            size="small"
            onClick={() => {
              dieuHuong('/attendance')
            }}
          >
            Điểm danh
          </Button>
        }
      >
        {chiTiet ? (
          <Flex vertical gap={14}>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Học sinh
              </Typography.Text>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {chiTiet.tenHocSinh}
              </Typography.Title>
              <Typography.Text type="secondary">
                {chiTiet.lopHocSinh ?? 'chưa khai lớp'}
              </Typography.Text>
            </div>

            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Thời gian
              </Typography.Text>
              <div>
                {tenThu(thuCua(chiTiet.ngay))}, {ngayNgan(chiTiet.ngay)} ·{' '}
                {gioNgan(chiTiet.gioBatDau)}–{gioNgan(chiTiet.gioKetThuc)}
              </div>
            </div>

            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Giáo viên &amp; trạng thái
              </Typography.Text>
              <Flex vertical gap={6} align="flex-start">
                <span>{chiTiet.tenGiaoVien}</span>
                <Space size={6} wrap>
                  <Tag color={nhanTrangThaiBuoi(chiTiet).mau}>{nhanTrangThaiBuoi(chiTiet).nhan}</Tag>
                  {chiTiet.laBuoiDayBu ? <Tag>buổi dạy bù</Tag> : null}
                  {chiTiet.daDongBoGoogle ? <Tag>đã lên Google</Tag> : <Tag>chưa lên Google</Tag>}
                </Space>
                {chiTiet.daDongBoGoogle ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Đồng bộ lúc {thoiDiemDiaPhuong(chiTiet.googleDongBoUtc)}
                  </Typography.Text>
                ) : null}
              </Flex>
            </div>

            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Người điểm danh &amp; ghi chú
              </Typography.Text>
              <div>
                {chiTiet.nguoiDiemDanh ?? 'chưa ai điểm danh'}
                {chiTiet.thoiDiemDiemDanhUtc
                  ? ` · ${thoiDiemDiaPhuong(chiTiet.thoiDiemDiemDanhUtc)}`
                  : ''}
              </div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {chiTiet.ghiChu ?? 'không có ghi chú'}
              </Typography.Paragraph>
            </div>

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Ngày {dayjs(chiTiet.ngay).format('DD/MM/YYYY')} · định danh buổi {chiTiet.id.slice(0, 8)}…
            </Typography.Text>
          </Flex>
        ) : null}
      </Drawer>
    </>
  )
}
