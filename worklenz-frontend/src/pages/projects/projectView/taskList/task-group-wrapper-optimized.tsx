import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Flex from 'antd/es/flex';
import useIsomorphicLayoutEffect from '@/hooks/useIsomorphicLayoutEffect';

import {
  DndContext,
  pointerWithin,
} from '@dnd-kit/core';

import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { useAppSelector } from '@/hooks/useAppSelector';

import TaskListTableWrapper from './task-list-table/task-list-table-wrapper/task-list-table-wrapper';
import TaskListBulkActionsBar from '@/components/taskListCommon/task-list-bulk-actions-bar/task-list-bulk-actions-bar';
import TaskTemplateDrawer from '@/components/task-templates/task-template-drawer';

import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import { useTaskDragAndDrop } from '@/hooks/useTaskDragAndDrop';

interface TaskGroupWrapperOptimizedProps {
  taskGroups: ITaskListGroup[];
  groupBy: string;
}

const TaskGroupWrapperOptimized = ({ taskGroups, groupBy }: TaskGroupWrapperOptimizedProps) => {
  const themeMode = useAppSelector((state: any) => state.themeReducer.mode);

  // Use extracted hooks
  useTaskSocketHandlers();
  const {
    activeId,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    resetTaskRowStyles,
  } = useTaskDragAndDrop({ taskGroups, groupBy });

  // Memoize task groups with colors
  const taskGroupsWithColors = useMemo(() => 
    taskGroups?.map(taskGroup => ({
      ...taskGroup,
      displayColor: themeMode === 'dark' ? taskGroup.color_code_dark : taskGroup.color_code,
    })) || [],
    [taskGroups, themeMode]
  );

  // Add drag styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .task-row[data-is-dragging="true"] {
        opacity: 0.5 !important;
        transform: rotate(5deg) !important;
        z-index: 1000 !important;
        position: relative !important;
      }
      .task-row {
        transition: transform 0.2s ease, opacity 0.2s ease;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Handle animation cleanup after drag ends
  useIsomorphicLayoutEffect(() => {
    if (activeId === null) {
      const timeoutId = setTimeout(resetTaskRowStyles, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [activeId, resetTaskRowStyles]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
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
            activeId={activeId}
          />
        ))}

        {createPortal(<TaskListBulkActionsBar />, document.body, 'bulk-action-container')}

        {createPortal(
          <TaskTemplateDrawer showDrawer={false} selectedTemplateId="" onClose={() => {}} />,
          document.body,
          'task-template-drawer'
        )}
      </Flex>
    </DndContext>
  );
};

export default React.memo(TaskGroupWrapperOptimized); 