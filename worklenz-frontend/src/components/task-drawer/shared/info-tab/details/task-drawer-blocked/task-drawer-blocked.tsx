import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, CheckboxChangeEvent, Form } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useBlockedFlag } from '@/hooks/useBlockedFlag';
import { setTaskBlocked } from '@/features/task-drawer/task-drawer.slice';
import { ITaskViewModel } from '@/types/tasks/task.types';

interface TaskDrawerBlockedProps {
  task: ITaskViewModel;
  disabled?: boolean;
}

export const TaskDrawerBlocked = ({ task, disabled = false }: TaskDrawerBlockedProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const dispatch = useAppDispatch();
  const { setBlocked } = useBlockedFlag(task.project_id);
  const [isSaving, setIsSaving] = useState(false);
  const isBlocked = task.is_blocked === true;

  const handleChange = async (event: CheckboxChangeEvent) => {
    if (!task.id) return;
    const nextIsBlocked = event.target.checked;

    dispatch(setTaskBlocked({ id: task.id, is_blocked: nextIsBlocked }));
    setIsSaving(true);
    const isSaved = await setBlocked(task.id, nextIsBlocked);
    setIsSaving(false);
    if (!isSaved) dispatch(setTaskBlocked({ id: task.id, is_blocked: isBlocked }));
  };

  return (
    <Form.Item label={t('taskInfoTab.details.blocked', { defaultValue: 'Blocked' })}>
      <Checkbox checked={isBlocked} onChange={handleChange} disabled={disabled || isSaving}>
        {t('taskInfoTab.details.flagAsBlocked', { defaultValue: 'Flag as blocked' })}
      </Checkbox>
    </Form.Item>
  );
};

export default TaskDrawerBlocked;
