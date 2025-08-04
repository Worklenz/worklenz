import React, { memo, useMemo, forwardRef, RefObject } from 'react';
import { GanttViewMode } from '../../types/gantt-types';
import { useGanttDimensions } from '../../hooks/useGanttDimensions';
import { TimelineUtils } from '../../utils/timeline-calculator';

interface GanttTimelineProps {
  viewMode: GanttViewMode;
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange?: { start: Date; end: Date };
}

const GanttTimeline = forwardRef<HTMLDivElement, GanttTimelineProps>(({ viewMode, containerRef, dateRange }, ref) => {
  const headers = useMemo(() => {
    // Generate timeline headers based on view mode and date range
    const result = [];
    
    if (!dateRange) {
      return result;
    }
    
    const { start, end } = dateRange;
    
    switch (viewMode) {
      case 'month':
        // Generate month headers based on date range
        const startYear = start.getFullYear();
        const startMonth = start.getMonth();
        const endYear = end.getFullYear();
        const endMonth = end.getMonth();
        
        let currentYear = startYear;
        let currentMonth = startMonth;
        
        while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
          const date = new Date(currentYear, currentMonth, 1);
          result.push({
            label: date.toLocaleDateString('en-US', { month: 'short', year: currentYear !== new Date().getFullYear() ? 'numeric' : undefined }),
            key: `month-${currentYear}-${currentMonth}`,
          });
          
          currentMonth++;
          if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
          }
        }
        break;
      case 'week':
        // Generate week headers based on date range
        const weekStart = new Date(start);
        const weekEnd = new Date(end);
        
        // Align to start of week
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        
        while (weekStart <= weekEnd) {
          const weekNum = TimelineUtils.getWeekNumber(weekStart);
          result.push({
            label: `Week ${weekNum}`,
            key: `week-${weekStart.getFullYear()}-${weekNum}`,
          });
          weekStart.setDate(weekStart.getDate() + 7);
        }
        break;
      case 'day':
        // Generate day headers based on date range
        const dayStart = new Date(start);
        const dayEnd = new Date(end);
        
        while (dayStart <= dayEnd) {
          result.push({
            label: dayStart.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
            key: `day-${dayStart.getFullYear()}-${dayStart.getMonth()}-${dayStart.getDate()}`,
          });
          dayStart.setDate(dayStart.getDate() + 1);
        }
        break;
      case 'quarter':
        // Generate quarter headers based on date range
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
        // Generate year headers based on date range
        const yearStart = start.getFullYear();
        const yearEnd = end.getFullYear();
        
        for (let year = yearStart; year <= yearEnd; year++) {
          result.push({
            label: `${year}`,
            key: `year-${year}`,
          });
        }
        break;
      default:
        break;
    }
    
    return result;
  }, [viewMode, dateRange]);

  const { actualColumnWidth, totalWidth, shouldScroll } = useGanttDimensions(
    viewMode,
    containerRef,
    headers.length
  );

  return (
    <div 
      ref={ref}
      className={`h-10 flex-shrink-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-y-hidden ${
        shouldScroll ? 'overflow-x-auto' : 'overflow-x-hidden'
      } scrollbar-hide`}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="flex h-full" style={{ width: `${totalWidth}px`, minWidth: shouldScroll ? 'auto' : '100%' }}>
        {headers.map(header => (
          <div 
            key={header.key} 
            className={`py-2.5 text-center border-r border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 ${
              viewMode === 'day' ? 'px-1 text-xs' : 'px-2'
            } ${
              viewMode === 'day' && actualColumnWidth < 50 ? 'whitespace-nowrap overflow-hidden text-ellipsis' : 'whitespace-nowrap'
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
});

GanttTimeline.displayName = 'GanttTimeline';

export default memo(GanttTimeline);