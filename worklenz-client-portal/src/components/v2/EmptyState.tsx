import type { ReactNode } from 'react';
import { Empty, Typography } from '@/shared/antd-imports';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Empty states say what to do next, not just "nothing here". */
export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <Empty
    image={Empty.PRESENTED_IMAGE_SIMPLE}
    description={
      <div>
        <Typography.Text strong>{title}</Typography.Text>
        {description && (
          <Typography.Paragraph type="secondary" style={{ margin: '4px auto 0', maxWidth: 420 }}>
            {description}
          </Typography.Paragraph>
        )}
      </div>
    }
    style={{ padding: '32px 0' }}
  >
    {action}
  </Empty>
);
