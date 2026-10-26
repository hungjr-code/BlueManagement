import { useState } from 'react'
import { Alert, App, Button, Empty, Flex, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { DownloadOutlined, KeyOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useBaiTap, duongDanTaiBaiTap, httpHocSinh } from '../../api/hocSinhPortal'
import type { BaiTapCuaHocSinh } from '../../api/hocSinhPortal'
import { ApiError } from '../../api/http'
import { luuTepVe } from '../../lib/taiTep'
import { DoiMatKhauHocSinhModal } from './DoiMatKhauHocSinhModal'

function ngayHienThi(giaTri: string | null): string {
  if (!giaTri) return '—'
  const [nam, thang, ngay] = giaTri.split('-')
  return `${ngay}/${thang}/${nam}`
}

function dungLuong(byte: number): string {
  if (byte >= 1024 * 1024) return `${(byte / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(byte / 1024))} KB`
}

/**
 * "Bài tập của em": danh sách tài liệu giáo viên đã giao cho CHÍNH học sinh này, kèm nút tải về.
 *
 * Tệp không nằm ở đâu công khai: mỗi lần bấm tải, app đọc hộ tệp từ Drive của giáo viên sau khi đã
 * kiểm tra em có được giao bài đó hay không.
 */
export function HocSinhBaiTapPage() {
  const { message } = App.useApp()
  const baiTap = useBaiTap()
  const [moDoiMatKhau, datMoDoiMatKhau] = useState(false)
  const [dangTai, datDangTai] = useState<string | null>(null)

  const tai = async (bai: BaiTapCuaHocSinh) => {
    datDangTai(bai.id)
    try {
      await luuTepVe(httpHocSinh, duongDanTaiBaiTap(bai.id), bai.tenTep)
    } catch (error) {
      message.error(
        error instanceof ApiError ? error.problem?.detail || error.message : 'Không tải được bài tập',
      )
    } finally {
      datDangTai(null)
    }
  }

  const cot: ColumnsType<BaiTapCuaHocSinh> = [
    {
      title: 'Bài tập',
      dataIndex: 'tieuDe',
      render: (_giaTri, dong) => (
        <Flex vertical gap={2}>
          <Typography.Text strong>{dong.tieuDe}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {dong.tenTep} · {dungLuong(dong.kichThuocByte)}
          </Typography.Text>
          {dong.ghiChu ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Ghi chú của giáo viên: {dong.ghiChu}
            </Typography.Text>
          ) : null}
        </Flex>
      ),
    },
    {
      title: 'Buổi học',
      dataIndex: 'ngayBuoi',
      width: 170,
      render: (_giaTri, dong) =>
        dong.ngayBuoi ? (
          <Flex vertical gap={2}>
            <span>{ngayHienThi(dong.ngayBuoi)}</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {dong.gioBuoi?.slice(0, 5) ?? ''}
            </Typography.Text>
          </Flex>
        ) : (
          <Tag>Giao riêng</Tag>
        ),
    },
    {
      title: 'Hạn nộp',
      dataIndex: 'hanNop',
      width: 160,
      render: (giaTri: string | null, dong) => (
        <Space size={6}>
          <span>{ngayHienThi(giaTri)}</span>
          {dong.quaHan ? <Tag color="red">Quá hạn</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Giáo viên',
      dataIndex: 'tenGiaoVien',
      width: 170,
    },
    {
      title: '',
      key: 'tai',
      width: 130,
      render: (_giaTri, dong) => (
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={dangTai === dong.id}
          onClick={() => {
            void tai(dong)
          }}
        >
          Tải về
        </Button>
      ),
    },
  ]

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center" wrap gap={12}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Bài tập của em
          </Typography.Title>
          <Typography.Text type="secondary">
            {baiTap.data ? `${baiTap.data.length} bài tập` : 'Đang tải…'}
          </Typography.Text>
        </div>

        <Space>
          <Button
            icon={<ReloadOutlined />}
            loading={baiTap.isFetching}
            onClick={() => {
              void baiTap.refetch()
            }}
          >
            Tải lại
          </Button>
          <Tooltip title="Đổi mật khẩu đăng nhập của em">
            <Button
              icon={<KeyOutlined />}
              onClick={() => {
                datMoDoiMatKhau(true)
              }}
            >
              Đổi mật khẩu
            </Button>
          </Tooltip>
        </Space>
      </Flex>

      {baiTap.isError ? (
        <Alert
          type="error"
          showIcon
          message="Không đọc được danh sách bài tập"
          description={
            baiTap.error instanceof ApiError && baiTap.error.isNetworkError
              ? 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
              : (baiTap.error?.message ?? 'Lỗi không xác định')
          }
        />
      ) : null}

      <Table<BaiTapCuaHocSinh>
        rowKey="id"
        size="middle"
        loading={baiTap.isPending}
        columns={cot}
        dataSource={baiTap.data ?? []}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Giáo viên chưa giao bài tập nào cho em"
            />
          ),
        }}
      />

      <DoiMatKhauHocSinhModal
        open={moDoiMatKhau}
        onClose={() => {
          datMoDoiMatKhau(false)
        }}
      />
    </Flex>
  )
}
