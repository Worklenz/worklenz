import React, { memo, useMemo, forwardRef, RefObject } from 'react';
import { GanttViewMode } from '../../types/gantt-types';
import { useGanttDimensions } from '../../hooks/useGanttDimensions';
import { TimelineUtils } from '../../utils/timeline-calculator';

interface GanttTimelineProps {
  viewMode: GanttViewMode;
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange?: { start: Date; end: Date };
}

const GanttTimeline = forwardRef<HTMLDivElement, GanttTimelineProps>(
  ({ viewMode, containerRef, dateRange }, ref) => {
    const { topHeaders, bottomHeaders } = useMemo(() => {
      if (!dateRange) {
        return { topHeaders: [], bottomHeaders: [] };
      }

      const { start, end } = dateRange;
      const topHeaders: Array<{ label: string; key: string; span: number }> = [];
      const bottomHeaders: Array<{ label: string; key: string }> = [];

      switch (viewMode) {
        case 'month':
          // Top: Years, Bottom: Months
          const startYear = start.getFullYear();
          const startMonth = start.getMonth();
          const endYear = end.getFullYear();
          const endMonth = end.getMonth();

          // Generate bottom headers (months)
          let currentYear = startYear;
          let currentMonth = startMonth;

          while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
            const date = new Date(currentYear, currentMonth, 1);
            bottomHeaders.push({
              label: date.toLocaleDateString('en-US', { month: 'short' }),
              key: `month-${currentYear}-${currentMonth}`,
            });

            currentMonth++;
            if (currentMonth > 11) {
              currentMonth = 0;
              currentYear++;
            }
          }

          // Generate top headers (years)
          for (let year = startYear; year <= endYear; year++) {
            const monthsInYear = bottomHeaders.filter(h => h.key.includes(`-${year}-`)).length;
            if (monthsInYear > 0) {
              topHeaders.push({
                label: `${year}`,
                key: `year-${year}`,
                span: monthsInYear,
              });
            }
          }
          break;

        case 'week':
          // Top: Months, Bottom: Weeks
          const weekStart = new Date(start);
          const weekEnd = new Date(end);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());

          const weekDates: Date[] = [];
          const tempDate = new Date(weekStart);
          while (tempDate <= weekEnd) {
            weekDates.push(new Date(tempDate));
            tempDate.setDate(tempDate.getDate() + 7);
          }

          // Generate bottom headers (weeks)
          weekDates.forEach(date => {
            const weekNum = TimelineUtils.getWeekNumber(date);
            bottomHeaders.push({
              label: `W${weekNum}`,
              key: `week-${date.getFullYear()}-${weekNum}`,
            });
          });

          // Generate top headers (months)
          const monthGroups = new Map<string, number>();
          weekDates.forEach(date => {
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            monthGroups.set(monthKey, (monthGroups.get(monthKey) || 0) + 1);
          });

          monthGroups.forEach((count, monthKey) => {
            const [year, month] = monthKey.split('-').map(Number);
            const date = new Date(year, month, 1);
            topHeaders.push({
              label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
              key: `month-${monthKey}`,
              span: count,
            });
          });
          break;

        case 'day':
          // Top: Months, Bottom: Days
          const dayStart = new Date(start);
          const dayEnd = new Date(end);

          const dayDates: Date[] = [];
          const tempDayDate = new Date(dayStart);
          while (tempDayDate <= dayEnd) {
            dayDates.push(new Date(tempDayDate));
            tempDayDate.setDate(tempDayDate.getDate() + 1);
          }

          // Generate bottom headers (days)
          dayDates.forEach(date => {
            bottomHeaders.push({
              label: date.getDate().toString(),
              key: `day-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
            });
          });

          // Generate top headers (months)
          const dayMonthGroups = new Map<string, number>();
          dayDates.forEach(date => {
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            dayMonthGroups.set(monthKey, (dayMonthGroups.get(monthKey) || 0) + 1);
          });

          dayMonthGroups.forEach((count, monthKey) => {
            const [year, month] = monthKey.split('-').map(Number);
            const date = new Date(year, month, 1);
            topHeaders.push({
              label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
              key: `month-${monthKey}`,
              span: count,
            });
          });
          break;

        default:
          // Fallback to single row for other view modes
          const result = [];
          switch (viewMode) {
            case 'quarter':
              const qStartYear = start.getFullYear();
              const qStartQuarter = Math.ceil((start.getMonth() + 1) / 3);
              const qEndYear = end.getFullYear();
              const qEndQuarter = Math.ceil((end.getMonth() + 1) / 3);

              let qYear = qStartYear;
              let qQuarter = qStartQuarter;

              while (qYear < qEndYear || (qYear === qEndYear && qQuarter <= qEndQuarter)) {
                result.push({
                  label: `Q${qQuarter} ${qYear}`,
                  key: `quarter-${qYear}-${qQuarter}`,
                });

                qQuarter++;
                if (qQuarter > 4) {
                  qQuarter = 1;
                  qYear++;
                }
              }
              break;
            case 'year':
              const yearStart = start.getFullYear();
              const yearEnd = end.getFullYear();

              for (let year = yearStart; year <= yearEnd; year++) {
                result.push({
                  label: `${year}`,
                  key: `year-${year}`,
                });
              }
              break;
          }

          result.forEach(item => {
            bottomHeaders.push(item);
          });
          break;
      }

      return { topHeaders, bottomHeaders };
    }, [viewMode, dateRange]);

    const { actualColumnWidth, totalWidth, shouldScroll } = useGanttDimensions(
      viewMode,
      containerRef,
      bottomHeaders.length
    );

    const hasTopHeaders = topHeaders.length > 0;

    return (
      <div
        ref={ref}
        className={`${hasTopHeaders ? 'h-20' : 'h-10'} flex-shrink-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-y-hidden ${
          shouldScroll ? 'overflow-x-auto' : 'overflow-x-hidden'
        } scrollbar-hide flex flex-col`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {hasTopHeaders && (
          <div
            className="flex h-10 border-b border-gray-200 dark:border-gray-700"
            style={{ width: `${totalWidth}px`, minWidth: shouldScroll ? 'auto' : '100%' }}
          >
            {topHeaders.map(header => (
              <div
                key={header.key}
                className="py-2.5 text-center border-r border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 px-2 whitespace-nowrap bg-gray-50 dark:bg-gray-750"
                style={{ width: `${actualColumnWidth * header.span}px` }}
                title={header.label}
              >
                {header.label}
              </div>
            ))}
          </div>
        )}
        <div
          className="flex h-10"
          style={{ width: `${totalWidth}px`, minWidth: shouldScroll ? 'auto' : '100%' }}
        >
          {bottomHeaders.map(header => (
            <div
              key={header.key}
              className={`py-2.5 text-center border-r border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 ${
                viewMode === 'day' ? 'px-1 text-xs' : 'px-2'
              } ${
                viewMode === 'day' && actualColumnWidth < 50
                  ? 'whitespace-nowrap overflow-hidden text-ellipsis'
                  : 'whitespace-nowrap'
              }`}
              style={{ width: `${actualColumnWidth}px` }}
              title={header.label}
            >
              {header.label}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

GanttTimeline.displayName = 'GanttTimeline';

export default memo(GanttTimeline);
