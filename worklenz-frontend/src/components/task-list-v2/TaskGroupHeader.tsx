import React from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getContrastColor } from '@/utils/colorUtils';

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
  const headerBackgroundColor = group.color || '#F0F0F0'; // Default light gray if no color
  const headerTextColor = getContrastColor(headerBackgroundColor);

  return (
    <div
      className="flex items-center px-4 py-2 cursor-pointer hover:opacity-80 transition-opacity duration-200 ease-in-out border-b border-gray-200 dark:border-gray-700"
      style={{
        backgroundColor: headerBackgroundColor,
        color: headerTextColor,
        position: 'sticky',
        top: 0,
        zIndex: 20 // Higher than sticky columns (zIndex: 1) and column headers (zIndex: 2)
      }}
      onClick={onToggle}
    >
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