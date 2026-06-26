import React, { memo, useCallback, useState } from 'react';
import { DatePicker } from '@/shared/antd-imports';
import { CloseOutlined } from '@/shared/antd-imports';
import { dayjs } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

interface ProjectDatePickerProps {
  field: 'start_date' | 'end_date';
  value: dayjs.Dayjs | null | undefined;
  disabled?: boolean;
  disabledDate?: (current: dayjs.Dayjs) => boolean;
  onChange: (date: dayjs.Dayjs | null) => void;
}

export const ProjectDatePicker: React.FC<ProjectDatePickerProps> = memo(
  ({ field, value, disabled, disabledDate, onChange }) => {
    const { t } = useTranslation('project-drawer');
    const [isActive, setIsActive] = useState(false);

    const handleDateChange = useCallback(
      (date: dayjs.Dayjs | null) => {
        onChange(date);
        setIsActive(false);
      },
      [onChange]
    );

    const handleClearDate = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleDateChange(null);
      },
      [handleDateChange]
    );

    const handleOpenDatePicker = useCallback(() => {
      if (!disabled) {
        setIsActive(true);
      }
    }, [disabled]);

    const placeholder = field === 'start_date' ? t('selectStartDate') : t('selectEndDate');
    const clearTitle = field === 'start_date' ? t('clearStartDate') : t('clearEndDate');

    if (isActive) {
      return (
        <div className="relative">
          <DatePicker
            className="w-full"
            value={value}
            onChange={handleDateChange}
            placeholder={placeholder}
            allowClear={false}
            suffixIcon={null}
            open={true}
            onOpenChange={open => {
              if (!open) setIsActive(false);
            }}
            // ✅ disabledDate is now correctly forwarded — greys out invalid calendar dates
            disabledDate={disabledDate}
            disabled={disabled}
            autoFocus
          />
          {value && (
            <button
              onClick={handleClearDate}
              className="absolute right-8 top-1/2 transform -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              title={clearTitle}
            >
              <CloseOutlined style={{ fontSize: '10px' }} />
            </button>
          )}
        </div>
      );
    }

    return (
      <div
        className={`w-full min-h-[32px] px-3 py-1 border border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors flex items-center ${
          disabled ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed' : 'bg-white dark:bg-gray-900'
        }`}
        onClick={handleOpenDatePicker}
      >
        {value ? (
          <span className="text-sm text-gray-900 dark:text-gray-100">
            {value.format('MMM DD, YYYY')}
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500">{placeholder}</span>
        )}
      </div>
    );
  }
);

ProjectDatePicker.displayName = 'ProjectDatePicker';
