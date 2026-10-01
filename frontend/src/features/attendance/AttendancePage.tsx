import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  Collapse,
  Empty,
  Flex,
  Input,
  Popover,
  Radio,
  Segmented,
  Select,
  Skeleton,
  Space,
  Table,
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
import {
  NHAN_LY_DO_NGHI,
  banNhapCua,
  laThayDoi,
  thanhItemLuu,
  thoiDiemDiaPhuong,
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
 * Điểm danh bằng ô lịch: mỗi buổi là một thẻ, bấm vào thẻ để đánh dấu rồi lưu cả khoảng một lần.
 *
 * Hai điều màn hình này không được phá:
 *
 * 1. **Bỏ trống không phải là nghỉ.** Buổi chưa đánh dấu khác hẳn buổi nghỉ — gộp hai thứ làm một là
 *    học phí tính sai. Vì vậy mọi thay đổi đều do người dùng bấm, và chấm trạng thái trên thẻ luôn
 *    phân biệt được ba thứ.
 * 2. **Sửa lại buổi đã điểm danh thì backend ghi nhật ký.** Thẻ có dấu “đã sửa” và hộp thoại nói
 *    trước lần lưu này sẽ vào nhật ký.
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
    // Giáo viên đã bị backend giới hạn theo chính họ; chỉ admin mới lọc được người khác.
    ...(laAdmin && giaoVienId ? { giaoVienId } : {}),
  })
  const luuDiemDanh = useLuuDiemDanh()
  const danhSachGiaoVien = useDanhSachGiaoVien({ kichThuoc: 200 })

  const duLieu = buoiHoc.data?.duLieu ?? []
  const loiTai = buoiHoc.error instanceof ApiError ? buoiHoc.error : null

  /** Những buổi đã sửa trong state nhưng chưa gửi lên backend. */
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

  /* ------------------------------ sửa trong state ------------------------------ */

  const suaBuoi = (buoi: BuoiHoc, sua: Partial<BanNhapDiemDanh>) => {
    setDangSua((truoc) => ({ ...truoc, [buoi.id]: { ...banNhapCua(buoi, truoc), ...sua } }))
  }

  const suaTrangThai = (buoi: BuoiHoc, trangThai: TrangThaiDiemDanh) => {
    const hienTai = banNhapCua(buoi, dangSua)
    suaBuoi(buoi, {
      trangThai,
      // Chọn Nghỉ thì mặc định "có phép" cho nhanh; nghỉ không phép bấm lại lựa chọn bên cạnh.
      lyDoNghi: trangThai === 'nghi' ? (hienTai.lyDoNghi ?? 'co_phep') : null,
    })
  }

  /** Đánh dấu nhanh cả khoảng: chỉ những buổi còn trống, để người dùng sửa lại chỗ cá biệt. */
  const danhDauCaKhoang = () => {
    const conTrong = duLieu.filter((buoi) => banNhapCua(buoi, dangSua).trangThai === 'chua_diem_danh')

    if (conTrong.length === 0) {
      message.info('Mọi buổi trong khoảng này đều đã có trạng thái — chỉ còn việc sửa các trường hợp cá biệt.')
      return
    }

    setDangSua((truoc) => {
      const moi = { ...truoc }
      conTrong.forEach((buoi) => {
        moi[buoi.id] = { ...banNhapCua(buoi, truoc), trangThai: 'di_hoc', lyDoNghi: null }
      })
      return moi
    })

    message.info(`Đã đánh dấu ${conTrong.length} buổi là đi học. Xem lại rồi bấm Lưu điểm danh.`)
  }

  /* ------------------------------ lưu và đổi khoảng ------------------------------ */

  const luuKhoang = async () => {
    if (dsThayDoi.length === 0) return

    try {
      const ketQua = await luuDiemDanh.mutateAsync(
        dsThayDoi.map(({ buoi, nhap }) => thanhItemLuu(buoi.id, nhap)),
      )
      setDangSua({})
      message.success(
        ketQua.soBuoiGhiNhatKy > 0
          ? `Đã lưu ${ketQua.soBuoiDaLuu} buổi, ghi ${ketQua.soBuoiGhiNhatKy} dòng nhật ký sửa điểm danh`
          : `Đã lưu ${ketQua.soBuoiDaLuu} buổi, không có dòng nào phải ghi nhật ký`,
      )
    } catch (error) {
      const loiApi = error instanceof ApiError ? error : null
      const theoField = loiApi?.fieldMessages ?? []
      message.error(theoField.length > 0 ? theoField.join(' · ') : (loiApi?.message ?? 'Không lưu được điểm danh'))
    }
  }

  /**
   * Đổi khoảng xem hoặc đổi giáo viên. Còn thay đổi chưa lưu thì hỏi trước: các thay đổi đó thuộc
   * khoảng cũ nên chuyển đi là mất.
   */
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
      title: 'Còn thay đổi chưa lưu',
      content: `${soThayDoi} buổi đã sửa nhưng chưa bấm Lưu điểm danh. Đổi khoảng xem sẽ bỏ các thay đổi đó.`,
      okText: 'Bỏ thay đổi và chuyển',
      okButtonProps: { danger: true },
      cancelText: 'Ở lại để lưu',
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

  /** Thêm buổi dạy bù xong: đóng hộp thoại, cần thì mở đúng khoảng chứa buổi đó. */
  const daThemDayBu = (ngay: string) => {
    setMoThemDayBu(false)

    if (ngay >= khoang.tuNgay && ngay <= khoang.denNgay) return

    if (soThayDoi > 0) {
      message.info(
        `Buổi dạy bù ngày ${ngay} không nằm trong khoảng đang xem. Còn ${soThayDoi} thay đổi chưa lưu nên chưa chuyển — lưu xong hãy mở khoảng đó.`,
      )
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
        description={`${khoang.moTa} · ${duLieu.length} buổi · bấm vào thẻ để đánh dấu, sửa xong bấm Lưu một lần`}
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
                placeholder="Mọi giáo viên"
                style={{ width: 200 }}
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
              ? 'Không kết nối được backend. Kiểm tra API đã chạy ở cổng 5080 chưa rồi thử lại.'
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

      <Flex align="center" gap={16} wrap style={{ marginBottom: 10 }}>
        <Space size={6}>
          <span className="cham chua_diem_danh" />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            chưa điểm danh
          </Typography.Text>
        </Space>
        <Space size={6}>
          <span className="cham di_hoc" />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            đi học
          </Typography.Text>
        </Space>
        <Space size={6}>
          <span className="cham nghi" />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            nghỉ
          </Typography.Text>
        </Space>
        <Space size={6}>
          <span className="cham-sua" />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            sửa chưa lưu
          </Typography.Text>
        </Space>
      </Flex>

      {buoiHoc.isPending ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : !loiTai && duLieu.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Typography.Text type="secondary">
              {khoang.moTa} chưa có buổi học nào để điểm danh. Buổi học được sinh từ lịch học lặp hằng
              tuần của học sinh đang học.
            </Typography.Text>
          }
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
                    <Flex vertical>
                      <span>
                        {gioNgan(buoi.gioBatDau)}–{gioNgan(buoi.gioKetThuc)}
                        {buoi.laBuoiDayBu ? ' · dạy bù' : ''}
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
                        placeholder="Ghi chú (không bắt buộc)"
                        value={nhap.ghiChu}
                        onChange={(suKien) => {
                          suaBuoi(buoi, { ghiChu: suKien.target.value })
                        }}
                      />

                      <Flex justify="space-between" align="center" gap={8}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {nhap.trangThai === 'chua_diem_danh'
                            ? 'chưa điểm danh — khác với nghỉ'
                            : nhap.trangThai === 'di_hoc'
                              ? 'đi học → tính tiền'
                              : `nghỉ ${nhap.lyDoNghi === 'khong_phep' ? 'không phép' : 'có phép'} → không tính tiền`}
                        </Typography.Text>
                        {nhap.trangThai !== 'chua_diem_danh' ? (
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0 }}
                            onClick={() => {
                              suaTrangThai(buoi, 'chua_diem_danh')
                            }}
                          >
                            Bỏ đánh dấu
                          </Button>
                        ) : null}
                      </Flex>

                      {buoi.trangThai !== 'chua_diem_danh' && daSua ? (
                        <Typography.Text type="warning" style={{ fontSize: 12 }}>
                          Buổi này đã điểm danh trước đó — lưu sẽ ghi một dòng nhật ký sửa đổi
                          {buoi.nguoiDiemDanh
                            ? ` (${buoi.nguoiDiemDanh}, ${thoiDiemDiaPhuong(buoi.thoiDiemDiemDanhUtc)})`
                            : ''}
                          .
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
            <Typography.Text type={soThayDoi > 0 ? undefined : 'secondary'}>
              {soThayDoi > 0 ? `${soThayDoi} buổi sửa chưa lưu` : 'Không có thay đổi nào chưa lưu'}
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
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'tong-hop',
              label: (
                <Typography.Text type="secondary">
                  Tổng hợp {cheDo === 'tuan' ? 'tuần' : 'khoảng'} · {duLieu.length} buổi
                </Typography.Text>
              ),
              children: (
                <Flex vertical gap={16}>
                  <div>
                    <Typography.Text strong>Theo học sinh</Typography.Text>
                    <Table<TongHopDiemDanh>
                      size="small"
                      rowKey="id"
                      pagination={false}
                      columns={cotTongHop}
                      dataSource={buoiHoc.data?.tongHopTheoHocSinh ?? []}
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
