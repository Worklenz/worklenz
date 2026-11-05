import React from 'react';
import { theme, Tooltip } from '@/shared/antd-imports';
import type { TimeInStatusIssueSegment } from '@/types/reporting/analytics-time-in-status.types';

interface TisMiniBarProps {
  segments: TimeInStatusIssueSegment[];
  totalDays: number;
  isOutlier?: boolean;
}

const FALLBACK = '#1890ff';
const OUTLIER = '#ff4d4f';

function hex(color: string | null): string {
  if (!color) return FALLBACK;
  return color.startsWith('#') ? color : `#${color}`;
}

export const TisMiniBar: React.FC<TisMiniBarProps> = ({
  segments,
  totalDays,
  isOutlier,
}) => {
  const { token } = theme.useToken();
  const max = Math.max(totalDays, 0.01);

  return (
    <Tooltip
      title={
        <div>
          {segments.map(s => (
            <div key={s.status_id}>
              {s.status_name}: {s.days}
              {s.is_live ? ' *' : ''}
              {s.is_outlier ? ' !' : ''}
            </div>
          ))}
        </div>
      }
    >
      <div
        role="img"
        aria-label={`Total ${totalDays} days`}
        style={{
          display: 'flex',
          width: '100%',
          minWidth: 80,
          height: 10,
          borderRadius: 4,
          overflow: 'hidden',
          background: token.colorFillSecondary,
          outline: isOutlier ? `1px solid ${OUTLIER}` : undefined,
        }}
      >
        {segments.map(seg => (
          <div
            key={seg.status_id}
            style={{
              width: `${(seg.days / max) * 100}%`,
              background: seg.is_outlier ? OUTLIER : hex(seg.color),
              minWidth: seg.days > 0 ? 2 : 0,
            }}
          />
        ))}
      </div>
    </Tooltip>
  );
};
