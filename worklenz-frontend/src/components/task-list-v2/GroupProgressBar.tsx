import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/shared/antd-imports';

interface GroupProgressBarProps {
  todoProgress: number;
  doingProgress: number;
  doneProgress: number;
  groupType: string;
}

const GroupProgressBar: React.FC<GroupProgressBarProps> = ({
  todoProgress,
  doingProgress,
  doneProgress,
  groupType
}) => {
  const { t } = useTranslation('task-management');
  console.log(todoProgress, doingProgress, doneProgress);
  
  // Only show for priority and phase grouping
  if (groupType !== 'priority' && groupType !== 'phase') {
    return null;
  }

  const total = (todoProgress || 0) + (doingProgress || 0) + (doneProgress || 0);
  
  // Don't show if no progress values exist
  if (total === 0) {
    return null;
  }

  // Tooltip content with all values in rows
  const tooltipContent = (
    <div>
      <div>{t('todo')}: {todoProgress || 0}%</div>
      <div>{t('inProgress')}: {doingProgress || 0}%</div>
      <div>{t('done')}: {doneProgress || 0}%</div>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      {/* Compact progress text */}
      <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap font-medium">
        {doneProgress || 0}% {t('done')}
      </span>
      
      {/* Compact progress bar */}
      <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div className="h-full flex">
          {/* Todo section - light green */}
          {todoProgress > 0 && (
            <Tooltip title={tooltipContent} placement="top">
              <div
                className="bg-green-200 dark:bg-green-800 transition-all duration-300"
                style={{ width: `${(todoProgress / total) * 100}%` }}
              />
            </Tooltip>
          )}
          {/* Doing section - medium green */}
          {doingProgress > 0 && (
            <Tooltip title={tooltipContent} placement="top">
              <div
                className="bg-green-400 dark:bg-green-600 transition-all duration-300"
                style={{ width: `${(doingProgress / total) * 100}%` }}
              />
            </Tooltip>
          )}
          {/* Done section - dark green */}
          {doneProgress > 0 && (
            <Tooltip title={tooltipContent} placement="top">
              <div
                className="bg-green-600 dark:bg-green-400 transition-all duration-300"
                style={{ width: `${(doneProgress / total) * 100}%` }}
              />
            </Tooltip>
          )}
        </div>
      </div>
      
      {/* Small legend dots with better spacing */}
      <div className="flex items-center gap-1">
        {todoProgress > 0 && (
          <Tooltip title={tooltipContent} placement="top">
            <div 
              className="w-1.5 h-1.5 bg-green-200 dark:bg-green-800 rounded-full" 
            />
          </Tooltip>
        )}
        {doingProgress > 0 && (
          <Tooltip title={tooltipContent} placement="top">
            <div 
              className="w-1.5 h-1.5 bg-green-400 dark:bg-green-600 rounded-full" 
            />
          </Tooltip>
        )}
        {doneProgress > 0 && (
          <Tooltip title={tooltipContent} placement="top">
            <div 
              className="w-1.5 h-1.5 bg-green-600 dark:bg-green-400 rounded-full" 
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default GroupProgressBar; 