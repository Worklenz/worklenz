import { Card, Flex, Tooltip, Typography } from '@/shared/antd-imports';
import { InfoCircleOutlined } from '@/shared/antd-imports';

const { Text } = Typography;

interface FinanceKpiCardProps {
  title: string;
  value: string;
  valueColor?: string;
  loading?: boolean;
  tooltip?: string;
}

export const FinanceKpiCard = ({
  title,
  value,
  valueColor,
  loading = false,
  tooltip,
}: FinanceKpiCardProps) => (
  <Card size="small" loading={loading} style={{ height: '100%' }}>
    <Flex align="center" gap={4} style={{ marginBottom: 4 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {title}
      </Text>
      {tooltip && (
        <Tooltip title={tooltip}>
          <InfoCircleOutlined style={{ fontSize: 11, cursor: 'pointer' }} />
        </Tooltip>
      )}
    </Flex>
    <div
      style={{
        fontSize: 20,
        fontWeight: 600,
        color: valueColor,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {value}
    </div>
  </Card>
);
