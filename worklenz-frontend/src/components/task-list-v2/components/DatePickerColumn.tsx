import React, { memo, useCallback, useState } from 'react';
import { DatePicker, Tooltip } from '@/shared/antd-imports';
import { CloseOutlined } from '@/shared/antd-imports';
import { dayjs, taskManagementAntdConfig } from '@/shared/antd-imports';
import { Task } from '@/types/task-management.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useTranslation } from 'react-i18next';

interface DatePickerColumnProps {
  width: string;
  task: Task;
  field: 'dueDate' | 'startDate';
  formattedDate: string | null;
  dateValue: dayjs.Dayjs | undefined;
  isDarkMode: boolean;
  activeDatePicker: string | null;
  onActiveDatePickerChange: (field: string | null) => void;
}

export const DatePickerColumn: React.FC<DatePickerColumnProps> = memo(({
  width,
  task,
  field,
  formattedDate,
  dateValue,
  isDarkMode,
  activeDatePicker,
  onActiveDatePickerChange
}) => {
  const { socket, connected } = useSocket();
  const { t } = useTranslation('task-list-table');

  // Handle date change
  const handleDateChange = useCallback(
    (date: dayjs.Dayjs | null) => {
      if (!connected || !socket) return;

      const eventType =
        field === 'startDate'
          ? SocketEvents.TASK_START_DATE_CHANGE
          : SocketEvents.TASK_END_DATE_CHANGE;
      const dateField = field === 'startDate' ? 'start_date' : 'end_date';

      socket.emit(
        eventType.toString(),
        JSON.stringify({
          task_id: task.id,
          [dateField]: date?.format('YYYY-MM-DD'),
          parent_task: null,
          time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      );

      // Close the date picker after selection
      onActiveDatePickerChange(null);
    },
    [connected, socket, task.id, field, onActiveDatePickerChange]
  );

  // Handle clear date
  const handleClearDate = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDateChange(null);
  }, [handleDateChange]);

  // Handle open date picker
  const handleOpenDatePicker = useCallback(() => {
    onActiveDatePickerChange(field);
  }, [field, onActiveDatePickerChange]);

  const isActive = activeDatePicker === field;
  const placeholder = field === 'dueDate' ? t('dueDatePlaceholder') : t('startDatePlaceholder');
  const clearTitle = field === 'dueDate' ? t('clearDueDate') : t('clearStartDate');
  const setTitle = field === 'dueDate' ? t('setDueDate') : t('setStartDate');

  return (
    <div className="flex items-center justify-center px-2 relative group border-r border-gray-200 dark:border-gray-700" style={{ width }}>
      {isActive ? (
        <div className="w-full relative">
          <DatePicker
            {...taskManagementAntdConfig.datePickerDefaults}
            className="w-full bg-transparent border-none shadow-none"
            value={dateValue}
            onChange={handleDateChange}
            placeholder={placeholder}
            allowClear={false}
            suffixIcon={null}
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                onActiveDatePickerChange(null);
              }
            }}
            autoFocus
          />
          {/* Custom clear button */}
          {dateValue && (
            <button
              onClick={handleClearDate}
              className={`absolute right-1 top-1/2 transform -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-xs ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title={clearTitle}
            >
              <CloseOutlined style={{ fontSize: '10px' }} />
            </button>
          )}
        </div>
      ) : (
        <div 
          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors text-center"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDatePicker();
          }}
        >
          {formattedDate ? (
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {formattedDate}
            </span>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {setTitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

DatePickerColumn.displayName = 'DatePickerColumn'; 