import { useState } from 'react'
import type { ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Breadcrumb, Button, Dropdown, Layout, Menu, Space, Tag, Typography, theme } from 'antd'
import {
  AppstoreOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  HistoryOutlined,
  IdcardOutlined,
  KeyOutlined,
  LockOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { env } from '../config/env'
import { usePhien } from './session'
import { DoiMatKhauModal } from '../features/auth/DoiMatKhauModal'

const { Header, Sider, Content, Footer } = Layout

interface NavItem {
  /** key PHẢI trùng với path của route, để menu và router không bị lệch nhau. */
  key: string
  label: string
  icon: ReactNode
  /** Chỉ admin thấy mục này. Giấu ở menu chỉ cho gọn mắt — backend vẫn chặn thật. */
  chiAdmin?: boolean
}

function taoNavItems(laAdmin: boolean): NavItem[] {
  return [
    { key: '/', label: 'Tổng quan', icon: <AppstoreOutlined /> },
    { key: '/schedule', label: 'Lịch dạy', icon: <CalendarOutlined /> },
    { key: '/students', label: 'Học sinh', icon: <UserOutlined /> },
    { key: '/attendance', label: 'Điểm danh', icon: <CheckSquareOutlined /> },
    { key: '/tuition', label: 'Học phí', icon: <WalletOutlined /> },
  { key: '/tai-lieu', label: 'Tài liệu', icon: <FileTextOutlined /> },
    { key: '/teachers', label: laAdmin ? 'Giáo viên' : 'Hồ sơ & Thu nhập', icon: <IdcardOutlined /> },
    { key: '/nhat-ky', label: 'Nhật ký', icon: <HistoryOutlined /> },
    { key: '/settings', label: 'Cài đặt', icon: <SettingOutlined /> },
  ]
}

const tenVaiTro: Record<string, string> = {
  admin: 'Chủ trung tâm',
  giao_vien: 'Giáo viên',
}

const NAM_HIEN_TAI = new Date().getFullYear()

/**
 * Chọn menu item đang mở theo URL: khớp tiền tố dài nhất, để /classes/123 vẫn sáng "Lớp học".
 * Trả về chuỗi rỗng khi URL không thuộc menu nào (ví dụ trang 404) để không sáng nhầm mục nào.
 */
function resolveSelectedKey(pathname: string, items: NavItem[]): string {
  if (pathname === '/') return '/'
  const matches = items
    .filter((item) => item.key !== '/' && pathname.startsWith(item.key))
    .sort((a, b) => b.key.length - a.key.length)
  return matches[0]?.key ?? ''
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [moDoiMatKhau, setMoDoiMatKhau] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const { nguoiDung, dangXuat } = usePhien()

  const laAdmin = nguoiDung?.vaiTro === 'admin'
  const itemsHienThi = taoNavItems(laAdmin)

  const selectedKey = resolveSelectedKey(location.pathname, itemsHienThi)
  const pageTitle = itemsHienThi.find((item) => item.key === selectedKey)?.label ?? 'Không tìm thấy trang'

  const thoat = async () => {
    await dangXuat()
    navigate('/login', { replace: true })
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sider nền sáng + viền mảnh tối giản */}
      <Sider
        theme="light"
        width={220}
        collapsible
        collapsed={collapsed}
        trigger={null}
        style={{ borderRight: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}
      >
        <div className="app-logo" title={env.appName}>
          <span className="app-logo-icon">
            <CalendarOutlined />
          </span>
          {!collapsed && <span className="app-logo-text">{env.appName}</span>}
        </div>

        <Menu
          theme="light"
          mode="inline"
          style={{ borderInlineEnd: 0, marginTop: 8 }}
          selectedKeys={[selectedKey]}
          items={itemsHienThi.map((item) => ({
            key: item.key,
            label: item.label,
            icon: item.icon,
          }))}
          onClick={({ key }) => {
            navigate(key)
          }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: token.colorBgContainer,
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Button
            type="text"
            aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => {
              setCollapsed((value) => !value)
            }}
          />

          <Breadcrumb
            items={
              selectedKey === '/'
                ? [{ title: 'Tổng quan' }]
                : [{ title: 'Trang chủ' }, { title: pageTitle }]
            }
          />

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tag icon={<LockOutlined />} color={laAdmin ? 'purple' : 'blue'}>
              {nguoiDung ? tenVaiTro[nguoiDung.vaiTro] : '—'}
            </Tag>
            <Typography.Text strong>{nguoiDung?.hoTen ?? '—'}</Typography.Text>

            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'thong-tin',
                    label: nguoiDung?.email ?? '',
                    disabled: true,
                  },
                  { type: 'divider' },
                  { key: 'doi-mat-khau', icon: <KeyOutlined />, label: 'Đổi mật khẩu' },
                  { key: 'dang-xuat', icon: <LogoutOutlined />, label: 'Đăng xuất' },
                ],
                onClick: ({ key }) => {
                  if (key === 'doi-mat-khau') setMoDoiMatKhau(true)
                  if (key === 'dang-xuat') void thoat()
                },
              }}
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  style={{ backgroundColor: '#EDF4FD', color: '#4377D9' }}
                  icon={<UserOutlined />}
                />
              </Space>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ margin: 20 }}>
          <div
            style={{
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
              padding: 24,
              minHeight: '100%',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
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

      <DoiMatKhauModal
        open={moDoiMatKhau}
        onClose={() => {
          setMoDoiMatKhau(false)
        }}
      />
    </Layout>
  )
}
