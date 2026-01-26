import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';

const ScheduleTaskListHeader: React.FC = () => {
  const { t } = useTranslation('schedule');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  const headerStyle = {
    backgroundColor: isDarkMode ? '#141414' : '#f9fafb',
    borderBottom: `1px solid ${isDarkMode ? '#434343' : '#e5e7eb'}`,
  };

  const columnHeaderClass = 'text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider';

  return (
    <div
      className="flex items-center gap-3 px-3 py-3 sticky top-0 z-20"
      style={{ ...headerStyle, minHeight: '44px' }}
    >
      {/* Task Name - 30% */}
      <div className={`flex-[3] ${columnHeaderClass}`}>
        {t('taskName', { defaultValue: 'Task Name' })}
      </div>

      {/* Status - 12% */}
      <div className={`flex-[1.2] ${columnHeaderClass}`}>
        {t('status', { defaultValue: 'Status' })}
      </div>

      {/* Labels - 15% */}
      <div className={`flex-[1.5] ${columnHeaderClass}`}>
        {t('labels', { defaultValue: 'Labels' })}
      </div>

      {/* Logged Time - 10% */}
      <div className={`flex-[1] ${columnHeaderClass}`}>
        {t('estimation', { defaultValue: 'Estimation' })}
      </div>

      {/* Phase - 12% */}
      <div className={`flex-[1.2] ${columnHeaderClass}`}>
        {t('phase', { defaultValue: 'Phase' })}
      </div>

      {/* Priority - 10% */}
      <div className={`flex-[1] ${columnHeaderClass}`}>
        {t('priority', { defaultValue: 'Priority' })}
      </div>

      {/* Start Date - 12% */}
      <div className={`flex-[1.2] ${columnHeaderClass}`}>
        {t('startDate', { defaultValue: 'Start Date' })}
      </div>

      {/* End Date - 12% */}
      <div className={`flex-[1.2] ${columnHeaderClass}`}>
        {t('endDate', { defaultValue: 'End Date' })}
      </div>

      {/* Assignees - 10% */}
      <div className={`flex-[1] ${columnHeaderClass}`}>
        {t('assignees', { defaultValue: 'Assignees' })}
      </div>
    </div>
  );
};

export default ScheduleTaskListHeader;
