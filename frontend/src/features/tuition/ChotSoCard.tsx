import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Flex,
  Form,
  Input,
  List,
  Modal,
  Skeleton,
  Space,
  Typography,
} from 'antd'
import { CheckCircleOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons'
import { useChotSoHocPhi, useMoChotSoHocPhi, useXemTruocChotSo } from '../../api/tuition'
import { formatVnd } from '../../lib/money'
import { moTaKy } from './hienThi'
import { LoiApiAlert } from './LoiApiAlert'

interface ChotSoCardProps {
  thang: number
  nam: number
}

interface GiaTriMoChotSo {
  lyDo: string
}

/**
 * Chốt sổ / mở chốt sổ — chỉ admin.
 *
 * Chốt sổ là KHOÁ con số của kỳ: lần "tính học phí" sau bỏ qua các dòng đã chốt, nên chốt trên con số
 * thiếu là tự lừa mình. Vì vậy phải xem trước: còn buổi chưa điểm danh thì người dùng phải tự tích
 * "tôi hiểu" rồi mới gửi `boQuaCanhBao: true` — giao diện không bật hộ.
 */
export function ChotSoCard({ thang, nam }: ChotSoCardProps) {
  const { message } = App.useApp()
  const [dangXem, datDangXem] = useState(false)
  const [daTich, datDaTich] = useState(false)
  const [loi, datLoi] = useState<unknown>(null)
  const [moMoChotSo, datMoMoChotSo] = useState(false)
  const [loiMoChotSo, datLoiMoChotSo] = useState<unknown>(null)
  const [form] = Form.useForm<GiaTriMoChotSo>()

  const xemTruoc = useXemTruocChotSo({ thang, nam }, dangXem)
  const chotSo = useChotSoHocPhi()
  const moChot = useMoChotSoHocPhi()

  // Đổi kỳ thì màn hình gắn `key` mới cho component này, nên trạng thái (đang xem trước, đã tích, lỗi)
  // tự về mặc định — không cần effect dọn tay sau mỗi lần đổi tháng/năm.

  const canhBao = xemTruoc.data
  const coCanhBao = canhBao?.coCanhBao ?? false

  const chayChotSo = async () => {
    datLoi(null)
    try {
      const ketQua = await chotSo.mutateAsync({ thang, nam, boQuaCanhBao: coCanhBao && daTich })
      message.success(
        `Đã chốt sổ ${moTaKy(thang, nam)}: ${ketQua.soDong} dòng, phải thu ${formatVnd(
          ketQua.tongPhaiThu,
        )}, đã thu ${formatVnd(ketQua.tongDaThu)}`,
      )
      datDaTich(false)
      void xemTruoc.refetch()
    } catch (error) {
      datLoi(error)
    }
  }

  const chayMoChotSo = async (giaTri: GiaTriMoChotSo) => {
    datLoiMoChotSo(null)
    try {
      const ketQua = await moChot.mutateAsync({ thang, nam, lyDo: giaTri.lyDo.trim() })
      message.success(`Đã mở chốt sổ ${moTaKy(thang, nam)} cho ${ketQua.soDong} dòng`)
      form.resetFields()
      datMoMoChotSo(false)
      void xemTruoc.refetch()
    } catch (error) {
      datLoiMoChotSo(error)
    }
  }

  return (
    <Card
      size="small"
      title="Chốt sổ kỳ"
      extra={
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Chỉ admin
        </Typography.Text>
      }
    >
      <Flex vertical gap={12}>
        <Alert
          type="info"
          showIcon
          message="Chốt sổ khoá con số của kỳ lại"
          description="Sau khi chốt, lần “Tính học phí kỳ này” bỏ qua các dòng đã chốt nên sổ giữ đúng con số đã chốt. Mở lại là việc của admin và bắt buộc nêu lý do (số liệu trước khi mở được lưu vào nhật ký)."
        />

        <Space wrap>
          <Button
            type="primary"
            icon={<LockOutlined />}
            loading={xemTruoc.isFetching && dangXem}
            onClick={() => {
              datDangXem(true)
              datDaTich(false)
              datLoi(null)
              void xemTruoc.refetch()
            }}
          >
            Xem trước &amp; chốt sổ
          </Button>
          <Button
            icon={<UnlockOutlined />}
            onClick={() => {
              datLoiMoChotSo(null)
              datMoMoChotSo(true)
            }}
          >
            Mở chốt sổ
          </Button>
        </Space>

        {dangXem ? (
          xemTruoc.isError ? (
            <LoiApiAlert
              error={xemTruoc.error}
              tieuDe="Không xem trước được kỳ này"
              onThuLai={() => {
                void xemTruoc.refetch()
              }}
            />
          ) : !canhBao ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : (
            <Flex vertical gap={12}>
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="Kỳ">{moTaKy(canhBao.thang, canhBao.nam)}</Descriptions.Item>
                <Descriptions.Item label="Số dòng học phí">{canhBao.soDongHocPhi}</Descriptions.Item>
                <Descriptions.Item label="Tổng phải thu">
                  {formatVnd(canhBao.tongPhaiThu)}
                </Descriptions.Item>
                <Descriptions.Item label="Tổng đã thu">{formatVnd(canhBao.tongDaThu)}</Descriptions.Item>
                <Descriptions.Item label="Tổng còn lại">
                  <Typography.Text type={canhBao.tongConLai > 0 ? 'danger' : undefined}>
                    {formatVnd(canhBao.tongConLai)}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Học sinh chưa được tính tiền">
                  {canhBao.soHocSinhChuaTinhTien}
                </Descriptions.Item>
              </Descriptions>

              {coCanhBao ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Kỳ này còn việc chưa xong — chốt lúc này là chốt trên con số thiếu"
                  description={
                    <Flex vertical gap={8}>
                      {canhBao.chuaDiemDanh.length > 0 ? (
                        <Flex vertical gap={4}>
                          <Typography.Text>
                            Còn {canhBao.chuaDiemDanh.length} học sinh có buổi chưa điểm danh (buổi đã
                            qua ngày hôm nay):
                          </Typography.Text>
                          <List
                            size="small"
                            dataSource={canhBao.chuaDiemDanh}
                            renderItem={(muc) => (
                              <List.Item>
                                {muc.tenHocSinh} — {muc.soBuoiChuaDiemDanh} buổi
                              </List.Item>
                            )}
                          />
                        </Flex>
                      ) : null}
                      {canhBao.soHocSinhChuaTinhTien > 0 ? (
                        <Typography.Text>
                          Và {canhBao.soHocSinhChuaTinhTien} học sinh có buổi trong kỳ nhưng chưa được
                          tính tiền — bấm “Tính học phí kỳ này” trước cho đủ dòng.
                        </Typography.Text>
                      ) : null}
                    </Flex>
                  }
                />
              ) : (
                <Alert
                  type="success"
                  showIcon
                  message="Kỳ này đã điểm danh đủ và mọi học sinh có buổi đều đã được tính tiền"
                  description="Chốt được ngay. Con số dưới đây sẽ là con số của sổ."
                />
              )}

              {coCanhBao ? (
                <Checkbox
                  checked={daTich}
                  onChange={(suKien) => {
                    datDaTich(suKien.target.checked)
                  }}
                >
                  Tôi hiểu và vẫn chốt (bỏ qua cảnh báo chưa điểm danh — việc này được ghi vào nhật ký)
                </Checkbox>
              ) : null}

              {loi ? <LoiApiAlert error={loi} tieuDe="Không chốt được sổ" /> : null}

              <Space>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={chotSo.isPending}
                  disabled={coCanhBao && !daTich}
                  onClick={() => {
                    void chayChotSo()
                  }}
                >
                  Chốt sổ {moTaKy(thang, nam)}
                </Button>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {canhBao.soDongHocPhi === 0
                    ? 'Kỳ này chưa có dòng học phí nào — chốt sẽ báo lỗi, hãy tính học phí trước.'
                    : 'Sau khi chốt, muốn tính lại phải mở chốt sổ trước.'}
                </Typography.Text>
              </Space>
            </Flex>
          )
        ) : null}
      </Flex>

      <Modal
        open={moMoChotSo}
        title={`Mở chốt sổ ${moTaKy(thang, nam)}`}
        footer={null}
        width={520}
        onCancel={() => {
          form.resetFields()
          datLoiMoChotSo(null)
          datMoMoChotSo(false)
        }}
      >
        <Flex vertical gap={12}>
          <Alert
            type="warning"
            showIcon
            message="Mở chốt sổ là mở khoá con số đã chốt của cả kỳ"
            description="Số liệu của kỳ trước khi mở được lưu vào nhật ký kèm lý do này, và lần tính học phí sau sẽ ghi đè con số đã chốt."
          />

          {loiMoChotSo ? <LoiApiAlert error={loiMoChotSo} tieuDe="Không mở được chốt sổ" /> : null}

          <Form<GiaTriMoChotSo>
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={(giaTri) => {
              void chayMoChotSo(giaTri)
            }}
          >
            <Form.Item
              label="Lý do mở chốt sổ"
              name="lyDo"
              rules={[
                {
                  validator(_: unknown, giaTri: string | undefined) {
                    if (!giaTri || giaTri.trim().length === 0) {
                      return Promise.reject(new Error('Phải ghi lý do mở lại sổ đã chốt'))
                    }
                    return Promise.resolve()
                  },
                },
              ]}
            >
              <Input.TextArea
                rows={3}
                maxLength={500}
                showCount
                placeholder="Ví dụ: chưa điểm danh buổi 28/09 nên học phí thiếu, cần tính lại"
              />
            </Form.Item>

            <Flex justify="end" gap={8}>
              <Button
                onClick={() => {
                  form.resetFields()
                  datMoMoChotSo(false)
                }}
              >
                Để sau
              </Button>
              <Button type="primary" htmlType="submit" loading={moChot.isPending}>
                Mở chốt sổ
              </Button>
            </Flex>
          </Form>
        </Flex>
      </Modal>
    </Card>
  )
}
