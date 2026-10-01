import { useState } from 'react'
import { Alert, Button, Card, DatePicker, Flex, Select, Space, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { PageHeader } from '../../components/page'
import { usePhien } from '../../app/session'
import { ApiError } from '../../api/http'
import { useDanhSachGiaoVien } from '../../api/teachers'
import {
  nhanHanhDong,
  thoiDiemDiaPhuong,
  useDanhMucNhatKy,
  useNhatKy,
} from '../../api/nhatKy'
import type { BoLocNhatKy, DongNhatKy } from '../../api/nhatKy'

const { RangePicker } = DatePicker

/**
 * Màu theo nhóm việc, để liếc là biết dòng nào ĐỔI SỐ LIỆU (cam/đỏ) và dòng nào chỉ tạo mới (xanh).
 * Việc lạ không có trong bảng thì để màu mặc định — không chặn hiển thị.
 */
const MAU_HANH_DONG: Record<string, string> = {
  sua_diem_danh: 'orange',
  cho_hoc_sinh_nghi: 'red',
  sua_hoc_sinh: 'orange',
  tao_hoc_sinh: 'green',
  them_buoi_day_bu: 'green',
  doi_vai_tro: 'purple',
  dat_lai_mat_khau: 'purple',
  chot_so: 'blue',
  mo_khoa_so: 'red',
}

/** Chuỗi JSON trong nhật ký → khối JSON dễ đọc. Không parse được thì in nguyên văn, không nuốt dữ liệu. */
function docJson(chuoi: string | null): string | null {
  if (!chuoi) return null
  try {
    return JSON.stringify(JSON.parse(chuoi), null, 2)
  } catch {
    return chuoi
  }
}

/**
 * Nhật ký thay đổi: ai đổi cái gì, lúc nào, từ giá trị nào sang giá trị nào.
 *
 * Giáo viên chỉ đọc được nhật ký do CHÍNH MÌNH thực hiện — backend chặn thật, màn hình này chỉ nói
 * rõ phạm vi để người dùng không tưởng là thiếu dữ liệu.
 */
export function NhatKyPage() {
  const { nguoiDung } = usePhien()
  const laAdmin = nguoiDung?.vaiTro === 'admin'

  const [boLoc, datBoLoc] = useState<BoLocNhatKy>({ trang: 1, kichThuoc: 20 })

  const truyVan = useNhatKy(boLoc)
  const danhMuc = useDanhMucNhatKy()
  const giaoVien = useDanhSachGiaoVien({ kichThuoc: 200 })

  const duLieu = truyVan.data
  const loiTruyVan =
    truyVan.error instanceof ApiError
      ? truyVan.error.message
      : truyVan.error
        ? 'Không tải được nhật ký.'
        : null

  /** Đổi một điều kiện lọc thì phải quay về trang 1, nếu không sẽ đứng ở trang không còn dữ liệu. */
  const locTheo = (thayDoi: Partial<BoLocNhatKy>) => {
    datBoLoc((cu) => ({ ...cu, ...thayDoi, trang: thayDoi.trang ?? 1 }))
  }

  const cot: TableProps<DongNhatKy>['columns'] = [
    {
      title: 'Thời điểm',
      dataIndex: 'thoiDiemUtc',
      width: 190,
      render: (giaTri: string) => thoiDiemDiaPhuong(giaTri),
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'nguoiThucHien',
      width: 180,
      render: (ten: string | null) =>
        ten ?? <Typography.Text type="secondary">Hệ thống</Typography.Text>,
    },
    {
      title: 'Việc',
      dataIndex: 'hanhDong',
      width: 200,
      render: (hanhDong: string) => (
        <Tag color={MAU_HANH_DONG[hanhDong] ?? 'default'}>{nhanHanhDong(hanhDong)}</Tag>
      ),
    },
    {
      title: 'Bảng bị tác động',
      dataIndex: 'doiTuong',
      width: 200,
      render: (doiTuong: string, dong) => (
        <Space size={6}>
          <Typography.Text code>{doiTuong}</Typography.Text>
          {dong.doiTuongId ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {dong.doiTuongId.slice(0, 8)}…
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Nơi gửi',
      dataIndex: 'diaChiIp',
      width: 140,
      render: (ip: string | null) => ip ?? '—',
    },
  ]

  return (
    <>
      <PageHeader
        title="Nhật ký"
        description="Ai đổi cái gì, lúc nào, từ giá trị nào sang giá trị nào — để tra lại khi số liệu đổi bất thường."
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={laAdmin ? 'Bạn đang xem toàn bộ nhật ký của trung tâm' : 'Bạn chỉ thấy nhật ký do chính mình thực hiện'}
        description={
          laAdmin
            ? 'Có thể lọc theo người thực hiện. Nhật ký do hệ thống tự làm (tự tạo tài khoản, tự đồng bộ) không có người thực hiện.'
            : 'Sửa đổi của người khác không hiện ở đây — kể cả khi nó tác động tới học sinh của bạn. Muốn xem toàn bộ thì hỏi admin.'
        }
      />

      <Card size="small" title="Bộ lọc" style={{ marginBottom: 16 }}>
        <Flex gap={12} wrap align="center">
          <RangePicker
            format="DD/MM/YYYY"
            allowEmpty={[true, true]}
            placeholder={['Từ ngày', 'Đến ngày']}
            onChange={(_giaTri, chuoi) => {
              locTheo({ tuNgay: chuoi[0] || undefined, denNgay: chuoi[1] || undefined })
            }}
          />

          <Select
            allowClear
            placeholder="Loại việc"
            style={{ minWidth: 200 }}
            value={boLoc.hanhDong}
            options={(danhMuc.data?.hanhDong ?? []).map((hanhDong) => ({
              value: hanhDong,
              label: nhanHanhDong(hanhDong),
            }))}
            onChange={(giaTri: string | undefined) => {
              locTheo({ hanhDong: giaTri })
            }}
          />

          <Select
            allowClear
            placeholder="Bảng bị tác động"
            style={{ minWidth: 200 }}
            value={boLoc.doiTuong}
            options={(danhMuc.data?.doiTuong ?? []).map((doiTuong) => ({
              value: doiTuong,
              label: doiTuong,
            }))}
            onChange={(giaTri: string | undefined) => {
              locTheo({ doiTuong: giaTri })
            }}
          />

          {laAdmin ? (
            <Select
              allowClear
              showSearch
              placeholder="Người thực hiện"
              style={{ minWidth: 220 }}
              optionFilterProp="label"
              value={boLoc.nguoiThucHienId}
              options={(giaoVien.data?.duLieu ?? []).map((nguoi) => ({
                value: nguoi.id,
                label: nguoi.hoTen,
              }))}
              onChange={(giaTri: string | undefined) => {
                locTheo({ nguoiThucHienId: giaTri })
              }}
            />
          ) : null}

          <Button
            icon={<ReloadOutlined />}
            loading={truyVan.isFetching}
            onClick={() => {
              void truyVan.refetch()
            }}
          >
            Tải lại
          </Button>
        </Flex>
      </Card>

      {loiTruyVan ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Không tải được nhật ký"
          description={loiTruyVan}
        />
      ) : null}

      <Table<DongNhatKy>
        rowKey="id"
        size="small"
        loading={truyVan.isLoading}
        columns={cot}
        dataSource={duLieu?.duLieu ?? []}
        expandable={{
          // Mở được mới hiện mũi tên: dòng chỉ có hành động mà không có ảnh chụp thì không có gì xem.
          rowExpandable: (dong) => Boolean(dong.duLieuTruoc || dong.duLieuSau),
          expandedRowRender: (dong) => (
            <Flex vertical gap={12}>
              <div>
                <Typography.Text strong>Trước</Typography.Text>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5 }}>{docJson(dong.duLieuTruoc) ?? '—'}</pre>
              </div>
              <div>
                <Typography.Text strong>Sau</Typography.Text>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5 }}>{docJson(dong.duLieuSau) ?? '—'}</pre>
              </div>
            </Flex>
          ),
        }}
        pagination={{
          current: duLieu?.trang ?? 1,
          pageSize: duLieu?.kichThuoc ?? 20,
          total: duLieu?.tongSo ?? 0,
          showSizeChanger: true,
          showTotal: (tong) => `${tong} dòng`,
        }}
        onChange={(bang) => {
          datBoLoc((cu) => ({
            ...cu,
            trang: bang.current ?? 1,
            kichThuoc: bang.pageSize ?? cu.kichThuoc ?? 20,
          }))
        }}
      />
    </>
  )
}
