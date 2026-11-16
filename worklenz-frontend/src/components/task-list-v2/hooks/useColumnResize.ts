import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
  type RefObject,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnConfig } from '../constants/columns';

interface ColumnResizeOptions {
  columnWidths: Record<string, string>;
  setColumnWidths: Dispatch<SetStateAction<Record<string, string>>>;
  outerScrollRef: RefObject<HTMLDivElement | null>;
  contentScrollRef: RefObject<HTMLDivElement | null>;
}

/** Keeps resize feedback immediate and owns document listener cleanup. */
export const useColumnResize = ({
  columnWidths,
  setColumnWidths,
  outerScrollRef,
  contentScrollRef,
}: ColumnResizeOptions) => {
  const { t } = useTranslation('task-list-table');
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => resizeCleanupRef.current?.(), []);
  const handleResizeKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>, column: ColumnConfig) => {
    // Only handle ArrowLeft and ArrowRight keys
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const columnId = column.id;

    // Get current width from state or column default
    const currentWidthString = columnWidths[columnId] || column.width;
    const currentWidth = parseInt(currentWidthString.replace('px', ''), 10);

    // Calculate minimum width based on header text length
    // Use translated label text to measure actual displayed text
    let headerText: string;
    if (column.isCustom) {
      // Use the same logic as CustomColumnHeader component
      headerText =
        column.name || column.custom_column_obj?.fieldTitle || column.key || column.label || '';
    } else {
      headerText = t(column.label || '', { defaultValue: column.label || '' });
    }
    // Approximate: 8px per character + padding for icons/spacing
    // Custom columns need more padding for settings icon + drag handle
    // Breakdown: text margin (4px) + gap (16px) + settings icon (14px) +
    //            drag handle padding (12px) + drag handle icon (14px) +
    //            container padding (16px) + buffer (24px) = 100px
    // Regular columns need padding for drag handle (40px)
    const paddingForIcons = column.isCustom ? 100 : 40;
    const calculatedMinWidth = Math.max(100, headerText.length * 8 + paddingForIcons);

    // Get min/max widths from column config or use calculated minimum
    const minWidth = column.minWidth
      ? parseInt(column.minWidth.replace('px', ''), 10)
      : calculatedMinWidth;
    const maxWidth = column.maxWidth ? parseInt(column.maxWidth.replace('px', ''), 10) : 1200;

    // Determine increment: Shift for larger increments (10px), normal for smaller (1px)
    const increment = e.shiftKey ? 10 : 1;

    // Determine direction: ArrowRight increases width, ArrowLeft decreases
    const direction = e.key === 'ArrowRight' ? 1 : -1;

    // Calculate new width
    const newWidth = Math.max(minWidth, Math.min(maxWidth, currentWidth + direction * increment));

    // Update CSS variable for immediate visual feedback
    document.documentElement.style.setProperty(`--col-width-${columnId}`, `${newWidth}px`);

    // Update state to persist the change
    setColumnWidths(prev => ({
      ...prev,
      [columnId]: `${newWidth}px`,
    }));

    // Update aria attributes and visual state for accessibility
    const handleElement = e.currentTarget;
    const atLimit = newWidth <= minWidth || newWidth >= maxWidth;

    // Update aria attributes for screen readers
    handleElement.setAttribute('aria-valuenow', `${newWidth}`);
    handleElement.setAttribute('aria-valuemin', `${minWidth}`);
    handleElement.setAttribute('aria-valuemax', `${maxWidth}`);

    // Update visual state
    if (atLimit) {
      handleElement.classList.add('at-limit');
    } else {
      handleElement.classList.remove('at-limit');
    }
  };
  const handleResizeMouseDown = (e: ReactMouseEvent<HTMLDivElement>, column: ColumnConfig) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = parseInt(column.width.replace('px', ''), 10);
    const columnId = column.id;
    const handleElement = e.currentTarget;

    // Calculate minimum width based on header text length
    // Use translated label text to measure actual displayed text
    let headerText: string;
    if (column.isCustom) {
      // Use the same logic as CustomColumnHeader component
      headerText =
        column.name || column.custom_column_obj?.fieldTitle || column.key || column.label || '';
    } else {
      headerText = t(column.label || '', { defaultValue: column.label || '' });
    }
    // Approximate: 8px per character + padding for icons/spacing
    // Custom columns need more padding for settings icon + drag handle
    // Breakdown: text margin (4px) + gap (16px) + settings icon (14px) +
    //            drag handle padding (12px) + drag handle icon (14px) +
    //            container padding (16px) + buffer (24px) = 100px
    // Regular columns need padding for drag handle (40px)
    const paddingForIcons = column.isCustom ? 60 : 50;
    const calculatedMinWidth = Math.max(60, headerText.length * 8 + paddingForIcons);

    // Get min/max widths from column config or use calculated minimum
    const minWidth = column.minWidth
      ? parseInt(column.minWidth.replace('px', ''), 10)
      : calculatedMinWidth;
    const maxWidth = column.maxWidth ? parseInt(column.maxWidth.replace('px', ''), 10) : 1200;

    // Find the scrollable table container
    const scrollableContainer =
      outerScrollRef.current ||
      contentScrollRef.current ||
      (e.currentTarget.closest('[style*="overflow"]') as HTMLElement) ||
      (document
        .getElementById('task-list-container')
        ?.querySelector('[style*="overflow"]') as HTMLElement) ||
      document.getElementById('task-list-container') ||
      (e.currentTarget.closest('.border') as HTMLElement) ||
      document.body;
    const tableContainer = scrollableContainer;

    // Create resize indicator line
    const indicator = document.createElement('div');
    indicator.className = 'column-resize-indicator';

    // Ensure the container has position relative for absolute positioning
    const originalPosition = tableContainer.style.position;
    if (!originalPosition || originalPosition === 'static') {
      tableContainer.style.position = 'relative';
    }

    // Calculate the full scrollable height to span entire table
    const scrollHeight = tableContainer.scrollHeight;

    // Set indicator to span from current scroll position to end of content
    // Use fixed positioning from top of visible area to bottom of scrollable content
    indicator.style.top = '0px';
    indicator.style.height = `${scrollHeight}px`;

    tableContainer.appendChild(indicator);

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'column-resize-tooltip';
    document.body.appendChild(tooltip);

    // Add resizing class
    handleElement.classList.add('resizing');
    document.body.classList.add('column-resizing');

    const updateIndicator = (x: number, width: number) => {
      // Calculate position relative to table container's scroll origin.
      // scrollLeft must be added because the indicator uses position:absolute
      // inside the scrollable container — without it the line drifts left
      // by exactly the horizontal scroll offset.
      const containerRect = tableContainer.getBoundingClientRect();
      const relativeX = x - containerRect.left + tableContainer.scrollLeft;
      indicator.style.left = `${relativeX}px`;
      indicator.style.opacity = '1';
      tooltip.textContent = `${width}px`;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${e.clientY - 40}px`;
      tooltip.style.opacity = '1';

      // Check if at limit
      const atLimit = width <= minWidth || width >= maxWidth;
      if (atLimit) {
        handleElement.classList.add('at-limit');
      } else {
        handleElement.classList.remove('at-limit');
      }
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + diff));
      // Update CSS variable once - all elements update together
      document.documentElement.style.setProperty(`--col-width-${columnId}`, `${newWidth}px`);
      // FIX: clamp indicator X to match clamped width so the
      // blue line stops at the min/max boundary
      const clampedClientX = startX + (newWidth - startWidth);
      updateIndicator(clampedClientX, newWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      // Calculate final width and update state to persist
      const diff = upEvent.clientX - startX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + diff));
      setColumnWidths(prev => ({
        ...prev,
        [columnId]: `${newWidth}px`,
      }));

      // Call cleanup function to remove listeners and DOM elements
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
      }
    };

    // Create cleanup function to remove listeners and DOM elements
    // Must be defined after handleMouseMove and handleMouseUp
    const cleanup = () => {
      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Reset body styles
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('column-resizing');

      // Restore original position style
      if (originalPosition) {
        tableContainer.style.position = originalPosition;
      } else {
        tableContainer.style.position = '';
      }

      // Remove indicator and tooltip
      if (indicator.parentNode) {
        indicator.style.opacity = '0';
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.remove();
          }
        }, 150);
      }
      if (tooltip.parentNode) {
        tooltip.style.opacity = '0';
        setTimeout(() => {
          if (tooltip.parentNode) {
            tooltip.remove();
          }
        }, 150);
      }

      // Remove resizing classes
      handleElement.classList.remove('resizing', 'at-limit');

      // Clear the cleanup ref
      resizeCleanupRef.current = null;
    };

    // Store cleanup function in ref
    resizeCleanupRef.current = cleanup;

    // Initial indicator position
    updateIndicator(e.clientX, startWidth);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  return { handleResizeKeyDown, handleResizeMouseDown };
};
