import React, { useMemo, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
// @ts-ignore: Heroicons module types
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
      className={`inline-flex w-max items-center px-1 cursor-pointer hover:opacity-80 transition-opacity duration-200 ease-in-out border-b border-gray-200 dark:border-gray-700 rounded-t-md ${
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
        <div className="flex items-center flex-1">
          <span className="text-sm font-semibold">
            {group.name} ({group.count})
          </span>
        </div>
      </div>
    </div>
  );
};

export default TaskGroupHeader; 