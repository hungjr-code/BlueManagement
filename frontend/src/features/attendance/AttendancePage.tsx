import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  Col,
  Collapse,
  Empty,
  Flex,
  Input,
  Popover,
  Radio,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
import { LeftOutlined, PlusOutlined, ReloadOutlined, RightOutlined, SaveOutlined } from '@ant-design/icons'
import { PageHeader } from '../../components/page'
import { LuoiLich } from '../../components/lich/LuoiLich'
import { TheBuoi } from '../../components/lich/TheBuoi'
import { chuyenMoc, laHienTai, tinhKhoangXem } from '../../components/lich/khoangXem'
import type { CheDoXem } from '../../components/lich/khoangXem'
import { useBuoiHoc, useLuuDiemDanh } from '../../api/attendance'
import { useDanhSachGiaoVien } from '../../api/teachers'
import { ApiError } from '../../api/http'
import type { BuoiHoc, LyDoNghi, TongHopDiemDanh, TrangThaiDiemDanh } from '../../api/types'
import { usePhien } from '../../app/session'
import { gioNgan } from '../../config/lichTuan'
import { ThemBuoiDayBuModal } from './ThemBuoiDayBuModal'
import { BieuDoTiLeChuyenCan } from '../../components/charts/BieuDoTiLeChuyenCan'
import { BieuDoChuyenCanTheoNgay } from '../../components/charts/BieuDoChuyenCanTheoNgay'
import {
  NHAN_LY_DO_NGHI,
  banNhapCua,
  laThayDoi,
  thanhItemLuu,
} from './trangThaiDiemDanh'
import type { BanNhapDiemDanh } from './trangThaiDiemDanh'

const cotTongHop: TableProps<TongHopDiemDanh>['columns'] = [
  { title: 'Tên', dataIndex: 'ten', ellipsis: true },
  { title: 'Buổi', dataIndex: 'soBuoi', width: 70, align: 'right' },
  { title: 'Đi học', dataIndex: 'soDiHoc', width: 70, align: 'right' },
  { title: 'Nghỉ CP', dataIndex: 'soNghiCoPhep', width: 80, align: 'right' },
  { title: 'Nghỉ KP', dataIndex: 'soNghiKhongPhep', width: 80, align: 'right' },
  {
    title: 'Chưa ĐD',
    dataIndex: 'soChuaDiemDanh',
    width: 80,
    align: 'right',
    render: (giaTri: number) => (
      <Typography.Text type={giaTri > 0 ? 'warning' : undefined} strong={giaTri > 0}>
        {giaTri}
      </Typography.Text>
    ),
  },
]

/**
 * Điểm danh buổi học theo ô lịch.
 */
export function AttendancePage() {
  const { modal, message } = App.useApp()
  const { nguoiDung } = usePhien()
  const laAdmin = nguoiDung?.vaiTro === 'admin'

  const [cheDo, datCheDo] = useState<CheDoXem>('tuan')
  const [mocNgay, datMocNgay] = useState(chuyenMoc('tuan', '', 0))
  const [giaoVienId, datGiaoVienId] = useState<string | undefined>(undefined)
  const [dangSua, setDangSua] = useState<Record<string, BanNhapDiemDanh>>({})
  const [moThemDayBu, setMoThemDayBu] = useState(false)

  const khoang = tinhKhoangXem(cheDo, mocNgay)
  const buoiHoc = useBuoiHoc({
    tuNgay: khoang.tuNgay,
    denNgay: khoang.denNgay,
    ...(laAdmin && giaoVienId ? { giaoVienId } : {}),
  })
  const luuDiemDanh = useLuuDiemDanh()
  const danhSachGiaoVien = useDanhSachGiaoVien({ kichThuoc: 200 })

  const duLieu = buoiHoc.data?.duLieu ?? []
  const loiTai = buoiHoc.error instanceof ApiError ? buoiHoc.error : null

  const dsThayDoi = duLieu
    .map((buoi) => ({ buoi, nhap: banNhapCua(buoi, dangSua) }))
    .filter(({ buoi, nhap }) => laThayDoi(buoi, nhap))
  const soThayDoi = dsThayDoi.length

  const theoNgay = new Map<string, BuoiHoc[]>()
  for (const buoi of duLieu) {
    const daCo = theoNgay.get(buoi.ngay)
    if (daCo) daCo.push(buoi)
    else theoNgay.set(buoi.ngay, [buoi])
  }

  const suaBuoi = (buoi: BuoiHoc, sua: Partial<BanNhapDiemDanh>) => {
    setDangSua((truoc) => ({ ...truoc, [buoi.id]: { ...banNhapCua(buoi, truoc), ...sua } }))
  }

  const suaTrangThai = (buoi: BuoiHoc, trangThai: TrangThaiDiemDanh) => {
    const hienTai = banNhapCua(buoi, dangSua)
    suaBuoi(buoi, {
      trangThai,
      lyDoNghi: trangThai === 'nghi' ? (hienTai.lyDoNghi ?? 'co_phep') : null,
    })
  }

  const danhDauCaKhoang = () => {
    const conTrong = duLieu.filter((buoi) => banNhapCua(buoi, dangSua).trangThai === 'chua_diem_danh')

    if (conTrong.length === 0) {
      message.info('Tất cả buổi học trong khoảng này đã được đánh dấu.')
      return
    }

    setDangSua((truoc) => {
      const moi = { ...truoc }
      conTrong.forEach((buoi) => {
        moi[buoi.id] = { ...banNhapCua(buoi, truoc), trangThai: 'di_hoc', lyDoNghi: null }
      })
      return moi
    })

    message.info(`Đã đánh dấu ${conTrong.length} buổi là đi học. Bấm "Lưu điểm danh" để cập nhật.`)
  }

  const luuKhoang = async () => {
    if (dsThayDoi.length === 0) return

    try {
      const ketQua = await luuDiemDanh.mutateAsync(
        dsThayDoi.map(({ buoi, nhap }) => thanhItemLuu(buoi.id, nhap)),
      )
      setDangSua({})
      message.success(`Đã lưu ${ketQua.soBuoiDaLuu} buổi học thành công`)
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      message.error(theoField.length > 0 ? theoField.join(' · ') : (loiApi?.message ?? 'Không lưu được điểm danh'))
    }
  }

  const doiKhoangXem = (chay: () => void) => {
    const apDung = () => {
      setDangSua({})
      chay()
    }

    if (soThayDoi === 0) {
      apDung()
      return
    }

    modal.confirm({
      title: 'Có thay đổi chưa lưu',
      content: `${soThayDoi} buổi đã sửa nhưng chưa bấm Lưu điểm danh. Chuyển trang sẽ huỷ các thay đổi này.`,
      okText: 'Bỏ thay đổi và chuyển',
      okButtonProps: { danger: true },
      cancelText: 'Ở lại',
      onOk: apDung,
    })
  }

  const doiCheDo = (moi: CheDoXem) => {
    doiKhoangXem(() => {
      datCheDo(moi)
      datMocNgay(chuyenMoc(moi, mocNgay, 0))
    })
  }

  const chuyen = (so: number) => {
    if (so === 0 && laHienTai(cheDo, mocNgay)) return

    doiKhoangXem(() => {
      datMocNgay(chuyenMoc(cheDo, mocNgay, so))
    })
  }

  const doiGiaoVien = (moi: string | undefined) => {
    doiKhoangXem(() => {
      datGiaoVienId(moi)
    })
  }

  const daThemDayBu = (ngay: string) => {
    setMoThemDayBu(false)
    if (ngay >= khoang.tuNgay && ngay <= khoang.denNgay) return

    if (soThayDoi > 0) {
      message.info(`Buổi dạy bù ngày ${ngay} đã thêm ngoài khoảng đang xem. Hãy lưu điểm danh trước khi chuyển.`)
      return
    }

    setDangSua({})
    datCheDo('tuan')
    datMocNgay(chuyenMoc('tuan', ngay, 0))
  }

  return (
    <>
      <PageHeader
        title="Điểm danh"
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
                chuyen(-1)
              }}
            />
            <Button
              onClick={() => {
                chuyen(0)
              }}
              disabled={laHienTai(cheDo, mocNgay)}
            >
              Hôm nay
            </Button>
            <Button
              icon={<RightOutlined />}
              aria-label={cheDo === 'tuan' ? 'Tuần sau' : 'Tháng sau'}
              onClick={() => {
                chuyen(1)
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
                onChange={doiGiaoVien}
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

      {loiTai ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Không đọc được buổi học"
          description={
            loiTai.isNetworkError
              ? 'Không kết nối được backend. Kiểm tra API đang chạy rồi thử lại.'
              : loiTai.message
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

      <Flex align="center" gap={16} wrap style={{ marginBottom: 14 }}>
        <Space size={6}>
          <span className="cham chua_diem_danh" />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Chưa điểm danh
          </Typography.Text>
        </Space>
        <Space size={6}>
          <span className="cham di_hoc" />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Đi học
          </Typography.Text>
        </Space>
        <Space size={6}>
          <span className="cham nghi" />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Nghỉ
          </Typography.Text>
        </Space>
        <Space size={6}>
          <span className="cham-sua" />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Chưa lưu
          </Typography.Text>
        </Space>
      </Flex>

      {buoiHoc.isPending ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : !loiTai && duLieu.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Không có buổi học nào trong khoảng thời gian này"
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setMoThemDayBu(true)
            }}
          >
            Thêm buổi dạy bù
          </Button>
        </Empty>
      ) : null}

      {!buoiHoc.isPending && !loiTai && duLieu.length > 0 ? (
        <LuoiLich
          cacNgay={khoang.cacNgay}
          caoO={cheDo === 'tuan' ? 240 : 150}
          renderNgay={(ngay) =>
            (theoNgay.get(ngay) ?? []).map((buoi) => {
              const nhap = banNhapCua(buoi, dangSua)
              const daSua = laThayDoi(buoi, nhap)

              return (
                <Popover
                  key={buoi.id}
                  trigger="click"
                  placement="right"
                  title={
                    <Flex vertical gap={2}>
                      <span style={{ fontWeight: 600 }}>
                        {gioNgan(buoi.gioBatDau)} – {gioNgan(buoi.gioKetThuc)}
                        {buoi.laBuoiDayBu ? ' · Dạy bù' : ''}
                      </span>
                      <Typography.Text type="secondary" style={{ fontWeight: 'normal', fontSize: 12 }}>
                        {buoi.tenHocSinh}
                        {buoi.lopHocSinh ? ` · ${buoi.lopHocSinh}` : ''}
                        {laAdmin ? ` · ${buoi.tenGiaoVien}` : ''}
                      </Typography.Text>
                    </Flex>
                  }
                  content={
                    <Flex vertical gap={10} style={{ width: 250 }}>
                      <Segmented<TrangThaiDiemDanh>
                        block
                        value={nhap.trangThai}
                        onChange={(giaTri) => {
                          suaTrangThai(buoi, giaTri)
                        }}
                        options={[
                          { label: 'Đi học', value: 'di_hoc' },
                          { label: 'Nghỉ', value: 'nghi' },
                        ]}
                      />

                      {nhap.trangThai === 'nghi' ? (
                        <Radio.Group
                          size="small"
                          value={nhap.lyDoNghi}
                          onChange={(suKien) => {
                            suaBuoi(buoi, { lyDoNghi: suKien.target.value as LyDoNghi })
                          }}
                        >
                          <Radio value="co_phep">{NHAN_LY_DO_NGHI.co_phep}</Radio>
                          <Radio value="khong_phep">{NHAN_LY_DO_NGHI.khong_phep}</Radio>
                        </Radio.Group>
                      ) : null}

                      <Input.TextArea
                        size="small"
                        rows={2}
                        maxLength={1000}
                        placeholder="Ghi chú (tuỳ chọn)"
                        value={nhap.ghiChu}
                        onChange={(suKien) => {
                          suaBuoi(buoi, { ghiChu: suKien.target.value })
                        }}
                      />

                      <Flex justify="space-between" align="center" gap={8}>
                        {nhap.trangThai === 'chua_diem_danh' ? (
                          <Tag>Chưa điểm danh</Tag>
                        ) : nhap.trangThai === 'di_hoc' ? (
                          <Tag color="green">Đi học</Tag>
                        ) : (
                          <Tag color="red">
                            Nghỉ {nhap.lyDoNghi === 'khong_phep' ? 'không phép' : 'có phép'}
                          </Tag>
                        )}
                        {nhap.trangThai !== 'chua_diem_danh' ? (
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0 }}
                            onClick={() => {
                              suaTrangThai(buoi, 'chua_diem_danh')
                            }}
                          >
                            Bỏ chọn
                          </Button>
                        ) : null}
                      </Flex>

                      {buoi.trangThai !== 'chua_diem_danh' && daSua ? (
                        <Typography.Text type="warning" style={{ fontSize: 11 }}>
                          Sửa đổi sẽ được ghi nhận vào nhật ký
                        </Typography.Text>
                      ) : null}
                    </Flex>
                  }
                >
                  <div>
                    <TheBuoi
                      buoi={buoi}
                      hienGiaoVien={laAdmin}
                      trangThai={nhap.trangThai}
                      daSua={daSua}
                    />
                  </div>
                </Popover>
              )
            })
          }
        />
      ) : null}

      {!buoiHoc.isPending && !loiTai && duLieu.length > 0 ? (
        <div className="thanh-luu">
          <Flex align="center" gap={12} wrap justify="space-between">
            <Typography.Text type={soThayDoi > 0 ? undefined : 'secondary'} strong={soThayDoi > 0}>
              {soThayDoi > 0 ? `${soThayDoi} buổi đã sửa chưa lưu` : 'Không có thay đổi nào chưa lưu'}
            </Typography.Text>

            <Space size={8} wrap>
              <Button onClick={danhDauCaKhoang}>Cả khoảng đi học</Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => {
                  setMoThemDayBu(true)
                }}
              >
                Buổi dạy bù
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                disabled={soThayDoi === 0}
                loading={luuDiemDanh.isPending}
                onClick={() => {
                  void luuKhoang()
                }}
              >
                Lưu điểm danh
              </Button>
            </Space>
          </Flex>
        </div>
      ) : null}

      {!buoiHoc.isPending && !loiTai && duLieu.length > 0 ? (
        <Collapse
          ghost
          defaultActiveKey={['tong-hop']}
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'tong-hop',
              label: (
                <Typography.Text type="secondary" strong>
                  Phân tích tỷ lệ chuyên cần & Tổng hợp {cheDo === 'tuan' ? 'tuần' : 'khoảng'} · {duLieu.length} buổi
                </Typography.Text>
              ),
              children: (
                <Flex vertical gap={16}>
                  {/* Biểu đồ tỷ lệ chuyên cần và phân bổ ngày */}
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                      <BieuDoTiLeChuyenCan
                        soBuoi={duLieu.length}
                        soDiHoc={
                          duLieu.filter((b) => banNhapCua(b, dangSua).trangThai === 'di_hoc').length
                        }
                        soNghiCoPhep={
                          duLieu.filter((b) => {
                            const n = banNhapCua(b, dangSua)
                            return n.trangThai === 'nghi' && n.lyDoNghi === 'co_phep'
                          }).length
                        }
                        soNghiKhongPhep={
                          duLieu.filter((b) => {
                            const n = banNhapCua(b, dangSua)
                            return n.trangThai === 'nghi' && n.lyDoNghi !== 'co_phep'
                          }).length
                        }
                        soChuaDiemDanh={
                          duLieu.filter(
                            (b) => banNhapCua(b, dangSua).trangThai === 'chua_diem_danh',
                          ).length
                        }
                        title={`Tỷ lệ chuyên cần (${khoang.moTa})`}
                        subTitle={`${duLieu.length} buổi học trong khoảng`}
                      />
                    </Col>
                    <Col xs={24} lg={12}>
                      <BieuDoChuyenCanTheoNgay
                        buoiHoc={duLieu}
                        tuNgay={khoang.tuNgay}
                        denNgay={khoang.denNgay}
                        title="Phân bổ điểm danh theo ngày"
                        subTitle="Số lượng buổi đi học và nghỉ theo từng ngày"
                      />
                    </Col>
                  </Row>

                  <div>
                    <Typography.Text strong>Theo học sinh</Typography.Text>
                    <Table<TongHopDiemDanh>
                      size="small"
                      rowKey="id"
                      pagination={false}
                      columns={cotTongHop}
                      dataSource={buoiHoc.data?.tongHopTheoHocSinh ?? []}
                      style={{ marginTop: 8 }}
                    />
                  </div>
                  {laAdmin ? (
                    <div>
                      <Typography.Text strong>Theo giáo viên</Typography.Text>
                      <Table<TongHopDiemDanh>
                        size="small"
                        rowKey="id"
                        pagination={false}
                        columns={cotTongHop}
                        dataSource={buoiHoc.data?.tongHopTheoGiaoVien ?? []}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                  ) : null}
                </Flex>
              ),
            },
          ]}
        />
      ) : null}

      {moThemDayBu ? (
        <ThemBuoiDayBuModal
          laAdmin={laAdmin}
          onDong={() => {
            setMoThemDayBu(false)
          }}
          onDaThem={daThemDayBu}
        />
      ) : null}
    </>
  )
}
