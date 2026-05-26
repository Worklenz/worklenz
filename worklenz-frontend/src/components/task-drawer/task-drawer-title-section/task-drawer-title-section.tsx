import React, { ChangeEvent, useEffect, useState } from 'react';
import { Flex, Input, InputRef, Skeleton, Typography } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateSelectedTaskName } from '@/features/task-drawer/task-drawer.slice';
import { updateTask } from '@/features/task-management/task-management.slice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { store } from '@/app/store';
import { Task } from '@/types/task-management.types';
import { TFunction } from 'i18next';
import TaskHierarchyBreadcrumb from '../task-hierarchy-breadcrumb/task-hierarchy-breadcrumb';
import './task-drawer-title-section.css';

type Props = {
  inputRef: React.RefObject<InputRef | null>;
  t: TFunction;
};

const TaskDrawerTitleSection = ({ inputRef, t }: Props) => {
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  const [isEditing, setIsEditing] = useState(false);

  const { taskFormViewModel, selectedTaskId, loadingTask } = useAppSelector(
    state => state.taskDrawerReducer
  );
  const projectName = useAppSelector(state => state.projectReducer.project?.name ?? null);

  const [taskName, setTaskName] = useState<string>(taskFormViewModel?.task?.name ?? '');

  useEffect(() => {
    if (!isEditing) {
      setTaskName(taskFormViewModel?.task?.name ?? '');
    }
  }, [taskFormViewModel?.task?.name, isEditing]);

  const onTaskNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newName = e.currentTarget.value;
    setTaskName(newName);
    if (selectedTaskId) {
      dispatch(updateSelectedTaskName({ id: selectedTaskId, name: newName }));
      const currentTask = store.getState().taskManagement.entities[selectedTaskId];
      if (currentTask) {
        dispatch(
          updateTask({
            ...currentTask,
            title: newName,
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Task)
        );
      }
    }
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    if (
      !selectedTaskId ||
      !connected ||
      taskName === taskFormViewModel?.task?.name ||
      !taskName
    ) return;
    socket?.emit(
      SocketEvents.TASK_NAME_CHANGE.toString(),
      JSON.stringify({
        task_id: selectedTaskId,
        name: taskName,
        parent_task: taskFormViewModel?.task?.parent_task_id,
      })
    );
  };

  const isLoadingTaskName = loadingTask && !taskFormViewModel?.task?.name;

  return (
    <div className="task-drawer-title-section">
      {/* Breadcrumb: project name / parent task */}
      <TaskHierarchyBreadcrumb t={t} projectName={projectName} />

      {/* Large task name */}
      <div className="task-drawer-title-name">
        {isLoadingTaskName ? (
          <Skeleton.Input active size="large" style={{ width: '100%', height: 40 }} />
        ) : isEditing ? (
          <Input
            ref={inputRef}
            value={taskName}
            onChange={onTaskNameChange}
            onBlur={handleInputBlur}
            placeholder={t('taskHeader.taskNamePlaceholder')}
            className="task-name-input task-name-input--large"
            style={{ width: '100%', border: 'none', padding: 0, boxShadow: 'none', fontSize: '22px', fontWeight: 700 }}
            showCount={true}
            maxLength={250}
            autoFocus
          />
        ) : (
          <Typography.Title
            level={4}
            onClick={() => setIsEditing(true)}
            className="task-name-display task-name-display--large"
            style={{ margin: 0, cursor: 'text', lineHeight: 1.3, fontWeight: 700, fontSize: '22px' }}
          >
            {taskName || t('taskHeader.taskNamePlaceholder')}
          </Typography.Title>
        )}
      </div>
    </div>
  );
};

export default TaskDrawerTitleSection;