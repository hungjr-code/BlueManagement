// File cấu hình route: các hằng lazy() ở đây bị rule fast-refresh báo nhầm,
// vì chúng không phải component được render trực tiếp mà chỉ nằm trong router config.
// oxlint-disable react/only-export-components
import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Spin } from 'antd'
import { AppLayout } from './AppLayout'
import { RequireAuth } from './session'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { NotFoundPage, RouteErrorPage } from '../features/errors/ErrorPages'

/**
 * Tách gói theo route (lazy): chỉ tải code của màn hình người dùng thực sự mở.
 * Tổng quan và Đăng nhập giữ eager vì ai cũng phải đi qua.
 */
const LoginPage = lazy(async () => {
  const module = await import('../features/auth/LoginPage')
  return { default: module.LoginPage }
})
const RegisterPage = lazy(async () => {
  const module = await import('../features/auth/RegisterPage')
  return { default: module.RegisterPage }
})
const ForgotPasswordPage = lazy(async () => {
  const module = await import('../features/auth/ForgotPasswordPage')
  return { default: module.ForgotPasswordPage }
})
const ResetPasswordPage = lazy(async () => {
  const module = await import('../features/auth/ResetPasswordPage')
  return { default: module.ResetPasswordPage }
})
const SchedulePage = lazy(async () => {
  const module = await import('../features/schedule/SchedulePage')
  return { default: module.SchedulePage }
})
const StudentsPage = lazy(async () => {
  const module = await import('../features/students/StudentsPage')
  return { default: module.StudentsPage }
})
const AttendancePage = lazy(async () => {
  const module = await import('../features/attendance/AttendancePage')
  return { default: module.AttendancePage }
})
const TuitionPage = lazy(async () => {
  const module = await import('../features/tuition/TuitionPage')
  return { default: module.TuitionPage }
})
const TeachersPage = lazy(async () => {
  const module = await import('../features/teachers/TeachersPage')
  return { default: module.TeachersPage }
})
const SettingsPage = lazy(async () => {
  const module = await import('../features/settings/SettingsPage')
  return { default: module.SettingsPage }
})
const NhatKyPage = lazy(async () => {
  const module = await import('../features/nhatKy/NhatKyPage')
  return { default: module.NhatKyPage }
})

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <Spin size="large" tip="Đang tải màn hình…">
        <div style={{ width: 160, height: 48 }} />
      </Spin>
    </div>
  )
}

/** Bọc Suspense cho một màn hình lazy. */
function lazyPage(element: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>
}

/**
 * Mọi màn hình nghiệp vụ đều nằm trong AppLayout (menu trái + header) và đều phải đăng nhập:
 * RequireAuth đứng trên AppLayout nên chưa có phiên thì cả nhánh này không render.
 *
 * Thêm màn hình mới = thêm 1 dòng ở đây và 1 mục trong navItems của AppLayout.
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: lazyPage(<LoginPage />),
  },
  {
    path: '/dang-ky',
    element: lazyPage(<RegisterPage />),
  },
  {
    path: '/quen-mat-khau',
    element: lazyPage(<ForgotPasswordPage />),
  },
  {
    // Liên kết trong thư đặt lại mật khẩu trỏ về đây kèm ?token=...
    path: '/dat-lai-mat-khau',
    element: lazyPage(<ResetPasswordPage />),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    // Bắt lỗi render/tải dữ liệu của cả nhánh, tránh màn hình trắng.
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'schedule', element: lazyPage(<SchedulePage />) },
      { path: 'students', element: lazyPage(<StudentsPage />) },
      { path: 'attendance', element: lazyPage(<AttendancePage />) },
      { path: 'tuition', element: lazyPage(<TuitionPage />) },
      { path: 'teachers', element: lazyPage(<TeachersPage />) },
      { path: 'nhat-ky', element: lazyPage(<NhatKyPage />) },
      { path: 'settings', element: lazyPage(<SettingsPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
