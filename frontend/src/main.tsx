import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { App as AntApp, ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import { queryClient } from './api/queryClient'
import { router } from './app/router'
import { SessionProvider } from './app/session'
import './index.css'

dayjs.locale('vi')

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Không tìm thấy phần tử #root trong index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          // Phong cách tối giản (Minimalism) với tone màu chủ đạo là Xanh Pastel (Blue Pastel)
          colorPrimary: '#5B8DEF',
          colorPrimaryHover: '#719DF2',
          colorPrimaryActive: '#4377D9',
          colorPrimaryBg: '#F0F5FD',
          colorPrimaryBgHover: '#E4EEFA',
          colorPrimaryBorder: '#C9DEF8',
          colorPrimaryBorderHover: '#A8CBF4',

          colorLink: '#457FD9',
          colorLinkHover: '#6B9EF0',

          colorBgLayout: '#F8FAFD',
          colorBgContainer: '#FFFFFF',
          colorBorder: '#E6EDF5',
          colorBorderSecondary: '#EFF4FA',

          colorText: '#1E293B',
          colorTextSecondary: '#64748B',
          colorTextTertiary: '#94A3B8',

          borderRadius: 10,
          borderRadiusLG: 14,
          borderRadiusSM: 6,
          controlHeight: 36,
          wireframe: false,
          boxShadowSecondary: '0 4px 20px -2px rgba(91, 141, 239, 0.08)',
          boxShadowTertiary: '0 2px 8px rgba(0, 0, 0, 0.04)',
        },
        components: {
          Layout: {
            headerBg: '#FFFFFF',
            bodyBg: '#F8FAFD',
            siderBg: '#FFFFFF',
            headerHeight: 58,
          },
          Menu: {
            itemSelectedBg: '#EDF4FD',
            itemSelectedColor: '#3669C9',
            itemHoverBg: '#F4F8FE',
            itemColor: '#475569',
            itemHeight: 40,
            itemBorderRadius: 8,
            itemMarginInline: 8,
          },
          Card: {
            colorBorderSecondary: '#EBF1F7',
            headerFontSize: 15,
            borderRadiusLG: 14,
            boxShadowTertiary: '0 1px 3px rgba(0, 0, 0, 0.02)',
            paddingLG: 20,
          },
          Table: {
            headerBg: '#F8FAFC',
            headerColor: '#64748B',
            headerSplitColor: 'transparent',
            rowHoverBg: '#F4F8FD',
            borderColor: '#EFF4FA',
            borderRadius: 10,
          },
          Button: {
            borderRadius: 8,
            controlHeight: 36,
            primaryShadow: '0 2px 8px rgba(91, 141, 239, 0.22)',
          },
          Tag: {
            borderRadius: 6,
          },
          Input: {
            borderRadius: 8,
            activeBorderColor: '#5B8DEF',
            hoverBorderColor: '#8DB3F4',
          },
          Select: {
            borderRadius: 8,
          },
          Segmented: {
            itemSelectedBg: '#FFFFFF',
            itemSelectedColor: '#2757B8',
            trackBg: '#EFF4FA',
            borderRadius: 8,
          },
          Alert: {
            borderRadiusLG: 10,
          },
          Modal: {
            borderRadiusLG: 14,
          },
          Drawer: {
            borderRadiusLG: 14,
          },
        },
      }}
    >
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <RouterProvider router={router} />
          </SessionProvider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
