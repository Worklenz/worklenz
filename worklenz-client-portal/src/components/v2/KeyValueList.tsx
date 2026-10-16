import type { ReactNode } from 'react';
import { Flex, Typography } from '@/shared/antd-imports';

export const KeyValueList = ({ rows }: { rows: Array<[string, ReactNode]> }) => (
  <div>
    {rows.map(([label, value]) => (
      <Flex key={label} justify="space-between" gap={12} style={{ padding: '6px 0' }}>
        <Typography.Text type="secondary">{label}</Typography.Text>
        <Typography.Text style={{ textAlign: 'right' }}>{value}</Typography.Text>
      </Flex>
    ))}
  </div>
);
