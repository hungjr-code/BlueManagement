import { useEffect, useState } from 'react'
import { Alert, App, DatePicker, Form, Input, Modal, Select, Typography, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import { useDanhSachHocSinh } from '../../api/students'
import { useGuiTaiLieu } from '../../api/taiLieu'
import { ApiError } from '../../api/http'

interface Props {
  open: boolean
  onClose: () => void
  /** Gắn tài liệu vào một buổi học cụ thể (mở từ chi tiết buổi). */
  buoiHocId?: string | null
  /** Khoá luôn học sinh nhận bài (mở từ chi tiết buổi của một em). */
  hocSinhMacDinh?: { id: string; ten: string } | null
  /** Mô tả buổi để giáo viên biết mình đang giao bài cho buổi nào. */
  moTaBuoi?: string | null
}

interface BieuMau {
  hocSinhId: string
  tieuDe?: string
  hanNop?: dayjs.Dayjs | null
  ghiChu?: string
}

/**
 * Gửi tài liệu cho học sinh: tệp được đẩy lên Google Drive CỦA CHÍNH GIÁO VIÊN (quyền drive.file),
 * còn học sinh tải qua app — tệp không mở công khai, không lộ link cho người ngoài.
 */
export function GuiTaiLieuModal({ open, onClose, buoiHocId, hocSinhMacDinh, moTaBuoi }: Props) {
  const { message } = App.useApp()
  const [bieuMau] = Form.useForm<BieuMau>()
  const [danhSachTep, datDanhSachTep] = useState<UploadFile[]>([])
  const [loi, datLoi] = useState<string | null>(null)

  const hocSinh = useDanhSachHocSinh({ kichThuoc: 200 })
  const gui = useGuiTaiLieu()

  useEffect(() => {
    if (!open) return
    bieuMau.resetFields()
    datDanhSachTep([])
    datLoi(null)
    if (hocSinhMacDinh) bieuMau.setFieldValue('hocSinhId', hocSinhMacDinh.id)
  }, [open, hocSinhMacDinh, bieuMau])

  const guiDi = async (giaTri: BieuMau) => {
    const tep = danhSachTep[0]?.originFileObj

    if (!tep) {
      datLoi('Chọn một tệp để gửi.')
      return
    }

    try {
      const ketQua = await gui.mutateAsync({
        tep,
        hocSinhId: giaTri.hocSinhId,
        buoiHocId: buoiHocId ?? null,
        tieuDe: giaTri.tieuDe ?? null,
        hanNop: giaTri.hanNop ? giaTri.hanNop.format('YYYY-MM-DD') : null,
        ghiChu: giaTri.ghiChu ?? null,
      })

      message.success(
        `Đã gửi "${ketQua.tieuDe}" cho ${ketQua.tenHocSinh}. Nhớ bấm Đồng bộ lại để lịch Google hiện bài tập.`,
      )
      onClose()
    } catch (error) {
      datLoi(
        error instanceof ApiError
          ? error.fieldMessages.join(' · ') || error.problem?.detail || error.message
          : 'Không gửi được tài liệu',
      )
    }
  }

  return (
    <Modal
      open={open}
      title={buoiHocId ? 'Gửi tài liệu cho buổi học' : 'Gửi tài liệu cho học sinh'}
      okText="Gửi"
      cancelText="Huỷ"
      width={560}
      confirmLoading={gui.isPending}
      onCancel={onClose}
      onOk={() => {
        void bieuMau.submit()
      }}
      destroyOnHidden
    >
      {moTaBuoi ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {moTaBuoi}
        </Typography.Paragraph>
      ) : null}

      {loi ? <Alert type="error" showIcon message={loi} style={{ marginBottom: 12 }} /> : null}

      <Form<BieuMau>
        form={bieuMau}
        layout="vertical"
        onFinish={(giaTri) => {
          void guiDi(giaTri)
        }}
      >
        <Form.Item label="Học sinh nhận bài" name="hocSinhId" rules={[{ required: true, message: 'Chọn học sinh' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn học sinh"
            loading={hocSinh.isPending}
            disabled={Boolean(hocSinhMacDinh)}
            options={(hocSinh.data?.duLieu ?? []).map((em) => ({
              value: em.id,
              label: em.hoTen + (em.lop ? ` — ${em.lop}` : ''),
            }))}
          />
        </Form.Item>

        <Form.Item label="Tệp" required>
          <Upload.Dragger
            maxCount={1}
            multiple={false}
            fileList={danhSachTep}
            // Không để antd tự gọi API: tệp được gửi kèm các trường khác trong một request multipart.
            beforeUpload={() => false}
            onChange={({ fileList }) => {
              datDanhSachTep(fileList.slice(-1))
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Kéo tệp vào đây hoặc bấm để chọn</p>
            <p className="ant-upload-hint">
              PDF, Word, PowerPoint, Excel, ảnh hoặc zip — tối đa 25MB. Tệp nằm trên Drive của bạn,
              học sinh tải qua app.
            </p>
          </Upload.Dragger>
        </Form.Item>

        <Form.Item label="Tiêu đề bài tập" name="tieuDe" extra="Bỏ trống thì lấy theo tên tệp.">
          <Input placeholder="Ví dụ: Đề ôn tập tuần này" maxLength={200} />
        </Form.Item>

        <Form.Item label="Hạn nộp" name="hanNop" extra="Bỏ trống nghĩa là không đặt hạn.">
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item label="Ghi chú cho học sinh" name="ghiChu">
          <Input.TextArea rows={2} maxLength={1000} placeholder="Ví dụ: làm trước buổi sau" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
