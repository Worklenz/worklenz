import React, { useRef, useEffect, useState, useCallback, ReactNode } from 'react';
import { useThrottle, usePerformanceMonitoring } from '../../utils/gantt-performance';
import { useAppSelector } from '../../hooks/useAppSelector';

interface VirtualScrollContainerProps {
  items: any[];
  itemHeight: number;
  containerHeight: number;
  containerWidth?: number;
  overscan?: number;
  horizontal?: boolean;
  children: (item: any, index: number, style: React.CSSProperties) => ReactNode;
  onScroll?: (scrollLeft: number, scrollTop: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

const VirtualScrollContainer: React.FC<VirtualScrollContainerProps> = ({
  items,
  itemHeight,
  containerHeight,
  containerWidth = 0,
  overscan = 5,
  horizontal = false,
  children,
  onScroll,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const { startMeasure, endMeasure, recordMetric } = usePerformanceMonitoring();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Calculate visible range
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;

  // Throttled scroll handler
  const throttledScrollHandler = useThrottle(
    useCallback(
      (event: Event) => {
        const target = event.target as HTMLDivElement;
        const newScrollTop = target.scrollTop;
        const newScrollLeft = target.scrollLeft;

        setScrollTop(newScrollTop);
        setScrollLeft(newScrollLeft);
        onScroll?.(newScrollLeft, newScrollTop);
      },
      [onScroll]
    ),
    16 // ~60fps
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', throttledScrollHandler, { passive: true });

    return () => {
      container.removeEventListener('scroll', throttledScrollHandler);
    };
  }, [throttledScrollHandler]);

  // Performance monitoring
  useEffect(() => {
    startMeasure('virtualScroll');
    recordMetric('visibleTaskCount', visibleItems.length);
    recordMetric('taskCount', items.length);
    endMeasure('virtualScroll');
  }, [visibleItems.length, items.length, startMeasure, endMeasure, recordMetric]);

  const renderVisibleItems = () => {
    return visibleItems.map((item, virtualIndex) => {
      const actualIndex = startIndex + virtualIndex;
      const itemStyle: React.CSSProperties = {
        position: 'absolute',
        top: horizontal ? 0 : actualIndex * itemHeight,
        left: horizontal ? actualIndex * itemHeight : 0,
        height: horizontal ? '100%' : itemHeight,
        width: horizontal ? itemHeight : '100%',
        transform: horizontal ? 'none' : `translateY(${offsetY}px)`,
      };

      return (
        <div key={item.id || actualIndex} style={itemStyle}>
          {children(item, actualIndex, itemStyle)}
        </div>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className={`virtual-scroll-container overflow-auto ${className}`}
      style={{
        height: containerHeight,
        width: containerWidth || '100%',
        position: 'relative',
        ...style,
      }}
    >
      {/* Spacer to maintain scroll height */}
      <div
        className="virtual-scroll-spacer"
        style={{
          height: horizontal ? '100%' : totalHeight,
          width: horizontal ? totalHeight : '100%',
          position: 'relative',
          pointerEvents: 'none',
        }}
      >
        {/* Visible items container */}
        <div
          className="virtual-scroll-content"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '100%',
            pointerEvents: 'auto',
          }}
        >
          {renderVisibleItems()}
        </div>
      </div>
    </div>
  );
};

// Grid virtual scrolling component for both rows and columns
interface VirtualGridProps {
  data: any[][];
  rowHeight: number;
  columnWidth: number | number[];
  containerHeight: number;
  containerWidth: number;
  overscan?: number;
  children: (
    item: any,
    rowIndex: number,
    colIndex: number,
    style: React.CSSProperties
  ) => ReactNode;
  onScroll?: (scrollLeft: number, scrollTop: number) => void;
  className?: string;
}

export const VirtualGrid: React.FC<VirtualGridProps> = ({
  data,
  rowHeight,
  columnWidth,
  containerHeight,
  containerWidth,
  overscan = 3,
  children,
  onScroll,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const rowCount = data.length;
  const colCount = data[0]?.length || 0;

  // Calculate column positions for variable width columns
  const columnWidths = Array.isArray(columnWidth)
    ? columnWidth
    : new Array(colCount).fill(columnWidth);
  const columnPositions = columnWidths.reduce(
    (acc, width, index) => {
      acc[index] = index === 0 ? 0 : acc[index - 1] + columnWidths[index - 1];
      return acc;
    },
    {} as Record<number, number>
  );

  const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const totalHeight = rowCount * rowHeight;

  // Calculate visible ranges
  const startRowIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endRowIndex = Math.min(
    rowCount - 1,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
  );

  const startColIndex = Math.max(0, findColumnIndex(scrollLeft) - overscan);
  const endColIndex = Math.min(
    colCount - 1,
    findColumnIndex(scrollLeft + containerWidth) + overscan
  );

  function findColumnIndex(position: number): number {
    for (let i = 0; i < colCount; i++) {
      if (columnPositions[i] <= position && position < columnPositions[i] + columnWidths[i]) {
        return i;
      }
    }
    return colCount - 1;
  }

  const throttledScrollHandler = useThrottle(
    useCallback(
      (event: Event) => {
        const target = event.target as HTMLDivElement;
        const newScrollTop = target.scrollTop;
        const newScrollLeft = target.scrollLeft;

        setScrollTop(newScrollTop);
        setScrollLeft(newScrollLeft);
        onScroll?.(newScrollLeft, newScrollTop);
      },
      [onScroll]
    ),
    16
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', throttledScrollHandler, { passive: true });

    return () => {
      container.removeEventListener('scroll', throttledScrollHandler);
    };
  }, [throttledScrollHandler]);

  const renderVisibleCells = () => {
    const cells: ReactNode[] = [];

    for (let rowIndex = startRowIndex; rowIndex <= endRowIndex; rowIndex++) {
      for (let colIndex = startColIndex; colIndex <= endColIndex; colIndex++) {
        const item = data[rowIndex]?.[colIndex];
        if (!item) continue;

        const cellStyle: React.CSSProperties = {
          position: 'absolute',
          top: rowIndex * rowHeight,
          left: columnPositions[colIndex],
          height: rowHeight,
          width: columnWidths[colIndex],
        };

        cells.push(
          <div key={`${rowIndex}-${colIndex}`} style={cellStyle}>
            {children(item, rowIndex, colIndex, cellStyle)}
          </div>
        );
      }
    }

    return cells;
  };

  return (
    <div
      ref={containerRef}
      className={`virtual-grid overflow-auto ${className}`}
      style={{
        height: containerHeight,
        width: containerWidth,
        position: 'relative',
      }}
    >
      <div
        style={{
          height: totalHeight,
          width: totalWidth,
          position: 'relative',
        }}
      >
        {renderVisibleCells()}
      </div>
    </div>
  );
};

// Timeline virtual scrolling component
interface VirtualTimelineProps {
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  containerWidth: number;
  containerHeight: number;
  overscan?: number;
  children: (date: Date, index: number, style: React.CSSProperties) => ReactNode;
  onScroll?: (scrollLeft: number) => void;
  className?: string;
}

export const VirtualTimeline: React.FC<VirtualTimelineProps> = ({
  startDate,
  endDate,
  dayWidth,
  containerWidth,
  containerHeight,
  overscan = 10,
  children,
  onScroll,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalWidth = totalDays * dayWidth;

  const startDayIndex = Math.max(0, Math.floor(scrollLeft / dayWidth) - overscan);
  const endDayIndex = Math.min(
    totalDays - 1,
    Math.ceil((scrollLeft + containerWidth) / dayWidth) + overscan
  );

  const throttledScrollHandler = useThrottle(
    useCallback(
      (event: Event) => {
        const target = event.target as HTMLDivElement;
        const newScrollLeft = target.scrollLeft;
        setScrollLeft(newScrollLeft);
        onScroll?.(newScrollLeft);
      },
      [onScroll]
    ),
    16
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', throttledScrollHandler, { passive: true });

    return () => {
      container.removeEventListener('scroll', throttledScrollHandler);
    };
  }, [throttledScrollHandler]);

  const renderVisibleDays = () => {
    const days: ReactNode[] = [];

    for (let dayIndex = startDayIndex; dayIndex <= endDayIndex; dayIndex++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + dayIndex);

      const dayStyle: React.CSSProperties = {
        position: 'absolute',
        left: dayIndex * dayWidth,
        top: 0,
        width: dayWidth,
        height: '100%',
      };

      days.push(
        <div key={dayIndex} style={dayStyle}>
          {children(date, dayIndex, dayStyle)}
        </div>
      );
    }

    return days;
  };

  return (
    <div
      ref={containerRef}
      className={`virtual-timeline overflow-x-auto ${className}`}
      style={{
        height: containerHeight,
        width: containerWidth,
        position: 'relative',
      }}
    >
      <div
        style={{
          height: '100%',
          width: totalWidth,
          position: 'relative',
        }}
      >
        {renderVisibleDays()}
      </div>
    </div>
  );
};

export default VirtualScrollContainer;
