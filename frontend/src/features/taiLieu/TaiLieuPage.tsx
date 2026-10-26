import { useState } from 'react'
import { Alert, App, Button, Empty, Flex, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd'
import { CloudUploadOutlined, DeleteOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useDanhSachHocSinh } from '../../api/students'
import { http } from '../../api/http'
import { ApiError } from '../../api/http'
import { duongDanTaiVe, useDanhSachTaiLieu, useThuHoiTaiLieu } from '../../api/taiLieu'
import type { TaiLieu } from '../../api/taiLieu'
import { luuTepVe } from '../../lib/taiTep'
import { PageHeader } from '../../components/page'
import { GuiTaiLieuModal } from './GuiTaiLieuModal'

function dungLuong(byte: number): string {
  if (byte >= 1024 * 1024) return `${(byte / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(byte / 1024))} KB`
}

/**
 * Màn hình "Tài liệu": tất cả bài tập giáo viên đã giao, gom một chỗ để nhìn và thu hồi.
 *
 * Tệp thật nằm trên Google Drive của giáo viên, không mở công khai: ở đây chỉ có đường dẫn tải của
 * app (kèm access token), nên không có link Drive nào để lọt ra ngoài.
 */
export function TaiLieuPage() {
  const { message } = App.useApp()
  const [hocSinhId, datHocSinhId] = useState<string | undefined>(undefined)
  const [moGui, datMoGui] = useState(false)
  const [dangTai, datDangTai] = useState<string | null>(null)

  const hocSinh = useDanhSachHocSinh({ kichThuoc: 200 })
  const taiLieu = useDanhSachTaiLieu(hocSinhId ? { hocSinhId } : undefined)
  const thuHoi = useThuHoiTaiLieu()

  const tai = async (dong: TaiLieu) => {
    datDangTai(dong.id)
    try {
      await luuTepVe(http, duongDanTaiVe(dong.id), dong.tenTep)
    } catch (error) {
      message.error(
        error instanceof ApiError ? error.problem?.detail || error.message : 'Không tải được tài liệu',
      )
    } finally {
      datDangTai(null)
    }
  }

  const cot: ColumnsType<TaiLieu> = [
    {
      title: 'Bài tập',
      dataIndex: 'tieuDe',
      render: (_giaTri, dong) => (
        <Flex vertical gap={2}>
          <Typography.Text strong>{dong.tieuDe}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {dong.tenTep} · {dungLuong(dong.kichThuocByte)}
          </Typography.Text>
        </Flex>
      ),
    },
    { title: 'Học sinh', dataIndex: 'tenHocSinh', width: 170 },
    {
      title: 'Buổi học',
      dataIndex: 'ngayBuoi',
      width: 165,
      render: (giaTri: string | null, dong) =>
        giaTri ? (
          <Flex vertical gap={2}>
            <span>{dayjs(giaTri).format('DD/MM/YYYY')}</span>
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
      width: 130,
      render: (giaTri: string | null) => (giaTri ? dayjs(giaTri).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'ngayTaoUtc',
      width: 130,
      render: (giaTri: string) => dayjs(giaTri).format('DD/MM/YYYY'),
    },
    {
      title: '',
      key: 'hanhDong',
      width: 190,
      render: (_giaTri, dong) => (
        <Space size={6}>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            loading={dangTai === dong.id}
            onClick={() => {
              void tai(dong)
            }}
          >
            Tải
          </Button>
          {dong.linkDrive ? (
            <Button
              size="small"
              type="link"
              onClick={() => {
                window.open(dong.linkDrive ?? '', '_blank', 'noopener')
              }}
            >
              Drive
            </Button>
          ) : null}
          <Popconfirm
            title="Thu hồi tài liệu này?"
            description="Tệp bị xoá khỏi Drive của bạn và học sinh không tải được nữa."
            okText="Thu hồi"
            cancelText="Để nguyên"
            onConfirm={async () => {
              try {
                await thuHoi.mutateAsync(dong.id)
                message.success('Đã thu hồi tài liệu')
              } catch (error) {
                message.error(
                  error instanceof ApiError ? error.problem?.detail || error.message : 'Không thu hồi được',
                )
              }
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Tài liệu"
        description={`${taiLieu.data?.length ?? 0} tài liệu đã giao · tệp nằm trên Drive của giáo viên, học sinh tải qua app`}
        extra={
          <Space wrap>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tất cả học sinh"
              style={{ width: 220 }}
              value={hocSinhId}
              loading={hocSinh.isPending}
              options={(hocSinh.data?.duLieu ?? []).map((em) => ({
                value: em.id,
                label: em.hoTen + (em.lop ? ` — ${em.lop}` : ''),
              }))}
              onChange={(giaTri: string | undefined) => {
                datHocSinhId(giaTri)
              }}
            />
            <Button
              icon={<ReloadOutlined />}
              loading={taiLieu.isFetching}
              onClick={() => {
                void taiLieu.refetch()
              }}
            >
              Tải lại
            </Button>
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              onClick={() => {
                datMoGui(true)
              }}
            >
              Gửi tài liệu
            </Button>
          </Space>
        }
      />

      {taiLieu.isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Không đọc được danh sách tài liệu"
          description={taiLieu.error?.message}
        />
      ) : null}

      <Table<TaiLieu>
        rowKey="id"
        size="middle"
        loading={taiLieu.isPending}
        columns={cot}
        dataSource={taiLieu.data ?? []}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa giao tài liệu nào. Bấm Gửi tài liệu để bắt đầu."
            />
          ),
        }}
      />

      <GuiTaiLieuModal
        open={moGui}
        onClose={() => {
          datMoGui(false)
        }}
      />
    </>
  )
}
