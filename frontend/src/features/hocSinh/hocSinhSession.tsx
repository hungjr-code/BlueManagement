// oxlint-disable react/only-export-components
// File này vừa export Provider vừa export hook dùng chung một context (giống app/session.tsx).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import {
  dangNhapHocSinh,
  dangXuatHocSinh,
  lamMoiPhienHocSinhMotLan,
  tokenHocSinh,
} from '../../api/hocSinhPortal'
import type { HocSinhToi } from '../../api/hocSinhPortal'

/**
 * Phiên đăng nhập của HỌC SINH.
 *
 * Tách hẳn khỏi phiên giáo viên: cookie khác (`cm_phien_hs`), endpoint làm mới khác, access token
 * nằm ở ô nhớ khác. Nhờ vậy hai loại người dùng dùng chung một trình duyệt vẫn không giẫm lên nhau.
 */
interface PhienHocSinh {
  hocSinh: HocSinhToi | null
  dangKhoiPhuc: boolean
  dangNhap: (maHocSinh: string, matKhau: string) => Promise<void>
  dangXuat: () => Promise<void>
}

const HocSinhContext = createContext<PhienHocSinh | null>(null)

export function HocSinhSessionProvider({ children }: { children: ReactNode }) {
  const [hocSinh, datHocSinh] = useState<HocSinhToi | null>(null)
  const [dangKhoiPhuc, datDangKhoiPhuc] = useState(true)

  useEffect(() => {
    let conCan = true

    // F5 làm mất access token (chỉ nằm trong RAM). Cookie httpOnly còn thì xin token mới, em không
    // phải đăng nhập lại.
    void lamMoiPhienHocSinhMotLan().then((ketQua) => {
      if (!conCan) return
      if (ketQua) datHocSinh(ketQua.hocSinh)
      datDangKhoiPhuc(false)
    })

    return () => {
      conCan = false
    }
  }, [])

  useEffect(() => {
    return tokenHocSinh.subscribe((token) => {
      if (token === null) datHocSinh(null)
    })
  }, [])

  const dangNhap = useCallback(async (maHocSinh: string, matKhau: string) => {
    const ketQua = await dangNhapHocSinh(maHocSinh, matKhau)
    tokenHocSinh.set(ketQua.accessToken)
    datHocSinh(ketQua.hocSinh)
  }, [])

  const dangXuat = useCallback(async () => {
    try {
      await dangXuatHocSinh()
    } finally {
      tokenHocSinh.clear()
      datHocSinh(null)
    }
  }, [])

  const giaTri = useMemo<PhienHocSinh>(
    () => ({ hocSinh, dangKhoiPhuc, dangNhap, dangXuat }),
    [hocSinh, dangKhoiPhuc, dangNhap, dangXuat],
  )

  return <HocSinhContext.Provider value={giaTri}>{children}</HocSinhContext.Provider>
}

export function usePhienHocSinh(): PhienHocSinh {
  const giaTri = useContext(HocSinhContext)
  if (!giaTri) {
    throw new Error('usePhienHocSinh phải được dùng bên trong HocSinhSessionProvider')
  }
  return giaTri
}

/** Chặn màn hình của học sinh khi chưa đăng nhập. */
export function RequireHocSinh({ children }: { children: ReactNode }) {
  const { hocSinh, dangKhoiPhuc } = usePhienHocSinh()
  const viTri = useLocation()

  if (dangKhoiPhuc) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip="Đang kiểm tra phiên đăng nhập…">
          <div style={{ width: 220, height: 40 }} />
        </Spin>
      </div>
    )
  }

  if (!hocSinh) {
    return <Navigate to="/hoc-sinh/dang-nhap" replace state={{ tu: viTri.pathname }} />
  }

  return <>{children}</>
}
