import React from 'react';
import {
  useColumnResizeHandler,
  COLUMN_MIN_WIDTH,
  COLUMN_MAX_WIDTH,
} from '@/hooks/useColumnResizeHandler';

interface ColumnResizeHandleProps {
  columnKey: string;
  currentWidth: number | string;
  onResize: (newWidth: number) => void;
  ariaLabel: string;
  title: string;
}

export const ColumnResizeHandle: React.FC<ColumnResizeHandleProps> = ({
  columnKey,
  currentWidth,
  onResize,
  ariaLabel,
  title,
}) => {
  const { handleMouseDown, handleKeyDownStart } = useColumnResizeHandler({
    columnKey,
    currentWidth,
    minWidth: COLUMN_MIN_WIDTH,
    maxWidth: COLUMN_MAX_WIDTH,
    onResizeStart: () => {
      // No-op - we handle resize start in the handler itself
    },
    onResize,
    ariaLabel,
  });

  return (
    <div
      className="column-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDownStart}
      title={title}
    />
  );
};
