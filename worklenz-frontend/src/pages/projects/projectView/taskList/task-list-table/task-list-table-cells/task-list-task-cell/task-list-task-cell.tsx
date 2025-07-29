import { Flex, Typography, Button, Input, Tooltip } from '@/shared/antd-imports';
import type { InputRef } from '@/shared/antd-imports';
import {
  DoubleRightOutlined,
  DownOutlined,
  RightOutlined,
  ExpandAltOutlined,
  CommentOutlined,
  EyeOutlined,
  PaperClipOutlined,
  MinusCircleOutlined,
  RetweetOutlined,
} from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import './task-list-task-cell.css';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { useState, useRef, useEffect } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { fetchSubTasks } from '@/features/task-management/task-management.slice';

type TaskListTaskCellProps = {
  task: IProjectTask;
  isSubTask?: boolean;
  toggleTaskExpansion: (taskId: string) => void;
  projectId: string;
};

const TaskListTaskCell = ({
  task,
  isSubTask = false,
  toggleTaskExpansion,
  projectId,
}: TaskListTaskCellProps) => {
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();

  const [editTaskName, setEditTaskName] = useState(false);
  const [taskName, setTaskName] = useState(task.name || '');
  const inputRef = useRef<InputRef>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        handleTaskNameSave();
      }
    };

    if (editTaskName) {
      document.addEventListener('mousedown', handleClickOutside);
      inputRef.current?.focus();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editTaskName]);

  const handleToggleExpansion = (taskId: string) => {
    if (task.sub_tasks_count && task.sub_tasks_count > 0 && !task.sub_tasks) {
      dispatch(fetchSubTasks({ taskId, projectId }));
    }
    toggleTaskExpansion(taskId);
  };

  const renderToggleButtonForHasSubTasks = (taskId: string | null, hasSubtasks: boolean) => {
    if (!hasSubtasks || !taskId) return null;
    return (
      <button
        onClick={() => handleToggleExpansion(taskId)}
        className="hover flex h-4 w-4 items-center justify-center rounded-sm text-[12px] hover:border hover:border-[#5587f5] hover:bg-[#d0eefa54]"
      >
        {task.show_sub_tasks ? <DownOutlined /> : <RightOutlined />}
      </button>
    );
  };

  const renderToggleButtonForNonSubtasks = (
    taskId: string,
    isSubTask: boolean,
    subTasksCount: number
  ) => {
    if (subTasksCount > 0 && !isSubTask) {
      return (
        <button
          onClick={() => handleToggleExpansion(taskId)}
          className="hover flex h-4 w-4 items-center justify-center rounded-sm text-[12px] hover:border hover:border-[#5587f5] hover:bg-[#d0eefa54]"
        >
          {task.show_sub_tasks ? <DownOutlined /> : <RightOutlined />}
        </button>
      );
    }

    return !isSubTask ? (
      <button
        onClick={() => handleToggleExpansion(taskId)}
        className="hover flex h-4 w-4 items-center justify-center rounded-sm text-[12px] hover:border hover:border-[#5587f5] hover:bg-[#d0eefa54] open-task-button"
      >
        {task.show_sub_tasks ? <DownOutlined /> : <RightOutlined />}
      </button>
    ) : (
      <div className="h-4 w-4"></div>
    );
  };

  const renderSubtasksCountLabel = (taskId: string, isSubTask: boolean, subTasksCount: number) => {
    if (!taskId || subTasksCount <= 1) return null;
    return (
      <Button
        onClick={() => handleToggleExpansion(taskId)}
        size="small"
        style={{
          display: 'flex',
          gap: 2,
          paddingInline: 4,
          alignItems: 'center',
          justifyItems: 'center',
          border: 'none',
        }}
      >
        <Typography.Text style={{ fontSize: 12, lineHeight: 1 }}>{subTasksCount}</Typography.Text>
        <DoubleRightOutlined style={{ fontSize: 10 }} />
      </Button>
    );
  };

  const handleTaskNameSave = () => {
    const taskName = inputRef.current?.input?.value;
    if (taskName?.trim() !== '' && connected) {
      socket?.emit(
        SocketEvents.TASK_NAME_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          name: taskName,
          parent_task: task.parent_task_id,
        })
      );
      setEditTaskName(false);
    }
  };

  return (
    <Flex
      align="center"
      justify="space-between"
      className={editTaskName ? 'edit-mode-cell' : ''}
      style={{
        margin: editTaskName ? '-8px' : undefined,
        border: editTaskName ? '1px solid #1677ff' : undefined,
        backgroundColor: editTaskName ? 'rgba(22, 119, 255, 0.02)' : undefined,
        minHeight: editTaskName ? '42px' : undefined,
      }}
    >
      <Flex gap={8} align="center">
        {!!task?.sub_tasks?.length ? (
          renderToggleButtonForHasSubTasks(task.id || null, !!task?.sub_tasks?.length)
        ) : (
          <div className="h-4 w-4">
            {renderToggleButtonForNonSubtasks(task.id || '', isSubTask, task.sub_tasks_count || 0)}
          </div>
        )}

        {isSubTask && <DoubleRightOutlined style={{ fontSize: 12 }} />}

        <div ref={wrapperRef} style={{ flex: 1 }}>
          {!editTaskName && (
            <Typography.Text
              ellipsis={{ tooltip: task.name }}
              onClick={() => setEditTaskName(true)}
              style={{ cursor: 'pointer', width: 'auto', maxWidth: '350px' }}
            >
              {task.name}
            </Typography.Text>
          )}

          {editTaskName && (
            <Input
              ref={inputRef}
              variant="borderless"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              autoFocus
              onPressEnter={handleTaskNameSave}
              style={{
                width: 350,
                padding: 0,
              }}
            />
          )}
        </div>

        {!editTaskName &&
          renderSubtasksCountLabel(task.id || '', isSubTask, task.sub_tasks_count || 0)}

        {task?.comments_count ? (
          <CommentOutlined type="secondary" style={{ fontSize: 14 }} />
        ) : null}

        {task?.has_subscribers ? <EyeOutlined type="secondary" style={{ fontSize: 14 }} /> : null}

        {task?.attachments_count ? (
          <PaperClipOutlined type="secondary" style={{ fontSize: 14 }} />
        ) : null}

        {task?.has_dependencies ? (
          <MinusCircleOutlined type="secondary" style={{ fontSize: 14 }} />
        ) : null}

        {task?.schedule_id ? (
          <Tooltip title="Recurring Task">
            <RetweetOutlined type="secondary" style={{ fontSize: 14 }} />
          </Tooltip>
        ) : null}
      </Flex>

      <div className="open-task-button">
        <Button
          type="text"
          icon={<ExpandAltOutlined />}
          onClick={() => {
            dispatch(setSelectedTaskId(task.id || ''));
            dispatch(setShowTaskDrawer(true));
          }}
          style={{
            backgroundColor: colors.transparent,
            padding: 0,
            height: 'fit-content',
          }}
        >
          {t('openButton')}
        </Button>
      </div>
    </Flex>
  );
};

export default TaskListTaskCell;
