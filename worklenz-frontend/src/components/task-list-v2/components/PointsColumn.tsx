import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/shared/antd-imports';

import { useStoryPoints } from '@/hooks/useStoryPoints';
import { formatStoryPoints, getStoryPointOptions } from '@/lib/project/story-points';
import { Task } from '@/types/task-management.types';

interface PointsColumnProps {
  width: string;
  task: Task;
  projectId: string;
  disabled?: boolean;
}

export const PointsColumn: React.FC<PointsColumnProps> = memo(
  ({ width, task, projectId, disabled = false }) => {
    const { t } = useTranslation('task-list-table');
    const { scale, setTaskPoints } = useStoryPoints(projectId);
    const currentPoints = task.story_points ?? null;

    const options = useMemo(
      () => [
        { value: NO_ESTIMATE_VALUE, label: '–' },
        ...getStoryPointOptions(scale, currentPoints).map(point => ({
          value: String(point),
          label: formatStoryPoints(point),
        })),
      ],
      [currentPoints, scale]
    );

    const handleChange = (value: string) => {
      const nextPoints = value === NO_ESTIMATE_VALUE ? null : Number(value);
      if (nextPoints === currentPoints) return;
      void setTaskPoints(task.id, nextPoints);
    };

    return (
      <div
        className="flex items-center justify-center px-1 border-r border-gray-200 dark:border-gray-700"
        style={{ width }}
        onClick={event => event.stopPropagation()}
      >
        <Select
          size="small"
          variant="borderless"
          className="w-full font-bold text-center"
          value={currentPoints === null ? NO_ESTIMATE_VALUE : String(currentPoints)}
          options={options}
          onChange={handleChange}
          disabled={disabled}
          popupMatchSelectWidth={false}
          aria-label={t('storyPointsFor', {
            defaultValue: 'Story points for {{name}}',
            name: task.title || task.name || '',
          })}
        />
      </div>
    );
  }
);

PointsColumn.displayName = 'PointsColumn';

const NO_ESTIMATE_VALUE = '__no_estimate__';
