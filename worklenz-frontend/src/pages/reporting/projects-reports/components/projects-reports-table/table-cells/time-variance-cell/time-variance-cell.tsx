import { memo } from 'react';
import { Typography, theme } from '@/shared/antd-imports';

type TimeVarianceCellProps = {
  /** Actual logged time in seconds */
  actualSeconds: number | null;
  /** Estimated time in minutes */
  estimatedMinutes: number | null;
};

const formatHoursAndMinutes = (totalSeconds: number) => {
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

const TimeVarianceCell = ({ actualSeconds, estimatedMinutes }: TimeVarianceCellProps) => {
  const { token } = theme.useToken();

  if (!estimatedMinutes) {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }

  const varianceSeconds = (actualSeconds || 0) - estimatedMinutes * 60;
  const isOver = varianceSeconds > 0;
  const color = isOver ? token.colorError : token.colorSuccess;
  const sign = varianceSeconds === 0 ? '' : isOver ? '+' : '-';
  const percent = Math.round((Math.abs(varianceSeconds) / (estimatedMinutes * 60)) * 100);

  return (
    <Typography.Text style={{ color: varianceSeconds === 0 ? undefined : color }}>
      {`${sign}${formatHoursAndMinutes(Math.abs(varianceSeconds))} (${sign}${percent}%)`}
    </Typography.Text>
  );
};

export default memo(TimeVarianceCell);
