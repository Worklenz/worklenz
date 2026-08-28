import { Card, Skeleton } from '@/shared/antd-imports';
import { PLAN_CARD_SKELETON_ROWS } from '../constants';

export const PlanCardSkeleton: React.FC = () => (
  <Card style={{ height: '100%', padding: '8px' }}>
    <Skeleton active paragraph={{ rows: PLAN_CARD_SKELETON_ROWS }} />
  </Card>
);
