import React from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { getContrastColor } from '@/utils/colorUtils';
import { useAppSelector } from '@/hooks/useAppSelector';

interface ScheduleTaskGroupHeaderProps {
  group: {
    id: string;
    name: string;
    tasks?: any[];
    color_code?: string;
  };
  isCollapsed: boolean;
  onToggle: () => void;
}

const ScheduleTaskGroupHeader: React.FC<ScheduleTaskGroupHeaderProps> = ({
  group,
  isCollapsed,
  onToggle,
}) => {
  const { t } = useTranslation('schedule');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  const taskCount = group.tasks?.length || 0;
  const headerBackgroundColor = group.color_code || '#F0F0F0';
  const headerTextColor = getContrastColor(headerBackgroundColor);

  return (
    <div className="relative flex items-center">
      <div
        className="inline-flex w-max items-center px-1 cursor-pointer hover:opacity-80 transition-opacity duration-200 ease-in-out border-t border-b border-gray-200 dark:border-gray-700 rounded-t-md pr-2"
        style={{
          backgroundColor: headerBackgroundColor,
          color: headerTextColor,
          position: 'sticky',
          left: 0,
          top: 0,
          zIndex: 25,
          height: '36px',
          minHeight: '36px',
          maxHeight: '36px',
        }}
        onClick={onToggle}
      >
        {/* Chevron button - matching TaskGroupHeader spacing */}
        <div style={{ width: '20px' }} className="flex items-center justify-center">
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

        {/* Group name and count - matching TaskGroupHeader layout */}
        <div className="flex items-center flex-1 ml-1">
          <div className="flex items-center">
            <span className="text-sm font-semibold pr-2" style={{ color: headerTextColor }}>
              {group.name}
            </span>
            <span className="text-sm font-semibold ml-1" style={{ color: headerTextColor }}>
              ({taskCount})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleTaskGroupHeader;
