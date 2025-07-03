import React from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

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
  return (
    <div
      className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700"
      onClick={onToggle}
    >
      {/* Chevron button */}
      <button 
        className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {isCollapsed ? (
          <ChevronRightIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        )}
      </button>

      {/* Group indicator and name */}
      <div className="ml-2 flex items-center gap-3 flex-1">
        {/* Color indicator */}
        <div 
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: group.color || '#94A3B8' }}
        />
        
        {/* Group name and count */}
        <div className="flex items-center justify-between flex-1">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {group.name}
          </span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {group.count}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TaskGroupHeader; 