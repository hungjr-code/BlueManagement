import { Alert, Card, Col, Flex, Progress, Row, Tag, Typography } from 'antd'
import { CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { DonutChart } from './DonutChart'
import type { ChartSegment } from './types'

interface BieuDoTiLeChuyenCanProps {
  soBuoi: number
  soDiHoc: number
  soNghiCoPhep: number
  soNghiKhongPhep: number
  soChuaDiemDanh: number
  title?: string
  subTitle?: string
  size?: number
}

export function BieuDoTiLeChuyenCan({
  soBuoi,
  soDiHoc,
  soNghiCoPhep,
  soNghiKhongPhep,
  soChuaDiemDanh,
  title = 'Tỷ lệ đi học & Chuyên cần',
  subTitle,
  size = 190,
}: BieuDoTiLeChuyenCanProps) {
  const daDiemDanh = soDiHoc + soNghiCoPhep + soNghiKhongPhep
  const tongNghi = soNghiCoPhep + soNghiKhongPhep

  const tiLeDiHoc =
    daDiemDanh > 0 ? Math.round((soDiHoc / daDiemDanh) * 1000) / 10 : 0
  const tiLeNghiCoPhep =
    daDiemDanh > 0 ? Math.round((soNghiCoPhep / daDiemDanh) * 1000) / 10 : 0
  const tiLeNghiKhongPhep =
    daDiemDanh > 0 ? Math.round((soNghiKhongPhep / daDiemDanh) * 1000) / 10 : 0

  const segments: ChartSegment[] = [
    {
      key: 'di_hoc',
      label: 'Đi học',
      value: soDiHoc,
      color: '#52c41a',
      description: 'Học sinh tham gia buổi học đầy đủ',
    },
    {
      key: 'nghi_co_phep',
      label: 'Nghỉ có phép',
      value: soNghiCoPhep,
      color: '#faad14',
      description: 'Học sinh báo trước khi nghỉ',
    },
    {
      key: 'nghi_khong_phep',
      label: 'Nghỉ không phép',
      value: soNghiKhongPhep,
      color: '#ff4d4f',
      description: 'Vắng không có lý do báo trước',
    },
    {
      key: 'chua_diem_danh',
      label: 'Chưa điểm danh',
      value: soChuaDiemDanh,
      color: '#cbd5e1',
      description: 'Buổi học chưa cập nhật trạng thái',
    },
  ]

  let nhanDanhGia = (
    <Tag color="default" icon={<InfoCircleOutlined />}>
      Chưa đủ dữ liệu điểm danh
    </Tag>
  )
  if (daDiemDanh > 0) {
    if (tiLeDiHoc >= 90) {
      nhanDanhGia = (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          Chuyên cần tốt ({tiLeDiHoc}%)
        </Tag>
      )
    } else if (tiLeDiHoc >= 75) {
      nhanDanhGia = (
        <Tag color="warning" icon={<InfoCircleOutlined />}>
          Chuyên cần ổn định ({tiLeDiHoc}%)
        </Tag>
      )
    } else {
      nhanDanhGia = (
        <Tag color="error" icon={<ExclamationCircleOutlined />}>
          Tỷ lệ vắng cao ({Math.round((100 - tiLeDiHoc) * 10) / 10}%)
        </Tag>
      )
    }
  }

  return (
    <Card
      size="small"
      title={
        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
          <Flex vertical>
            <Typography.Text strong style={{ fontSize: 14 }}>
              {title}
            </Typography.Text>
            {subTitle ? (
              <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                {subTitle}
              </Typography.Text>
            ) : null}
          </Flex>
          {nhanDanhGia}
        </Flex>
      }
      style={{ height: '100%' }}
    >
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} md={13} style={{ display: 'flex', justifyContent: 'center' }}>
          <DonutChart
            data={segments}
            size={size}
            centerValue={daDiemDanh > 0 ? `${tiLeDiHoc}%` : '—'}
            centerLabel="Tỷ lệ đi học"
            centerSubtext={daDiemDanh > 0 ? `${soDiHoc}/${daDiemDanh} buổi đã điểm danh` : `${soBuoi} buổi`}
            showLegend={false}
          />
        </Col>

        <Col xs={24} md={11}>
          <Flex vertical gap={10}>
            {/* Đi học */}
            <div>
              <Flex justify="space-between" align="baseline">
                <Typography.Text style={{ fontSize: 12.5, fontWeight: 600, color: '#15803d' }}>
                  Đi học
                </Typography.Text>
                <Typography.Text style={{ fontSize: 12, fontWeight: 600 }}>
                  {soDiHoc} buổi · {tiLeDiHoc}%
                </Typography.Text>
              </Flex>
              <Progress
                percent={tiLeDiHoc}
                strokeColor="#52c41a"
                size="small"
                showInfo={false}
                style={{ margin: '2px 0 0 0' }}
              />
            </div>

            {/* Nghỉ có phép */}
            <div>
              <Flex justify="space-between" align="baseline">
                <Typography.Text style={{ fontSize: 12.5, fontWeight: 500, color: '#b45309' }}>
                  Nghỉ có phép
                </Typography.Text>
                <Typography.Text style={{ fontSize: 12, fontWeight: 500 }}>
                  {soNghiCoPhep} buổi · {tiLeNghiCoPhep}%
                </Typography.Text>
              </Flex>
              <Progress
                percent={tiLeNghiCoPhep}
                strokeColor="#faad14"
                size="small"
                showInfo={false}
                style={{ margin: '2px 0 0 0' }}
              />
            </div>

            {/* Nghỉ không phép */}
            <div>
              <Flex justify="space-between" align="baseline">
                <Typography.Text style={{ fontSize: 12.5, fontWeight: 500, color: '#b91c1c' }}>
                  Nghỉ không phép
                </Typography.Text>
                <Typography.Text style={{ fontSize: 12, fontWeight: 500 }}>
                  {soNghiKhongPhep} buổi · {tiLeNghiKhongPhep}%
                </Typography.Text>
              </Flex>
              <Progress
                percent={tiLeNghiKhongPhep}
                strokeColor="#ff4d4f"
                size="small"
                showInfo={false}
                style={{ margin: '2px 0 0 0' }}
              />
            </div>

            {/* Chưa điểm danh */}
            <div>
              <Flex justify="space-between" align="baseline">
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Chưa điểm danh
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {soChuaDiemDanh} buổi / {soBuoi} tổng
                </Typography.Text>
              </Flex>
              <Progress
                percent={soBuoi > 0 ? Math.round((soChuaDiemDanh / soBuoi) * 100) : 0}
                strokeColor="#cbd5e1"
                size="small"
                showInfo={false}
                style={{ margin: '2px 0 0 0' }}
              />
            </div>

            {tongNghi > 0 && tiLeDiHoc < 80 ? (
              <Alert
                type="warning"
                showIcon
                style={{ padding: '6px 10px', fontSize: 11.5 }}
                message={`Đã có ${tongNghi} buổi vắng (${soNghiKhongPhep} không phép). Cần theo dõi sát để đảm bảo tiến độ học tập.`}
              />
            ) : null}
          </Flex>
        </Col>
      </Row>
    </Card>
  )
}
