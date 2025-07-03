import React, { useMemo, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Checkbox } from 'antd';
import { getContrastColor } from '@/utils/colorUtils';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { selectSelectedTaskIds, selectTask, deselectTask } from '@/features/task-management/selection.slice';
import { selectGroups } from '@/features/task-management/task-management.slice';

interface TaskGroupHeaderProps {
  group: {
    id: string;
    name: string;
    count: number;
    color?: string; // Color for the group indicator
  };
  isCollapsed: boolean;
  onToggle: () => void;
}

const TaskGroupHeader: React.FC<TaskGroupHeaderProps> = ({ group, isCollapsed, onToggle }) => {
  const dispatch = useAppDispatch();
  const selectedTaskIds = useAppSelector(selectSelectedTaskIds);
  const groups = useAppSelector(selectGroups);
  
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
      className={`flex items-center px-4 py-2 cursor-pointer hover:opacity-80 transition-opacity duration-200 ease-in-out border-b border-gray-200 dark:border-gray-700 ${
        isOver ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
      }`}
      style={{
        backgroundColor: isOver ? `${headerBackgroundColor}dd` : headerBackgroundColor,
        color: headerTextColor,
        position: 'sticky',
        top: 0,
        zIndex: 20 // Higher than sticky columns (zIndex: 1) and column headers (zIndex: 2)
      }}
      onClick={onToggle}
    >
      {/* Drag Handle Space */}
      <div style={{ width: '32px' }} className="flex items-center justify-center">
        {/* Chevron button */}
        <button 
          className="p-1 rounded-md hover:bg-opacity-20 transition-colors"
          style={{ backgroundColor: headerBackgroundColor, color: headerTextColor, borderColor: headerTextColor, border: '1px solid' }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-4 w-4" style={{ color: headerTextColor }} />
          ) : (
            <ChevronDownIcon className="h-4 w-4" style={{ color: headerTextColor }} />
          )}
        </button>
      </div>

      {/* Select All Checkbox Space */}
      <div style={{ width: '40px' }} className="flex items-center justify-center">
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

      {/* Group indicator and name */}
      <div className="ml-2 flex items-center gap-3 flex-1">
        {/* Color indicator (removed as full header is colored) */}
        
        {/* Group name and count */}
        <div className="flex items-center justify-between flex-1">
          <span className="text-sm font-medium">
            {group.name}
          </span>
          <span 
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: getContrastColor(headerTextColor) === '#000000' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)', color: headerTextColor }}
          >
            {group.count}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TaskGroupHeader; 