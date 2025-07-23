// TaskNameCell.tsx
import React, { useCallback } from 'react';
import { Flex, Typography, Button } from '@/shared/antd-imports';
import {
  DoubleRightOutlined,
  DownOutlined,
  RightOutlined,
  ExpandAltOutlined,
} from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { useTranslation } from 'react-i18next';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

type TaskRowNameProps = {
  task: IProjectTask;
  isSubTask?: boolean;
  expandedTasks: string[];
  setSelectedTaskId: (taskId: string) => void;
  toggleTaskExpansion: (taskId: string) => void;
};

const TaskRowName = React.memo(
  ({
    task,
    isSubTask = false,
    expandedTasks,
    setSelectedTaskId,
    toggleTaskExpansion,
  }: TaskRowNameProps) => {
    // localization
    const { t } = useTranslation('task-list-table');
    const dispatch = useAppDispatch();

    const handleToggleExpansion = useCallback(
      (taskId: string) => {
        toggleTaskExpansion(taskId);
      },
      [toggleTaskExpansion]
    );

    const handleSelectTask = useCallback(() => {
      if (!task.id) return;
      setSelectedTaskId(task.id);
      dispatch(setShowTaskDrawer(true));
    }, [dispatch, setSelectedTaskId, task.id]);

    // render the toggle arrow icon for tasks with subtasks
    const renderToggleButton = (taskId: string, hasSubtasks: boolean) => {
      if (!hasSubtasks) return null;
      return (
        <button
          onClick={() => handleToggleExpansion(taskId)}
          className="hover flex h-4 w-4 items-center justify-center rounded-sm text-[12px] hover:border hover:border-[#5587f5] hover:bg-[#d0eefa54] transition duration-150"
        >
          {expandedTasks.includes(taskId) ? <DownOutlined /> : <RightOutlined />}
        </button>
      );
    };

    // render the double arrow icon and count label for tasks with subtasks
    const renderSubtasksCountLabel = (
      taskId: string,
      isSubTask: boolean,
      subTasksCount: number
    ) => {
      return (
        !isSubTask && (
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
            <Typography.Text style={{ fontSize: 12, lineHeight: 1 }}>
              {subTasksCount}
            </Typography.Text>
            <DoubleRightOutlined style={{ fontSize: 10 }} />
          </Button>
        )
      );
    };

    return (
      <Flex align="center" justify="space-between" className="relative group">
        <Flex gap={8} align="center">
          {task?.sub_tasks?.length && task.id ? (
            renderToggleButton(task.id, !!task?.sub_tasks?.length)
          ) : (
            <div className="h-4 w-4"></div>
          )}

          {isSubTask && <DoubleRightOutlined style={{ fontSize: 12 }} />}

          <Typography.Text ellipsis={{ expanded: false }}>{task.name}</Typography.Text>

          {renderSubtasksCountLabel(task.id || '', isSubTask, task?.sub_tasks?.length || 0)}
        </Flex>

        <Button
          type="text"
          icon={<ExpandAltOutlined />}
          onClick={handleSelectTask}
          className="invisible group-hover:visible"
          style={{
            backgroundColor: colors.transparent,
            padding: 0,
            height: 'fit-content',
          }}
        >
          {t('openButton')}
        </Button>
      </Flex>
    );
  }
);

export default TaskRowName;
