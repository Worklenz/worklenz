import React, { useMemo, useCallback, useState } from 'react';
// @ts-ignore: Heroicons module types
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { Checkbox, Dropdown, Menu, Input, Modal, Badge, Flex } from '@/shared/antd-imports';
import GroupProgressBar from './GroupProgressBar';
import { useTranslation } from 'react-i18next';
import { getContrastColor } from '@/utils/colorUtils';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  selectSelectedTaskIds,
  selectTask,
  deselectTask,
} from '@/features/task-management/selection.slice';
import {
  selectGroups,
  fetchTasksV3,
  selectAllTasksArray,
} from '@/features/task-management/task-management.slice';
import { selectCurrentGrouping } from '@/features/task-management/grouping.slice';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';
import { fetchStatuses } from '@/features/taskAttributes/taskStatusSlice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { useAuthService } from '@/hooks/useAuth';
import { ITaskStatusUpdateModel } from '@/types/tasks/task-status-update-model.types';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import logger from '@/utils/errorLogger';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_project_board_column_setting_click } from '@/shared/worklenz-analytics-events';

interface TaskGroupHeaderProps {
  group: {
    id: string;
    name: string;
    count: number;
    color?: string; // Color for the group indicator
    todo_progress?: number;
    doing_progress?: number;
    done_progress?: number;
    groupType?: string;
  };
  isCollapsed: boolean;
  onToggle: () => void;
  projectId: string;
}

const TaskGroupHeader: React.FC<TaskGroupHeaderProps> = ({
  group,
  isCollapsed,
  onToggle,
  projectId,
}) => {
  const { t } = useTranslation('task-management');
  const dispatch = useAppDispatch();
  const selectedTaskIds = useAppSelector(selectSelectedTaskIds);
  const groups = useAppSelector(selectGroups);
  const allTasks = useAppSelector(selectAllTasksArray);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const { statusCategories, status: statusList } = useAppSelector(state => state.taskStatusReducer);
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { isOwnerOrAdmin } = useAuthService();

  const [dropdownVisible, setDropdownVisible] = useState(false);

  const [isRenaming, setIsRenaming] = useState(false);
  const [isChangingCategory, setIsChangingCategory] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(group.name);

  const headerBackgroundColor = group.color || '#F0F0F0'; // Default light gray if no color
  const headerTextColor = getContrastColor(headerBackgroundColor);

  // Get tasks in this group
  const currentGroup = useMemo(() => {
    return groups.find(g => g.id === group.id);
  }, [groups, group.id]);

  const tasksInGroup = useMemo(() => {
    return currentGroup?.taskIds || [];
  }, [currentGroup]);

  // Calculate group progress values dynamically
  const groupProgressValues = useMemo(() => {
    if (!currentGroup || !allTasks.length) {
      return { todoProgress: 0, doingProgress: 0, doneProgress: 0 };
    }

    const tasksInCurrentGroup = currentGroup.taskIds
      .map(taskId => allTasks.find(task => task.id === taskId))
      .filter(task => task !== undefined);

    if (tasksInCurrentGroup.length === 0) {
      return { todoProgress: 0, doingProgress: 0, doneProgress: 0 };
    }

    // If we're grouping by status, show progress based on task completion
    if (currentGrouping === 'status') {
      // For status grouping, calculate based on task progress values
      const progressStats = tasksInCurrentGroup.reduce(
        (acc, task) => {
          const progress = task.progress || 0;
          if (progress === 0) {
            acc.todo += 1;
          } else if (progress === 100) {
            acc.done += 1;
          } else {
            acc.doing += 1;
          }
          return acc;
        },
        { todo: 0, doing: 0, done: 0 }
      );

      const totalTasks = tasksInCurrentGroup.length;

      return {
        todoProgress: totalTasks > 0 ? Math.round((progressStats.todo / totalTasks) * 100) || 0 : 0,
        doingProgress:
          totalTasks > 0 ? Math.round((progressStats.doing / totalTasks) * 100) || 0 : 0,
        doneProgress: totalTasks > 0 ? Math.round((progressStats.done / totalTasks) * 100) || 0 : 0,
      };
    } else {
      // For priority/phase grouping, show progress based on status distribution
      // Use a simplified approach based on status names and common patterns
      const statusCounts = tasksInCurrentGroup.reduce(
        (acc, task) => {
          // Find the status by ID first
          const statusInfo = statusList.find(s => s.id === task.status);
          const statusName = statusInfo?.name?.toLowerCase() || task.status?.toLowerCase() || '';

          // Categorize based on common status name patterns
          if (
            statusName.includes('todo') ||
            statusName.includes('to do') ||
            statusName.includes('pending') ||
            statusName.includes('open') ||
            statusName.includes('backlog')
          ) {
            acc.todo += 1;
          } else if (
            statusName.includes('doing') ||
            statusName.includes('progress') ||
            statusName.includes('active') ||
            statusName.includes('working') ||
            statusName.includes('development')
          ) {
            acc.doing += 1;
          } else if (
            statusName.includes('done') ||
            statusName.includes('completed') ||
            statusName.includes('finished') ||
            statusName.includes('closed') ||
            statusName.includes('resolved')
          ) {
            acc.done += 1;
          } else {
            // Default unknown statuses to "doing" (in progress)
            acc.doing += 1;
          }
          return acc;
        },
        { todo: 0, doing: 0, done: 0 }
      );

      const totalTasks = tasksInCurrentGroup.length;

      return {
        todoProgress: totalTasks > 0 ? Math.round((statusCounts.todo / totalTasks) * 100) || 0 : 0,
        doingProgress:
          totalTasks > 0 ? Math.round((statusCounts.doing / totalTasks) * 100) || 0 : 0,
        doneProgress: totalTasks > 0 ? Math.round((statusCounts.done / totalTasks) * 100) || 0 : 0,
      };
    }
  }, [currentGroup, allTasks, statusList, currentGrouping]);

  // Calculate selection state for this group
  const { isAllSelected, isPartiallySelected } = useMemo(() => {
    if (tasksInGroup.length === 0) {
      return { isAllSelected: false, isPartiallySelected: false };
    }

    const selectedTasksInGroup = tasksInGroup.filter(taskId => selectedTaskIds.includes(taskId));
    const allSelected = selectedTasksInGroup.length === tasksInGroup.length;
    const partiallySelected =
      selectedTasksInGroup.length > 0 && selectedTasksInGroup.length < tasksInGroup.length;

    return { isAllSelected: allSelected, isPartiallySelected: partiallySelected };
  }, [tasksInGroup, selectedTaskIds]);

  // Handle select all checkbox change
  const handleSelectAllChange = useCallback(
    (e: any) => {
      e.stopPropagation();

      if (isAllSelected) {
        // Deselect all tasks in this group
        tasksInGroup.forEach(taskId => {
          dispatch(deselectTask(taskId));
        });
      } else {
        // Select all tasks in this group
        tasksInGroup.forEach(taskId => {
          dispatch(selectTask(taskId));
        });
      }
    },
    [dispatch, isAllSelected, tasksInGroup]
  );

  // Handle inline name editing
  const handleNameSave = useCallback(async () => {
    // If no changes or already renaming, just exit editing mode
    if (!editingName.trim() || editingName.trim() === group.name || isRenaming) {
      setIsEditingName(false);
      setEditingName(group.name);
      return;
    }

    setIsRenaming(true);
    try {
      if (currentGrouping === 'status') {
        // Extract status ID from group ID (format: "status-{statusId}")
        const statusId = group.id.replace('status-', '');
        const body: ITaskStatusUpdateModel = {
          name: editingName.trim(),
          project_id: projectId,
        };

        await statusApiService.updateNameOfStatus(statusId, body, projectId);
        trackMixpanelEvent(evt_project_board_column_setting_click, { Rename: 'Status' });
        dispatch(fetchStatuses(projectId));
      } else if (currentGrouping === 'phase') {
        // Extract phase ID from group ID (format: "phase-{phaseId}")
        const phaseId = group.id.replace('phase-', '');
        const body = { id: phaseId, name: editingName.trim() };

        await phasesApiService.updateNameOfPhase(phaseId, body as ITaskPhase, projectId);
        trackMixpanelEvent(evt_project_board_column_setting_click, { Rename: 'Phase' });
        dispatch(fetchPhasesByProjectId(projectId));
      }

      // Refresh task list to get updated group names
      dispatch(fetchTasksV3(projectId));
    } catch (error) {
      logger.error('Error renaming group:', error);
      setEditingName(group.name);
    } finally {
      setIsEditingName(false);
      setIsRenaming(false);
    }
  }, [
    editingName,
    group.name,
    group.id,
    currentGrouping,
    projectId,
    dispatch,
    trackMixpanelEvent,
    isRenaming,
  ]);

  const handleNameClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isOwnerOrAdmin) return;
      setIsEditingName(true);
      setEditingName(group.name);
    },
    [group.name, isOwnerOrAdmin]
  );

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleNameSave();
      } else if (e.key === 'Escape') {
        setIsEditingName(false);
        setEditingName(group.name);
      }
      e.stopPropagation();
    },
    [group.name, handleNameSave]
  );

  const handleNameBlur = useCallback(() => {
    handleNameSave();
  }, [handleNameSave]);

  // Handle dropdown menu actions
  const handleRenameGroup = useCallback(() => {
    setDropdownVisible(false);
    setIsEditingName(true);
    setEditingName(group.name);
  }, [group.name]);

  // Handle category change
  const handleCategoryChange = useCallback(
    async (categoryId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (isChangingCategory) return;

      setIsChangingCategory(true);
      try {
        // Extract status ID from group ID (format: "status-{statusId}")
        const statusId = group.id.replace('status-', '');

        await statusApiService.updateStatusCategory(statusId, categoryId, projectId);
        trackMixpanelEvent(evt_project_board_column_setting_click, { 'Change category': 'Status' });

        // Refresh status list and tasks
        dispatch(fetchStatuses(projectId));
        dispatch(fetchTasksV3(projectId));
      } catch (error) {
        logger.error('Error changing category:', error);
      } finally {
        setIsChangingCategory(false);
      }
    },
    [group.id, projectId, dispatch, trackMixpanelEvent, isChangingCategory]
  );

  // Create dropdown menu items
  const menuItems = useMemo(() => {
    if (!isOwnerOrAdmin) return [];

    const items = [
      {
        key: 'rename',
        icon: <PencilIcon className="h-4 w-4" />,
        label:
          currentGrouping === 'status'
            ? t('renameStatus')
            : currentGrouping === 'phase'
              ? t('renamePhase')
              : t('renameGroup'),
        onClick: (e: any) => {
          e?.domEvent?.stopPropagation();
          handleRenameGroup();
        },
      },
    ];

    // Only show "Change Category" when grouped by status
    if (currentGrouping === 'status') {
      const categorySubMenuItems = statusCategories.map(category => ({
        key: `category-${category.id}`,
        label: (
          <div className="flex items-center gap-2">
            <Badge color={category.color_code} />
            <span>{category.name}</span>
          </div>
        ),
        onClick: (e: any) => {
          e?.domEvent?.stopPropagation();
          handleCategoryChange(category.id || '', e?.domEvent);
        },
      }));

      items.push({
        key: 'changeCategory',
        icon: <ArrowPathIcon className="h-4 w-4" />,
        label: t('changeCategory'),
        children: categorySubMenuItems,
      } as any);
    }

    return items;
  }, [
    currentGrouping,
    handleRenameGroup,
    handleCategoryChange,
    isOwnerOrAdmin,
    statusCategories,
    t,
  ]);

  return (
    <div className="relative flex items-center">
      <div
        className="inline-flex w-max items-center px-1 cursor-pointer hover:opacity-80 transition-opacity duration-200 ease-in-out border-t border-b border-gray-200 dark:border-gray-700 rounded-t-md pr-2"
        style={{
          backgroundColor: headerBackgroundColor,
          color: headerTextColor,
          position: 'sticky',
          top: 0,
          zIndex: 25, // Higher than task rows but lower than column headers (z-30)
          height: '36px',
          minHeight: '36px',
          maxHeight: '36px',
        }}
        onClick={onToggle}
      >
        {/* Drag Handle Space - ultra minimal width */}
        <div style={{ width: '20px' }} className="flex items-center justify-center">
          {/* Chevron button */}
          <button
            className="p-0 rounded-sm hover:shadow-lg hover:scale-105 transition-all duration-300 ease-out"
            style={{ backgroundColor: 'transparent', color: headerTextColor }}
            onClick={e => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <div
              className="transition-transform duration-300 ease-out"
              style={{
                transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                transformOrigin: 'center',
              }}
            >
              <ChevronRightIcon className="h-3 w-3" style={{ color: headerTextColor }} />
            </div>
          </button>
        </div>

        {/* Select All Checkbox Space - ultra minimal width */}
        <div style={{ width: '28px' }} className="flex items-center justify-center">
          <Checkbox
            checked={isAllSelected}
            indeterminate={isPartiallySelected}
            onChange={handleSelectAllChange}
            onClick={e => e.stopPropagation()}
            style={{
              color: headerTextColor,
            }}
          />
        </div>

        {/* Group indicator and name - no gap at all */}
        <div className="flex items-center flex-1 ml-1">
          {/* Group name and count */}
          <div className="flex items-center">
            {isEditingName ? (
              <Input
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={handleNameBlur}
                autoFocus
                size="small"
                className="text-sm font-semibold"
                style={{
                  width: 'auto',
                  minWidth: '100px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: headerTextColor,
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="text-sm font-semibold pr-2 cursor-pointer hover:underline"
                style={{ color: headerTextColor }}
                onClick={handleNameClick}
              >
                {group.name}
              </span>
            )}
            <span className="text-sm font-semibold ml-1" style={{ color: headerTextColor }}>
              ({group.count})
            </span>
          </div>
        </div>

        {/* Three-dot menu - only show for status and phase grouping */}
        {menuItems.length > 0 && (currentGrouping === 'status' || currentGrouping === 'phase') && (
          <div className="flex items-center ml-2">
            <Dropdown
              menu={{ items: menuItems }}
              trigger={['click']}
              open={dropdownVisible}
              onOpenChange={setDropdownVisible}
              placement="bottomRight"
              overlayStyle={{ zIndex: 1000 }}
            >
              <button
                className="p-1 rounded-sm hover:bg-black hover:bg-opacity-10 transition-colors duration-200"
                style={{ color: headerTextColor }}
                onClick={e => {
                  e.stopPropagation();
                  setDropdownVisible(!dropdownVisible);
                }}
              >
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </button>
            </Dropdown>
          </div>
        )}
      </div>

      {/* Progress Bar - sticky to the right edge during horizontal scroll */}
      {(currentGrouping === 'priority' || currentGrouping === 'phase') &&
        !(
          groupProgressValues.todoProgress === 0 &&
          groupProgressValues.doingProgress === 0 &&
          groupProgressValues.doneProgress === 0
        ) && (
          <div
            className="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm px-3 py-1.5 ml-auto"
            style={{
              position: 'sticky',
              right: '16px',
              zIndex: 35, // Higher than header
              minWidth: '160px',
              height: '30px',
            }}
          >
            <GroupProgressBar
              todoProgress={groupProgressValues.todoProgress}
              doingProgress={groupProgressValues.doingProgress}
              doneProgress={groupProgressValues.doneProgress}
              groupType={group.groupType || currentGrouping || ''}
            />
          </div>
        )}
    </div>
  );
};

export default TaskGroupHeader;
