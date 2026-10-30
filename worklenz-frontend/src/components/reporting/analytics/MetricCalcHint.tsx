import React from 'react';
import { InfoCircleOutlined, Tooltip, theme } from '@/shared/antd-imports';

interface MetricCalcHintProps {
  /** Plain-language explanation of how the metric is calculated. */
  title: string;
  /** Icon color; defaults to secondary text. */
  color?: string;
  className?: string;
}

/**
 * Info icon with tooltip describing how a reporting metric is calculated.
 * Use next to KPI labels and chart/table headings.
 */
export const MetricCalcHint: React.FC<MetricCalcHintProps> = ({
  title,
  color,
  className,
}) => {
  const { token } = theme.useToken();
  return (
    <Tooltip title={title}>
      <InfoCircleOutlined
        className={className}
        aria-label={title}
        style={{
          color: color ?? token.colorTextSecondary,
          fontSize: 12,
          cursor: 'help',
          flexShrink: 0,
        }}
      />
    </Tooltip>
  );
};
