import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  TouchSensor,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  selectAllTasksArray,
  selectGroups,
  selectGrouping,
  selectLoading,
  selectError,
  selectSelectedPriorities,
  selectSearch,
  fetchTasksV3,
  reorderTasksInGroup,
  moveTaskBetweenGroups,
  fetchTaskListColumns,
  selectColumns,
  selectCustomColumns,
  selectLoadingColumns,
  updateColumnVisibility,
  addTaskToGroup,
} from '@/features/task-management/task-management.slice';
import {
  selectCurrentGrouping,
  selectCollapsedGroups,
  toggleGroupCollapsed,
} from '@/features/task-management/grouping.slice';
import {
  selectSelectedTaskIds,
  selectLastSelectedTaskId,
  selectIsTaskSelected,
  selectTask,
  deselectTask,
  toggleTaskSelection,
  selectRange,
  clearSelection,
} from '@/features/task-management/selection.slice';
import TaskRowWithSubtasks from './TaskRowWithSubtasks';
import TaskGroupHeader from './TaskGroupHeader';
import { Task, TaskGroup } from '@/types/task-management.types';
import { RootState } from '@/app/store';
import { TaskListField } from '@/types/task-list-field.types';
import { useParams } from 'react-router-dom';
import ImprovedTaskFilters from '@/components/task-management/improved-task-filters';
import OptimizedBulkActionBar from '@/components/task-management/optimized-bulk-action-bar';
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import { HolderOutlined, PlusOutlined, SettingOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { COLUMN_KEYS } from '@/features/tasks/tasks.slice';
import { Skeleton, Input, Button, Tooltip, Flex, Dropdown, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import CustomColumnModal from '@/pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/custom-column-modal';
import {
  setCustomColumnModalAttributes,
  toggleCustomColumnModalOpen,
  CustomFieldsTypes,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import { createPortal } from 'react-dom';

// Base column configuration
const BASE_COLUMNS = [
  { id: 'dragHandle', label: '', width: '32px', isSticky: true, key: 'dragHandle' },
  { id: 'checkbox', label: '', width: '40px', isSticky: true, key: 'checkbox' },
  { id: 'taskKey', label: 'keyColumn', width: '100px', key: COLUMN_KEYS.KEY },
  { id: 'title', label: 'taskColumn', width: '470px', isSticky: true, key: COLUMN_KEYS.NAME },
  { id: 'status', label: 'statusColumn', width: '120px', key: COLUMN_KEYS.STATUS },
  { id: 'assignees', label: 'assigneesColumn', width: '150px', key: COLUMN_KEYS.ASSIGNEES },
  { id: 'priority', label: 'priorityColumn', width: '120px', key: COLUMN_KEYS.PRIORITY },
  { id: 'dueDate', label: 'dueDateColumn', width: '120px', key: COLUMN_KEYS.DUE_DATE },
  { id: 'progress', label: 'progressColumn', width: '120px', key: COLUMN_KEYS.PROGRESS },
  { id: 'labels', label: 'labelsColumn', width: 'auto', key: COLUMN_KEYS.LABELS },
  { id: 'phase', label: 'phaseColumn', width: '120px', key: COLUMN_KEYS.PHASE },
  { id: 'timeTracking', label: 'timeTrackingColumn', width: '120px', key: COLUMN_KEYS.TIME_TRACKING },
  { id: 'estimation', label: 'estimationColumn', width: '120px', key: COLUMN_KEYS.ESTIMATION },
  { id: 'startDate', label: 'startDateColumn', width: '120px', key: COLUMN_KEYS.START_DATE },
  { id: 'dueTime', label: 'dueTimeColumn', width: '120px', key: COLUMN_KEYS.DUE_TIME },
  { id: 'completedDate', label: 'completedDateColumn', width: '120px', key: COLUMN_KEYS.COMPLETED_DATE },
  { id: 'createdDate', label: 'createdDateColumn', width: '120px', key: COLUMN_KEYS.CREATED_DATE },
  { id: 'lastUpdated', label: 'lastUpdatedColumn', width: '120px', key: COLUMN_KEYS.LAST_UPDATED },
  { id: 'reporter', label: 'reporterColumn', width: '120px', key: COLUMN_KEYS.REPORTER },
];

type ColumnStyle = {
  width: string;
  position?: 'static' | 'relative' | 'absolute' | 'sticky' | 'fixed';
  left?: number;
  backgroundColor?: string;
  zIndex?: number;
  flexShrink?: number;
};

// Add Task Row Component - similar to AddSubtaskRow
interface AddTaskRowProps {
  groupId: string;
  groupType: string;
  groupValue: string;
  projectId: string;
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
  }>;
  onTaskAdded: () => void;
}

const AddTaskRow: React.FC<AddTaskRowProps> = memo(({ 
  groupId, 
  groupType,
  groupValue,
  projectId, 
  visibleColumns, 
  onTaskAdded 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [taskName, setTaskName] = useState('');
  const { socket, connected } = useSocket();
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();

  const handleAddTask = useCallback(() => {
    if (!taskName.trim()) return;

    // Prepare task data based on group type
    const taskData: any = {
      name: taskName.trim(),
      project_id: projectId,
    };

    // Set the appropriate field based on group type
    // Note: groupValue comes from backend and might be lowercase with underscores for phases
    if (groupType === 'status') {
      taskData.status_id = groupValue === 'Unmapped' ? null : groupValue;
    } else if (groupType === 'priority') {
      taskData.priority_id = groupValue === 'Unmapped' ? null : groupValue;
    } else if (groupType === 'phase') {
      // For phase, we need to handle the case where groupValue might be 
      // the actual phase name or 'Unmapped'
      if (groupValue === 'Unmapped' || groupValue === 'unmapped') {
        taskData.phase_id = null;
      } else {
        // Use the original group title for phase_id since backend expects phase names
        taskData.phase_id = groupValue;
      }
    }

    // Emit socket event for server-side creation
    if (connected && socket) {
      socket.emit(
        SocketEvents.QUICK_TASK.toString(),
        JSON.stringify(taskData)
      );
    }

    setTaskName('');
    setIsAdding(false);
    onTaskAdded();
  }, [taskName, groupType, groupValue, projectId, connected, socket, onTaskAdded]);

  const handleCancel = useCallback(() => {
    setTaskName('');
    setIsAdding(false);
  }, []);

  const renderColumn = useCallback((columnId: string, width: string) => {
    const baseStyle = { width };

    switch (columnId) {
      case 'dragHandle':
        return <div style={baseStyle} />;
      case 'checkbox':
        return <div style={baseStyle} />;
      case 'taskKey':
        return <div style={baseStyle} />;
      case 'title':
        return (
          <div className="flex items-center h-full" style={baseStyle}>
            <div className="flex items-center w-full h-full pl-8">
              {!isAdding ? (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors h-full"
                >
                  <PlusOutlined className="text-xs" />
                  {t('addTaskText')}
                </button>
              ) : (
                <Input
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  onPressEnter={handleAddTask}
                  onBlur={handleCancel}
                  placeholder="Type task name and press Enter to save"
                  className="w-full h-full border-none shadow-none bg-transparent"
                  style={{ 
                    height: '100%',
                    minHeight: '32px',
                    padding: '0',
                    fontSize: '14px'
                  }}
                  autoFocus
                />
              )}
            </div>
          </div>
        );
      default:
        return <div style={baseStyle} />;
    }
  }, [isAdding, taskName, handleAddTask, handleCancel, t]);

  return (
    <div className="flex items-center min-w-max px-4 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[36px] border-b border-gray-200 dark:border-gray-700">
      {visibleColumns.map((column) =>
        renderColumn(column.id, column.width)
      )}
    </div>
  );
});

AddTaskRow.displayName = 'AddTaskRow';

// Add Custom Column Button Component
const AddCustomColumnButton: React.FC = memo(() => {
  const dispatch = useAppDispatch();

  const handleModalOpen = useCallback(() => {
    dispatch(setCustomColumnModalAttributes({ modalType: 'create', columnId: null }));
    dispatch(toggleCustomColumnModalOpen(true));
  }, [dispatch]);

  const { t } = useTranslation('task-list-table');

  return (
    <Tooltip title={t('customColumns.addCustomColumn')}>
      <Button
        icon={<PlusOutlined />}
        type="text"
        size="small"
        onClick={handleModalOpen}
        className="hover:bg-gray-100 dark:hover:bg-gray-700"
        style={{
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
      />
    </Tooltip>
  );
});

AddCustomColumnButton.displayName = 'AddCustomColumnButton';

// Custom Column Header Component
const CustomColumnHeader: React.FC<{
  column: any;
  onSettingsClick: (columnId: string) => void;
}> = ({ column, onSettingsClick }) => {
  const { t } = useTranslation('task-list-table');

  // Get the display name from various possible sources
  const displayName = column.name || 
                     column.label || 
                     column.custom_column_obj?.fieldTitle || 
                     column.custom_column_obj?.field_title ||
                     t('customColumns.customColumnHeader');

  return (
    <Flex align="center" justify="space-between" className="w-full">
      <span title={displayName}>{displayName}</span>
      <Tooltip title={t('customColumns.customColumnSettings')}>
        <SettingOutlined
          className="cursor-pointer hover:text-primary"
          onClick={e => {
            e.stopPropagation();
            onSettingsClick(column.key || column.id);
          }}
        />
      </Tooltip>
    </Flex>
  );
};

// Custom Column Cell Component with Interactive Inputs
const CustomColumnCell: React.FC<{
  column: any;
  task: any;
  updateTaskCustomColumnValue: (taskId: string, columnKey: string, value: string) => void;
}> = memo(({ column, task, updateTaskCustomColumnValue }) => {
  const { t } = useTranslation('task-list-table');

  const customValue = task.custom_column_values?.[column.key];
  const fieldType = column.custom_column_obj?.fieldType;

  if (!fieldType || !column.custom_column) {
    return <span className="text-gray-400 text-sm">-</span>;
  }

  // Render different input types based on field type
  switch (fieldType) {
    case 'people':
      return (
        <PeopleCustomColumnCell
          task={task}
          columnKey={column.key}
          customValue={customValue}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
        />
      );
    case 'date':
      return (
        <DateCustomColumnCell
          task={task}
          columnKey={column.key}
          customValue={customValue}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
        />
      );
    case 'number':
      return (
        <NumberCustomColumnCell
          task={task}
          columnKey={column.key}
          customValue={customValue}
          columnObj={column.custom_column_obj}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
        />
      );
    case 'selection':
      return (
        <SelectionCustomColumnCell
          task={task}
          columnKey={column.key}
          customValue={customValue}
          columnObj={column.custom_column_obj}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
        />
      );
    default:
      return <span className="text-sm text-gray-400">{t('customColumns.unsupportedField')}</span>;
  }
});

CustomColumnCell.displayName = 'CustomColumnCell';

// People Field Cell Component
const PeopleCustomColumnCell: React.FC<{
  task: any;
  columnKey: string;
  customValue: any;
  updateTaskCustomColumnValue: (taskId: string, columnKey: string, value: string) => void;
}> = memo(({ task, columnKey, customValue, updateTaskCustomColumnValue }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-list-table');
  
  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const selectedMemberIds = useMemo(() => {
    try {
      return customValue ? JSON.parse(customValue) : [];
    } catch (e) {
      return [];
    }
  }, [customValue]);

  const filteredMembers = useMemo(() => {
    return members?.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];
  }, [members, searchQuery]);

  const selectedMembers = useMemo(() => {
    if (!members?.data || !selectedMemberIds.length) return [];
    return members.data.filter(member => selectedMemberIds.includes(member.id));
  }, [members, selectedMemberIds]);

  const handleMemberSelection = (memberId: string) => {
    const newSelectedIds = selectedMemberIds.includes(memberId)
      ? selectedMemberIds.filter((id: string) => id !== memberId)
      : [...selectedMemberIds, memberId];

    if (task.id) {
      updateTaskCustomColumnValue(task.id, columnKey, JSON.stringify(newSelectedIds));
    }
  };

  const handleInviteProjectMember = () => {
    dispatch(toggleProjectMemberDrawer());
  };

  const dropdownContent = (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 w-80">
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('searchInputPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <div className="max-h-60 overflow-y-auto">
          {filteredMembers.length > 0 ? (
            filteredMembers.map(member => (
              <div
                key={member.id}
                onClick={() => member.id && handleMemberSelection(member.id)}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={member.id ? selectedMemberIds.includes(member.id) : false}
                  onChange={() => member.id && handleMemberSelection(member.id)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.name} className="w-8 h-8 rounded-full" />
                  ) : (
                    member.name?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
              {t('noMembersFound')}
            </div>
          )}
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
          <button
            onClick={handleInviteProjectMember}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
          >
            <UsergroupAddOutlined className="w-4 h-4" />
            {t('assigneeSelectorInviteButton')}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-1">
      {selectedMembers.length > 0 && (
        <div className="flex -space-x-1">
          {selectedMembers.slice(0, 3).map((member) => (
            <div
              key={member.id}
              className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300 border-2 border-white dark:border-gray-800"
              title={member.name}
            >
              {member.avatar_url ? (
                <img src={member.avatar_url} alt={member.name} className="w-6 h-6 rounded-full" />
              ) : (
                member.name?.charAt(0).toUpperCase()
              )}
            </div>
          ))}
          {selectedMembers.length > 3 && (
            <div className="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-500 flex items-center justify-center text-xs font-medium text-white border-2 border-white dark:border-gray-800">
              +{selectedMembers.length - 3}
            </div>
          )}
        </div>
      )}
      
      <Dropdown
        open={isDropdownOpen}
        onOpenChange={setIsDropdownOpen}
        dropdownRender={() => dropdownContent}
        trigger={['click']}
        placement="bottomLeft"
      >
        <button className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
          <PlusOutlined className="w-3 h-3 text-gray-400 dark:text-gray-500" />
        </button>
      </Dropdown>
    </div>
  );
});

PeopleCustomColumnCell.displayName = 'PeopleCustomColumnCell';

// Date Field Cell Component
const DateCustomColumnCell: React.FC<{
  task: any;
  columnKey: string;
  customValue: any;
  updateTaskCustomColumnValue: (taskId: string, columnKey: string, value: string) => void;
}> = memo(({ task, columnKey, customValue, updateTaskCustomColumnValue }) => {
  const dateValue = customValue ? dayjs(customValue) : null;

  return (
    <DatePicker
      value={dateValue}
      onChange={date => {
        if (task.id) {
          updateTaskCustomColumnValue(task.id, columnKey, date ? date.toISOString() : '');
        }
      }}
      placeholder="Set Date"
      format="MMM DD, YYYY"
      suffixIcon={null}
      className="w-full border-none bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
      inputReadOnly
    />
  );
});

DateCustomColumnCell.displayName = 'DateCustomColumnCell';

// Number Field Cell Component
const NumberCustomColumnCell: React.FC<{
  task: any;
  columnKey: string;
  customValue: any;
  columnObj: any;
  updateTaskCustomColumnValue: (taskId: string, columnKey: string, value: string) => void;
}> = memo(({ task, columnKey, customValue, columnObj, updateTaskCustomColumnValue }) => {
  const [inputValue, setInputValue] = useState(customValue || '');
  const [isEditing, setIsEditing] = useState(false);
  
  const numberType = columnObj?.numberType || 'formatted';
  const decimals = columnObj?.decimals || 0;
  const label = columnObj?.label || '';
  const labelPosition = columnObj?.labelPosition || 'left';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers, decimal point, and minus sign
    if (/^-?\d*\.?\d*$/.test(value) || value === '') {
      setInputValue(value);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (task.id && inputValue !== customValue) {
      updateTaskCustomColumnValue(task.id, columnKey, inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setInputValue(customValue || '');
      setIsEditing(false);
    }
  };

  const getDisplayValue = () => {
    if (isEditing) return inputValue;
    
    if (!inputValue) return '';
    
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) return inputValue;
    
    switch (numberType) {
      case 'formatted':
        return numValue.toFixed(decimals);
      case 'percentage':
        return `${numValue.toFixed(decimals)}%`;
      case 'withLabel':
        return labelPosition === 'left' ? `${label} ${numValue.toFixed(decimals)}` : `${numValue.toFixed(decimals)} ${label}`;
      default:
        return inputValue;
    }
  };

  return (
    <div className="flex items-center gap-1">
      {numberType === 'withLabel' && labelPosition === 'left' && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      )}
      <input
        type="text"
        value={getDisplayValue()}
        onChange={handleInputChange}
        onFocus={() => setIsEditing(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent border-none text-sm text-right focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700 px-1 py-0.5 rounded"
        placeholder="0"
      />
      {numberType === 'withLabel' && labelPosition === 'right' && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      )}
    </div>
  );
});

NumberCustomColumnCell.displayName = 'NumberCustomColumnCell';

// Selection Field Cell Component
const SelectionCustomColumnCell: React.FC<{
  task: any;
  columnKey: string;
  customValue: any;
  columnObj: any;
  updateTaskCustomColumnValue: (taskId: string, columnKey: string, value: string) => void;
}> = memo(({ task, columnKey, customValue, columnObj, updateTaskCustomColumnValue }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const selectionsList = columnObj?.selectionsList || [];
  
  const selectedOption = selectionsList.find((option: any) => option.selection_name === customValue);

  const dropdownContent = (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 min-w-[150px]">
      {selectionsList.map((option: any) => (
        <div
          key={option.selection_id}
          onClick={() => {
            if (task.id) {
              updateTaskCustomColumnValue(task.id, columnKey, option.selection_name);
            }
            setIsDropdownOpen(false);
          }}
          className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer"
        >
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: option.selection_color || '#6b7280' }}
          />
          <span className="text-sm text-gray-900 dark:text-gray-100">{option.selection_name}</span>
        </div>
      ))}
      {selectionsList.length === 0 && (
        <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-sm">
          No options available
        </div>
      )}
    </div>
  );

  return (
    <Dropdown
      open={isDropdownOpen}
      onOpenChange={setIsDropdownOpen}
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded min-h-[24px]">
        {selectedOption ? (
          <>
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedOption.selection_color || '#6b7280' }}
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">{selectedOption.selection_name}</span>
          </>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500">Select option</span>
        )}
      </div>
    </Dropdown>
  );
});

SelectionCustomColumnCell.displayName = 'SelectionCustomColumnCell';

const TaskListV2: React.FC = () => {
  const dispatch = useAppDispatch();
  const { projectId: urlProjectId } = useParams();
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Using Redux state for collapsedGroups instead of local state
  const collapsedGroups = useAppSelector(selectCollapsedGroups);

  // Selectors
  const allTasks = useAppSelector(selectAllTasksArray); // Renamed to allTasks for clarity
  const groups = useAppSelector(selectGroups);
  const grouping = useAppSelector(selectGrouping);
  const loading = useAppSelector(selectLoading);
  const error = useAppSelector(selectError);
  const selectedPriorities = useAppSelector(selectSelectedPriorities);
  const searchQuery = useAppSelector(selectSearch);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const selectedTaskIds = useAppSelector(selectSelectedTaskIds);
  const lastSelectedTaskId = useAppSelector(selectLastSelectedTaskId);

  const fields = useAppSelector(state => state.taskManagementFields) || [];
  const columns = useAppSelector(selectColumns);
  const customColumns = useAppSelector(selectCustomColumns);
  const loadingColumns = useAppSelector(selectLoadingColumns);

  // Enable real-time updates via socket handlers
  useTaskSocketHandlers();

  // Filter visible columns based on local fields (primary) and backend columns (fallback)
  const visibleColumns = useMemo(() => {
    // Start with base columns
    const baseVisibleColumns = BASE_COLUMNS.filter(column => {
      // Always show drag handle and title (sticky columns)
      if (column.isSticky) return true;
      
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
    });

    // Add visible custom columns
    const visibleCustomColumns = customColumns
      ?.filter(column => column.pinned)
      ?.map(column => ({
        id: column.key || column.id || 'unknown',
        label: column.name || t('customColumns.customColumnHeader'),
        width: `${(column as any).width || 120}px`,
        key: column.key || column.id || 'unknown',
        custom_column: true,
        custom_column_obj: column.custom_column_obj || (column as any).configuration,
        isCustom: true,
        name: column.name, // Add the name property for proper display
        uuid: column.id, // Preserve the actual UUID for delete operations
      })) || [];

    return [...baseVisibleColumns, ...visibleCustomColumns];
  }, [fields, columns, customColumns]);

  // Sync local field changes with backend column configuration (debounced)
  useEffect(() => {
    if (!urlProjectId || columns.length === 0 || fields.length === 0) return;

    // Debounce the sync to avoid too many API calls
    const timeoutId = setTimeout(() => {
      // Check if there are any differences between local fields and backend columns
      const changedFields = fields.filter(field => {
        const backendColumn = columns.find(c => c.key === field.key);
        if (backendColumn) {
          // If backend column exists and visibility differs from local field
          return (backendColumn.pinned ?? false) !== field.visible;
        }
        return false;
      });

      // Update backend for any changed fields
      changedFields.forEach(field => {
        const backendColumn = columns.find(c => c.key === field.key);
        if (backendColumn) {
          dispatch(updateColumnVisibility({
            projectId: urlProjectId,
            item: {
              ...backendColumn,
              pinned: field.visible
            }
          }));
        }
      });
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [fields, columns, urlProjectId, dispatch]);

  // Effects
  useEffect(() => {
    if (urlProjectId) {
      dispatch(fetchTasksV3(urlProjectId));
      dispatch(fetchTaskListColumns(urlProjectId));
    }
  }, [dispatch, urlProjectId]);

  // Handlers
  const handleTaskSelect = useCallback(
    (taskId: string, event: React.MouseEvent) => {
      if (event.ctrlKey || event.metaKey) {
        dispatch(toggleTaskSelection(taskId));
      } else if (event.shiftKey && lastSelectedTaskId) {
        const taskIds = allTasks.map(t => t.id); // Use allTasks here
        const startIdx = taskIds.indexOf(lastSelectedTaskId);
        const endIdx = taskIds.indexOf(taskId);
        const rangeIds = taskIds.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
        dispatch(selectRange(rangeIds));
      } else {
        dispatch(clearSelection());
        dispatch(selectTask(taskId));
      }
    },
    [dispatch, lastSelectedTaskId, allTasks]
  );

  const handleGroupCollapse = useCallback(
    (groupId: string) => {
      dispatch(toggleGroupCollapsed(groupId)); // Dispatch Redux action to toggle collapsed state
    },
    [dispatch]
  );

  // Function to update custom column values
  const updateTaskCustomColumnValue = useCallback((taskId: string, columnKey: string, value: string) => {
    try {
      if (!urlProjectId) {
        console.error('Project ID is missing');
        return;
      }

      // Prepare the data to send via socket
      const body = {
        task_id: taskId,
        column_key: columnKey,
        value: value,
        project_id: urlProjectId,
      };

      // Emit socket event to update the custom column value
      if (socket && connected) {
        socket.emit(SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(), JSON.stringify(body));
      } else {
        console.warn('Socket not connected, unable to emit TASK_CUSTOM_COLUMN_UPDATE event');
      }
    } catch (error) {
      console.error('Error updating custom column value:', error);
    }
  }, [urlProjectId, socket, connected]);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;

      if (!over) return;

      const activeId = active.id;
      const overId = over.id;

      // Find the active task and the item being dragged over
      const activeTask = allTasks.find(task => task.id === activeId);
      if (!activeTask) return;

      // Check if we're dragging over a task or a group
      const overTask = allTasks.find(task => task.id === overId);
      const overGroup = groups.find(group => group.id === overId);

      // Find the groups
      const activeGroup = groups.find(group => group.taskIds.includes(activeTask.id));
      let targetGroup = overGroup;

      if (overTask) {
        targetGroup = groups.find(group => group.taskIds.includes(overTask.id));
      }

      if (!activeGroup || !targetGroup) return;

      // If dragging to a different group, we need to handle cross-group movement
      if (activeGroup.id !== targetGroup.id) {
        console.log('Cross-group drag detected:', {
          activeTask: activeTask.id,
          fromGroup: activeGroup.id,
          toGroup: targetGroup.id,
        });
      }
    },
    [allTasks, groups]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) {
        return;
      }

      const activeId = active.id;
      const overId = over.id;

      // Find the active task
      const activeTask = allTasks.find(task => task.id === activeId);
      if (!activeTask) {
        console.error('Active task not found:', activeId);
        return;
      }

      // Find the groups
      const activeGroup = groups.find(group => group.taskIds.includes(activeTask.id));
      if (!activeGroup) {
        console.error('Could not find active group for task:', activeId);
        return;
      }

      // Check if we're dropping on a task or a group
      const overTask = allTasks.find(task => task.id === overId);
      const overGroup = groups.find(group => group.id === overId);

      let targetGroup = overGroup;
      let insertIndex = 0;

      if (overTask) {
        // Dropping on a task
        targetGroup = groups.find(group => group.taskIds.includes(overTask.id));
        if (targetGroup) {
          insertIndex = targetGroup.taskIds.indexOf(overTask.id);
        }
      } else if (overGroup) {
        // Dropping on a group (at the end)
        targetGroup = overGroup;
        insertIndex = targetGroup.taskIds.length;
      }

      if (!targetGroup) {
        console.error('Could not find target group');
        return;
      }

      const isCrossGroup = activeGroup.id !== targetGroup.id;
      const activeIndex = activeGroup.taskIds.indexOf(activeTask.id);

      console.log('Drag operation:', {
        activeId,
        overId,
        activeTask: activeTask.name || activeTask.title,
        activeGroup: activeGroup.id,
        targetGroup: targetGroup.id,
        activeIndex,
        insertIndex,
        isCrossGroup,
      });

      if (isCrossGroup) {
        // Moving task between groups
        console.log('Moving task between groups:', {
          task: activeTask.name || activeTask.title,
          from: activeGroup.title,
          to: targetGroup.title,
          newPosition: insertIndex,
        });

        // Move task to the target group
        dispatch(
          moveTaskBetweenGroups({
            taskId: activeId as string,
            sourceGroupId: activeGroup.id,
            targetGroupId: targetGroup.id,
          })
        );

        // Reorder task within target group at drop position
        dispatch(
          reorderTasksInGroup({
            sourceTaskId: activeId as string,
            destinationTaskId: over.id as string,
            sourceGroupId: activeGroup.id,
            destinationGroupId: targetGroup.id,
          })
        );
      } else {
        // Reordering within the same group
        console.log('Reordering task within same group:', {
          task: activeTask.name || activeTask.title,
          group: activeGroup.title,
          from: activeIndex,
          to: insertIndex,
        });

        if (activeIndex !== insertIndex) {
          // Reorder task within same group at drop position
          dispatch(
            reorderTasksInGroup({
              sourceTaskId: activeId as string,
              destinationTaskId: over.id as string,
              sourceGroupId: activeGroup.id,
              destinationGroupId: activeGroup.id,
            })
          );
        }
      }
    },
    [allTasks, groups]
  );

  // Bulk action handlers
  const handleClearSelection = useCallback(() => {
    dispatch(clearSelection());
  }, [dispatch]);

  const handleBulkStatusChange = useCallback(async (statusId: string) => {
    // TODO: Implement bulk status change
    console.log('Bulk status change:', statusId);
  }, []);

  const handleBulkPriorityChange = useCallback(async (priorityId: string) => {
    // TODO: Implement bulk priority change
    console.log('Bulk priority change:', priorityId);
  }, []);

  const handleBulkPhaseChange = useCallback(async (phaseId: string) => {
    // TODO: Implement bulk phase change
    console.log('Bulk phase change:', phaseId);
  }, []);

  const handleBulkAssignToMe = useCallback(async () => {
    // TODO: Implement bulk assign to me
    console.log('Bulk assign to me');
  }, []);

  const handleBulkAssignMembers = useCallback(async (memberIds: string[]) => {
    // TODO: Implement bulk assign members
    console.log('Bulk assign members:', memberIds);
  }, []);

  const handleBulkAddLabels = useCallback(async (labelIds: string[]) => {
    // TODO: Implement bulk add labels
    console.log('Bulk add labels:', labelIds);
  }, []);

  const handleBulkArchive = useCallback(async () => {
    // TODO: Implement bulk archive
    console.log('Bulk archive');
  }, []);

  const handleBulkDelete = useCallback(async () => {
    // TODO: Implement bulk delete
    console.log('Bulk delete');
  }, []);

  const handleBulkDuplicate = useCallback(async () => {
    // TODO: Implement bulk duplicate
    console.log('Bulk duplicate');
  }, []);

  const handleBulkExport = useCallback(async () => {
    // TODO: Implement bulk export
    console.log('Bulk export');
  }, []);

  const handleBulkSetDueDate = useCallback(async (date: string) => {
    // TODO: Implement bulk set due date
    console.log('Bulk set due date:', date);
  }, []);

  // Custom column settings handler
  const handleCustomColumnSettings = useCallback((columnKey: string) => {
    if (!columnKey) return;
    
    // Find the column data from visibleColumns
    const columnData = visibleColumns.find(col => col.key === columnKey || col.id === columnKey);
    
    console.log('Opening modal with column data:', {
      columnKey,
      columnData,
      visibleColumns
    });
    
    dispatch(setCustomColumnModalAttributes({ 
      modalType: 'edit', 
      columnId: columnKey,
      columnData: columnData
    }));
    dispatch(toggleCustomColumnModalOpen(true));
  }, [dispatch, visibleColumns]);

  // Memoized values for GroupedVirtuoso
  const virtuosoGroups = useMemo(() => {
    let currentTaskIndex = 0;
    return groups.map(group => {
      const isCurrentGroupCollapsed = collapsedGroups.has(group.id);

      // Order tasks according to group.taskIds array to maintain proper order
      const visibleTasksInGroup = isCurrentGroupCollapsed
        ? []
        : group.taskIds
            .map(taskId => allTasks.find(task => task.id === taskId))
            .filter((task): task is Task => task !== undefined); // Type guard to filter out undefined tasks

      const tasksForVirtuoso = visibleTasksInGroup.map(task => ({
        ...task,
        originalIndex: allTasks.indexOf(task),
      }));

      // Add AddTaskRow as a virtual item at the end of each group (when not collapsed)
      const itemsWithAddTask = !isCurrentGroupCollapsed ? [
        ...tasksForVirtuoso,
        {
          id: `add-task-${group.id}`,
          isAddTaskRow: true,
          groupId: group.id,
          groupType: currentGrouping || 'status',
          groupValue: group.groupValue || group.title,
          projectId: urlProjectId,
        }
      ] : tasksForVirtuoso;

      const groupData = {
        ...group,
        tasks: itemsWithAddTask,
        startIndex: currentTaskIndex,
        count: itemsWithAddTask.length,
        // Add actual task count for display purposes (regardless of collapsed state)
        actualCount: group.taskIds.length,
        // Ensure groupValue is available for AddTaskRow
        groupValue: group.groupValue || group.title,
      };
      currentTaskIndex += itemsWithAddTask.length;
      return groupData;
    });
  }, [groups, allTasks, collapsedGroups, currentGrouping, urlProjectId]);

  const virtuosoGroupCounts = useMemo(() => {
    return virtuosoGroups.map(group => group.count);
  }, [virtuosoGroups]);

  const virtuosoItems = useMemo(() => {
    return virtuosoGroups.flatMap(group => group.tasks);
  }, [virtuosoGroups]);

  // Memoize column headers to prevent unnecessary re-renders
  const columnHeaders = useMemo(
    () => (
      <div className="flex items-center px-4 py-3 bg-gray-50 dark:bg-gray-800 w-full" style={{ minWidth: 'max-content', height: '44px' }}>
        {visibleColumns.map(column => {
          const columnStyle: ColumnStyle = {
            width: column.width,
            flexShrink: 0, // Prevent columns from shrinking
            // Add specific styling for labels column with auto width
            ...(column.id === 'labels' && column.width === 'auto'
              ? {
                  minWidth: '200px', // Ensure minimum width for labels
                  flexGrow: 1, // Allow it to grow
                }
              : {}),
          };

          return (
            <div
              key={column.id}
              className="text-sm font-semibold text-gray-600 dark:text-gray-300"
              style={columnStyle}
            >
              {column.id === 'dragHandle' ? (
                <span></span> // Empty space for drag handle column header
              ) : column.id === 'checkbox' ? (
                <span></span> // Empty for checkbox column header
              ) : (column as any).isCustom ? (
                <CustomColumnHeader
                  column={column}
                  onSettingsClick={handleCustomColumnSettings}
                />
              ) : (
                t(column.label || '')
              )}
            </div>
          );
        })}
        {/* Add Custom Column Button */}
        <div className="flex items-center justify-center" style={{ width: '60px', flexShrink: 0 }}>
          <AddCustomColumnButton />
        </div>
        {/* Filler div to extend background to full width */}
        <div className="flex-1 bg-gray-50 dark:bg-gray-800"></div>
      </div>
    ),
    [visibleColumns, t, handleCustomColumnSettings]
  );

  // Add callback for task added
  const handleTaskAdded = useCallback(() => {
    // Refresh tasks after adding a new one
    if (urlProjectId) {
      dispatch(fetchTasksV3(urlProjectId));
    }
  }, [dispatch, urlProjectId]);

  // Render functions
  const renderGroup = useCallback(
    (groupIndex: number) => {
      const group = virtuosoGroups[groupIndex];
      const isGroupCollapsed = collapsedGroups.has(group.id);
      // Check if group is empty (no actual tasks, only AddTaskRow)
      const isGroupEmpty = group.actualCount === 0;

      return (
        <div className={groupIndex > 0 ? 'mt-2' : ''}>
          <TaskGroupHeader
            group={{
              id: group.id,
              name: group.title,
              count: group.actualCount, // Use actualCount instead of count for display
              color: group.color,
            }}
            isCollapsed={isGroupCollapsed}
            onToggle={() => handleGroupCollapse(group.id)}
          />
          {/* No tasks message when group is empty */}
          {isGroupEmpty && !isGroupCollapsed && (
            <div className="relative w-full">
              <div className="flex items-center min-w-max px-4 py-3">
                {/* Render invisible columns to maintain layout */}
                {visibleColumns.map((column) => (
                  <div
                    key={`empty-${column.id}`}
                    style={{ width: column.width, flexShrink: 0 }}
                  />
                ))}
              </div>
              {/* Overlay the centered message */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-sm italic text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 px-4 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                  {t('noTasksInGroup')}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    },
    [virtuosoGroups, collapsedGroups, handleGroupCollapse, visibleColumns, t]
  );

  const renderTask = useCallback(
    (taskIndex: number) => {
      const item = virtuosoItems[taskIndex]; // Get item from the flattened virtuosoItems
      if (!item || !urlProjectId) return null; // Should not happen if logic is correct
      
      // Check if this is an AddTaskRow virtual item
      if ('isAddTaskRow' in item && item.isAddTaskRow) {
        return (
          <AddTaskRow
            groupId={item.groupId}
            groupType={item.groupType}
            groupValue={item.groupValue}
            projectId={urlProjectId}
            visibleColumns={visibleColumns}
            onTaskAdded={handleTaskAdded}
          />
        );
      }
      
      // Regular task row
      return (
        <TaskRowWithSubtasks
          taskId={item.id}
          projectId={urlProjectId}
          visibleColumns={visibleColumns}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
        />
      );
    },
    [virtuosoItems, visibleColumns, urlProjectId, handleTaskAdded]
  );

  if (loading || loadingColumns) return <Skeleton active />;
  if (error) return <div>Error: {error}</div>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col bg-white dark:bg-gray-900" style={{ height: '100vh', overflow: 'hidden' }}>
        {/* Task Filters */}
        <div className="flex-none px-4 py-3" style={{ height: '66px', flexShrink: 0 }}>
          <ImprovedTaskFilters position="list" />
        </div>

        {/* Table Container with fixed height and horizontal scroll */}
        <div 
          className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700" 
          style={{ 
            height: '600px',
            maxHeight: '600px'
          }}
        >
          <div style={{ minWidth: 'max-content' }}>
            {/* Column Headers - Sticky at top */}
            <div className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center px-4 py-3 w-full" style={{ minWidth: 'max-content', height: '44px' }}>
                {visibleColumns.map(column => {
                  const columnStyle: ColumnStyle = {
                    width: column.width,
                    flexShrink: 0,
                    ...(column.id === 'labels' && column.width === 'auto'
                      ? {
                          minWidth: '200px',
                          flexGrow: 1,
                        }
                      : {}),
                  };

                  return (
                    <div
                      key={column.id}
                      className="text-sm font-semibold text-gray-600 dark:text-gray-300"
                      style={columnStyle}
                    >
                      {column.id === 'dragHandle' ? (
                        <span></span>
                      ) : column.id === 'checkbox' ? (
                        <span></span>
                      ) : (column as any).isCustom ? (
                        <CustomColumnHeader
                          column={column}
                          onSettingsClick={handleCustomColumnSettings}
                        />
                      ) : (
                        t(column.label || '')
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center justify-center" style={{ width: '60px', flexShrink: 0 }}>
                  <AddCustomColumnButton />
                </div>
              </div>
            </div>

            {/* Task List Content */}
            <div className="bg-white dark:bg-gray-900">
              <SortableContext
                items={virtuosoItems
                  .filter(item => !('isAddTaskRow' in item) && !item.parent_task_id)
                  .map(item => item.id)
                  .filter((id): id is string => id !== undefined)}
                strategy={verticalListSortingStrategy}
              >
                <GroupedVirtuoso
                  style={{ height: '550px' }}
                  groupCounts={virtuosoGroupCounts}
                  groupContent={renderGroup}
                  itemContent={renderTask}
                  components={{
                    List: React.forwardRef<
                      HTMLDivElement,
                      { style?: React.CSSProperties; children?: React.ReactNode }
                    >(({ style, children }, ref) => (
                      <div ref={ref} style={style || {}} className="virtuoso-list-container bg-white dark:bg-gray-900">
                        {children}
                      </div>
                    )),
                  }}
                />
              </SortableContext>
            </div>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-md border-2 border-blue-400 opacity-95">
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <HolderOutlined className="text-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {allTasks.find(task => task.id === activeId)?.name ||
                        allTasks.find(task => task.id === activeId)?.title ||
                        'Task'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {allTasks.find(task => task.id === activeId)?.task_key}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>

        {/* Bulk Action Bar - Positioned absolutely to not affect layout */}
        {selectedTaskIds.length > 0 && urlProjectId && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <OptimizedBulkActionBar
              selectedTaskIds={selectedTaskIds}
              totalSelected={selectedTaskIds.length}
              projectId={urlProjectId}
              onClearSelection={handleClearSelection}
              onBulkStatusChange={handleBulkStatusChange}
              onBulkPriorityChange={handleBulkPriorityChange}
              onBulkPhaseChange={handleBulkPhaseChange}
              onBulkAssignToMe={handleBulkAssignToMe}
              onBulkAssignMembers={handleBulkAssignMembers}
              onBulkAddLabels={handleBulkAddLabels}
              onBulkArchive={handleBulkArchive}
              onBulkDelete={handleBulkDelete}
              onBulkDuplicate={handleBulkDuplicate}
              onBulkExport={handleBulkExport}
              onBulkSetDueDate={handleBulkSetDueDate}
            />
          </div>
        )}

        {/* Custom Column Modal */}
        {createPortal(<CustomColumnModal />, document.body, 'custom-column-modal')}
      </div>
    </DndContext>
  );
};

export default TaskListV2;
