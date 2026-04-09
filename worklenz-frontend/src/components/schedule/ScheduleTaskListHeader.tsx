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

  const columnHeaderClass =
    'text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider';

  return (
    <div
      className="flex items-center gap-3 px-3 py-3 sticky top-0 z-20"
      style={{ ...headerStyle, minHeight: '44px' }}
    >
      {/* Task Key - 10% */}
      <div className={`flex-[1] ${columnHeaderClass}`}>{t('key', { defaultValue: 'Key' })}</div>

      {/* Task Name - 35% */}
      <div className={`flex-[3.5] ${columnHeaderClass}`}>
        {t('taskName', { defaultValue: 'Task Name' })}
      </div>

      {/* Status - 13% */}
      <div className={`flex-[1.3] ${columnHeaderClass}`}>
        {t('status', { defaultValue: 'Status' })}
      </div>

      {/* Estimation - 11% */}
      <div className={`flex-[1.1] ${columnHeaderClass}`}>
        {t('estimation', { defaultValue: 'Estimation' })}
      </div>

      {/* Logged Time - 11% */}
      <div className={`flex-[1.1] ${columnHeaderClass}`}>
        {t('loggedTime', { defaultValue: 'Logged' })}
      </div>

      {/* Priority - 10% */}
      <div className={`flex-[1] ${columnHeaderClass}`}>
        {t('priority', { defaultValue: 'Priority' })}
      </div>

      {/* Start Date - 13% */}
      <div className={`flex-[1.3] ${columnHeaderClass}`}>
        {t('startDate', { defaultValue: 'Start Date' })}
      </div>

      {/* End Date - 13% */}
      <div className={`flex-[1.3] ${columnHeaderClass}`}>
        {t('endDate', { defaultValue: 'End Date' })}
      </div>
    </div>
  );
};

export default ScheduleTaskListHeader;
