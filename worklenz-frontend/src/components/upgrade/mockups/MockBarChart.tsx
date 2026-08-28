import React from 'react';
import { Flex, Typography } from '@/shared/antd-imports';

const { Text } = Typography;

interface MockBarChartDatum {
  label: string;
  value: number; // 0-100, relative bar height
  color?: string;
}

interface MockBarChartProps {
  data: MockBarChartDatum[];
  barAreaHeight?: number;
}

// Purely decorative bar chart for blurred "coming soon"/upgrade mockups —
// these are never interactive or data-driven, so plain CSS bars are used
// instead of pulling in a charting library.
const MockBarChart: React.FC<MockBarChartProps> = ({ data, barAreaHeight = 120 }) => (
  <Flex gap={16} style={{ padding: '0 4px' }}>
    {data.map(({ label, value, color = '#1677ff' }) => (
      <Flex
        key={label}
        vertical
        align="center"
        justify="flex-end"
        gap={6}
        style={{ flex: 1, height: barAreaHeight + 22 }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 36,
            height: Math.max((value / 100) * barAreaHeight, 6),
            background: color,
            borderRadius: '4px 4px 0 0',
          }}
        />
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {label}
        </Text>
      </Flex>
    ))}
  </Flex>
);

export default MockBarChart;
