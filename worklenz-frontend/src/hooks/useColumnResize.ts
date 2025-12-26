import { useState, useCallback, useRef, useEffect } from 'react';

interface ColumnWidths {
  [key: string]: number;
}

interface UseColumnResizeProps {
  initialWidths: ColumnWidths;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
}

interface UseColumnResizeReturn {
  columnWidths: ColumnWidths;
  handleResizeStart: (e: React.MouseEvent, columnKey: string) => void;
  resetColumnWidth: (columnKey: string) => void;
  resetAllWidths: () => void;
}

/**
 * Custom hook for handling table column resizing with Excel-like drag behavior
 * Features:
 * - Drag to resize columns
 * - Persist widths to localStorage
 * - Min/max width constraints
 * - Smooth resize with visual feedback
 */
export const useColumnResize = ({
  initialWidths,
  minWidth = 50,
  maxWidth = 800,
  storageKey = 'worklenz.taskList.columnWidths',
}: UseColumnResizeProps): UseColumnResizeReturn => {
  // Load saved widths from localStorage or use initial widths
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with initial widths to handle new columns
        return { ...initialWidths, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load column widths from localStorage:', error);
    }
    return initialWidths;
  });

  const resizingColumnRef = useRef<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // Save to localStorage whenever widths change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths));
    } catch (error) {
      // Handle quota exceeded or other localStorage errors gracefully
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded. Column widths not saved.');
      } else {
        console.error('Failed to save column widths to localStorage:', error);
      }
    }
  }, [columnWidths, storageKey]);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      if (resizingColumnRef.current) {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        resizingColumnRef.current = null;
      }
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleMouseMove = useCallback(
    (moveEvent: MouseEvent) => {
      if (!resizingColumnRef.current) return;

      const diff = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + diff));

      setColumnWidths(prev => ({
        ...prev,
        [resizingColumnRef.current!]: newWidth,
      }));
    },
    [minWidth, maxWidth]
  );

  const handleMouseUp = useCallback(() => {
    resizingColumnRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, columnKey: string) => {
      e.preventDefault();
      e.stopPropagation();

      resizingColumnRef.current = columnKey;
      startXRef.current = e.clientX;
      startWidthRef.current = columnWidths[columnKey] || initialWidths[columnKey] || 150;

      // Set cursor and disable text selection during resize
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [columnWidths, initialWidths, handleMouseMove, handleMouseUp]
  );

  const resetColumnWidth = useCallback(
    (columnKey: string) => {
      setColumnWidths(prev => ({
        ...prev,
        [columnKey]: initialWidths[columnKey] || 150,
      }));
    },
    [initialWidths]
  );

  const resetAllWidths = useCallback(() => {
    setColumnWidths(initialWidths);
    localStorage.removeItem(storageKey);
  }, [initialWidths, storageKey]);

  return {
    columnWidths,
    handleResizeStart,
    resetColumnWidth,
    resetAllWidths,
  };
};
