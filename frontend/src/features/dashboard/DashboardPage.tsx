import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { CalendarOutlined, CheckSquareOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { PageHeader } from '../../components/page'
import { useHomNay, useTuanNay } from '../../api/dashboard'
import { usePhien } from '../../app/session'
import type { BuoiHoc, GiaoVien } from '../../api/types'
import { ngayNgan } from '../../config/lichTuan'
import { formatVnd } from '../../lib/money'
import { BoLocGiaoVien } from './BoLocGiaoVien'
import { LichDayTuan } from './LichDayTuan'
import { BangTongHop } from './BangTongHop'
import { taoCotBuoiHoc } from './cotBuoiHoc'

const CHU_THICH_HOC_PHI = 'Con số dự kiến để nhìn nhanh; công nợ thật tính từ điểm danh ở trang Học phí.'

function moTaLoi(error: unknown): string {
  return error instanceof Error ? error.message : 'Lỗi không xác định'
}

/**
 * Tổng quan: hôm nay dạy ai, tuần này dạy những ai.
 *
 * Số liệu đọc thẳng từ `GET /api/dashboard/hom-nay` và `/tuan-nay` — không có số nào gõ tay ở đây.
 * Admin lọc được theo giáo viên; giáo viên không thấy bộ lọc vì backend đã giới hạn dữ liệu trả về
 * đúng bằng lịch dạy của chính họ.
 */
export function DashboardPage() {
  const dieuHuong = useNavigate()
  const { nguoiDung } = usePhien()
  const laAdmin = nguoiDung?.vaiTro === 'admin'

  // Giữ cả object giáo viên đang lọc để hiện được tên; API chỉ cần id.
  const [giaoVienLoc, setGiaoVienLoc] = useState<GiaoVien | undefined>(undefined)
  const giaoVienId = giaoVienLoc?.id

  const homNay = useHomNay(giaoVienId)
  const tuanNay = useTuanNay(giaoVienId)

  const cotHomNay = taoCotBuoiHoc()
  const dangTai = homNay.isPending || tuanNay.isPending
  const coLoi = homNay.isError || tuanNay.isError
  const buoiHomNay = homNay.data?.duLieu ?? []

  const thuLai = () => {
    void homNay.refetch()
    void tuanNay.refetch()
  }

  const nutThuLai = (
    <Button size="small" icon={<ReloadOutlined />} onClick={thuLai}>
      Thử lại
    </Button>
  )

  return (
    <>
      <PageHeader
        title="Tổng quan"
        description="Hôm nay dạy ai, tuần này dạy những ai. Số liệu đọc trực tiếp từ API; học phí là con số dự kiến."
        extra={
          <Space wrap>
            {laAdmin ? <BoLocGiaoVien giaTri={giaoVienLoc} onChange={setGiaoVienLoc} /> : null}
            <Tag icon={<CalendarOutlined />} color="blue">
              {dayjs().format('dddd, DD/MM/YYYY')}
            </Tag>
          </Space>
        }
      />

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {giaoVienLoc ? (
          <Alert
            type="info"
            showIcon
            message={`Đang xem lịch dạy của ${giaoVienLoc.hoTen}`}
            action={
              <Button
                size="small"
                onClick={() => {
                  setGiaoVienLoc(undefined)
                }}
              >
                Bỏ lọc
              </Button>
            }
          />
        ) : null}

        <Card
          size="small"
          title="Hôm nay dạy ai"
          extra={
            <Space wrap>
              {homNay.data ? (
                <Typography.Text type="secondary">
                  {homNay.data.soBuoi} buổi · {homNay.data.soChuaDiemDanh} chưa điểm danh
                </Typography.Text>
              ) : null}
              <Button
                size="small"
                type="primary"
                icon={<CheckSquareOutlined />}
                onClick={() => {
                  dieuHuong('/attendance')
                }}
              >
                Điểm danh
              </Button>
            </Space>
          }
        >
          {homNay.isPending ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : homNay.isError ? (
            <Alert
              type="error"
              showIcon
              message="Không đọc được lịch dạy hôm nay"
              description={moTaLoi(homNay.error)}
              action={nutThuLai}
            />
          ) : buoiHomNay.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                giaoVienLoc
                  ? `Hôm nay ${giaoVienLoc.hoTen} không có buổi học nào`
                  : 'Hôm nay không có buổi học nào'
              }
            />
          ) : (
            <Table<BuoiHoc>
              size="small"
              rowKey="id"
              columns={cotHomNay}
              dataSource={buoiHomNay}
              pagination={false}
              scroll={{ x: 900 }}
            />
          )}
        </Card>

        {dangTai ? (
          <Row gutter={[16, 16]}>
            {[0, 1, 2, 3].map((o) => (
              <Col key={o} xs={24} sm={12} xl={6}>
                <Card size="small">
                  <Skeleton active title paragraph={{ rows: 2 }} />
                </Card>
              </Col>
            ))}
          </Row>
        ) : coLoi ? (
          <Alert
            type="error"
            showIcon
            message="Chưa đọc được số liệu tổng quan"
            description={
              homNay.isError
                ? `Hôm nay: ${moTaLoi(homNay.error)}`
                : `Tuần này: ${moTaLoi(tuanNay.error)}`
            }
            action={nutThuLai}
          />
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic
                  title="Buổi dạy hôm nay"
                  value={homNay.data?.soBuoi ?? '—'}
                  suffix="buổi"
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Đã điểm danh {homNay.data?.soDaDiemDanh ?? 0}/{homNay.data?.soBuoi ?? 0} buổi
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic
                  title="Buổi dạy tuần này"
                  value={tuanNay.data?.soBuoi ?? '—'}
                  suffix="buổi"
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Tuần {ngayNgan(tuanNay.data?.tuNgay)} – {ngayNgan(tuanNay.data?.denNgay)}
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic
                  title="Buổi chưa điểm danh"
                  value={tuanNay.data?.soChuaDiemDanh ?? '—'}
                  suffix="buổi"
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Chưa điểm danh khác với nghỉ: buổi bỏ trống không sinh ra tiền.
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic
                  title="Học phí dự kiến tháng này"
                  value={tuanNay.data ? formatVnd(tuanNay.data.hocPhiDuKienThangNay) : '—'}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {CHU_THICH_HOC_PHI}
                </Typography.Text>
              </Card>
            </Col>
          </Row>
        )}

        {!dangTai && !coLoi && tuanNay.data ? (
          <>
            <LichDayTuan tuan={tuanNay.data} tenGiaoVienLoc={giaoVienLoc?.hoTen} />

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={laAdmin ? 12 : 24}>
                <BangTongHop
                  tieuDe="Tổng hợp cuối tuần theo học sinh"
                  duLieu={tuanNay.data.tongHopTheoHocSinh}
                  ghiChu="Đếm từ điểm danh của từng buổi trong tuần này. Số buổi đi học là căn cứ tính tiền."
                />
              </Col>
              {laAdmin ? (
                <Col xs={24} xl={12}>
                  <BangTongHop
                    tieuDe="Tổng hợp cuối tuần theo giáo viên"
                    duLieu={tuanNay.data.tongHopTheoGiaoVien}
                    ghiChu="Chỉ admin thấy bảng này: dùng để biết giáo viên nào còn buổi chưa điểm danh."
                  />
                </Col>
              ) : null}
            </Row>
          </>
        ) : null}

        {tuanNay.isPending ? (
          <Card size="small">
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        ) : null}
      </Space>
    </>
  )
}
