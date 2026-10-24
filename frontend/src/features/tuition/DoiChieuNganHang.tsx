import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Flex,
  Input,
  List,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd'
import type { TableProps } from 'antd'
import { FileSearchOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons'
import { usePhanTichDoiChieu, useXacNhanDoiChieu } from '../../api/tuition'
import type { CapDoiChieu, DeXuatDoiChieu, GiaoDichNganHang, KetQuaDoiChieu } from '../../api/tuition'
import { ngayNgan } from '../../config/lichTuan'
import { formatVnd } from '../../lib/money'
import { docCsv, docNgay, docSoTien, doanCot } from './csv'
import type { AnhXaCot } from './csv'
import { coTheGhi, mauMucDoKhop, moTaMucDoKhop, nhanMucDoKhop } from './hienThi'
import { LoiApiAlert } from '../../components/LoiApiAlert'

interface DongDaDoc {
  dong: number
  ngayChu: string
  ngay: string | null
  soTienChu: string
  soTien: number | null
  noiDung: string
  maGiaoDich: string
  lyDoLoi: string | null
}

function layO(dong: string[], chiSo: number | null): string {
  if (chiSo === null) return ''
  return dong[chiSo] ?? ''
}

/**
 * Đối chiếu sao kê ngân hàng với sổ học phí.
 */
export function DoiChieuNganHang() {
  const { message } = App.useApp()
  const phanTich = usePhanTichDoiChieu()
  const xacNhan = useXacNhanDoiChieu()

  const [noiDung, datNoiDung] = useState('')
  const [anhXaNguoiDung, datAnhXaNguoiDung] = useState<AnhXaCot | null>(null)
  const [deXuat, datDeXuat] = useState<DeXuatDoiChieu[] | null>(null)
  const [daChon, datDaChon] = useState<string[]>([])
  const [ketQuaGhi, datKetQuaGhi] = useState<KetQuaDoiChieu | null>(null)
  const [loiPhanTich, datLoiPhanTich] = useState<unknown>(null)
  const [loiXacNhan, datLoiXacNhan] = useState<unknown>(null)

  const bang = useMemo(() => docCsv(noiDung), [noiDung])
  const anhXaMacDinh = useMemo(() => doanCot(bang.tieuDe), [bang])
  const anhXa = anhXaNguoiDung ?? anhXaMacDinh

  const doiNoiDung = (moi: string) => {
    datNoiDung(moi)
    datAnhXaNguoiDung(null)
    datDeXuat(null)
    datDaChon([])
    datKetQuaGhi(null)
    datLoiPhanTich(null)
    datLoiXacNhan(null)
  }

  const daDoc = useMemo<DongDaDoc[]>(
    () =>
      bang.dong.map((dong, chiSo) => {
        const ngayChu = layO(dong, anhXa.ngay)
        const soTienChu = layO(dong, anhXa.soTien)
        const ngay = docNgay(ngayChu)
        const soTien = docSoTien(soTienChu)

        let lyDoLoi: string | null = null
        if (ngay === null) lyDoLoi = 'Không đọc được ngày'
        else if (soTien === null) lyDoLoi = 'Không đọc được số tiền'

        return {
          dong: chiSo + 2,
          ngayChu,
          ngay,
          soTienChu,
          soTien,
          noiDung: layO(dong, anhXa.noiDung),
          maGiaoDich: layO(dong, anhXa.maGiaoDich),
          lyDoLoi,
        }
      }),
    [bang, anhXa],
  )

  const hopLe = useMemo(() => daDoc.filter((dong) => dong.lyDoLoi === null), [daDoc])
  const biBoQua = daDoc.length - hopLe.length

  const giaoDichGuiLen = useMemo<GiaoDichNganHang[]>(
    () =>
      hopLe.map((dong) => ({
        ngay: dong.ngay ?? '',
        soTien: dong.soTien ?? 0,
        noiDung: dong.noiDung.length > 0 ? dong.noiDung : null,
        maGiaoDich: dong.maGiaoDich.length > 0 ? dong.maGiaoDich : null,
      })),
    [hopLe],
  )

  const chayPhanTich = async () => {
    datLoiPhanTich(null)
    datLoiXacNhan(null)
    datDeXuat(null)
    datDaChon([])
    datKetQuaGhi(null)
    try {
      const ketQua = await phanTich.mutateAsync(giaoDichGuiLen)
      datDeXuat(ketQua)
      message.success(`Đã phân tích ${ketQua.length} giao dịch`)
    } catch (error) {
      datLoiPhanTich(error)
    }
  }

  const ghiCacCapDaChon = async () => {
    if (!deXuat) return
    datLoiXacNhan(null)
    const cacCap: CapDoiChieu[] = daChon.flatMap((khoa) => {
      const muc = deXuat[Number(khoa)]
      if (!muc || muc.hocPhiId === null) return []
      return [
        {
          hocPhiId: muc.hocPhiId,
          soTien: muc.giaoDich.soTien,
          ngayThu: muc.giaoDich.ngay,
          maGiaoDichNganHang: muc.giaoDich.maGiaoDich,
        },
      ]
    })

    try {
      const ketQua = await xacNhan.mutateAsync(cacCap)
      datKetQuaGhi(ketQua)
      datDaChon([])
      datDeXuat(null)
      message.success(`Đã ghi ${ketQua.soDaGhi} phiếu thu thành công`)
    } catch (error) {
      datLoiXacNhan(error)
    }
  }

  const cotXemTruoc: TableProps<DongDaDoc>['columns'] = [
    { title: 'Dòng', dataIndex: 'dong', width: 70 },
    {
      title: 'Ngày',
      key: 'ngay',
      width: 120,
      render: (_giaTri, dong) =>
        dong.ngay ? ngayNgan(dong.ngay) : <Typography.Text type="danger">{dong.ngayChu || '—'}</Typography.Text>,
    },
    {
      title: 'Số tiền',
      key: 'soTien',
      width: 140,
      align: 'right',
      render: (_giaTri, dong) =>
        dong.soTien !== null ? (
          formatVnd(dong.soTien)
        ) : (
          <Typography.Text type="danger">{dong.soTienChu || '—'}</Typography.Text>
        ),
    },
    { title: 'Nội dung', dataIndex: 'noiDung', ellipsis: true },
    {
      title: 'Mã giao dịch',
      dataIndex: 'maGiaoDich',
      width: 150,
      render: (ma: string) => (ma ? <Typography.Text code>{ma}</Typography.Text> : '—'),
    },
    {
      title: 'Tình trạng',
      key: 'tinhTrang',
      width: 150,
      render: (_giaTri, dong) =>
        dong.lyDoLoi === null ? (
          <Tag color="green">Hợp lệ</Tag>
        ) : (
          <Tag color="red">{dong.lyDoLoi}</Tag>
        ),
    },
  ]

  const cotDeXuat: TableProps<DeXuatDoiChieu>['columns'] = [
    {
      title: 'Giao dịch',
      key: 'giaoDich',
      width: 190,
      render: (_giaTri, muc) => (
        <Flex vertical>
          <Typography.Text>{ngayNgan(muc.giaoDich.ngay)}</Typography.Text>
          <Typography.Text strong>{formatVnd(muc.giaoDich.soTien)}</Typography.Text>
        </Flex>
      ),
    },
    {
      title: 'Nội dung',
      key: 'noiDung',
      ellipsis: true,
      render: (_giaTri, muc) => muc.giaoDich.noiDung ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Mức độ khớp',
      key: 'mucDoKhop',
      width: 140,
      render: (_giaTri, muc) => (
        <Tooltip title={moTaMucDoKhop(muc.mucDoKhop)}>
          <Tag color={mauMucDoKhop(muc.mucDoKhop)}>{nhanMucDoKhop(muc.mucDoKhop)}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Lý do',
      dataIndex: 'lyDo',
      width: 240,
      render: (lyDo: string) => <Typography.Text type="secondary">{lyDo}</Typography.Text>,
    },
    {
      title: 'Gợi ý cho',
      key: 'hocSinh',
      width: 180,
      render: (_giaTri, muc) =>
        muc.hocPhiId === null ? (
          <Typography.Text type="secondary">Chưa tìm thấy</Typography.Text>
        ) : (
          <Flex vertical>
            <Typography.Text strong>{muc.tenHocSinh ?? '—'}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              còn lại {formatVnd(muc.conLai ?? 0)}
            </Typography.Text>
          </Flex>
        ),
    },
  ]

  const soChon = daChon.length

  return (
    <Card
      size="small"
      title="Đối chiếu sao kê ngân hàng"
      extra={
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Tự động gợi ý khớp chuyển khoản
        </Typography.Text>
      }
    >
      <Flex vertical gap={16}>
        <Space wrap>
          <Upload
            accept=".csv,text/csv"
            maxCount={1}
            showUploadList={false}
            beforeUpload={(tep) => {
              const trinhDoc = new FileReader()
              trinhDoc.onload = () => {
                doiNoiDung(String(trinhDoc.result ?? ''))
                message.success(`Đã đọc file ${tep.name}`)
              }
              trinhDoc.onerror = () => {
                message.error('Không đọc được file này. Thử mở bằng Excel rồi lưu lại thành .csv.')
              }
              trinhDoc.readAsText(tep, 'UTF-8')
              return false
            }}
          >
            <Button icon={<UploadOutlined />}>Chọn file .csv</Button>
          </Upload>
          <Button
            disabled={noiDung.trim().length === 0}
            onClick={() => {
              doiNoiDung('')
            }}
          >
            Xoá nội dung
          </Button>
        </Space>

        <Input.TextArea
          rows={4}
          value={noiDung}
          onChange={(suKien) => {
            doiNoiDung(suKien.target.value)
          }}
          placeholder={`Dán nội dung sao kê (CSV), ví dụ:\nNgày,Số tiền,Nội dung,Mã giao dịch\n05/09/2026,1500000,NGUYEN VAN A HOC PHI THANG 09/2026,FT26090512345`}
        />

        {bang.tieuDe.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có dữ liệu sao kê — chọn file .csv hoặc dán nội dung vào ô trên"
          />
        ) : (
          <Flex vertical gap={12}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Số cột">{bang.tieuDe.length}</Descriptions.Item>
              <Descriptions.Item label="Số dòng dữ liệu">{bang.dong.length}</Descriptions.Item>
              <Descriptions.Item label="Dòng hợp lệ">
                {hopLe.length} dòng
                {biBoQua > 0 ? (
                  <Typography.Text type="warning"> · bỏ qua {biBoQua} dòng</Typography.Text>
                ) : null}
              </Descriptions.Item>
            </Descriptions>

            <Space wrap>
              <Select<number | null>
                style={{ width: 200 }}
                placeholder="Cột ngày"
                value={anhXa.ngay}
                allowClear
                onChange={(giaTri) => {
                  datAnhXaNguoiDung({ ...anhXa, ngay: giaTri ?? null })
                }}
                options={bang.tieuDe.map((ten, chiSo) => ({ value: chiSo, label: ten }))}
                status={anhXa.ngay === null ? 'warning' : undefined}
              />
              <Select<number | null>
                style={{ width: 200 }}
                placeholder="Cột số tiền"
                value={anhXa.soTien}
                allowClear
                onChange={(giaTri) => {
                  datAnhXaNguoiDung({ ...anhXa, soTien: giaTri ?? null })
                }}
                options={bang.tieuDe.map((ten, chiSo) => ({ value: chiSo, label: ten }))}
                status={anhXa.soTien === null ? 'warning' : undefined}
              />
              <Select<number | null>
                style={{ width: 200 }}
                placeholder="Cột nội dung"
                value={anhXa.noiDung}
                allowClear
                onChange={(giaTri) => {
                  datAnhXaNguoiDung({ ...anhXa, noiDung: giaTri ?? null })
                }}
                options={bang.tieuDe.map((ten, chiSo) => ({ value: chiSo, label: ten }))}
              />
              <Select<number | null>
                style={{ width: 200 }}
                placeholder="Cột mã giao dịch"
                value={anhXa.maGiaoDich}
                allowClear
                onChange={(giaTri) => {
                  datAnhXaNguoiDung({ ...anhXa, maGiaoDich: giaTri ?? null })
                }}
                options={bang.tieuDe.map((ten, chiSo) => ({ value: chiSo, label: ten }))}
              />
            </Space>

            {biBoQua > 0 ? (
              <Alert
                type="warning"
                showIcon
                message={`Có ${biBoQua} dòng không đọc được ngày hoặc số tiền`}
              />
            ) : null}

            <Table<DongDaDoc>
              size="small"
              rowKey="dong"
              columns={cotXemTruoc}
              dataSource={daDoc}
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 5, hideOnSinglePage: true, size: 'small' }}
              locale={{ emptyText: 'Không có dòng dữ liệu nào' }}
            />

            <Space>
              <Button
                type="primary"
                icon={<FileSearchOutlined />}
                disabled={hopLe.length === 0}
                loading={phanTich.isPending}
                onClick={() => {
                  void chayPhanTich()
                }}
              >
                Phân tích {hopLe.length} giao dịch
              </Button>
            </Space>

            {loiPhanTich ? (
              <LoiApiAlert error={loiPhanTich} tieuDe="Không phân tích được sao kê" />
            ) : null}

            {ketQuaGhi ? (
              <Flex vertical gap={8}>
                <Alert
                  type="success"
                  showIcon
                  message={`Đã ghi ${ketQuaGhi.soDaGhi} phiếu thu chuyển khoản, tổng ${formatVnd(ketQuaGhi.tongDaGhi)}`}
                />
                {ketQuaGhi.boQua.length > 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    message={`${ketQuaGhi.boQua.length} cặp không thể ghi`}
                    description={
                      <List
                        size="small"
                        dataSource={ketQuaGhi.boQua}
                        renderItem={(lyDo) => <List.Item>{lyDo}</List.Item>}
                      />
                    }
                  />
                ) : null}
              </Flex>
            ) : null}

            {loiXacNhan ? (
              <LoiApiAlert error={loiXacNhan} tieuDe="Không ghi được các cặp đã chọn" />
            ) : null}

            {deXuat ? (
              <Flex vertical gap={8}>
                <Space>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    disabled={soChon === 0}
                    loading={xacNhan.isPending}
                    onClick={() => {
                      void ghiCacCapDaChon()
                    }}
                  >
                    Ghi {soChon} cặp đã chọn
                  </Button>
                </Space>

                <Table<DeXuatDoiChieu>
                  size="small"
                  rowKey={(_muc, chiSo) => String(chiSo)}
                  columns={cotDeXuat}
                  dataSource={deXuat}
                  scroll={{ x: 'max-content' }}
                  rowSelection={{
                    selectedRowKeys: daChon,
                    onChange: (khoaDaChon) => {
                      datDaChon(khoaDaChon.map(String))
                    },
                    getCheckboxProps: (muc) => ({ disabled: !coTheGhi(muc) }),
                  }}
                  pagination={{ pageSize: 10, hideOnSinglePage: true, size: 'small' }}
                  locale={{ emptyText: 'Không có đề xuất nào' }}
                />
              </Flex>
            ) : null}
          </Flex>
        )}
      </Flex>
    </Card>
  )
}
