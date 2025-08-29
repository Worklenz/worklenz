import { useState, useEffect, useCallback, RefObject } from 'react';
import { GanttViewMode } from '../types/gantt-types';
import { getColumnWidth } from '../constants/gantt-constants';

export const useGanttDimensions = (
  viewMode: GanttViewMode,
  containerRef: RefObject<HTMLDivElement>,
  columnsCount: number
) => {
  const [containerWidth, setContainerWidth] = useState(0);

  const updateContainerWidth = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
  }, [containerRef]);

  useEffect(() => {
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, [updateContainerWidth]);

  const baseColumnWidth = getColumnWidth(viewMode);
  const minTotalWidth = columnsCount * baseColumnWidth;

  // For day/week views with many columns, always use base width to enable scrolling
  // For month/quarter/year views, stretch to fill container if wider
  const shouldStretch = viewMode !== 'day' && viewMode !== 'week';

  const actualColumnWidth =
    shouldStretch && containerWidth > minTotalWidth
      ? containerWidth / columnsCount
      : baseColumnWidth;

  const totalWidth = columnsCount * actualColumnWidth;

  return {
    containerWidth,
    actualColumnWidth,
    totalWidth,
    columnsCount,
    shouldScroll: totalWidth > containerWidth,
  };
};
