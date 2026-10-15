import type { ReactNode } from 'react';
import { Flex, Typography } from '@/shared/antd-imports';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Actions on the right (kept to one primary action). */
  extra?: ReactNode;
}

export const PageHeader = ({ title, subtitle, extra }: PageHeaderProps) => (
  <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12} style={{ marginBottom: 20 }}>
    <div style={{ minWidth: 0 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
      {subtitle && (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
          {subtitle}
        </Typography.Text>
      )}
    </div>
    {extra && <div>{extra}</div>}
  </Flex>
);
