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
 * Lịch dạy dạng ô lịch: tuần hoặc tháng, mỗi ô một ngày.
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
    ...(laAdmin && giaoVienId ? { giaoVienId } : {}),
  })
  const danhSachGiaoVien = useDanhSachGiaoVien({ kichThuoc: 200 })
  const duLieu = buoiHoc.data?.duLieu ?? []

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
        description={`${khoang.moTa} · ${duLieu.length} buổi`}
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
                placeholder="Tất cả giáo viên"
                style={{ width: 190 }}
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
              ? 'Không kết nối được backend. Kiểm tra API đang chạy rồi thử lại.'
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
          description="Không có buổi học nào trong khoảng thời gian này"
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
          <Flex vertical gap={16}>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Học sinh
              </Typography.Text>
              <Typography.Title level={5} style={{ margin: 0, marginTop: 2 }}>
                {chiTiet.tenHocSinh}
              </Typography.Title>
              <Typography.Text type="secondary">
                {chiTiet.lopHocSinh ?? 'Chưa khai lớp'}
              </Typography.Text>
            </div>

            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Thời gian
              </Typography.Text>
              <div style={{ marginTop: 2, fontWeight: 500 }}>
                {tenThu(thuCua(chiTiet.ngay))}, {ngayNgan(chiTiet.ngay)} ·{' '}
                {gioNgan(chiTiet.gioBatDau)} – {gioNgan(chiTiet.gioKetThuc)}
              </div>
            </div>

            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Giáo viên &amp; trạng thái
              </Typography.Text>
              <Flex vertical gap={6} align="flex-start" style={{ marginTop: 2 }}>
                <span style={{ fontWeight: 500 }}>{chiTiet.tenGiaoVien}</span>
                <Space size={6} wrap>
                  <Tag color={nhanTrangThaiBuoi(chiTiet).mau}>{nhanTrangThaiBuoi(chiTiet).nhan}</Tag>
                  {chiTiet.laBuoiDayBu ? <Tag color="purple">Buổi dạy bù</Tag> : null}
                  {chiTiet.daDongBoGoogle ? (
                    <Tag color="cyan">Đã đồng bộ Google</Tag>
                  ) : null}
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
                Điểm danh &amp; ghi chú
              </Typography.Text>
              <div style={{ marginTop: 2 }}>
                {chiTiet.nguoiDiemDanh ?? 'Chưa điểm danh'}
                {chiTiet.thoiDiemDiemDanhUtc
                  ? ` · ${thoiDiemDiaPhuong(chiTiet.thoiDiemDiemDanhUtc)}`
                  : ''}
              </div>
              {chiTiet.ghiChu ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
                  {chiTiet.ghiChu}
                </Typography.Paragraph>
              ) : null}
            </div>

            <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              {dayjs(chiTiet.ngay).format('DD/MM/YYYY')}
            </Typography.Text>
          </Flex>
        ) : null}
      </Drawer>
    </>
  )
}
