import { useSocket } from '@/socket/socketContext';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { Select, Form } from '@/shared/antd-imports';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setTaskPhase } from '@/features/task-drawer/task-drawer.slice';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TaskDrawerPhaseSelectorProps {
  phases: ITaskPhase[];
  task: ITaskViewModel;
}

const TaskDrawerPhaseSelector = ({ phases, task }: TaskDrawerPhaseSelectorProps) => {
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-drawer/task-drawer');
  const projectType = useAppSelector(state => state.projectReducer.project?.project_type);
  const isSoftwareProject = isSoftwareProjectType(projectType);

  const [selectedPhase, setSelectedPhase] = useState<string | undefined>(task?.phase_id);

  useEffect(() => {
    // FIX: Only sync local phase state when task has a real ID.
    // Previously this ran whenever task?.phase_id changed — including when
    // the drawer closes and taskFormViewModel is reset to {} in Redux, which
    // sets task to an empty object and phase_id to undefined. That caused the
    // phase selector to flash back to "no selection" during the closing
    // animation. Now we ignore updates where the task itself is gone.
    if (!task?.id) return;
    setSelectedPhase(task.phase_id ?? undefined);
  }, [task?.phase_id, task?.id]);

  // Software projects: completed sprints can no longer receive issues
  const phaseMenuItems = useMemo(
    () =>
      phases
        ?.filter(
          phase =>
            !isSoftwareProject ||
            phase.sprint_status !== 'completed' ||
            phase.id === selectedPhase
        )
        .map(phase => ({
          key: phase.id,
          value: phase.id,
          label: phase.name,
        })),
    [phases, isSoftwareProject, selectedPhase]
  );

  const handlePhaseChange = (value: string | null) => {
    setSelectedPhase(value || undefined);

    socket?.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
      task_id: task.id,
      phase_id: value,
      parent_task: task.parent_task_id || null,
    });

    socket?.once(
      SocketEvents.TASK_PHASE_CHANGE.toString(),
      (data: { phase_id: string | null; id: string }) => {
        dispatch(setTaskPhase(data));
      }
    );
  };

  const fieldLabel = isSoftwareProject
    ? t('taskInfoTab.details.sprint', { defaultValue: 'Sprint' })
    : t('taskInfoTab.details.phase', { defaultValue: 'Phase' });
  const placeholder = isSoftwareProject
    ? t('taskInfoTab.details.sprintPlaceholder', { defaultValue: 'Backlog' })
    : t('taskInfoTab.details.phasePlaceholder', { defaultValue: 'Select Phase' });

  return (
    <Form.Item name="phase" label={fieldLabel}>
      <Select
        allowClear
        placeholder={placeholder}
        aria-label={fieldLabel}
        value={selectedPhase}
        options={phaseMenuItems}
        style={{ width: 'fit-content', minWidth: 145 }}
        onChange={handlePhaseChange}
      />
    </Form.Item>
  );
};

export default TaskDrawerPhaseSelector;
