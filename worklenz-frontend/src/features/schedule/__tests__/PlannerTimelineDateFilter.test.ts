import { describe, expect, it } from 'vitest';
import dayjs, { Dayjs } from 'dayjs';

/**
 * Validates date range logic mirroring PlannerTimelineView's date filter rules.
 */
describe('PlannerTimelineView Date Range Filter Validation', () => {
  const getDisabledDate = (
    calendarDates: [Dayjs | null, Dayjs | null] | null,
    dateFilter: [Dayjs, Dayjs] | null,
    activeField: 'start' | 'end' | null
  ) => {
    return (current: Dayjs) => {
      if (!current) return false;

      const startDate = calendarDates?.[0] ?? dateFilter?.[0];
      const endDate = calendarDates?.[1] ?? dateFilter?.[1];

      // If user is editing/picking the End Date: disable days before Start Date
      if (activeField === 'end' || (calendarDates?.[0] && !calendarDates?.[1])) {
        if (startDate) {
          return current.isBefore(startDate, 'day');
        }
      }

      // If user is editing/picking the Start Date: disable days after End Date
      if (activeField === 'start' || (!calendarDates?.[0] && calendarDates?.[1])) {
        if (endDate) {
          return current.isAfter(endDate, 'day');
        }
      }

      return false;
    };
  };

  const validateDateRange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (!dates || !dates[0] || !dates[1]) {
      return { isValid: true, isCleared: true, error: null };
    }
    const [start, end] = dates;
    if (start.isAfter(end, 'day')) {
      return {
        isValid: false,
        isCleared: false,
        error: 'End date cannot be earlier than start date',
      };
    }
    return { isValid: true, isCleared: false, error: null };
  };

  describe('disabledDate calendar rules', () => {
    it('disables dates before Start Date when picking End Date on first attempt', () => {
      const startDate = dayjs('2026-10-15');
      const disabledDate = getDisabledDate([startDate, null], null, 'end');

      expect(disabledDate(dayjs('2026-10-14'))).toBe(true);
      expect(disabledDate(dayjs('2026-10-01'))).toBe(true);
      expect(disabledDate(dayjs('2026-10-15'))).toBe(false);
      expect(disabledDate(dayjs('2026-10-20'))).toBe(false);
    });

    it('disables dates after End Date when picking Start Date on first attempt (user selected End Date first)', () => {
      const endDate = dayjs('2026-10-15');
      const disabledDate = getDisabledDate([null, endDate], null, 'start');

      expect(disabledDate(dayjs('2026-10-16'))).toBe(true);
      expect(disabledDate(dayjs('2026-10-31'))).toBe(true);
      expect(disabledDate(dayjs('2026-10-15'))).toBe(false);
      expect(disabledDate(dayjs('2026-10-10'))).toBe(false);
    });

    it('disables dates before Start Date when changing End Date again on an existing locked range', () => {
      const existingRange: [Dayjs, Dayjs] = [dayjs('2026-10-10'), dayjs('2026-10-20')];
      // User opens picker and focuses End Date input to change it (calendarDates is null initially)
      const disabledDate = getDisabledDate(null, existingRange, 'end');

      expect(disabledDate(dayjs('2026-10-09'))).toBe(true);
      expect(disabledDate(dayjs('2026-10-01'))).toBe(true);
      expect(disabledDate(dayjs('2026-10-10'))).toBe(false);
      expect(disabledDate(dayjs('2026-10-15'))).toBe(false);
      expect(disabledDate(dayjs('2026-10-25'))).toBe(false);
    });

    it('disables dates after End Date when changing Start Date again on an existing locked range', () => {
      const existingRange: [Dayjs, Dayjs] = [dayjs('2026-10-10'), dayjs('2026-10-20')];
      // User opens picker and focuses Start Date input to change it
      const disabledDate = getDisabledDate(null, existingRange, 'start');

      expect(disabledDate(dayjs('2026-10-21'))).toBe(true);
      expect(disabledDate(dayjs('2026-10-30'))).toBe(true);
      expect(disabledDate(dayjs('2026-10-20'))).toBe(false);
      expect(disabledDate(dayjs('2026-10-15'))).toBe(false);
      expect(disabledDate(dayjs('2026-10-05'))).toBe(false);
    });

    it('allows any date when no range exists and no intermediate field is focused', () => {
      const disabledDate = getDisabledDate(null, null, null);

      expect(disabledDate(dayjs('2026-10-01'))).toBe(false);
      expect(disabledDate(dayjs('2026-10-15'))).toBe(false);
      expect(disabledDate(dayjs('2026-10-31'))).toBe(false);
    });
  });

  describe('validateDateRange submission validation', () => {
    it('rejects ranges where Start Date is after End Date without swapping', () => {
      const result = validateDateRange([dayjs('2026-10-25'), dayjs('2026-10-10')]);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('End date cannot be earlier than start date');
    });

    it('accepts valid date ranges', () => {
      const result = validateDateRange([dayjs('2026-10-10'), dayjs('2026-10-25')]);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('accepts single-day ranges (Start Date equals End Date)', () => {
      const result = validateDateRange([dayjs('2026-10-15'), dayjs('2026-10-15')]);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('handles clearing date range', () => {
      const result = validateDateRange(null);

      expect(result.isValid).toBe(true);
      expect(result.isCleared).toBe(true);
      expect(result.error).toBeNull();
    });
  });
});
