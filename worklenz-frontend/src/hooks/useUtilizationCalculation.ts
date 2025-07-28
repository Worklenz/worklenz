import { useCallback, useEffect, useState, useRef } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  fetchHolidays,
  selectWorkingDaysInRange,
} from '@/features/admin-center/admin-center.slice';
import {
  utilizationCalculator,
  UtilizationParams,
  UtilizationResult,
} from '@/utils/utilizationCalculator';
import { scheduleAPIService } from '@/api/schedule/schedule.api.service';
import dayjs from 'dayjs';

interface UseUtilizationCalculationOptions {
  autoFetch?: boolean;
  dateRange?: { from: string; to: string };
}

interface UtilizationCalculationHook {
  calculateWorkingDays: (params: UtilizationParams) => Promise<UtilizationResult>;
  isLoading: boolean;
  error: string | null;
  workingDaysCount: number;
  refreshHolidays: () => void;
}

export const useUtilizationCalculation = (
  options: UseUtilizationCalculationOptions = {}
): UtilizationCalculationHook => {
  const { autoFetch = true, dateRange } = options;
  const dispatch = useAppDispatch();
  const { holidays, loadingHolidays, holidaysDateRange } = useAppSelector(
    state => state.adminCenterReducer
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workingDaysCount, setWorkingDaysCount] = useState(0);

  const debounceRef = useRef<NodeJS.Timeout>();

  // Fetch holidays for date range if not already loaded (with debouncing)
  const fetchHolidaysForRange = useCallback(
    async (from: string, to: string) => {
      // Clear any existing debounce timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Check if we already have data for this range
      if (
        holidaysDateRange &&
        holidaysDateRange.from === from &&
        holidaysDateRange.to === to &&
        holidays.length > 0
      ) {
        return;
      }

      // Debounce the API call to prevent rapid successive requests
      debounceRef.current = setTimeout(async () => {
        try {
          await dispatch(
            fetchHolidays({
              from_date: from,
              to_date: to,
              include_custom: true,
            })
          ).unwrap();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch holidays');
        }
      }, 300); // 300ms debounce delay
    },
    [dispatch, holidays.length, holidaysDateRange]
  );

  // Calculate working days with holiday awareness
  const calculateWorkingDays = useCallback(
    async (params: UtilizationParams): Promise<UtilizationResult> => {
      setIsLoading(true);
      setError(null);

      try {
        // Ensure holidays are fetched for the date range
        await fetchHolidaysForRange(params.fromDate, params.toDate);

        // Calculate using utility
        const result = await utilizationCalculator.calculateWorkingDays(params);

        setWorkingDaysCount(result.totalWorkingDays);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Calculation failed';
        setError(errorMessage);

        // Return fallback calculation
        return {
          totalWorkingDays: 0,
          totalExpectedHours: 0,
          holidaysCount: 0,
          holidayDates: [],
        };
      } finally {
        setIsLoading(false);
      }
    },
    [fetchHolidaysForRange]
  );

  // Refresh holidays (clear cache and refetch)
  const refreshHolidays = useCallback(() => {
    utilizationCalculator.clearCache();
    if (dateRange) {
      fetchHolidaysForRange(dateRange.from, dateRange.to);
    }
  }, [dateRange, fetchHolidaysForRange]);

  // Auto-fetch holidays if date range is provided
  useEffect(() => {
    if (autoFetch && dateRange) {
      fetchHolidaysForRange(dateRange.from, dateRange.to);
    }
  }, [autoFetch, dateRange, fetchHolidaysForRange]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    calculateWorkingDays,
    isLoading: isLoading || loadingHolidays,
    error,
    workingDaysCount,
    refreshHolidays,
  };
};

// Helper hook for common utilization scenarios
export const useReportingUtilization = (fromDate: string, toDate: string) => {
  const [workingSettings, setWorkingSettings] = useState<{
    workingDays: string[];
    workingHours: number;
  } | null>(null);

  const calculationHook = useUtilizationCalculation({
    autoFetch: true,
    dateRange: { from: fromDate, to: toDate },
  });

  // Fetch working settings
  useEffect(() => {
    const fetchWorkingSettings = async () => {
      try {
        const res = await scheduleAPIService.fetchScheduleSettings();
        if (res?.done && res.body) {
          setWorkingSettings({
            workingDays: res.body.workingDays || [
              'Monday',
              'Tuesday',
              'Wednesday',
              'Thursday',
              'Friday',
            ],
            workingHours: res.body.workingHours || 8,
          });
        }
      } catch (error) {
        console.error('Error fetching working settings:', error);
        // Set defaults
        setWorkingSettings({
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          workingHours: 8,
        });
      }
    };

    fetchWorkingSettings();
  }, []);

  const calculateForDateRange = useCallback(async () => {
    if (!workingSettings) return null;

    return await calculationHook.calculateWorkingDays({
      fromDate,
      toDate,
      workingDays: workingSettings.workingDays,
      workingHoursPerDay: workingSettings.workingHours,
    });
  }, [calculationHook, fromDate, toDate, workingSettings]);

  return {
    ...calculationHook,
    calculateForDateRange,
    workingSettings,
    isReady: !!workingSettings,
  };
};
