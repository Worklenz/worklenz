import React from 'react';
import { ColumnConfig } from '../constants/columns';
import { GroupDropZone } from './TaskListDropIndicators';
import TaskGroupHeader from '../TaskGroupHeader';
import { ExampleTaskRows } from './ExampleTaskRows';
import { UNMAPPED_PHASE_ID } from '@/features/task-management/task-list-mode-context';
import type { VirtuosoGroupItem } from '../hooks/useVirtuosoGroups';
import { Task } from '@/types/task-management.types';

export interface TaskListGroupRowProps {
  groupIndex: number;
  group: VirtuosoGroupItem;
  isCollapsed: boolean;
  onToggleCollapse: (groupId: string) => void;
  isDropActive: boolean;
  isBacklogMode: boolean;
  isActiveSprint: boolean;
  visibleColumns: ColumnConfig[];
  isDarkMode: boolean;
  hasNoTasks: boolean;
  isGuest: boolean;
  isWorkReadOnly: boolean;
  isSoftwareProject: boolean;
  currentGrouping?: string | null;
  projectId: string;
  canCreateTask: boolean;
  onTaskCreated: (task: Task, groupId: string, openDrawer: boolean) => void;
}

export const TaskListGroupRow: React.FC<TaskListGroupRowProps> = React.memo(
  ({
    groupIndex,
    group,
    isCollapsed,
    onToggleCollapse,
    isDropActive,
    isBacklogMode,
    isActiveSprint,
    visibleColumns,
    isDarkMode,
    hasNoTasks,
    isGuest,
    isWorkReadOnly,
    isSoftwareProject,
    currentGrouping,
    projectId,
    canCreateTask,
    onTaskCreated,
  }) => {
    const isGroupEmpty = group.actualCount === 0;
    const groupSpacingClass = isBacklogMode ? 'pt-3' : 'mt-2';

    return (
      <div className={groupIndex > 0 ? groupSpacingClass : ''} data-group-header="true">
        <GroupDropZone groupId={group.id} isActive={isDropActive}>
          <TaskGroupHeader
            group={{
              id: group.id,
              name: group.title,
              count: group.actualCount,
              color: isDarkMode ? group.color_code_dark : group.color,
            }}
            isCollapsed={isCollapsed}
            onToggle={() => onToggleCollapse(group.id)}
            projectId={projectId}
          />
          {isGroupEmpty &&
            !isCollapsed &&
            hasNoTasks &&
            !isGuest &&
            !isWorkReadOnly &&
            (!(isBacklogMode && isSoftwareProject) || group.id === UNMAPPED_PHASE_ID) && (
              <ExampleTaskRows
                visibleColumns={visibleColumns}
                isDarkMode={isDarkMode}
                groupId={group.id}
                groupType={currentGrouping || 'status'}
                groupValue={group.id}
                groupName={group.title || ''}
                groupColor={(isDarkMode ? group.color_code_dark || group.color : group.color) || ''}
                projectId={projectId}
                canCreateTask={canCreateTask}
                interactive
                onTaskCreated={(task, options) =>
                  onTaskCreated(task, group.id, !!options?.openDrawer)
                }
              />
            )}
        </GroupDropZone>
      </div>
    );
  }
);

TaskListGroupRow.displayName = 'TaskListGroupRow';
