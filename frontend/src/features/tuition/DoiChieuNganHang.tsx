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
import { LoiApiAlert } from './LoiApiAlert'

interface DongDaDoc {
  /** Số dòng trong file (dòng 1 là tiêu đề nên dữ liệu bắt đầu từ 2) — để nói rõ dòng nào bị bỏ. */
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
 * Đối chiếu sao kê ngân hàng với sổ học phí: MÁY ĐỀ XUẤT — NGƯỜI XÁC NHẬN.
 *
 * File .csv do trình duyệt đọc (FileReader), không gửi file lên server; `phan-tich` chỉ trả về đề xuất
 * và không ghi gì, chỉ `xac-nhan` mới thành phiếu thu chuyển khoản.
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

  /**
   * Đổi nội dung sao kê là mọi thứ cũ không còn nghĩa: đoán lại cột và bỏ đề xuất của lần trước.
   * Làm ngay trong sự kiện đổi nội dung (dán, chọn file, xoá) thay vì trong effect — state chỉ đổi ở
   * một chỗ, không phải suy ra lại sau mỗi lần render.
   */
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
      // Bỏ bảng đề xuất cũ: ghi xong mà bấm lại lần nữa là ghi trùng tiền.
      datDeXuat(null)
      message.success(`Đã ghi ${ketQua.soDaGhi} phiếu thu chuyển khoản`)
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
      width: 180,
      render: (_giaTri, dong) =>
        dong.lyDoLoi === null ? (
          <Tag color="green">Đọc được</Tag>
        ) : (
          <Tag color="red">Bỏ qua: {dong.lyDoLoi}</Tag>
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
      title: 'Nội dung chuyển khoản',
      key: 'noiDung',
      ellipsis: true,
      render: (_giaTri, muc) => muc.giaoDich.noiDung ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Mức độ khớp',
      key: 'mucDoKhop',
      width: 170,
      render: (_giaTri, muc) => (
        <Tooltip title={moTaMucDoKhop(muc.mucDoKhop)}>
          <Tag color={mauMucDoKhop(muc.mucDoKhop)}>{nhanMucDoKhop(muc.mucDoKhop)}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Lý do',
      dataIndex: 'lyDo',
      width: 260,
      render: (lyDo: string) => <Typography.Text type="secondary">{lyDo}</Typography.Text>,
    },
    {
      title: 'Đề xuất cho',
      key: 'hocSinh',
      width: 190,
      render: (_giaTri, muc) =>
        muc.hocPhiId === null ? (
          <Typography.Text type="secondary">Không ghép được</Typography.Text>
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
          Máy đề xuất — bạn xác nhận
        </Typography.Text>
      }
    >
      <Flex vertical gap={16}>
        <Alert
          type="info"
          showIcon
          message="File sao kê được đọc ngay trong trình duyệt, không gửi lên máy chủ"
          description={
            <Flex vertical gap={4}>
              <Typography.Text>
                Mỗi ngân hàng xuất một định dạng khác nhau nên hệ thống không tự đọc file: bạn chọn file
                .csv (hoặc dán nội dung) rồi chỉ lại cột nếu cần. Nội dung chuyển khoản, số tiền và mã
                giao dịch được gửi lên dưới dạng từng dòng để phân tích.
              </Typography.Text>
              <Typography.Text type="secondary">
                Đối chiếu không phụ thuộc kỳ đang chọn: hệ thống so với MỌI dòng học phí còn nợ, và chỉ
                dùng tháng hiện tại để nhận ra nội dung có nhắc tới kỳ hay không.
              </Typography.Text>
            </Flex>
          }
        />

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
              // Trả false: không upload file lên backend, chỉ đọc tại máy.
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
            Xoá nội dung đã dán
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Cần cột ngày và cột số tiền; nội dung và mã giao dịch nên có để ghép chắc hơn.
          </Typography.Text>
        </Space>

        <Input.TextArea
          rows={5}
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
              <Descriptions.Item label="Ký tự phân cách">
                <Typography.Text code>
                  {bang.phanCach === '\t' ? 'Tab' : bang.phanCach}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Dòng đọc được">
                {hopLe.length} dòng
                {biBoQua > 0 ? (
                  <Typography.Text type="warning"> · bỏ qua {biBoQua} dòng</Typography.Text>
                ) : null}
              </Descriptions.Item>
            </Descriptions>

            <Space wrap>
              <Select<number | null>
                style={{ width: 240 }}
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
                style={{ width: 240 }}
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
                style={{ width: 240 }}
                placeholder="Cột nội dung"
                value={anhXa.noiDung}
                allowClear
                onChange={(giaTri) => {
                  datAnhXaNguoiDung({ ...anhXa, noiDung: giaTri ?? null })
                }}
                options={bang.tieuDe.map((ten, chiSo) => ({ value: chiSo, label: ten }))}
              />
              <Select<number | null>
                style={{ width: 240 }}
                placeholder="Cột mã giao dịch"
                value={anhXa.maGiaoDich}
                allowClear
                onChange={(giaTri) => {
                  datAnhXaNguoiDung({ ...anhXa, maGiaoDich: giaTri ?? null })
                }}
                options={bang.tieuDe.map((ten, chiSo) => ({ value: chiSo, label: ten }))}
              />
            </Space>

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Hệ thống tự đoán cột theo tên tiêu đề; {anhXaNguoiDung ? 'bạn đã chỉnh lại' : 'bạn sửa lại được nếu đoán sai'}.
            </Typography.Text>

            {biBoQua > 0 ? (
              <Alert
                type="warning"
                showIcon
                message={`Có ${biBoQua} dòng không đọc được ngày hoặc số tiền nên sẽ KHÔNG được gửi lên`}
                description="Những dòng đó vẫn hiện trong bảng dưới kèm lý do — kiểm tra cột đã chọn đúng chưa, hoặc sửa lại file."
              />
            ) : null}

            <Table<DongDaDoc>
              size="small"
              rowKey="dong"
              columns={cotXemTruoc}
              dataSource={daDoc}
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 8, hideOnSinglePage: true, size: 'small' }}
              locale={{ emptyText: 'Không có dòng dữ liệu nào trong file' }}
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
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Phân tích chỉ trả về đề xuất, chưa ghi gì vào sổ.
              </Typography.Text>
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
                  description="Sổ học phí đã được cập nhật. Nếu còn giao dịch chưa ghép, bấm Phân tích lại để xem đề xuất mới."
                />
                {ketQuaGhi.boQua.length > 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    message={`${ketQuaGhi.boQua.length} cặp KHÔNG ghi được`}
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
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Chỉ những dòng có đề xuất trỏ tới học sinh mới tích được. Ghi xong là thành phiếu thu
                    chuyển khoản có mã giao dịch, không tự động — bạn là người quyết định.
                  </Typography.Text>
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
