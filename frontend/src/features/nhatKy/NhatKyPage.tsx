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

function docJson(chuoi: string | null): string | null {
  if (!chuoi) return null
  try {
    return JSON.stringify(JSON.parse(chuoi), null, 2)
  } catch {
    return chuoi
  }
}

/**
 * Nhật ký thay đổi dữ liệu trong hệ thống.
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
      title: 'Hành động',
      dataIndex: 'hanhDong',
      width: 200,
      render: (hanhDong: string) => (
        <Tag color={MAU_HANH_DONG[hanhDong] ?? 'default'}>{nhanHanhDong(hanhDong)}</Tag>
      ),
    },
    {
      title: 'Đối tượng tác động',
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
      title: 'Địa chỉ IP',
      dataIndex: 'diaChiIp',
      width: 140,
      render: (ip: string | null) => ip ?? '—',
    },
  ]

  return (
    <>
      <PageHeader
        title="Nhật ký"
        description="Lịch sử thay đổi và kiểm toán dữ liệu hệ thống."
      />

      <Card size="small" title="Bộ lọc nhật ký" style={{ marginBottom: 16 }}>
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
            placeholder="Loại hành động"
            style={{ minWidth: 180 }}
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
            placeholder="Bảng dữ liệu"
            style={{ minWidth: 180 }}
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
              style={{ minWidth: 200 }}
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
          rowExpandable: (dong) => Boolean(dong.duLieuTruoc || dong.duLieuSau),
          expandedRowRender: (dong) => (
            <Flex vertical gap={12}>
              <div>
                <Typography.Text strong>Trước thay đổi:</Typography.Text>
                <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5, background: '#F8FAFD', padding: 8, borderRadius: 6 }}>
                  {docJson(dong.duLieuTruoc) ?? '—'}
                </pre>
              </div>
              <div>
                <Typography.Text strong>Sau thay đổi:</Typography.Text>
                <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5, background: '#F8FAFD', padding: 8, borderRadius: 6 }}>
                  {docJson(dong.duLieuSau) ?? '—'}
                </pre>
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
