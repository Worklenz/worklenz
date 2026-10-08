import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Select } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useEpicAssignment } from '@/hooks/useEpicAssignment';
import { useEnsureProjectEpics } from '@/hooks/useEnsureProjectEpics';
import { setTaskEpic } from '@/features/task-drawer/task-drawer.slice';
import {
  NO_EPIC_VALUE,
  useEpicSelectOptions,
} from '@/components/projects/epics/use-epic-select-options';
import { ITaskViewModel } from '@/types/tasks/task.types';

interface TaskDrawerEpicSelectorProps {
  task: ITaskViewModel;
  disabled?: boolean;
}

export const TaskDrawerEpicSelector = ({ task, disabled = false }: TaskDrawerEpicSelectorProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const dispatch = useAppDispatch();
  const { isLoading } = useEnsureProjectEpics(task.project_id);
  const { assignEpic } = useEpicAssignment(task.project_id);
  const [isSaving, setIsSaving] = useState(false);
  const currentEpicId = task.epic_id ?? null;
  const options = useEpicSelectOptions(currentEpicId);

  const handleChange = async (value: string) => {
    if (!task.id) return;
    const nextEpicId = value === NO_EPIC_VALUE ? null : value;
    if (nextEpicId === currentEpicId) return;

    dispatch(setTaskEpic({ id: task.id, epic_id: nextEpicId }));
    setIsSaving(true);
    const isSaved = await assignEpic(task.id, nextEpicId);
    setIsSaving(false);
    if (!isSaved) dispatch(setTaskEpic({ id: task.id, epic_id: currentEpicId }));
  };

  const label = t('taskInfoTab.details.epic', { defaultValue: 'Epic' });

  return (
    <Form.Item label={label}>
      <Select
        value={currentEpicId ?? NO_EPIC_VALUE}
        options={options}
        onChange={handleChange}
        loading={isSaving || isLoading}
        disabled={disabled}
        popupMatchSelectWidth={false}
        style={{ width: '100%', maxWidth: 260 }}
        aria-label={label}
      />
    </Form.Item>
  );
};

export default TaskDrawerEpicSelector;
