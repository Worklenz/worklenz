import { ReactNode } from 'react';
import { Flex, Typography } from '@/shared/antd-imports';

interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
}

export const SectionHeader = ({ title, description, extra }: SectionHeaderProps) => (
  <Flex justify="space-between" align="flex-start" gap={12}>
    <div className="min-w-0">
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 2, fontSize: 16 }}>
        {title}
      </Typography.Title>
      {description && (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {description}
        </Typography.Text>
      )}
    </div>
    {extra}
  </Flex>
);
