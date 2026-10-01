import { Button, Result } from 'antd'
import { Link, useRouteError } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="404"
      subTitle="Không có trang này. Có thể đường dẫn bị gõ sai."
      extra={
        <Link to="/">
          <Button type="primary">Về trang tổng quan</Button>
        </Link>
      }
    />
  )
}

/**
 * Route errorElement: hứng lỗi render hoặc lỗi tải dữ liệu của cả nhánh route.
 * Không có nó thì React Router hiện màn hình lỗi mặc định khó đọc.
 */
export function RouteErrorPage() {
  const error = useRouteError()

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Lỗi không xác định'

  return (
    <div style={{ padding: 24 }}>
      <Result
        status="500"
        title="Màn hình gặp lỗi"
        subTitle={message}
        extra={[
          <Button
            key="reload"
            type="primary"
            onClick={() => {
              window.location.reload()
            }}
          >
            Tải lại trang
          </Button>,
          <Link key="home" to="/">
            <Button>Về trang tổng quan</Button>
          </Link>,
        ]}
      />
    </div>
  )
}
