import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Select } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useStoryPoints } from '@/hooks/useStoryPoints';
import { setTaskStoryPoints } from '@/features/task-drawer/task-drawer.slice';
import { formatStoryPoints, getStoryPointOptions } from '@/lib/project/story-points';
import { ITaskViewModel } from '@/types/tasks/task.types';

interface TaskDrawerStoryPointsProps {
  task: ITaskViewModel;
  disabled?: boolean;
}

export const TaskDrawerStoryPoints = ({ task, disabled = false }: TaskDrawerStoryPointsProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const dispatch = useAppDispatch();
  const { scale, setTaskPoints } = useStoryPoints(task.project_id);
  const [isSaving, setIsSaving] = useState(false);
  const currentPoints = task.story_points ?? null;

  const options = useMemo(
    () => [
      {
        value: NO_ESTIMATE_VALUE,
        label: t('taskInfoTab.details.noEstimate', { defaultValue: 'No estimate' }),
      },
      ...getStoryPointOptions(scale, currentPoints).map(point => ({
        value: String(point),
        label: formatStoryPoints(point),
      })),
    ],
    [currentPoints, scale, t]
  );

  const handleChange = async (value: string) => {
    if (!task.id) return;
    const nextPoints = value === NO_ESTIMATE_VALUE ? null : Number(value);
    if (nextPoints === currentPoints) return;

    dispatch(setTaskStoryPoints({ id: task.id, story_points: nextPoints }));
    setIsSaving(true);
    const isSaved = await setTaskPoints(task.id, nextPoints);
    setIsSaving(false);
    if (!isSaved) dispatch(setTaskStoryPoints({ id: task.id, story_points: currentPoints }));
  };

  return (
    <Form.Item label={t('taskInfoTab.details.storyPoints', { defaultValue: 'Story points' })}>
      <Select
        value={currentPoints === null ? NO_ESTIMATE_VALUE : String(currentPoints)}
        options={options}
        onChange={handleChange}
        loading={isSaving}
        disabled={disabled}
        style={{ width: 140 }}
        aria-label={t('taskInfoTab.details.storyPoints', { defaultValue: 'Story points' })}
      />
    </Form.Item>
  );
};

const NO_ESTIMATE_VALUE = '__no_estimate__';

export default TaskDrawerStoryPoints;
