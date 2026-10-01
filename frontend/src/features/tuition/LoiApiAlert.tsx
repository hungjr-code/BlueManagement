import { Alert, Button, List, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { loiTheoField, moTaLoi } from './hienThi'

interface LoiApiAlertProps {
  /** Lỗi bắt được — thường là ApiError đã chuẩn hoá ở src/api/http.ts. */
  error: unknown
  /** Tiêu đề nói rõ việc gì không làm được, để người dùng biết hỏng ở bước nào. */
  tieuDe: string
  /** Có truyền thì hiện nút "Thử lại". */
  onThuLai?: () => void
}

/**
 * Hiện lỗi API ở một chỗ: lỗi validate của backend liệt kê theo từng field trước, còn lại hiện message.
 * Không bóc lỗi axios ở đây vì tầng http đã quy hết về ApiError.
 */
export function LoiApiAlert({ error, tieuDe, onThuLai }: LoiApiAlertProps) {
  const theoField = loiTheoField(error)

  return (
    <Alert
      type="error"
      showIcon
      message={tieuDe}
      description={
        theoField.length > 0 ? (
          <List
            size="small"
            dataSource={theoField}
            renderItem={(item) => (
              <List.Item>
                <Typography.Text code>{item.field}</Typography.Text> {item.thongDiep}
              </List.Item>
            )}
          />
        ) : (
          moTaLoi(error, 'Lỗi không xác định, bạn thử lại sau.')
        )
      }
      action={
        onThuLai ? (
          <Button size="small" icon={<ReloadOutlined />} onClick={onThuLai}>
            Thử lại
          </Button>
        ) : null
      }
    />
  )
}
