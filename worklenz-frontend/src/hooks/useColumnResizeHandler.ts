import { useCallback, useRef, useEffect } from 'react';

/**
 * Constants for column resize constraints
 */
export const COLUMN_MIN_WIDTH = 50;
export const COLUMN_MAX_WIDTH = 800;

interface UseColumnResizeHandlerProps {
  columnKey: string;
  currentWidth: number | string;
  minWidth?: number;
  maxWidth?: number;
  onResizeStart: (e: React.MouseEvent | React.KeyboardEvent, columnKey: string) => void;
  onResize: (newWidth: number) => void;
  getTableContainer?: (element: HTMLElement) => HTMLElement;
  ariaLabel?: string;
}

interface ResizeState {
  indicator: HTMLDivElement;
  tooltip: HTMLDivElement;
  handleElement: HTMLElement;
  tableContainer: HTMLElement;
  startX: number;
  startWidth: number;
  isResizing: boolean;
  handleMouseMove: (e: MouseEvent) => void;
  handleMouseUp: () => void;
  handleKeyDown: (e: KeyboardEvent) => void;
}

/**
 * Hook for handling column resize with mouse and keyboard support
 * Provides visual feedback (indicator, tooltip) and proper cleanup
 */
export const useColumnResizeHandler = ({
  columnKey,
  currentWidth,
  minWidth = COLUMN_MIN_WIDTH,
  maxWidth = COLUMN_MAX_WIDTH,
  onResizeStart,
  onResize,
  getTableContainer,
  ariaLabel,
}: UseColumnResizeHandlerProps) => {
  const resizeStateRef = useRef<ResizeState | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Default function to find table container
  const defaultGetTableContainer = useCallback((element: HTMLElement): HTMLElement => {
    return (
      (element.closest('.tasklist-container') as HTMLElement) ||
      (element.closest('[class*="overflow"]') as HTMLElement) ||
      (element.closest('table')?.parentElement as HTMLElement) ||
      document.body
    );
  }, []);

  const findTableContainer = getTableContainer || defaultGetTableContainer;

  // Update indicator and tooltip position
  const updateIndicator = useCallback(
    (x: number, width: number, clientY?: number) => {
      const state = resizeStateRef.current;
      if (!state) return;

      const containerRect = state.tableContainer.getBoundingClientRect();
      const relativeX = x - containerRect.left;

      state.indicator.style.left = `${relativeX}px`;
      state.indicator.style.opacity = '1';

      state.tooltip.textContent = `${width}px`;
      state.tooltip.style.left = `${x}px`;
      if (clientY !== undefined) {
        state.tooltip.style.top = `${clientY - 40}px`;
      }
      state.tooltip.style.opacity = '1';

      // Check if at limit and update classes
      const atLimit = width <= minWidth || width >= maxWidth;
      if (atLimit) {
        state.handleElement.classList.add('at-limit');
      } else {
        state.handleElement.classList.remove('at-limit');
      }

      // Update aria attributes
      state.handleElement.setAttribute('aria-valuenow', `${width}`);
      state.handleElement.setAttribute('aria-valuemin', `${minWidth}`);
      state.handleElement.setAttribute('aria-valuemax', `${maxWidth}`);
    },
    [minWidth, maxWidth]
  );

  // Cleanup function to remove listeners and DOM elements
  const cleanup = useCallback(() => {
    const state = resizeStateRef.current;
    if (!state) return;

    // Remove event listeners
    document.removeEventListener('mousemove', state.handleMouseMove);
    document.removeEventListener('mouseup', state.handleMouseUp);
    document.removeEventListener('keydown', state.handleKeyDown);

    // Reset body styles
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.classList.remove('column-resizing');

    // Remove indicator
    if (state.indicator.parentNode) {
      state.indicator.style.opacity = '0';
      setTimeout(() => {
        if (state.indicator.parentNode) {
          state.indicator.remove();
        }
      }, 150);
    }

    // Remove tooltip
    if (state.tooltip.parentNode) {
      state.tooltip.style.opacity = '0';
      setTimeout(() => {
        if (state.tooltip.parentNode) {
          state.tooltip.remove();
        }
      }, 150);
    }

    // Remove resizing classes
    state.handleElement.classList.remove('resizing', 'at-limit');
    state.handleElement.removeAttribute('aria-valuenow');
    state.handleElement.removeAttribute('aria-valuemin');
    state.handleElement.removeAttribute('aria-valuemax');

    // Reset table container position if needed
    if (state.tableContainer !== document.body) {
      state.tableContainer.style.position = '';
    }

    resizeStateRef.current = null;
    cleanupRef.current = null;
  }, []);

  // Mouse down handler
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const handleElement = e.currentTarget as HTMLElement;
      const startX = e.clientX;
      const startWidth =
        typeof currentWidth === 'number'
          ? currentWidth
          : parseInt(String(currentWidth).replace('px', ''), 10);

      // Find table container
      const tableContainer = findTableContainer(handleElement);

      // Create resize indicator line
      const indicator = document.createElement('div');
      indicator.className = 'column-resize-indicator';
      if (tableContainer !== document.body) {
        tableContainer.style.position = 'relative';
      }
      tableContainer.appendChild(indicator);

      // Create tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'column-resize-tooltip';
      document.body.appendChild(tooltip);

      // Add resizing class
      handleElement.classList.add('resizing');
      document.body.classList.add('column-resizing');

      // Create mouse move handler
      const handleMouseMove = (moveEvent: MouseEvent) => {
        const state = resizeStateRef.current;
        if (!state || !state.isResizing) return;

        const diff = moveEvent.clientX - state.startX;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, state.startWidth + diff));

        updateIndicator(moveEvent.clientX, newWidth, moveEvent.clientY);
        onResize(newWidth);
      };

      // Create mouse up handler
      const handleMouseUp = () => {
        cleanup();
      };

      // Create keyboard handler for resize
      const handleKeyDown = (e: KeyboardEvent) => {
        const state = resizeStateRef.current;
        if (!state || !state.isResizing) return;

        // Handle arrow keys for resizing
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();

          const increment = e.shiftKey ? 10 : 1;
          const direction = e.key === 'ArrowRight' ? 1 : -1;
          const newWidth = Math.max(
            minWidth,
            Math.min(maxWidth, state.startWidth + direction * increment)
          );

          // Update start width for next keypress
          state.startWidth = newWidth;
          state.startX += direction * increment; // Adjust startX to maintain relative position

          updateIndicator(state.startX, newWidth);
          onResize(newWidth);
        } else if (e.key === 'Escape') {
          // Cancel resize on Escape
          e.preventDefault();
          cleanup();
        } else if (e.key === 'Enter') {
          // Complete resize on Enter
          e.preventDefault();
          cleanup();
        }
      };

      // Store resize state
      resizeStateRef.current = {
        indicator,
        tooltip,
        handleElement,
        tableContainer,
        startX,
        startWidth,
        isResizing: true,
        handleMouseMove,
        handleMouseUp,
        handleKeyDown,
      };

      // Store cleanup function
      cleanupRef.current = cleanup;

      // Call the resize start handler
      onResizeStart(e, columnKey);

      // Initial indicator position
      updateIndicator(e.clientX, startWidth, e.clientY);

      // Add event listeners
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('keydown', handleKeyDown);
    },
    [
      currentWidth,
      findTableContainer,
      onResizeStart,
      columnKey,
      updateIndicator,
      minWidth,
      maxWidth,
      onResize,
      cleanup,
    ]
  );

  // Keyboard handler for starting resize
  const handleKeyDownStart = useCallback(
    (e: React.KeyboardEvent) => {
      // Only handle Enter/Space to start resize
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();

        const handleElement = e.currentTarget as HTMLElement;
        const rect = handleElement.getBoundingClientRect();
        const startX = rect.right; // Start at the right edge of the handle
        const startWidth =
          typeof currentWidth === 'number'
            ? currentWidth
            : parseInt(String(currentWidth).replace('px', ''), 10);

        // Find table container
        const tableContainer = findTableContainer(handleElement);

        // Create resize indicator line
        const indicator = document.createElement('div');
        indicator.className = 'column-resize-indicator';
        if (tableContainer !== document.body) {
          tableContainer.style.position = 'relative';
        }
        tableContainer.appendChild(indicator);

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'column-resize-tooltip';
        document.body.appendChild(tooltip);

        // Add resizing class
        handleElement.classList.add('resizing');
        document.body.classList.add('column-resizing');

        // Create keyboard handler for resize
        const handleKeyDown = (keyEvent: KeyboardEvent) => {
          const state = resizeStateRef.current;
          if (!state || !state.isResizing) return;

          // Handle arrow keys for resizing
          if (keyEvent.key === 'ArrowLeft' || keyEvent.key === 'ArrowRight') {
            keyEvent.preventDefault();
            keyEvent.stopPropagation();

            const increment = keyEvent.shiftKey ? 10 : 1;
            const direction = keyEvent.key === 'ArrowRight' ? 1 : -1;
            const newWidth = Math.max(
              minWidth,
              Math.min(maxWidth, state.startWidth + direction * increment)
            );

            // Update start width for next keypress
            state.startWidth = newWidth;
            state.startX += direction * increment; // Adjust startX to maintain relative position

            updateIndicator(state.startX, newWidth);
            onResize(newWidth);
          } else if (keyEvent.key === 'Escape') {
            // Cancel resize on Escape
            keyEvent.preventDefault();
            cleanup();
          } else if (keyEvent.key === 'Enter') {
            // Complete resize on Enter
            keyEvent.preventDefault();
            cleanup();
          }
        };

        // Store resize state
        resizeStateRef.current = {
          indicator,
          tooltip,
          handleElement,
          tableContainer,
          startX,
          startWidth,
          isResizing: true,
          handleMouseMove: () => {}, // Not used for keyboard-only resize
          handleMouseUp: () => {}, // Not used for keyboard-only resize
          handleKeyDown,
        };

        // Store cleanup function
        cleanupRef.current = cleanup;

        // Call the resize start handler
        onResizeStart(e, columnKey);

        // Initial indicator position
        updateIndicator(startX, startWidth);

        // Add event listeners for keyboard resize
        document.addEventListener('keydown', handleKeyDown);
      }
    },
    [
      currentWidth,
      findTableContainer,
      onResizeStart,
      columnKey,
      updateIndicator,
      minWidth,
      maxWidth,
      onResize,
      cleanup,
    ]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return {
    handleMouseDown,
    handleKeyDownStart,
    isResizing: resizeStateRef.current?.isResizing || false,
  };
};
