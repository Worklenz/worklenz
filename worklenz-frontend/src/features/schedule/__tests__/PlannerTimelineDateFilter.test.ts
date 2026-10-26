import { describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import { renderHook, act } from '@testing-library/react';
import {
  isTimelineDateDisabled,
  useTimelineDateFilter,
} from '../plannerTimelineDateFilter';

describe('PlannerTimelineDateFilter Production Rules and Callbacks', () => {
  const mockTranslate = (key: string, options?: { defaultValue?: string }) => {
    if (key === 'endDateBeforeStartDate') {
      return 'End date cannot be earlier than start date';
    }
    return options?.defaultValue || key;
  };

  describe('isTimelineDateDisabled rule', () => {
    it('disables dates before Start Date when activeField is end (on first attempt)', () => {
      const startDate = dayjs('2026-10-15');
      // activeField is explicitly 'end'
      expect(isTimelineDateDisabled(dayjs('2026-10-14'), [startDate, null], null, 'end')).toBe(true);
      expect(isTimelineDateDisabled(dayjs('2026-10-01'), [startDate, null], null, 'end')).toBe(true);
      expect(isTimelineDateDisabled(dayjs('2026-10-15'), [startDate, null], null, 'end')).toBe(false);
      expect(isTimelineDateDisabled(dayjs('2026-10-20'), [startDate, null], null, 'end')).toBe(false);
    });

    it('disables dates after End Date when activeField is start (user picked End Date first)', () => {
      const endDate = dayjs('2026-10-15');
      // activeField is explicitly 'start'
      expect(isTimelineDateDisabled(dayjs('2026-10-16'), [null, endDate], null, 'start')).toBe(true);
      expect(isTimelineDateDisabled(dayjs('2026-10-31'), [null, endDate], null, 'start')).toBe(true);
      expect(isTimelineDateDisabled(dayjs('2026-10-15'), [null, endDate], null, 'start')).toBe(false);
      expect(isTimelineDateDisabled(dayjs('2026-10-10'), [null, endDate], null, 'start')).toBe(false);
    });

    it('regression: allows revising provisional start date earlier when start input is refocused', () => {
      // User picked October 15 as start, end is empty.
      // Then user focuses the start input to revise it to October 10.
      const provisionalStart = dayjs('2026-10-15');
      const calendarDates: [dayjs.Dayjs | null, dayjs.Dayjs | null] = [provisionalStart, null];
      const activeField = 'start';

      // October 10 (earlier than provisional October 15) must NOT be disabled
      expect(isTimelineDateDisabled(dayjs('2026-10-10'), calendarDates, null, activeField)).toBe(false);
      expect(isTimelineDateDisabled(dayjs('2026-10-01'), calendarDates, null, activeField)).toBe(false);
      expect(isTimelineDateDisabled(dayjs('2026-10-15'), calendarDates, null, activeField)).toBe(false);
    });

    it('symmetric regression: allows revising provisional end date later when end input is refocused', () => {
      // User picked October 15 as provisional end date, start is empty.
      // Then user focuses the end input to revise it to October 25.
      const provisionalEnd = dayjs('2026-10-15');
      const calendarDates: [dayjs.Dayjs | null, dayjs.Dayjs | null] = [null, provisionalEnd];
      const activeField = 'end';

      // October 25 (later than provisional October 15) must NOT be disabled
      expect(isTimelineDateDisabled(dayjs('2026-10-25'), calendarDates, null, activeField)).toBe(false);
      expect(isTimelineDateDisabled(dayjs('2026-10-31'), calendarDates, null, activeField)).toBe(false);
      expect(isTimelineDateDisabled(dayjs('2026-10-15'), calendarDates, null, activeField)).toBe(false);
    });

    it('disables dates before Start Date when modifying End Date on an existing locked range', () => {
      const existingRange: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs('2026-10-10'), dayjs('2026-10-20')];
      // User opens picker and focuses End Date input (calendarDates is null initially)
      expect(isTimelineDateDisabled(dayjs('2026-10-09'), null, existingRange, 'end')).toBe(true);
      expect(isTimelineDateDisabled(dayjs('2026-10-01'), null, existingRange, 'end')).toBe(true);
      expect(isTimelineDateDisabled(dayjs('2026-10-10'), null, existingRange, 'end')).toBe(false);
      expect(isTimelineDateDisabled(dayjs('2026-10-25'), null, existingRange, 'end')).toBe(false);
    });

    it('disables dates after End Date when modifying Start Date on an existing locked range', () => {
      const existingRange: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs('2026-10-10'), dayjs('2026-10-20')];
      // User opens picker and focuses Start Date input
      expect(isTimelineDateDisabled(dayjs('2026-10-21'), null, existingRange, 'start')).toBe(true);
      expect(isTimelineDateDisabled(dayjs('2026-10-30'), null, existingRange, 'start')).toBe(true);
      expect(isTimelineDateDisabled(dayjs('2026-10-20'), null, existingRange, 'start')).toBe(false);
      expect(isTimelineDateDisabled(dayjs('2026-10-05'), null, existingRange, 'start')).toBe(false);
    });

    it('applies partial-selection fallback only when activeField is null', () => {
      const startDate = dayjs('2026-10-15');
      // activeField is null, start is present, end is empty -> fallback treats as selecting end date
      expect(isTimelineDateDisabled(dayjs('2026-10-10'), [startDate, null], null, null)).toBe(true);
      expect(isTimelineDateDisabled(dayjs('2026-10-20'), [startDate, null], null, null)).toBe(false);

      const endDate = dayjs('2026-10-15');
      // activeField is null, end is present, start is empty -> fallback treats as selecting start date
      expect(isTimelineDateDisabled(dayjs('2026-10-20'), [null, endDate], null, null)).toBe(true);
      expect(isTimelineDateDisabled(dayjs('2026-10-10'), [null, endDate], null, null)).toBe(false);
    });

    it('allows any date when no range exists and activeField is null', () => {
      expect(isTimelineDateDisabled(dayjs('2026-10-01'), null, null, null)).toBe(false);
      expect(isTimelineDateDisabled(dayjs('2026-10-15'), null, null, null)).toBe(false);
      expect(isTimelineDateDisabled(dayjs('2026-10-31'), null, null, null)).toBe(false);
    });
  });

  describe('useTimelineDateFilter production callbacks', () => {
    it('detects inverted calendar draft in onCalendarChange, sets error, and triggers toast', () => {
      const showMessageError = vi.fn();
      const { result } = renderHook(() =>
        useTimelineDateFilter({
          t: mockTranslate,
          showMessageError,
        })
      );

      // rc-picker fires onCalendarChange with draft values [2026-10-25, 2026-10-10]
      act(() => {
        result.current.onCalendarChange([dayjs('2026-10-25'), dayjs('2026-10-10')]);
      });

      expect(result.current.dateRangeError).toBe('End date cannot be earlier than start date');
      expect(showMessageError).toHaveBeenCalledWith('End date cannot be earlier than start date');
    });

    it('clears error once calendar draft is no longer inverted', () => {
      const showMessageError = vi.fn();
      const { result } = renderHook(() =>
        useTimelineDateFilter({
          t: mockTranslate,
          showMessageError,
        })
      );

      // First produce inverted error
      act(() => {
        result.current.onCalendarChange([dayjs('2026-10-25'), dayjs('2026-10-10')]);
      });
      expect(result.current.dateRangeError).not.toBeNull();

      // Now draft is corrected (e.g. valid range or user cleared/edited to single date)
      act(() => {
        result.current.onCalendarChange([dayjs('2026-10-10'), dayjs('2026-10-25')]);
      });
      expect(result.current.dateRangeError).toBeNull();
    });

    it('submission handler (onChange) preserves previously applied valid range when called with inverted dates', () => {
      const showMessageError = vi.fn();
      const { result } = renderHook(() =>
        useTimelineDateFilter({
          t: mockTranslate,
          showMessageError,
        })
      );

      // Establish previously applied valid range
      const initialStart = dayjs('2026-10-10');
      const initialEnd = dayjs('2026-10-20');
      act(() => {
        result.current.onChange([initialStart, initialEnd]);
      });
      expect(result.current.dateFilter).toEqual([initialStart, initialEnd]);
      expect(result.current.dateRangeError).toBeNull();

      // Call onChange directly with inverted dates
      act(() => {
        result.current.onChange([dayjs('2026-10-25'), dayjs('2026-10-10')]);
      });

      // Must preserve the previously applied valid range
      expect(result.current.dateFilter).toEqual([initialStart, initialEnd]);
      expect(result.current.dateRangeError).toBe('End date cannot be earlier than start date');
      expect(showMessageError).toHaveBeenCalledWith('End date cannot be earlier than start date');
    });

    it('revising provisional start earlier via hook callbacks keeps start date editable', () => {
      const { result } = renderHook(() =>
        useTimelineDateFilter({
          t: mockTranslate,
        })
      );

      // Select October 15 as start
      act(() => {
        result.current.onCalendarChange([dayjs('2026-10-15'), null], undefined, { range: 'start' });
      });
      expect(result.current.activeField).toBe('end');

      // User focuses the start input to revise it
      act(() => {
        result.current.onFocus(null, { range: 'start' });
      });
      expect(result.current.activeField).toBe('start');

      // October 10 is earlier than October 15, but since activeField is 'start' and end is empty, it must be enabled
      expect(result.current.disabledDate(dayjs('2026-10-10'))).toBe(false);
    });

    it('clears date filter and errors when clearAll is called', () => {
      const { result } = renderHook(() =>
        useTimelineDateFilter({
          t: mockTranslate,
        })
      );

      act(() => {
        result.current.onChange([dayjs('2026-10-10'), dayjs('2026-10-20')]);
      });
      expect(result.current.dateFilter).not.toBeNull();

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.dateFilter).toBeNull();
      expect(result.current.calendarDates).toBeNull();
      expect(result.current.activeField).toBeNull();
      expect(result.current.dateRangeError).toBeNull();
    });
  });
});
