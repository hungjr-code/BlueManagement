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

// Toàn bộ ngày tháng trong app hiển thị theo tiếng Việt (dd/MM/yyyy).
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
          // Tối giản: giao diện gần như đơn sắc (mực đen + xám rất nhạt + viền mảnh), màu sắc để dành
          // cho DỮ LIỆU — mỗi học sinh một màu trên ô lịch. Nền tảng xám nhạt, không đổ bóng nặng.
          colorPrimary: '#111827',
          colorLink: '#2563eb',
          colorBgLayout: '#fafafa',
          colorBorderSecondary: '#efefef',
          borderRadius: 8,
          controlHeight: 34,
          wireframe: false,
          boxShadowSecondary: '0 2px 10px rgba(15, 23, 42, 0.06)',
        },
        components: {
          Layout: { headerBg: '#ffffff', bodyBg: '#fafafa', headerHeight: 56 },
          Menu: {
            itemSelectedBg: '#f4f4f5',
            itemSelectedColor: '#111827',
            itemHeight: 38,
          },
          Table: { headerBg: '#fcfcfc', headerSplitColor: 'transparent' },
        },
      }}
    >
      {/* AntApp cấp context cho message/notification/modal dùng qua hook.
          Không dùng static method (message.success...) vì nó bỏ qua theme và locale ở trên. */}
      <AntApp>
        <QueryClientProvider client={queryClient}>
          {/* SessionProvider nằm ngoài RouterProvider: nó chỉ nói ai đang đăng nhập,
              còn việc điều hướng khi hết phiên do RequireAuth lo. */}
          <SessionProvider>
            <RouterProvider router={router} />
          </SessionProvider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
