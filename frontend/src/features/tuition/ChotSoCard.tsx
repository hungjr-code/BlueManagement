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
import { LoiApiAlert } from '../../components/LoiApiAlert'

interface ChotSoCardProps {
  thang: number
  nam: number
}

interface GiaTriMoChotSo {
  lyDo: string
}

/**
 * Chốt sổ và mở chốt sổ kỳ học phí.
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
          Chỉ dành cho Admin
        </Typography.Text>
      }
    >
      <Flex vertical gap={12}>
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
                <Descriptions.Item label="Số học sinh">{canhBao.soDongHocPhi}</Descriptions.Item>
                <Descriptions.Item label="Tổng phải thu">
                  {formatVnd(canhBao.tongPhaiThu)}
                </Descriptions.Item>
                <Descriptions.Item label="Tổng đã thu">{formatVnd(canhBao.tongDaThu)}</Descriptions.Item>
                <Descriptions.Item label="Tổng còn lại">
                  <Typography.Text type={canhBao.tongConLai > 0 ? 'danger' : undefined}>
                    {formatVnd(canhBao.tongConLai)}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Chưa tính tiền">
                  {canhBao.soHocSinhChuaTinhTien}
                </Descriptions.Item>
              </Descriptions>

              {coCanhBao ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Còn buổi học chưa điểm danh trong kỳ"
                  description={
                    <Flex vertical gap={8}>
                      {canhBao.chuaDiemDanh.length > 0 ? (
                        <List
                          size="small"
                          dataSource={canhBao.chuaDiemDanh}
                          renderItem={(muc) => (
                            <List.Item>
                              {muc.tenHocSinh} — {muc.soBuoiChuaDiemDanh} buổi chưa điểm danh
                            </List.Item>
                          )}
                        />
                      ) : null}
                    </Flex>
                  }
                />
              ) : (
                <Alert
                  type="success"
                  showIcon
                  message="Kỳ này đã điểm danh đầy đủ và sẵn sàng chốt sổ"
                />
              )}

              {coCanhBao ? (
                <Checkbox
                  checked={daTich}
                  onChange={(suKien) => {
                    datDaTich(suKien.target.checked)
                  }}
                >
                  Tôi hiểu và vẫn muốn chốt sổ
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
              </Space>
            </Flex>
          )
        ) : null}
      </Flex>

      <Modal
        open={moMoChotSo}
        title={`Mở chốt sổ ${moTaKy(thang, nam)}`}
        footer={null}
        width={480}
        onCancel={() => {
          form.resetFields()
          datLoiMoChotSo(null)
          datMoMoChotSo(false)
        }}
      >
        <Flex vertical gap={12}>
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
                      return Promise.reject(new Error('Vui lòng nhập lý do mở lại sổ'))
                    }
                    return Promise.resolve()
                  },
                },
              ]}
            >
              <Input.TextArea
                rows={3}
                maxLength={500}
                placeholder="Nhập lý do mở lại sổ đã chốt"
              />
            </Form.Item>

            <Flex justify="end" gap={8}>
              <Button
                onClick={() => {
                  form.resetFields()
                  datMoMoChotSo(false)
                }}
              >
                Huỷ
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
