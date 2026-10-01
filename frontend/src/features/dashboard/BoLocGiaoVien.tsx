import { useMemo } from 'react'
import { Button, Space, Select, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useDanhSachGiaoVien } from '../../api/teachers'
import type { GiaoVien } from '../../api/types'

interface BoLocGiaoVienProps {
  /** Giáo viên đang lọc, `undefined` là xem tất cả. */
  giaTri: GiaoVien | undefined
  onChange: (giaoVien: GiaoVien | undefined) => void
}

/**
 * Bộ lọc giáo viên ở header Tổng quan. **Chỉ admin thấy** — giáo viên không có lựa chọn nào để lọc
 * vì backend đã giới hạn dữ liệu của họ đúng bằng lịch dạy của chính họ.
 *
 * Lấy danh sách bằng `useDanhSachGiaoVien({ kichThuoc: 200 })`: 200 là mức tối đa backend cho phép
 * ở một trang, đủ cho một trung tâm cỡ này và không cần phân trang trong ô chọn.
 * Chọn xong thì trang cha truyền `giaoVienId` xuống `/api/dashboard/hom-nay` và `/tuan-nay`.
 */
export function BoLocGiaoVien({ giaTri, onChange }: BoLocGiaoVienProps) {
  const danhSach = useDanhSachGiaoVien({ kichThuoc: 200 })

  const theoId = useMemo(
    () => new Map((danhSach.data?.duLieu ?? []).map((giaoVien) => [giaoVien.id, giaoVien])),
    [danhSach.data],
  )

  const luaChon = (danhSach.data?.duLieu ?? []).map((giaoVien) => ({
    value: giaoVien.id,
    label:
      giaoVien.trangThai === 'dang_lam'
        ? giaoVien.hoTen
        : `${giaoVien.hoTen} (không còn dạy)`,
  }))

  if (danhSach.isError) {
    return (
      <Space size={4}>
        <Typography.Text type="danger">Không đọc được danh sách giáo viên</Typography.Text>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => {
            void danhSach.refetch()
          }}
        >
          Thử lại
        </Button>
      </Space>
    )
  }

  return (
    <Select
      allowClear
      showSearch
      optionFilterProp="label"
      style={{ width: 240 }}
      placeholder="Tất cả giáo viên"
      aria-label="Lọc theo giáo viên"
      value={giaTri?.id}
      options={luaChon}
      loading={danhSach.isPending}
      notFoundContent={danhSach.isPending ? 'Đang tải…' : 'Chưa có giáo viên nào'}
      onChange={(giaoVienId?: string) => {
        onChange(giaoVienId ? theoId.get(giaoVienId) : undefined)
      }}
    />
  )
}
