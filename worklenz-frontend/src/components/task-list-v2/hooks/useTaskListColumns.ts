import React, { useCallback, useMemo, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setCustomColumnModalAttributes,
  toggleCustomColumnModalOpen,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { selectColumns, selectCustomColumns } from '@/features/task-management/task-management.slice';
import { BASE_COLUMNS, ColumnConfig } from '../constants/columns';
import {
  validateColumnWidths,
  validateColumnWidth,
  CUSTOM_COLUMN_MIN_WIDTH,
  CUSTOM_COLUMN_MAX_WIDTH,
  CUSTOM_COLUMN_DEFAULT_WIDTH,
} from '@/utils/column-width-validation';

const SOFTWARE_COLUMN_LABELS: Record<string, string> = {
  title: 'issueColumn',
  phase: 'sprintColumn',
  assignees: 'assigneeColumn',
};

const BACKLOG_COLUMN_IDS: readonly string[] = [
  'status',
  'epic',
  'assignees',
  'labels',
  'priority',
  'points',
];
/** Card borders (3px active-sprint accent + 1px right) and row padding around backlog columns. */
const BACKLOG_ROW_CHROME_WIDTH = 18;

export interface UseTaskListColumnsParams {
  projectId?: string;
  isBacklogMode: boolean;
  isSoftwareProject: boolean;
  scrollContainer: HTMLDivElement | null;
}

export interface UseTaskListColumnsReturn {
  visibleColumns: ColumnConfig[];
  columnWidths: Record<string, string>;
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  containerStyle: React.CSSProperties & Record<string, string>;
  activeColumnId: string | null;
  overColumnId: string | null;
  handleColumnDragStart: (event: DragStartEvent) => void;
  handleColumnDragOver: (event: DragOverEvent) => void;
  handleColumnDragEnd: (event: DragEndEvent) => void;
  handleCustomColumnSettings: (columnKey: string) => void;
}

export const useTaskListColumns = ({
  projectId,
  isBacklogMode,
  isSoftwareProject,
  scrollContainer,
}: UseTaskListColumnsParams): UseTaskListColumnsReturn => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-list-table');
  const fields = useAppSelector(state => state.taskManagementFields.fields);
  const columns = useAppSelector(selectColumns);
  const customColumns = useAppSelector(selectCustomColumns);

  const columnReorderStorageKey = projectId
    ? `worklenz.taskList.${isBacklogMode ? 'backlogColumnOrder' : 'columnOrder'}.${projectId}`
    : null;

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (!columnReorderStorageKey) return [];
    try {
      const stored = localStorage.getItem(columnReorderStorageKey);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch (error) {
      console.error('Failed to load column order from localStorage:', error);
      return [];
    }
  });

  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  // State to store custom column widths (overrides BASE_COLUMNS widths)
  // Load from localStorage on mount
  const [columnWidths, setColumnWidths] = useState<Record<string, string>>(() => {
    if (!projectId) return {};

    try {
      const stored = localStorage.getItem(`worklenz.taskList.columnWidths.${projectId}`);
      if (!stored) return {};

      const parsed = JSON.parse(stored);
      // Validate stored widths against minWidth and maxWidth constraints
      return validateColumnWidths(parsed, BASE_COLUMNS);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded. Column widths not loaded.');
      } else {
        console.error('Failed to load column widths from localStorage:', error);
      }
      return {};
    }
  });

  // Save column widths to localStorage whenever they change
  useEffect(() => {
    if (projectId && Object.keys(columnWidths).length > 0) {
      try {
        localStorage.setItem(
          `worklenz.taskList.columnWidths.${projectId}`,
          JSON.stringify(columnWidths)
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded. Column widths not saved.');
        } else {
          console.error('Failed to save column widths to localStorage:', error);
        }
      }
    }
  }, [columnWidths, projectId]);

  // Filter visible columns based on local fields (primary) and backend columns (fallback)
  const rawVisibleColumns = useMemo(() => {
    // Start with base columns
    const baseVisibleColumns = BASE_COLUMNS.filter(column => {
      if (isBacklogMode && column.id === 'checkbox') return false;

      // Always show essential UI controls (drag handle, checkbox, title)
      // These are required for task list functionality
      if (
        column.isSticky &&
        (column.id === 'dragHandle' || column.id === 'checkbox' || column.id === 'title')
      ) {
        return true;
      }

      if (isBacklogMode) {
        return BACKLOG_COLUMN_IDS.includes(column.id);
      }
      // For other columns (including taskKey), respect the visibility settings
      // Primary: Check local fields configuration
      const field = fields.find(f => f.key === column.key);
      if (field) {
        return field.visible;
      }

      // Fallback: Check backend column configuration if local field not found
      const backendColumn = columns.find(c => c.key === column.key);
      if (backendColumn) {
        return backendColumn.pinned ?? false;
      }

      // Default: hide if neither local field nor backend column found
      return false;
    }).map(column => {
      // Apply custom width if it exists, otherwise use default width
      const rawWidth = columnWidths[column.id] || column.width;

      // Validate width using shared utility function
      const width = validateColumnWidth(column.id, rawWidth, column);
      const label = isSoftwareProject
        ? SOFTWARE_COLUMN_LABELS[column.id] ?? column.label
        : column.label;

      return {
        ...column,
        label,
        width,
      };
    });

    // Add visible custom columns
    const visibleCustomColumns =
      customColumns
        ?.filter(column => column.pinned && !isBacklogMode)
        ?.map(column => {
          // Give selection columns more width for dropdown content
          const fieldType = column.custom_column_obj?.fieldType;
          let defaultWidth = CUSTOM_COLUMN_DEFAULT_WIDTH;
          if (fieldType === 'selection' || fieldType === 'people') {
            defaultWidth = CUSTOM_COLUMN_DEFAULT_WIDTH;
          }

          // Map the configuration data structure to the expected format
          const customColumnObj = (column.custom_column_obj || column.configuration) as Record<string, unknown> | undefined;

          // Transform configuration format to custom_column_obj format if needed
          let transformedColumnObj = customColumnObj;
          if (customColumnObj && !customColumnObj.fieldType && customColumnObj.field_type) {
            transformedColumnObj = {
              ...customColumnObj,
              fieldType: customColumnObj.field_type,
              numberType: customColumnObj.number_type,
              labelPosition: customColumnObj.label_position,
              previewValue: customColumnObj.preview_value,
              firstNumericColumn: customColumnObj.first_numeric_column_key,
              secondNumericColumn: customColumnObj.second_numeric_column_key,
              selectionsList:
                customColumnObj.selections_list || customColumnObj.selectionsList || [],
              labelsList: customColumnObj.labels_list || customColumnObj.labelsList || [],
            };
          }

          const columnId = column.key || column.id || 'unknown';
          const rawWidth = columnWidths[columnId] || column.width || defaultWidth;
          const validatedWidth = validateColumnWidth(columnId, rawWidth, {
            id: columnId,
            minWidth: `${CUSTOM_COLUMN_MIN_WIDTH}px`,
            maxWidth: `${CUSTOM_COLUMN_MAX_WIDTH}px`,
            width: `${defaultWidth}px`,
          });

          return {
            id: columnId,
            label: column.name || t('customColumns.customColumnHeader'),
            width: validatedWidth,
            key: column.key || column.id || 'unknown',
            isSticky: false,
            minWidth: `${CUSTOM_COLUMN_MIN_WIDTH}px`,
            maxWidth: `${CUSTOM_COLUMN_MAX_WIDTH}px`,
            custom_column: true,
            custom_column_obj: transformedColumnObj,
            isCustom: true,
            name: column.name,
            uuid: column.id,
            isEditingHeader: column.isEditingHeader,
          };
        }) || [];

    return [...baseVisibleColumns, ...visibleCustomColumns];
  }, [fields, columns, customColumns, t, columnWidths, isBacklogMode, isSoftwareProject]);

  // Ensure column order includes only visible non-sticky columns; newly shown ones are placed
  // after the nearest column that precedes them in the default order.
  useEffect(() => {
    const reorderableIds = rawVisibleColumns.filter(column => !column.isSticky).map(c => c.id);
    setColumnOrder(prev => {
      const next = prev.filter(id => reorderableIds.includes(id));
      reorderableIds.forEach((id, defaultIndex) => {
        if (next.includes(id)) return;
        const precedingId = reorderableIds
          .slice(0, defaultIndex)
          .reverse()
          .find(candidateId => next.includes(candidateId));
        next.splice(precedingId ? next.indexOf(precedingId) + 1 : 0, 0, id);
      });
      const hasChanged =
        next.length !== prev.length || next.some((id, index) => id !== prev[index]);
      return hasChanged ? next : prev;
    });
  }, [rawVisibleColumns]);

  // Reload column order when project changes
  useEffect(() => {
    if (!columnReorderStorageKey) return;
    try {
      const stored = localStorage.getItem(columnReorderStorageKey);
      setColumnOrder(stored ? (JSON.parse(stored) as string[]) : []);
    } catch (error) {
      console.error('Failed to reload column order from localStorage:', error);
      setColumnOrder([]);
    }
  }, [columnReorderStorageKey]);

  // Persist column order
  useEffect(() => {
    if (columnReorderStorageKey && columnOrder.length) {
      try {
        localStorage.setItem(columnReorderStorageKey, JSON.stringify(columnOrder));
      } catch (error) {
        console.error('Failed to save column order to localStorage:', error);
      }
    }
  }, [columnOrder, columnReorderStorageKey]);

  // Apply column order while keeping sticky columns at the front
  const visibleColumns = useMemo(() => {
    const stickyColumns = rawVisibleColumns.filter(column => column.isSticky);
    const reorderableColumns = rawVisibleColumns.filter(column => !column.isSticky);

    const orderedIds = columnOrder.length
      ? columnOrder
      : reorderableColumns.map(column => column.id);

    const orderedReorderable = orderedIds
      .map(id => reorderableColumns.find(column => column.id === id))
      .filter(Boolean) as typeof reorderableColumns;

    const missingColumns = reorderableColumns.filter(column => !orderedIds.includes(column.id));

    return [...stickyColumns, ...orderedReorderable, ...missingColumns];
  }, [rawVisibleColumns, columnOrder]);

  // Create CSS style object with column width variables for instant resizing
  // Apply to document root so CSS variables are globally accessible
  const [backlogViewportWidth, setBacklogViewportWidth] = useState(0);

  useEffect(() => {
    if (!isBacklogMode || !scrollContainer) return;
    const updateWidth = () => setBacklogViewportWidth(scrollContainer.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(scrollContainer);
    return () => observer.disconnect();
  }, [isBacklogMode, scrollContainer]);

  /** Backlog: the title column absorbs spare width so the other columns sit on the right. */
  const backlogTitleWidth = useMemo(() => {
    if (!isBacklogMode || !backlogViewportWidth) return null;
    const titleColumn = visibleColumns.find(col => col.id === 'title');
    if (!titleColumn) return null;
    const otherColumnsWidth = visibleColumns
      .filter(col => col.id !== 'title')
      .reduce((total, col) => total + (parseFloat(String(col.width)) || 0), 0);
    const availableWidth =
      backlogViewportWidth - otherColumnsWidth - BACKLOG_ROW_CHROME_WIDTH;
    const baseWidth = parseFloat(String(titleColumn.width)) || 0;
    return `${Math.max(baseWidth, Math.floor(availableWidth))}px`;
  }, [isBacklogMode, backlogViewportWidth, visibleColumns]);

  const containerStyle = useMemo(() => {
    const style: React.CSSProperties & Record<string, string> = {};
    visibleColumns.forEach(col => {
      const width = col.id === 'title' && backlogTitleWidth ? backlogTitleWidth : col.width;
      style[`--col-width-${col.id}`] = width;
    });

    return style;
  }, [visibleColumns, backlogTitleWidth]);

  // Publish only committed widths, before layout measurement. Rendering must not
  // mutate the DOM, especially when React retries or abandons a render.
  useLayoutEffect(() => {
    const rootStyle = document.documentElement.style;
    Object.entries(containerStyle).forEach(([property, width]) => {
      if (rootStyle.getPropertyValue(property) !== width) rootStyle.setProperty(property, width);
    });
  }, [containerStyle]);

  // Column drag-and-drop handlers
  const handleColumnDragStart = useCallback((event: DragStartEvent) => {
    const colId = (event?.active?.id as string) || null;
    setActiveColumnId(colId);
  }, []);

  const handleColumnDragOver = useCallback((event: DragOverEvent) => {
    const newOverId = (event?.over?.id as string) || null;
    setOverColumnId(prev => (prev === newOverId ? prev : newOverId));
  }, []);

  const handleColumnDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveColumnId(null);
      setOverColumnId(null);

      const { active, over } = event || {};
      if (!active || !over || active.id === over.id) return;

      const reorderableIds = visibleColumns.filter(column => !column.isSticky).map(c => c.id);
      const oldIndex = reorderableIds.indexOf(active.id as string);
      const newIndex = reorderableIds.indexOf(over.id as string);

      if (oldIndex === -1 || newIndex === -1) return;

      const nextOrder = arrayMove(reorderableIds, oldIndex, newIndex);
      setColumnOrder(nextOrder);
    },
    [visibleColumns]
  );

  const handleCustomColumnSettings = useCallback(
    (columnKey: string) => {
      if (!columnKey) return;

      const columnData = visibleColumns.find(col => col.key === columnKey || col.id === columnKey);

      // Use the UUID for API calls, not the key (nanoid)
      // For custom columns, prioritize the uuid field over id field
      const columnId = columnData?.uuid;
      if (!columnId) return;

      dispatch(
        setCustomColumnModalAttributes({
          modalType: 'edit',
          columnId: columnId,
          columnData: columnData,
          canChangeColumnType: true,
        })
      );
      dispatch(toggleCustomColumnModalOpen(true));
    },
    [dispatch, visibleColumns]
  );

  return {
    visibleColumns,
    columnWidths,
    setColumnWidths,
    containerStyle,
    activeColumnId,
    overColumnId,
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDragEnd,
    handleCustomColumnSettings,
  };
};
