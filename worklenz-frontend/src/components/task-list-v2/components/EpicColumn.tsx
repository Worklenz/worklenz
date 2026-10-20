import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/shared/antd-imports';

import { useEpicAssignment } from '@/hooks/useEpicAssignment';
import {
  NO_EPIC_VALUE,
  useEpicSelectOptions,
} from '@/components/projects/epics/use-epic-select-options';
import { Task } from '@/types/task-management.types';

interface EpicColumnProps {
  width: string;
  task: Task;
  projectId: string;
  disabled?: boolean;
}

export const EpicColumn: React.FC<EpicColumnProps> = memo(
  ({ width, task, projectId, disabled = false }) => {
    const { t } = useTranslation('task-list-table');
    const { assignEpic } = useEpicAssignment(projectId);
    const [isSaving, setIsSaving] = useState(false);
    const currentEpicId = task.epic_id ?? null;
    const options = useEpicSelectOptions(currentEpicId);

    const handleChange = async (value: string) => {
      const nextEpicId = value === NO_EPIC_VALUE ? null : value;
      if (nextEpicId === currentEpicId) return;

      setIsSaving(true);
      await assignEpic(task.id, nextEpicId);
      setIsSaving(false);
    };

    return (
      <div
        className="flex items-center px-2 border-r border-gray-200 dark:border-gray-700"
        style={{ width, minWidth: 0, overflow: 'hidden' }}
        onClick={event => event.stopPropagation()}
      >
        <Select
          size="small"
          variant="borderless"
          className="w-full epic-inline-select"
          value={currentEpicId ?? NO_EPIC_VALUE}
          options={options}
          onChange={handleChange}
          disabled={disabled}
          loading={isSaving}
          popupMatchSelectWidth={false}
          aria-label={t('epicFor', {
            defaultValue: 'Epic for {{name}}',
            name: task.title || task.name || '',
          })}
        />
      </div>
    );
  }
);

EpicColumn.displayName = 'EpicColumn';
