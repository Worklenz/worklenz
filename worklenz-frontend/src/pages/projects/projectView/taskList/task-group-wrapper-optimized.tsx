import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Flex from 'antd/es/flex';
import useIsomorphicLayoutEffect from '@/hooks/useIsomorphicLayoutEffect';

import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { useAppSelector } from '@/hooks/useAppSelector';

import TaskListTableWrapper from './task-list-table/task-list-table-wrapper/task-list-table-wrapper';
import TaskListBulkActionsBar from '@/components/taskListCommon/task-list-bulk-actions-bar/task-list-bulk-actions-bar';
import TaskTemplateDrawer from '@/components/task-templates/task-template-drawer';

import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';

interface TaskGroupWrapperOptimizedProps {
  taskGroups: ITaskListGroup[];
  groupBy: string;
}

const TaskGroupWrapperOptimized = ({ taskGroups, groupBy }: TaskGroupWrapperOptimizedProps) => {
  const themeMode = useAppSelector((state: any) => state.themeReducer.mode);

  // Use extracted hooks
  useTaskSocketHandlers();

  // Memoize task groups with colors
  const taskGroupsWithColors = useMemo(() => 
    taskGroups?.map(taskGroup => ({
      ...taskGroup,
      displayColor: themeMode === 'dark' ? taskGroup.color_code_dark : taskGroup.color_code,
    })) || [],
    [taskGroups, themeMode]
  );

  // Add drag styles without animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .task-row[data-is-dragging="true"] {
        opacity: 0.5 !important;
        z-index: 1000 !important;
        position: relative !important;
      }
      .task-row {
        /* Remove transitions during drag operations */
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Remove the animation cleanup since we're simplifying the approach

  return (
    <Flex gap={24} vertical>
      {taskGroupsWithColors.map(taskGroup => (
        <TaskListTableWrapper
          key={taskGroup.id}
          taskList={taskGroup.tasks}
          tableId={taskGroup.id}
          name={taskGroup.name}
          groupBy={groupBy}
          statusCategory={taskGroup.category_id}
          color={taskGroup.displayColor}
          activeId={null}
        />
      ))}

      {createPortal(<TaskListBulkActionsBar />, document.body, 'bulk-action-container')}

      {createPortal(
        <TaskTemplateDrawer showDrawer={false} selectedTemplateId="" onClose={() => {}} />,
        document.body,
        'task-template-drawer'
      )}
    </Flex>
  );
};

export default React.memo(TaskGroupWrapperOptimized); 