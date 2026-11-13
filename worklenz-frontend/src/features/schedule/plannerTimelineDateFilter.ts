import { useState, useCallback } from 'react';
import { Dayjs } from 'dayjs';
import { message } from '../../shared/antd-imports';

export interface UseTimelineDateFilterOptions {
  t: (key: string, options?: { defaultValue?: string }) => string;
  showMessageError?: (content: string) => void;
}

/**
 * Computes disabled date rule for timeline RangePicker:
 * - When activeField is explicitly set ('start' or 'end'), it takes precedence.
 * - Partial-selection fallback is applied ONLY when activeField is null.
 */
export const isTimelineDateDisabled = (
  current: Dayjs,
  calendarDates: [Dayjs | null, Dayjs | null] | null,
  dateFilter: [Dayjs, Dayjs] | null,
  activeField: 'start' | 'end' | null
): boolean => {
  if (!current) return false;

  const startDate = calendarDates?.[0] ?? dateFilter?.[0];
  const endDate = calendarDates?.[1] ?? dateFilter?.[1];

  // 1. Explicit focused field takes precedence
  if (activeField === 'end') {
    return startDate ? current.isBefore(startDate, 'day') : false;
  }

  if (activeField === 'start') {
    return endDate ? current.isAfter(endDate, 'day') : false;
  }

  // 2. Partial-selection fallback ONLY when activeField is null
  if (activeField === null) {
    if (calendarDates?.[0] && !calendarDates?.[1]) {
      return startDate ? current.isBefore(startDate, 'day') : false;
    }
    if (!calendarDates?.[0] && calendarDates?.[1]) {
      return endDate ? current.isAfter(endDate, 'day') : false;
    }
  }

  return false;
};

/**
 * Hook providing state and production callbacks for the Planner Timeline date range filter.
 */
export const useTimelineDateFilter = ({
  t,
  showMessageError = (msg: string) => message.error(msg),
}: UseTimelineDateFilterOptions) => {
  const [dateFilter, setDateFilter] = useState<[Dayjs, Dayjs] | null>(null);
  const [calendarDates, setCalendarDates] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [activeField, setActiveField] = useState<'start' | 'end' | null>(null);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);

  const disabledDate = useCallback(
    (current: Dayjs) => isTimelineDateDisabled(current, calendarDates, dateFilter, activeField),
    [calendarDates, dateFilter, activeField]
  );

  const onCalendarChange = useCallback(
    (
      dates: [Dayjs | null, Dayjs | null] | null,
      _dateStrings?: [string, string],
      info?: { range?: 'start' | 'end' }
    ) => {
      setCalendarDates(dates);

      // Validate complete inverted range before submission
      if (dates && dates[0] && dates[1] && dates[0].isAfter(dates[1], 'day')) {
        const errorMsg = t('endDateBeforeStartDate', {
          defaultValue: 'End date cannot be earlier than start date',
        });
        setDateRangeError(errorMsg);
        showMessageError(errorMsg);
      } else {
        // Clear error once draft is no longer inverted
        setDateRangeError(null);
      }

      if (info?.range === 'start') {
        setActiveField('end');
      } else if (info?.range === 'end') {
        setActiveField('start');
      }
    },
    [t, showMessageError]
  );

  const onChange = useCallback(
    (dates: [Dayjs | null, Dayjs | null] | null, _dateStrings?: [string, string]) => {
      if (!dates || !dates[0] || !dates[1]) {
        setDateFilter(null);
        setDateRangeError(null);
        return;
      }

      const [start, end] = dates;
      if (start.isAfter(end, 'day')) {
        const errorMsg = t('endDateBeforeStartDate', {
          defaultValue: 'End date cannot be earlier than start date',
        });
        setDateRangeError(errorMsg);
        showMessageError(errorMsg);
        return; // Preserves previously applied valid range
      }

      setDateRangeError(null);
      setDateFilter([start, end]);
    },
    [t, showMessageError]
  );

  const onFocus = useCallback((_e: any, info?: { range?: 'start' | 'end' }) => {
    if (info?.range) {
      setActiveField(info.range);
    }
  }, []);

  const onOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setCalendarDates(null);
      setActiveField(null);
      setDateRangeError(null);
    }
  }, []);

  const clearAll = useCallback(() => {
    setDateFilter(null);
    setCalendarDates(null);
    setActiveField(null);
    setDateRangeError(null);
  }, []);

  return {
    dateFilter,
    setDateFilter,
    calendarDates,
    setCalendarDates,
    activeField,
    setActiveField,
    dateRangeError,
    setDateRangeError,
    disabledDate,
    onCalendarChange,
    onChange,
    onFocus,
    onOpenChange,
    clearAll,
  };
};
