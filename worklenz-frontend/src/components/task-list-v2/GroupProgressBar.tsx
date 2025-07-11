import React from 'react';
import { useTranslation } from 'react-i18next';

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
  
  // Only show for priority and phase grouping
  if (groupType !== 'priority' && groupType !== 'phase') {
    return null;
  }

  const total = todoProgress + doingProgress + doneProgress;
  
  // Don't show if no progress values exist
  if (total === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Compact progress text */}
      <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap font-medium">
        {doneProgress}% {t('done')}
      </span>
      
      {/* Compact progress bar */}
      <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div className="h-full flex">
          {/* Todo section - light gray */}
          {todoProgress > 0 && (
            <div
              className="bg-gray-300 dark:bg-gray-600 transition-all duration-300"
              style={{ width: `${(todoProgress / total) * 100}%` }}
              title={`${t('todo')}: ${todoProgress}%`}
            />
          )}
          {/* Doing section - blue */}
          {doingProgress > 0 && (
            <div
              className="bg-blue-500 transition-all duration-300"
              style={{ width: `${(doingProgress / total) * 100}%` }}
              title={`${t('inProgress')}: ${doingProgress}%`}
            />
          )}
          {/* Done section - green */}
          {doneProgress > 0 && (
            <div
              className="bg-green-500 transition-all duration-300"
              style={{ width: `${(doneProgress / total) * 100}%` }}
              title={`${t('done')}: ${doneProgress}%`}
            />
          )}
        </div>
      </div>
      
      {/* Small legend dots with better spacing */}
      <div className="flex items-center gap-1">
        {todoProgress > 0 && (
          <div 
            className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" 
            title={`${t('todo')}: ${todoProgress}%`}
          />
        )}
        {doingProgress > 0 && (
          <div 
            className="w-1.5 h-1.5 bg-blue-500 rounded-full" 
            title={`${t('inProgress')}: ${doingProgress}%`}
          />
        )}
        {doneProgress > 0 && (
          <div 
            className="w-1.5 h-1.5 bg-green-500 rounded-full" 
            title={`${t('done')}: ${doneProgress}%`}
          />
        )}
      </div>
    </div>
  );
};

export default GroupProgressBar; 