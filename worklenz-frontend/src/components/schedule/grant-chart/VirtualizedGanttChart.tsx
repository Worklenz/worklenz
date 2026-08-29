import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '../../../utils/themeWiseColor';
import { CELL_WIDTH } from '../../../shared/constants';
import DayAllocationCell from './day-allocation-cell';
import ProjectTimelineBar from './project-timeline-bar';
import { useGanttOptimization, usePerformanceMonitor } from '@/hooks/useSchedulePerformance';
import { useTranslation } from 'react-i18next';

interface VirtualizedGanttChartProps {
  teamData: any[];
  dateList: any;
  dayCount: number;
  expandedProject: string | null;
  zoomLevel: number;
  showWeekends: boolean;
  onProjectExpand: (memberId: string) => void;
}

const MEMBER_HEIGHT = 90;
const PROJECT_HEIGHT = 65;

const VirtualizedGanttChart: React.FC<VirtualizedGanttChartProps> = ({
  teamData,
  dateList,
  dayCount,
  expandedProject,
  zoomLevel,
  showWeekends,
  onProjectExpand,
}) => {
  const { t } = useTranslation('schedule');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<any>(null);
  
  // Performance monitoring
  const { getMetrics } = usePerformanceMonitor('VirtualizedGanttChart');
  
  // Calculate actual cell width based on zoom
  const cellWidth = useMemo(() => CELL_WIDTH * zoomLevel, [zoomLevel]);
  
  // Filter date data based on showWeekends
  const filteredDateData = useMemo(() => {
    if (!dateList?.date_data) return [];
    
    return dateList.date_data.map((dateGroup: any) => ({
      ...dateGroup,
      days: showWeekends ? dateGroup.days : dateGroup.days.filter((day: any) => !day.isWeekend)
    }));
  }, [dateList, showWeekends]);
  
  const filteredDayCount = useMemo(() => {
    return filteredDateData.reduce((count, dateGroup) => count + dateGroup.days.length, 0);
  }, [filteredDateData]);
  
  // Calculate expanded rows
  const expandedRows = useMemo(() => {
    const rows: any[] = [];
    
    teamData.forEach((member, memberIndex) => {
      rows.push({
        type: 'member',
        data: member,
        memberIndex,
        height: MEMBER_HEIGHT,
      });
      
      if (expandedProject === member.id && member.projects) {
        member.projects.forEach((project: any, projectIndex: number) => {
          rows.push({
            type: 'project',
            data: project,
            memberIndex,
            projectIndex,
            height: PROJECT_HEIGHT,
          });
        });
      }
    });
    
    return rows;
  }, [teamData, expandedProject]);
  
  // Gantt optimization
  const {
    visibleRange,
    calculateVisibleCells,
  } = useGanttOptimization({
    cellWidth,
    dayCount: filteredDayCount,
    memberCount: expandedRows.length,
  });
  
  // Handle container resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        setContainerSize({ width: offsetWidth, height: offsetHeight });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  // Cell renderer for virtualized grid
  const CellRenderer = useCallback(({ columnIndex, rowIndex, style }: any) => {
    const row = expandedRows[rowIndex];
    if (!row) return null;
    
    // Calculate day data from filtered date list
    let dayData: any = null;
    let dayCount = 0;
    
    for (const dateGroup of filteredDateData) {
      if (columnIndex < dayCount + dateGroup.days.length) {
        dayData = dateGroup.days[columnIndex - dayCount];
        break;
      }
      dayCount += dateGroup.days.length;
    }
    
    if (!dayData) return null;
    
    const isWeekend = dayData.isWeekend;
    const isToday = dayData.isToday;
    
    if (row.type === 'member') {
      return (
        <div
          style={{
            ...style,
            background: isWeekend 
              ? themeMode === 'dark' 
                ? 'rgba(100, 100, 100, 0.2)' 
                : 'rgba(217, 217, 217, 0.3)'
              : isToday
                ? 'rgba(24, 144, 255, 0.1)'
                : themeWiseColor('#ffffff', '#1f1f1f', themeMode),
            borderRight: themeMode === 'dark' ? '1px solid #303030' : '1px solid #f0f0f0',
            borderBottom: themeMode === 'dark' ? '1px solid #303030' : '1px solid #f0f0f0',
            transition: 'all 0.2s ease',
          }}
        >
          <DayAllocationCell
            workingHours={8}
            loggedHours={0}
            totalPerDayHours={0}
            isWeekend={isWeekend}
            capacity={100}
            availableHours={8}
            memberName={row.data.name}
            date={`${dayData.name} ${dayData.day}`}
          />
        </div>
      );
    }
    
    if (row.type === 'project') {
      return (
        <div
          style={{
            ...style,
            background: isWeekend 
              ? themeMode === 'dark' 
                ? 'rgba(100, 100, 100, 0.2)' 
                : 'rgba(217, 217, 217, 0.3)'
              : isToday
                ? 'rgba(24, 144, 255, 0.05)'
                : 'transparent',
            borderRight: themeMode === 'dark' ? '1px solid #303030' : '1px solid #f0f0f0',
            borderBottom: themeMode === 'dark' ? '1px solid #303030' : '1px solid #f0f0f0',
            position: 'relative',
            transition: 'all 0.2s ease',
          }}
        >
          {/* Project timeline bar would be positioned absolutely here */}
          {row.data?.date_union?.start && row.data?.date_union?.end && (
            <ProjectTimelineBar
              defaultData={row.data?.default_values}
              project={row.data}
              indicatorWidth={row.data?.indicator_width}
              indicatorOffset={row.data?.indicator_offset}
            />
          )}
        </div>
      );
    }
    
    return null;
  }, [expandedRows, filteredDateData, themeMode]);
  
  // Handle scroll to update visible range
  const handleScroll = useCallback(({ scrollLeft }: { scrollLeft: number }) => {
    calculateVisibleCells(scrollLeft, containerSize.width);
  }, [calculateVisibleCells, containerSize.width]);
  
  // Calculate total dimensions
  const totalWidth = filteredDayCount * cellWidth;
  const totalHeight = expandedRows.reduce((sum, row) => sum + row.height, 0);
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {containerSize.width > 0 && containerSize.height > 0 && (
        <Grid
          ref={gridRef}
          width={containerSize.width}
          height={containerSize.height}
          columnCount={filteredDayCount}
          rowCount={expandedRows.length}
          columnWidth={cellWidth}
          rowHeight={(index) => expandedRows[index]?.height || MEMBER_HEIGHT}
          onScroll={handleScroll}
          style={{
            backgroundColor: themeWiseColor('#ffffff', '#141414', themeMode),
          }}
        >
          {CellRenderer}
        </Grid>
      )}
      
      {/* Performance overlay for development */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            fontSize: '12px',
            borderRadius: '4px',
            pointerEvents: 'none',
            fontFamily: 'monospace',
          }}
        >
          <div>Visible: {visibleRange.start}-{visibleRange.end}</div>
          <div>Rows: {expandedRows.length}</div>
          <div>Cols: {filteredDayCount}</div>
        </div>
      )}
    </div>
  );
};

export default React.memo(VirtualizedGanttChart);