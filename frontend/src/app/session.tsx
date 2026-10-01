// oxlint-disable react/only-export-components
// File này vừa export Provider vừa export hook dùng chung một context; tách ra hai file
// chỉ làm người đọc phải nhảy qua lại mà không được lợi gì.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { dangKy as goiDangKy, dangNhap as goiDangNhap, dangXuat as goiDangXuat } from '../api/auth'
import { lamMoiPhienMotLan, tokenStore } from '../api/http'
import type { NguoiDung } from '../api/types'

interface PhienDangNhap {
  nguoiDung: NguoiDung | null
  /** Đang hỏi backend xem cookie phiên còn hiệu lực không (chỉ lúc mới mở trang). */
  dangKhoiPhuc: boolean
  dangNhap: (email: string, matKhau: string) => Promise<void>
  /** Tự tạo tài khoản mới; backend tạo xong là có phiên luôn. */
  dangKy: (hoTen: string, email: string, matKhau: string) => Promise<void>
  dangXuat: () => Promise<void>
  /** Cập nhật lại thông tin người đang đăng nhập sau khi tự sửa hồ sơ (ví dụ tài khoản nhận tiền). */
  datNguoiDung: (nguoiDung: NguoiDung) => void
}

const SessionContext = createContext<PhienDangNhap | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [nguoiDung, setNguoiDung] = useState<NguoiDung | null>(null)
  const [dangKhoiPhuc, setDangKhoiPhuc] = useState(true)

  useEffect(() => {
    let conCan = true

    // F5 làm mất access token vì nó chỉ nằm trong RAM. Nếu cookie httpOnly còn thì xin token mới
    // và dựng lại phiên, người dùng không phải đăng nhập lại.
    void lamMoiPhienMotLan().then((ketQua) => {
      if (!conCan) return
      if (ketQua) setNguoiDung(ketQua.nguoiDung)
      setDangKhoiPhuc(false)
    })

    return () => {
      conCan = false
    }
  }, [])

  useEffect(() => {
    // Mọi request bị 401 dứt khoát đều xoá token. Nghe ở đây để trạng thái phiên về "chưa đăng nhập"
    // tại một chỗ, thay vì mỗi màn hình tự kiểm tra rồi tự chuyển trang.
    return tokenStore.subscribe((token) => {
      if (token === null) setNguoiDung(null)
    })
  }, [])

  const dangNhap = useCallback(async (email: string, matKhau: string) => {
    const ketQua = await goiDangNhap(email, matKhau)
    tokenStore.set(ketQua.accessToken)
    setNguoiDung(ketQua.nguoiDung)
  }, [])

  const dangKy = useCallback(async (hoTen: string, email: string, matKhau: string) => {
    const ketQua = await goiDangKy(hoTen, email, matKhau)
    tokenStore.set(ketQua.accessToken)
    setNguoiDung(ketQua.nguoiDung)
  }, [])

  const dangXuat = useCallback(async () => {
    try {
      await goiDangXuat()
    } finally {
      // Dù backend có lỗi thì phía trình duyệt vẫn phải sạch phiên.
      tokenStore.clear()
      setNguoiDung(null)
    }
  }, [])

  const datNguoiDung = useCallback((moi: NguoiDung) => {
    setNguoiDung(moi)
  }, [])

  const giaTri = useMemo<PhienDangNhap>(
    () => ({ nguoiDung, dangKhoiPhuc, dangNhap, dangKy, dangXuat, datNguoiDung }),
    [nguoiDung, dangKhoiPhuc, dangNhap, dangKy, dangXuat, datNguoiDung],
  )

  return <SessionContext.Provider value={giaTri}>{children}</SessionContext.Provider>
}

export function usePhien(): PhienDangNhap {
  const giaTri = useContext(SessionContext)
  if (!giaTri) {
    throw new Error('usePhien phải được dùng bên trong SessionProvider')
  }
  return giaTri
}

/**
 * Chặn màn hình khi chưa đăng nhập. Đang khôi phục phiên thì hiện vòng xoay: hiện trang đăng nhập
 * ngay lúc đó sẽ nháy màn hình dù người dùng vẫn còn phiên.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { nguoiDung, dangKhoiPhuc } = usePhien()
  const viTri = useLocation()

  if (dangKhoiPhuc) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Spin size="large" tip="Đang kiểm tra phiên đăng nhập…">
          <div style={{ width: 220, height: 40 }} />
        </Spin>
      </div>
    )
  }

  if (!nguoiDung) {
    // Ghi nhớ đường dẫn đang mở để đăng nhập xong quay lại đúng chỗ.
    return <Navigate to="/login" replace state={{ tu: viTri.pathname + viTri.search }} />
  }

  return <>{children}</>
}
