import { App, Button, Layout, Menu, Space, Tag, Typography } from 'antd'
import { BookOutlined, CalendarOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { env } from '../../config/env'
import { usePhienHocSinh } from './hocSinhSession'

const { Header, Content, Footer } = Layout

const NAM_HIEN_TAI = new Date().getFullYear()

const muc: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: '/hoc-sinh', label: 'Bài tập của em', icon: <BookOutlined /> },
  { key: '/hoc-sinh/lich-hoc', label: 'Lịch học của em', icon: <CalendarOutlined /> },
]

/**
 * Khung trang của học sinh: chỉ hai mục — bài tập và lịch học. Không có menu quản trị, không có
 * liên kết nào sang phần của giáo viên.
 */
export function HocSinhLayout() {
  const { hocSinh, dangXuat } = usePhienHocSinh()
  const viTri = useLocation()
  const dieuHuong = useNavigate()
  const { message } = App.useApp()

  const dangMo = viTri.pathname.startsWith('/hoc-sinh/lich-hoc') ? '/hoc-sinh/lich-hoc' : '/hoc-sinh'

  const thoat = async () => {
    await dangXuat()
    message.success('Đã đăng xuất')
    dieuHuong('/hoc-sinh/dang-nhap', { replace: true })
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 20px',
        }}
      >
        <Typography.Text strong>{env.appName}</Typography.Text>
        <Tag icon={<UserOutlined />} color="blue">
          {hocSinh?.maHocSinh ?? 'Học sinh'}
        </Tag>
        <Typography.Text strong>{hocSinh?.hoTen}</Typography.Text>

        <Space style={{ marginLeft: 'auto' }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {hocSinh?.lop ? 'Lớp ' + hocSinh.lop + ' · ' : ''}GV {hocSinh?.tenGiaoVien}
          </Typography.Text>
          <Button icon={<LogoutOutlined />} onClick={() => void thoat()}>
            Đăng xuất
          </Button>
        </Space>
      </Header>

      <Menu
        mode="horizontal"
        selectedKeys={[dangMo]}
        items={muc.map((x) => ({ key: x.key, label: x.label, icon: x.icon }))}
        onClick={({ key }) => {
          dieuHuong(key)
        }}
        style={{ paddingInline: 20 }}
      />

      <Content style={{ margin: 20 }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid #EFF4FA',
            borderRadius: 14,
            padding: 24,
            minHeight: '100%',
          }}
        >
          <Outlet />
        </div>
      </Content>

      <Footer style={{ textAlign: 'center', padding: '12px 16px' }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {env.appName} © {NAM_HIEN_TAI}
        </Typography.Text>
      </Footer>
    </Layout>
  )
}
