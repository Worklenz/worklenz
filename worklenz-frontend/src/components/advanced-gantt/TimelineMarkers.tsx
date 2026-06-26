import React, { useMemo } from 'react';
import { Holiday, TimelineConfig } from '../../types/advanced-gantt.types';
import { useAppSelector } from '../../hooks/useAppSelector';
import { themeWiseColor } from '../../utils/themeWiseColor';
import { useDateCalculations } from '../../utils/gantt-performance';

interface TimelineMarkersProps {
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  containerHeight: number;
  timelineConfig: TimelineConfig;
  holidays?: Holiday[];
  showWeekends?: boolean;
  showHolidays?: boolean;
  showToday?: boolean;
  className?: string;
}

const TimelineMarkers: React.FC<TimelineMarkersProps> = ({
  startDate,
  endDate,
  dayWidth,
  containerHeight,
  timelineConfig,
  holidays = [],
  showWeekends = true,
  showHolidays = true,
  showToday = true,
  className = '',
}) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { getDaysBetween, isWeekend, isWorkingDay } = useDateCalculations();

  // Generate all dates in the timeline
  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    const totalDays = getDaysBetween(startDate, endDate);

    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }

    return dates;
  }, [startDate, endDate, getDaysBetween]);

  // Theme-aware colors
  const colors = useMemo(
    () => ({
      weekend: themeWiseColor('rgba(0, 0, 0, 0.05)', 'rgba(255, 255, 255, 0.05)', themeMode),
      nonWorkingDay: themeWiseColor('rgba(0, 0, 0, 0.03)', 'rgba(255, 255, 255, 0.03)', themeMode),
      holiday: themeWiseColor('rgba(255, 107, 107, 0.1)', 'rgba(255, 107, 107, 0.15)', themeMode),
      today: themeWiseColor('rgba(24, 144, 255, 0.15)', 'rgba(64, 169, 255, 0.2)', themeMode),
      todayLine: themeWiseColor('#1890ff', '#40a9ff', themeMode),
      holidayBorder: themeWiseColor('#ff6b6b', '#ff8787', themeMode),
    }),
    [themeMode]
  );

  // Check if a date is a holiday
  const isHoliday = (date: Date): Holiday | undefined => {
    return holidays.find(holiday => {
      if (holiday.recurring) {
        return (
          holiday.date.getMonth() === date.getMonth() && holiday.date.getDate() === date.getDate()
        );
      }
      return holiday.date.toDateString() === date.toDateString();
    });
  };

  // Check if date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Render weekend markers
  const renderWeekendMarkers = () => {
    if (!showWeekends) return null;

    return timelineDates.map((date, index) => {
      if (!isWeekend(date)) return null;

      return (
        <div
          key={`weekend-${index}`}
          className="weekend-marker absolute top-0 pointer-events-none"
          style={{
            left: index * dayWidth,
            width: dayWidth,
            height: containerHeight,
            backgroundColor: colors.weekend,
            zIndex: 1,
          }}
        />
      );
    });
  };

  // Render non-working day markers
  const renderNonWorkingDayMarkers = () => {
    return timelineDates.map((date, index) => {
      if (isWorkingDay(date, timelineConfig.workingDays)) return null;

      return (
        <div
          key={`non-working-${index}`}
          className="non-working-day-marker absolute top-0 pointer-events-none"
          style={{
            left: index * dayWidth,
            width: dayWidth,
            height: containerHeight,
            backgroundColor: colors.nonWorkingDay,
            zIndex: 1,
          }}
        />
      );
    });
  };

  // Render holiday markers
  const renderHolidayMarkers = () => {
    if (!showHolidays) return null;

    return timelineDates.map((date, index) => {
      const holiday = isHoliday(date);
      if (!holiday) return null;

      const holidayColor = holiday.color || colors.holiday;

      return (
        <div
          key={`holiday-${index}`}
          className="holiday-marker absolute top-0 pointer-events-none group"
          style={{
            left: index * dayWidth,
            width: dayWidth,
            height: containerHeight,
            backgroundColor: holidayColor,
            borderLeft: `2px solid ${colors.holidayBorder}`,
            zIndex: 2,
          }}
        >
          {/* Holiday tooltip */}
          <div className="holiday-tooltip absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
            <div className="font-medium">{holiday.name}</div>
            <div className="text-xs opacity-75">{date.toLocaleDateString()}</div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
          </div>

          {/* Holiday icon */}
          <div className="holiday-icon absolute top-1 left-1 w-3 h-3 rounded-full bg-red-500 opacity-75">
            <div className="w-full h-full rounded-full animate-pulse"></div>
          </div>
        </div>
      );
    });
  };

  // Render today marker
  const renderTodayMarker = () => {
    if (!showToday) return null;

    const todayIndex = timelineDates.findIndex(date => isToday(date));
    if (todayIndex === -1) return null;

    return (
      <div
        className="today-marker absolute top-0 pointer-events-none"
        style={{
          left: todayIndex * dayWidth,
          width: dayWidth,
          height: containerHeight,
          backgroundColor: colors.today,
          zIndex: 3,
        }}
      >
        {/* Today line */}
        <div
          className="today-line absolute top-0 left-1/2 transform -translate-x-1/2"
          style={{
            width: '2px',
            height: containerHeight,
            backgroundColor: colors.todayLine,
            zIndex: 4,
          }}
        />

        {/* Today label */}
        <div className="today-label absolute top-2 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-sm">
          Today
        </div>
      </div>
    );
  };

  // Render time period markers (quarters, months, etc.)
  const renderTimePeriodMarkers = () => {
    const markers: React.ReactNode[] = [];
    const currentDate = new Date(startDate);
    currentDate.setDate(1); // Start of month

    while (currentDate <= endDate) {
      const daysSinceStart = getDaysBetween(startDate, currentDate);
      const isQuarterStart = currentDate.getMonth() % 3 === 0 && currentDate.getDate() === 1;
      const isYearStart = currentDate.getMonth() === 0 && currentDate.getDate() === 1;

      if (isYearStart) {
        markers.push(
          <div
            key={`year-${currentDate.getTime()}`}
            className="year-marker absolute top-0 border-l-2 border-blue-600 dark:border-blue-400"
            style={{
              left: daysSinceStart * dayWidth,
              height: containerHeight,
              zIndex: 5,
            }}
          >
            <div className="year-label absolute top-2 left-1 bg-blue-600 dark:bg-blue-400 text-white text-xs px-1 py-0.5 rounded">
              {currentDate.getFullYear()}
            </div>
          </div>
        );
      } else if (isQuarterStart) {
        markers.push(
          <div
            key={`quarter-${currentDate.getTime()}`}
            className="quarter-marker absolute top-0 border-l border-green-500 dark:border-green-400 opacity-60"
            style={{
              left: daysSinceStart * dayWidth,
              height: containerHeight,
              zIndex: 4,
            }}
          >
            <div className="quarter-label absolute top-2 left-1 bg-green-500 dark:bg-green-400 text-white text-xs px-1 py-0.5 rounded">
              Q{Math.floor(currentDate.getMonth() / 3) + 1}
            </div>
          </div>
        );
      }

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return markers;
  };

  return (
    <div className={`timeline-markers absolute inset-0 ${className}`}>
      {renderNonWorkingDayMarkers()}
      {renderWeekendMarkers()}
      {renderHolidayMarkers()}
      {renderTodayMarker()}
      {renderTimePeriodMarkers()}
    </div>
  );
};

// Holiday presets for common countries
export const holidayPresets = {
  US: [
    {
      date: new Date(2024, 0, 1),
      name: "New Year's Day",
      type: 'national' as const,
      recurring: true,
    },
    {
      date: new Date(2024, 0, 15),
      name: 'Martin Luther King Jr. Day',
      type: 'national' as const,
      recurring: true,
    },
    {
      date: new Date(2024, 1, 19),
      name: "Presidents' Day",
      type: 'national' as const,
      recurring: true,
    },
    {
      date: new Date(2024, 4, 27),
      name: 'Memorial Day',
      type: 'national' as const,
      recurring: true,
    },
    { date: new Date(2024, 5, 19), name: 'Juneteenth', type: 'national' as const, recurring: true },
    {
      date: new Date(2024, 6, 4),
      name: 'Independence Day',
      type: 'national' as const,
      recurring: true,
    },
    { date: new Date(2024, 8, 2), name: 'Labor Day', type: 'national' as const, recurring: true },
    {
      date: new Date(2024, 9, 14),
      name: 'Columbus Day',
      type: 'national' as const,
      recurring: true,
    },
    {
      date: new Date(2024, 10, 11),
      name: 'Veterans Day',
      type: 'national' as const,
      recurring: true,
    },
    {
      date: new Date(2024, 10, 28),
      name: 'Thanksgiving',
      type: 'national' as const,
      recurring: true,
    },
    {
      date: new Date(2024, 11, 25),
      name: 'Christmas Day',
      type: 'national' as const,
      recurring: true,
    },
  ],

  UK: [
    {
      date: new Date(2024, 0, 1),
      name: "New Year's Day",
      type: 'national' as const,
      recurring: true,
    },
    {
      date: new Date(2024, 2, 29),
      name: 'Good Friday',
      type: 'religious' as const,
      recurring: false,
    },
    {
      date: new Date(2024, 3, 1),
      name: 'Easter Monday',
      type: 'religious' as const,
      recurring: false,
    },
    {
      date: new Date(2024, 4, 6),
      name: 'Early May Bank Holiday',
      type: 'national' as const,
      recurring: true,
    },
    {
      date: new Date(2024, 4, 27),
      name: 'Spring Bank Holiday',
      type: 'national' as const,
      recurring: true,
    },
    {
      date: new Date(2024, 7, 26),
      name: 'Summer Bank Holiday',
      type: 'national' as const,
      recurring: true,
    },
    {
      date: new Date(2024, 11, 25),
      name: 'Christmas Day',
      type: 'religious' as const,
      recurring: true,
    },
    {
      date: new Date(2024, 11, 26),
      name: 'Boxing Day',
      type: 'national' as const,
      recurring: true,
    },
  ],
};

// Working day presets
export const workingDayPresets = {
  standard: [1, 2, 3, 4, 5], // Monday to Friday
  middle_east: [0, 1, 2, 3, 4], // Sunday to Thursday
  six_day: [1, 2, 3, 4, 5, 6], // Monday to Saturday
  four_day: [1, 2, 3, 4], // Monday to Thursday
};

export default TimelineMarkers;
