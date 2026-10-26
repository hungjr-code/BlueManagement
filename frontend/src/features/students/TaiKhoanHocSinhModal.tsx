import { useEffect, useState } from 'react'
import { Alert, App, Button, Descriptions, Flex, Input, Modal, Popconfirm, Space, Tag, Typography } from 'antd'
import { KeyOutlined, StopOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { http } from '../../api/http'
import { ApiError } from '../../api/http'
import type { HocSinh } from '../../api/types'

interface TaiKhoanHocSinh {
  hocSinhId: string
  hoTen: string
  maHocSinh: string | null
  coMatKhau: boolean
  lanDangNhapCuoiUtc: string | null
  soPhienDangMo: number
}

interface CapTaiKhoan {
  hocSinhId: string
  hoTen: string
  maHocSinh: string
  matKhauTam: string
  ghiChu: string
}

interface Props {
  hocSinh: HocSinh | null
  onClose: () => void
}

/**
 * Cấp / đặt lại / thu hồi tài khoản đăng nhập của một học sinh.
 *
 * Mật khẩu tạm chỉ hiện ĐÚNG MỘT LẦN (máy chủ chỉ lưu bản băm), nên màn hình này nói rõ điều đó và
 * không cố tải lại mật khẩu cũ.
 */
export function TaiKhoanHocSinhModal({ hocSinh, onClose }: Props) {
  const { message } = App.useApp()
  const [trangThai, datTrangThai] = useState<TaiKhoanHocSinh | null>(null)
  const [vuaCap, datVuaCap] = useState<CapTaiKhoan | null>(null)
  const [maMongMuon, datMaMongMuon] = useState('')
  const [matKhauMongMuon, datMatKhauMongMuon] = useState('')
  const [dangChay, datDangChay] = useState(false)
  const [loi, datLoi] = useState<string | null>(null)

  const mo = hocSinh !== null

  useEffect(() => {
    if (!hocSinh) return

    datVuaCap(null)
    datLoi(null)
    datMaMongMuon(hocSinh.maHocSinh ?? '')
    datMatKhauMongMuon('')
    datTrangThai(null)
    datDangChay(true)

    void http
      .get<TaiKhoanHocSinh>(`/students/${hocSinh.id}/tai-khoan`)
      .then((phanHoi) => {
        datTrangThai(phanHoi.data)
      })
      .catch((error: unknown) => {
        datLoi(error instanceof ApiError ? error.problem?.detail || error.message : 'Không đọc được trạng thái')
      })
      .finally(() => {
        datDangChay(false)
      })
  }, [hocSinh])

  const capTaiKhoan = async () => {
    if (!hocSinh) return

    datDangChay(true)
    datLoi(null)

    try {
      const { data } = await http.post<CapTaiKhoan>(`/students/${hocSinh.id}/tai-khoan`, {
        maHocSinh: maMongMuon.trim() || null,
        matKhauMoi: matKhauMongMuon.trim() || null,
      })
      datVuaCap(data)
      datMatKhauMongMuon('')
      message.success('Đã cấp tài khoản cho học sinh')
    } catch (error) {
      datLoi(
        error instanceof ApiError
          ? error.fieldMessages.join(' · ') || error.problem?.detail || error.message
          : 'Không cấp được tài khoản',
      )
    } finally {
      datDangChay(false)
    }
  }

  const thuHoi = async () => {
    if (!hocSinh) return

    datDangChay(true)
    try {
      await http.delete(`/students/${hocSinh.id}/tai-khoan`)
      datVuaCap(null)
      message.success('Đã thu hồi tài khoản: học sinh không đăng nhập được nữa')
      onClose()
    } catch (error) {
      message.error(error instanceof ApiError ? error.problem?.detail || error.message : 'Không thu hồi được')
    } finally {
      datDangChay(false)
    }
  }

  return (
    <Modal
      open={mo}
      title={hocSinh ? `Tài khoản của ${hocSinh.hoTen}` : 'Tài khoản học sinh'}
      width={560}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>Đóng</Button>
          <Button type="primary" loading={dangChay} onClick={() => void capTaiKhoan()}>
            {trangThai?.coMatKhau ? 'Đặt lại mật khẩu' : 'Cấp tài khoản'}
          </Button>
        </Space>
      }
      destroyOnHidden
    >
      <Flex vertical gap={14}>
        {loi ? <Alert type="error" showIcon message={loi} /> : null}

        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="Mã đăng nhập">
            {trangThai?.maHocSinh ?? hocSinh?.maHocSinh ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Mật khẩu">
            {trangThai?.coMatKhau ? (
              <Tag color="success">Đã cấp</Tag>
            ) : (
              <Tag color="warning">Chưa cấp — em chưa đăng nhập được</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Lần đăng nhập gần nhất">
            {trangThai?.lanDangNhapCuoiUtc ? dayjs(trangThai.lanDangNhapCuoiUtc).format('DD/MM/YYYY HH:mm') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Phiên đang mở">{trangThai?.soPhienDangMo ?? 0}</Descriptions.Item>
        </Descriptions>

        {vuaCap ? (
          <Alert
            type="success"
            showIcon
            message="Đọc cho học sinh ngay — mật khẩu này chỉ hiện một lần"
            description={
              <Flex vertical gap={4}>
                <Typography.Text>
                  Mã đăng nhập: <Typography.Text strong copyable>{vuaCap.maHocSinh}</Typography.Text>
                </Typography.Text>
                <Typography.Text>
                  Mật khẩu: <Typography.Text strong copyable>{vuaCap.matKhauTam}</Typography.Text>
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {vuaCap.ghiChu}
                </Typography.Text>
              </Flex>
            }
          />
        ) : null}

        <Flex vertical gap={8}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Cấp tài khoản / đặt lại mật khẩu
          </Typography.Text>
          <Space wrap>
            <Input
              value={maMongMuon}
              onChange={(suKien) => {
                datMaMongMuon(suKien.target.value)
              }}
              placeholder="Mã học sinh (bỏ trống để tự sinh)"
              prefix={<KeyOutlined />}
              style={{ width: 250 }}
            />
            <Input.Password
              value={matKhauMongMuon}
              onChange={(suKien) => {
                datMatKhauMongMuon(suKien.target.value)
              }}
              placeholder="Mật khẩu (bỏ trống để tự sinh)"
              style={{ width: 230 }}
            />
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Đổi mã học sinh cũng được — mã cũ không còn dùng để đăng nhập.
          </Typography.Text>
        </Flex>

        {trangThai?.coMatKhau ? (
          <Popconfirm
            title="Thu hồi tài khoản?"
            description="Học sinh không đăng nhập được nữa và mọi phiên đang mở bị cắt."
            okText="Thu hồi"
            cancelText="Để nguyên"
            onConfirm={() => void thuHoi()}
          >
            <Button danger icon={<StopOutlined />} style={{ alignSelf: 'flex-start' }}>
              Thu hồi tài khoản
            </Button>
          </Popconfirm>
        ) : null}
      </Flex>
    </Modal>
  )
}
