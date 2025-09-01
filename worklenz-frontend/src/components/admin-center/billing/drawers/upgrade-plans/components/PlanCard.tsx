import { Card, Typography } from '@/shared/antd-imports';
import { PlanCardProps } from '../types';
import { IPaddlePlans } from '@/shared/constants';

export const PlanCard: React.FC<PlanCardProps> = ({
  planType,
  title,
  description,
  features,
  priceDisplay,
  selectedPlanType,
  onPlanSelect,
}) => (
  <Card
    style={{
      height: '100%',
      border: selectedPlanType === planType ? '2px solid #1890ff' : '1px solid #d9d9d9',
      padding: '8px',
      display: 'flex',
      flexDirection: 'column',
    }}
    bodyStyle={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}
    onClick={() => onPlanSelect(planType)}
    hoverable
  >
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <Typography.Title level={4} style={{ marginBottom: 8 }}>
        {title}
      </Typography.Title>
      <Typography.Text type="secondary">{description}</Typography.Text>
    </div>

    {priceDisplay}

    <div style={{ flex: 1, marginBottom: 24 }}>{features}</div>
  </Card>
);