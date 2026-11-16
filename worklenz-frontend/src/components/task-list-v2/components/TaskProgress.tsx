import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { theme, Tooltip } from '@/shared/antd-imports';

interface TaskProgressProps {
  progress: number;
  numberOfSubTasks: number;
}

/** A static ring avoids Progress's size measurement and animation state per row. */
export const TaskProgress = memo(({ progress = 0, numberOfSubTasks = 0 }: TaskProgressProps) => {
  const { token } = theme.useToken();
  const { t } = useTranslation('task-list-table');
  const percent = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;
  const isComplete = percent === 100;
  const size = isComplete ? 21 : 26;

  return (
    <Tooltip title={`0 / ${numberOfSubTasks + 1}`}>
      <svg
        role="progressbar"
        aria-label={t('progressColumn', { defaultValue: 'Progress' })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{ display: 'block', flexShrink: 0, cursor: 'default' }}
      >
        <circle
          cx="50"
          cy="50"
          r="45.5"
          fill="none"
          stroke={token.colorFillSecondary}
          strokeWidth="9"
        />
        <circle
          cx="50"
          cy="50"
          r="45.5"
          fill="none"
          stroke={isComplete ? token.colorSuccess : token.colorInfo}
          strokeWidth="9"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - percent}
          opacity={percent === 0 ? 0 : 1}
          transform="rotate(-90 50 50)"
        />
        {isComplete ? (
          <path d="M29 50l14 14 28-28" fill="none" stroke={token.colorSuccess} strokeWidth="8" />
        ) : (
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="38.5"
            fill={token.colorText}
          >
            {percent}%
          </text>
        )}
      </svg>
    </Tooltip>
  );
});

TaskProgress.displayName = 'TaskProgress';
export default TaskProgress;
