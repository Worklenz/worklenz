import React, { useMemo, useCallback, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
// @ts-ignore: Heroicons module types
import { ChevronDownIcon, ChevronRightIcon, EllipsisHorizontalIcon, PencilIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Checkbox, Dropdown, Menu, Input, Modal, Badge, Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import { getContrastColor } from '@/utils/colorUtils';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { selectSelectedTaskIds, selectTask, deselectTask } from '@/features/task-management/selection.slice';
import { selectGroups, fetchTasksV3 } from '@/features/task-management/task-management.slice';
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
  };
  isCollapsed: boolean;
  onToggle: () => void;
  projectId: string;
}

const TaskGroupHeader: React.FC<TaskGroupHeaderProps> = ({ group, isCollapsed, onToggle, projectId }) => {
  const { t } = useTranslation('task-management');
  const dispatch = useAppDispatch();
  const selectedTaskIds = useAppSelector(selectSelectedTaskIds);
  const groups = useAppSelector(selectGroups);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const { statusCategories } = useAppSelector(state => state.taskStatusReducer);
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { isOwnerOrAdmin } = useAuthService();
  
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
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

  // Calculate selection state for this group
  const { isAllSelected, isPartiallySelected } = useMemo(() => {
    if (tasksInGroup.length === 0) {
      return { isAllSelected: false, isPartiallySelected: false };
    }
    
    const selectedTasksInGroup = tasksInGroup.filter(taskId => selectedTaskIds.includes(taskId));
    const allSelected = selectedTasksInGroup.length === tasksInGroup.length;
    const partiallySelected = selectedTasksInGroup.length > 0 && selectedTasksInGroup.length < tasksInGroup.length;
    
    return { isAllSelected: allSelected, isPartiallySelected: partiallySelected };
  }, [tasksInGroup, selectedTaskIds]);

  // Handle select all checkbox change
  const handleSelectAllChange = useCallback((e: any) => {
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
  }, [dispatch, isAllSelected, tasksInGroup]);

  // Handle inline name editing
  const handleNameSave = useCallback(async () => {
    if (!editingName.trim() || editingName.trim() === group.name || isRenaming) return;

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
      setIsEditingName(false);
      
    } catch (error) {
      logger.error('Error renaming group:', error);
      setEditingName(group.name);
    } finally {
      setIsRenaming(false);
    }
  }, [editingName, group.name, group.id, currentGrouping, projectId, dispatch, trackMixpanelEvent, isRenaming]);

  const handleNameClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwnerOrAdmin) return;
    setIsEditingName(true);
    setEditingName(group.name);
  }, [group.name, isOwnerOrAdmin]);

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setEditingName(group.name);
    }
    e.stopPropagation();
  }, [group.name, handleNameSave]);

  const handleNameBlur = useCallback(() => {
    setIsEditingName(false);
    setEditingName(group.name);
  }, [group.name]);

  // Handle dropdown menu actions
  const handleRenameGroup = useCallback(() => {
    setDropdownVisible(false);
    setIsEditingName(true);
    setEditingName(group.name);
  }, [group.name]);

  const handleChangeCategory = useCallback(() => {
    setDropdownVisible(false);
    setCategoryModalVisible(true);
  }, []);

  // Handle category change
  const handleCategoryChange = useCallback(async (categoryId: string, e?: React.MouseEvent) => {
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
      setCategoryModalVisible(false);
      
    } catch (error) {
      logger.error('Error changing category:', error);
    } finally {
      setIsChangingCategory(false);
    }
  }, [group.id, projectId, dispatch, trackMixpanelEvent, isChangingCategory]);

  // Create dropdown menu items
  const menuItems = useMemo(() => {
    if (!isOwnerOrAdmin) return [];

    const items = [
      {
        key: 'rename',
        icon: <PencilIcon className="h-4 w-4" />,
        label: currentGrouping === 'status' ? t('renameStatus') : currentGrouping === 'phase' ? t('renamePhase') : t('renameGroup'),
        onClick: (e: any) => {
          e?.domEvent?.stopPropagation();
          handleRenameGroup();
        },
      },
    ];

    // Only show "Change Category" when grouped by status
    if (currentGrouping === 'status') {
      items.push({
        key: 'changeCategory',
        icon: <ArrowPathIcon className="h-4 w-4" />,
        label: t('changeCategory'),
        onClick: (e: any) => {
          e?.domEvent?.stopPropagation();
          handleChangeCategory();
        },
      });
    }

    return items;
  }, [currentGrouping, handleRenameGroup, handleChangeCategory, isOwnerOrAdmin]);

  // Make the group header droppable
  const { isOver, setNodeRef } = useDroppable({
    id: group.id,
    data: {
      type: 'group',
      group,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`inline-flex w-max items-center px-1 cursor-pointer hover:opacity-80 transition-opacity duration-200 ease-in-out border-t border-b border-gray-200 dark:border-gray-700 rounded-t-md pr-2 ${
        isOver ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
      }`}
      style={{
        backgroundColor: isOver ? `${headerBackgroundColor}dd` : headerBackgroundColor,
        color: headerTextColor,
        position: 'sticky',
        top: 0,
        zIndex: 25, // Higher than task rows but lower than column headers (z-30)
        height: '36px',
        minHeight: '36px',
        maxHeight: '36px'
      }}
      onClick={onToggle}
    >
      {/* Drag Handle Space - ultra minimal width */}
      <div style={{ width: '20px' }} className="flex items-center justify-center">
        {/* Chevron button */}
        <button 
          className="p-0 rounded-sm hover:shadow-lg hover:scale-105 transition-all duration-300 ease-out"
          style={{ backgroundColor: 'transparent', color: headerTextColor }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          <div 
            className="transition-transform duration-300 ease-out"
            style={{ 
              transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              transformOrigin: 'center'
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
          onClick={(e) => e.stopPropagation()}
          style={{
            color: headerTextColor,
          }}
        />
      </div>

      {/* Group indicator and name - no gap at all */}
      <div className="flex items-center flex-1 ml-1">
        {/* Group name and count */}
        <div className="flex items-center">
          <span 
            className="text-sm font-semibold pr-2"
            style={{ color: headerTextColor }}
          >
            {group.name}
          </span>
          <span className="text-sm font-semibold ml-1" style={{ color: headerTextColor }}>
            ({group.count})
          </span>
        </div>
      </div>
    </div>
  );
};

export default TaskGroupHeader; 