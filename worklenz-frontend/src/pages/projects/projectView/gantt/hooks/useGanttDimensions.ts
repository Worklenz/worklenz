import { useState, useEffect, useCallback, RefObject } from 'react';
import { GanttViewMode } from '../types/gantt-types';
import { getColumnWidth } from '../constants/gantt-constants';

export const useGanttDimensions = (
  viewMode: GanttViewMode,
  containerRef: RefObject<HTMLDivElement>,
  columnsCount: number
) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [dimensionsVersion, setDimensionsVersion] = useState(0);

  const updateContainerWidth = useCallback(() => {
    if (containerRef.current) {
      const newWidth = containerRef.current.offsetWidth;
      if (newWidth !== containerWidth) {
        setContainerWidth(newWidth);
        setDimensionsVersion(prev => prev + 1);
      }
    }
  }, [containerRef, containerWidth]);

  useEffect(() => {
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, [updateContainerWidth]);

  // Force re-calculation when viewMode or columnsCount changes
  useEffect(() => {
    setDimensionsVersion(prev => prev + 1);
  }, [viewMode, columnsCount]);

  const baseColumnWidth = getColumnWidth(viewMode);
  const minTotalWidth = columnsCount * baseColumnWidth;

  // For day/week views with many columns, always use base width to enable scrolling
  // For month/quarter/year views, stretch to fill container if wider
  const shouldStretch = viewMode !== 'day' && viewMode !== 'week';

  const actualColumnWidth =
    shouldStretch && containerWidth > minTotalWidth
      ? Math.max(baseColumnWidth, containerWidth / columnsCount)
      : baseColumnWidth;

  const totalWidth = columnsCount * actualColumnWidth;

  return {
    containerWidth,
    actualColumnWidth,
    totalWidth,
    columnsCount,
    shouldScroll: totalWidth > containerWidth,
    dimensionsVersion, // Expose version for components that need to react to dimension changes
  };
};
