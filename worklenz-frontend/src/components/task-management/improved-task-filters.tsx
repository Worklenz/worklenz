import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { createSelector } from '@reduxjs/toolkit';
import {
  SearchOutlined,
  CloseOutlined,
  DownOutlined,
  TeamOutlined,
  TagOutlined,
  FlagOutlined,
  GroupOutlined,
  EyeOutlined,
  InboxOutlined,
  CheckOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@/shared/antd-imports';
import { RootState } from '@/app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { useFilterDataLoader } from '@/hooks/useFilterDataLoader';
import {
  toggleField,
  syncFieldWithDatabase,
} from '@/features/task-management/taskListFields.slice';
import { selectColumns } from '@/features/task-management/task-management.slice';

// Import Redux actions
import {
  fetchTasksV3,
  setSearch as setTaskManagementSearch,
  setArchived as setTaskManagementArchived,
  toggleArchived as toggleTaskManagementArchived,
  selectArchived,
  setSort,
  setSortField,
  setSortOrder,
  selectSort,
  selectSortField,
  selectSortOrder,
} from '@/features/task-management/task-management.slice';
import {
  setCurrentGrouping,
  selectCurrentGrouping,
} from '@/features/task-management/grouping.slice';

import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import {
  fetchLabelsByProject,
  fetchTaskAssignees,
  setMembers,
  setLabels,
  setSearch,
  setPriorities,
  setFields,
} from '@/features/tasks/tasks.slice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { ITaskListColumn } from '@/types/tasks/taskList.types';
import { IGroupBy } from '@/features/tasks/tasks.slice';
import { ITaskListSortableColumn } from '@/types/tasks/taskListFilters.types';
// --- Enhanced Kanban imports ---
import {
  setGroupBy as setKanbanGroupBy,
  setSearch as setKanbanSearch,
  setArchived as setKanbanArchived,
  setTaskAssignees as setKanbanTaskAssignees,
  setLabels as setKanbanLabels,
  setPriorities as setKanbanPriorities,
  setMembers as setKanbanMembers,
  fetchEnhancedKanbanGroups,
  setSelectedPriorities as setKanbanSelectedPriorities,
  setBoardSearch as setKanbanBoardSearch,
  setTaskAssigneeSelection,
  setLabelSelection,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';

// Board slice imports for compatibility
import {
  setBoardSearch,
  setBoardPriorities,
  setBoardMembers,
  setBoardLabels,
} from '@/features/board/board-slice';

// Import modal components
import ManageStatusModal from '@/components/task-management/ManageStatusModal';
import ManagePhaseModal from '@/components/task-management/ManagePhaseModal';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';

// Performance constants
const FILTER_DEBOUNCE_DELAY = 300; // ms
const SEARCH_DEBOUNCE_DELAY = 500; // ms
const MAX_FILTER_OPTIONS = 100;

// Sort order enum
enum SORT_ORDER {
  ASCEND = 'ascend',
  DESCEND = 'descend',
}

// Optimized selectors with proper transformation logic
const selectFilterData = createSelector(
  [
    (state: any) => state.priorityReducer.priorities,
    (state: any) => state.taskReducer.priorities,
    (state: any) => state.boardReducer.priorities,
    (state: any) => state.taskReducer.labels,
    (state: any) => state.boardReducer.labels,
    (state: any) => state.taskReducer.taskAssignees,
    (state: any) => state.boardReducer.taskAssignees,
    (state: any) => state.projectReducer.project,
    // Enhanced kanban data - use original data for filter options
    (state: any) => state.enhancedKanbanReducer.originalTaskAssignees,
    (state: any) => state.enhancedKanbanReducer.originalLabels,
    (state: any) => state.enhancedKanbanReducer.priorities,
  ],
  (
    priorities,
    taskPriorities,
    boardPriorities,
    taskLabels,
    boardLabels,
    taskAssignees,
    boardAssignees,
    project,
    kanbanOriginalTaskAssignees,
    kanbanOriginalLabels,
    kanbanPriorities
  ) => ({
    priorities: priorities || [],
    taskPriorities: taskPriorities || [],
    boardPriorities: boardPriorities || [],
    taskLabels: taskLabels || [],
    boardLabels: boardLabels || [],
    taskAssignees: taskAssignees || [],
    boardAssignees: boardAssignees || [],
    project,
    selectedPriorities: taskPriorities || [], // Use taskReducer.priorities as selected priorities
    // Enhanced kanban data - use original data for filter options
    kanbanTaskAssignees: kanbanOriginalTaskAssignees || [],
    kanbanLabels: kanbanOriginalLabels || [],
    kanbanPriorities: kanbanPriorities || [],
  })
);

// Types
interface FilterOption {
  id: string;
  label: string;
  value: string;
  color?: string;
  avatar?: string;
  count?: number;
  selected?: boolean;
}

interface FilterSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: FilterOption[];
  selectedValues: string[];
  multiSelect: boolean;
  searchable?: boolean;
}

interface ImprovedTaskFiltersProps {
  position: 'board' | 'list';
  className?: string;
}

// Enhanced debounce with cancellation support
function createDebouncedFunction<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFunc = ((...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  }) as T & { cancel: () => void };

  debouncedFunc.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debouncedFunc;
}

// Get real filter data from Redux state
const useFilterData = (position: 'board' | 'list'): FilterSection[] => {
  const { t } = useTranslation('task-list-filters');
  const [searchParams] = useSearchParams();
  const { projectView } = useTabSearchParam();

  // Use optimized selector to get all filter data at once
  const filterData = useAppSelector(selectFilterData);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  // Enhanced Kanban selectors
  const kanbanState = useAppSelector((state: RootState) => state.enhancedKanbanReducer);
  const kanbanProject = useAppSelector((state: RootState) => state.projectReducer.project);
  // Determine which state to use
  const isBoard = position === 'board';
  const tab = searchParams.get('tab');
  const currentProjectView = tab === 'tasks-list' ? 'list' : 'kanban';

  return useMemo(() => {
    if (isBoard) {
      // Use enhanced kanban state
      const currentPriorities = kanbanState.priorities || [];
      const currentLabels = kanbanState.labels || [];
      const currentAssignees = kanbanState.taskAssignees || [];
      const groupByValue = kanbanState.groupBy || 'status';

      // Get priorities from the project or use empty array as fallback
      const projectPriorities = (kanbanProject as any)?.priorities || [];

      return [
        {
          id: 'priority',
          label: t('priorityText'),
          options: filterData.priorities.map((p: any) => ({
            value: p.id,
            label: p.name,
            color: p.color_code,
          })),
          selectedValues: currentPriorities,
          multiSelect: true,
          searchable: false,
          icon: FlagOutlined,
        },
        {
          id: 'assignees',
          label: t('membersText'),
          icon: TeamOutlined,
          multiSelect: true,
          searchable: true,
          selectedValues: currentAssignees
            .filter((m: any) => m.selected && m.id)
            .map((m: any) => m.id || ''),
          options: filterData.kanbanTaskAssignees.map((assignee: any) => ({
            id: assignee.id || '',
            label: assignee.name || '',
            value: assignee.id || '',
            avatar: assignee.avatar_url,
            selected: assignee.selected,
          })),
        },
        {
          id: 'labels',
          label: t('labelsText'),
          icon: TagOutlined,
          multiSelect: true,
          searchable: true,
          selectedValues: currentLabels
            .filter((l: any) => l.selected && l.id)
            .map((l: any) => l.id || ''),
          options: filterData.kanbanLabels.map((label: any) => ({
            id: label.id || '',
            label: label.name || '',
            value: label.id || '',
            color: label.color_code,
            selected: label.selected,
          })),
        },
        {
          id: 'groupBy',
          label: t('groupByText'),
          icon: GroupOutlined,
          multiSelect: false,
          searchable: false,
          selectedValues: [groupByValue],
          options: [
            { id: 'status', label: t('statusText'), value: 'status' },
            { id: 'priority', label: t('priorityText'), value: 'priority' },
            {
              id: 'phase',
              label: (kanbanProject as any)?.phase_label || t('phaseText'),
              value: 'phase',
            },
          ],
        },
      ];
    } else {
      // Use task management/board state
      const currentPriorities =
        currentProjectView === 'list' ? filterData.taskPriorities : filterData.boardPriorities;
      const currentLabels =
        currentProjectView === 'list' ? filterData.taskLabels : filterData.boardLabels;
      const currentAssignees =
        currentProjectView === 'list' ? filterData.taskAssignees : filterData.boardAssignees;
      const groupByValue = currentGrouping || 'status';
      return [
        {
          id: 'priority',
          label: t('priorityText'),
          options: filterData.priorities.map((p: any) => ({
            value: p.id,
            label: p.name,
            color: p.color_code,
          })),
          selectedValues: filterData.selectedPriorities,
          multiSelect: true,
          searchable: false,
          icon: FlagOutlined,
        },
        {
          id: 'assignees',
          label: t('membersText'),
          icon: TeamOutlined,
          multiSelect: true,
          searchable: true,
          selectedValues: currentAssignees
            .filter((m: any) => m.selected && m.id)
            .map((m: any) => m.id || ''),
          options: currentAssignees.map((assignee: any) => ({
            id: assignee.id || '',
            label: assignee.name || '',
            value: assignee.id || '',
            avatar: assignee.avatar_url,
            selected: assignee.selected,
          })),
        },
        {
          id: 'labels',
          label: t('labelsText'),
          icon: TagOutlined,
          multiSelect: true,
          searchable: true,
          selectedValues: currentLabels
            .filter((l: any) => l.selected && l.id)
            .map((l: any) => l.id || ''),
          options: currentLabels.map((label: any) => ({
            id: label.id || '',
            label: label.name || '',
            value: label.id || '',
            color: label.color_code,
            selected: label.selected,
          })),
        },
        {
          id: 'groupBy',
          label: t('groupByText'),
          icon: GroupOutlined,
          multiSelect: false,
          searchable: false,
          selectedValues: [groupByValue],
          options: [
            { id: 'status', label: t('statusText'), value: 'status' },
            { id: 'priority', label: t('priorityText'), value: 'priority' },
            {
              id: 'phase',
              label: filterData.project?.phase_label || t('phaseText'),
              value: 'phase',
            },
          ],
        },
      ];
    }
  }, [isBoard, kanbanState, kanbanProject, filterData, currentProjectView, t, currentGrouping]);
};

// Filter Dropdown Component
const FilterDropdown: React.FC<{
  section: FilterSection;
  onSelectionChange: (sectionId: string, values: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
  themeClasses: any;
  isDarkMode: boolean;
  className?: string;
  dispatch?: any;
  onManageStatus?: () => void;
  onManagePhase?: () => void;
  projectPhaseLabel?: string; // Add this prop
}> = ({
  section,
  onSelectionChange,
  isOpen,
  onToggle,
  themeClasses,
  isDarkMode,
  className = '',
  dispatch,
  onManageStatus,
  onManagePhase,
  projectPhaseLabel, // Add this prop
}) => {
  const { t } = useTranslation('task-list-filters');
  // Add permission checks for groupBy section
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const canConfigure = isOwnerOrAdmin || isProjectManager;
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(section.options);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Memoized filter function to prevent unnecessary recalculations
  const filteredOptionsMemo = useMemo(() => {
    if (!section.searchable || !searchTerm.trim()) {
      return section.options;
    }

    const searchLower = searchTerm.toLowerCase();
    return section.options.filter(option => option.label.toLowerCase().includes(searchLower));
  }, [searchTerm, section.options, section.searchable]);

  // Update filtered options when memo changes
  useEffect(() => {
    setFilteredOptions(filteredOptionsMemo);
  }, [filteredOptionsMemo]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen) onToggle();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleOptionToggle = useCallback(
    (optionValue: string) => {
      if (section.multiSelect) {
        const newValues = section.selectedValues.includes(optionValue)
          ? section.selectedValues.filter(v => v !== optionValue)
          : [...section.selectedValues, optionValue];
        onSelectionChange(section.id, newValues);
      } else {
        onSelectionChange(section.id, [optionValue]);
        onToggle();
      }
    },
    [section, onSelectionChange, onToggle]
  );

  const clearSelection = useCallback(() => {
    onSelectionChange(section.id, []);
  }, [section.id, onSelectionChange]);

  const selectedCount = section.selectedValues.length;
  const IconComponent = section.icon;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={onToggle}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
          border transition-all duration-200 ease-in-out
          ${
            selectedCount > 0
              ? isDarkMode
                ? 'bg-gray-600 text-white border-gray-500'
                : 'bg-gray-200 text-gray-800 border-gray-300 font-semibold'
              : `${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`
          }
          hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
          ${isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
        `}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <IconComponent className="w-3.5 h-3.5" />
        <span>{section.label}</span>
        {/* Show selected option for single-select (group by) */}
        {section.id === 'groupBy' && selectedCount > 0 && (
          <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {section.options.find(opt => opt.value === section.selectedValues[0])?.label}
          </span>
        )}
        {/* Show count for multi-select filters */}
        {section.id !== 'groupBy' && selectedCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-gray-500 rounded-full">
            {selectedCount}
          </span>
        )}
        <DownOutlined
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Configuration Buttons for GroupBy section */}
      {section.id === 'groupBy' && canConfigure && (
        <div className="inline-flex items-center gap-1 ml-2">
          {section.selectedValues[0] === 'phase' && (
            <button
              onClick={onManagePhase}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ease-in-out hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText} ${
                isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'
              }`}
            >
              {t('manage')} {projectPhaseLabel || t('phasesText')}
            </button>
          )}
          {section.selectedValues[0] === 'status' && (
            <button
              onClick={onManageStatus}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ease-in-out hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText} ${
                isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'
              }`}
            >
              {t('manageStatuses')}
            </button>
          )}
        </div>
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-sm border ${themeClasses.dropdownBorder}`}
        >
          {/* Search Input */}
          {section.searchable && (
            <div className={`p-2 border-b ${themeClasses.dividerBorder}`}>
              <div className="relative w-full">
                <SearchOutlined className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={`${t('searchPlaceholder')} ${section.label.toLowerCase()}...`}
                  className={`w-full pl-8 pr-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150 ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-100 placeholder-gray-400 border-gray-600'
                      : 'bg-white text-gray-900 placeholder-gray-400 border-gray-300'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className={`p-2 text-xs text-center ${themeClasses.secondaryText}`}>
                {t('noOptionsFound')}
              </div>
            ) : (
              <div className="p-0.5">
                {filteredOptions.map(option => {
                  const isSelected = section.selectedValues.includes(option.value);

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionToggle(option.value)}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded
                        transition-colors duration-150 text-left
                        ${
                          isSelected
                            ? isDarkMode
                              ? 'bg-gray-600 text-white'
                              : 'bg-gray-200 text-gray-800 font-semibold'
                            : `${themeClasses.optionText} ${themeClasses.optionHover}`
                        }
                      `}
                    >
                      {/* Checkbox/Radio indicator - hide for group by */}
                      {section.id !== 'groupBy' && (
                        <div
                          className={`
                          flex items-center justify-center w-3.5 h-3.5 border rounded
                          ${
                            isSelected
                              ? 'bg-gray-600 border-gray-800 text-white'
                              : 'border-gray-300 dark:border-gray-600'
                          }
                        `}
                        >
                          {isSelected && <CheckOutlined className="w-2.5 h-2.5" />}
                        </div>
                      )}

                      {/* Color indicator */}
                      {option.color && (
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: option.color }}
                        />
                      )}

                      {/* Avatar */}
                      {option.avatar && (
                        <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-xs font-medium text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                          <img
                            src={option.avatar}
                            alt={option.label}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        </div>
                      )}

                      {/* Label and Count */}
                      <div className="flex-1 flex items-center justify-between">
                        <span className="truncate">{option.label}</span>
                        {option.count !== undefined && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {option.count}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Search Component
const SearchFilter: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  themeClasses: any;
  className?: string;
}> = ({ value, onChange, placeholder, themeClasses, className = '' }) => {
  const { t } = useTranslation('task-list-filters');
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value with external value prop
  useEffect(() => {
    setLocalValue(value);
    // Keep expanded if there's a search value
    if (value) {
      setIsExpanded(true);
    }
  }, [value]);

  const handleToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isExpanded]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onChange(localValue);
    },
    [localValue, onChange]
  );

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  // Redux selectors for theme and other state
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');

  return (
    <div className={`relative ${className}`}>
      {!isExpanded && !value ? (
        <button
          onClick={handleToggle}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText} ${
            themeClasses.containerBg === 'bg-gray-800'
              ? 'focus:ring-offset-gray-900'
              : 'focus:ring-offset-white'
          }`}
        >
          <SearchOutlined className="w-3.5 h-3.5" />
          <span>{t('search')}</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <div className="relative w-full">
            <SearchOutlined className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={localValue}
              onChange={e => setLocalValue(e.target.value)}
              placeholder={placeholder || t('searchTasks') || 'Search tasks by name or key...'}
              className={`w-full pr-4 pl-8 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-150 ${
                isDarkMode
                  ? 'bg-gray-700 text-gray-100 placeholder-gray-400 border-gray-600'
                  : 'bg-white text-gray-900 placeholder-gray-400 border-gray-300'
              }`}
            />
            {localValue && (
              <button
                type="button"
                onClick={handleClear}
                className={`absolute right-1.5 top-1/2 transform -translate-y-1/2 transition-colors duration-150 ${
                  isDarkMode
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CloseOutlined className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200 ${
              isDarkMode
                ? 'text-white bg-gray-600 hover:bg-gray-700'
                : 'text-gray-800 bg-gray-200 hover:bg-gray-300'
            }`}
          >
            {t('search')}
          </button>
          <button
            type="button"
            onClick={() => {
              setLocalValue('');
              onChange('');
              setIsExpanded(false);
            }}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
              isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t('cancel')}
          </button>
        </form>
      )}
    </div>
  );
};

// Sort Dropdown Component - Simplified version using task-management slice
const SortDropdown: React.FC<{ themeClasses: any; isDarkMode: boolean }> = ({
  themeClasses,
  isDarkMode,
}) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const { projectId } = useAppSelector(state => state.projectReducer);
  
  // Get current sort state from task-management slice
  const currentSortField = useAppSelector(selectSortField);
  const currentSortOrder = useAppSelector(selectSortOrder);

  const [open, setOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const sortFieldsList = [
    { label: t('taskText'), key: 'name' },
    { label: t('statusText'), key: 'status' },
    { label: t('priorityText'), key: 'priority' },
    { label: t('startDateText'), key: 'start_date' },
    { label: t('endDateText'), key: 'end_date' },
    { label: t('completedDateText'), key: 'completed_at' },
    { label: t('createdDateText'), key: 'created_at' },
    { label: t('lastUpdatedText'), key: 'updated_at' },
  ];

  const handleSortFieldChange = (fieldKey: string) => {
    // If clicking the same field, toggle order, otherwise set new field with ASC
    if (currentSortField === fieldKey) {
      const newOrder = currentSortOrder === 'ASC' ? 'DESC' : 'ASC';
      dispatch(setSort({ field: fieldKey, order: newOrder }));
    } else {
      dispatch(setSort({ field: fieldKey, order: 'ASC' }));
    }
    
    // Fetch updated tasks
    if (projectId) {
      dispatch(fetchTasksV3(projectId));
    }
    
    setOpen(false);
  };

  const clearSort = () => {
    dispatch(setSort({ field: '', order: 'ASC' }));
    if (projectId) {
      dispatch(fetchTasksV3(projectId));
    }
  };

  const isActive = currentSortField !== '';
  const currentFieldLabel = sortFieldsList.find(f => f.key === currentSortField)?.label;
  const orderText = currentSortOrder === 'ASC' ? t('ascendingOrder') : t('descendingOrder');

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button - matching FilterDropdown style */}
      <button
        onClick={() => setOpen(!open)}
        title={
          isActive
            ? t('currentSort', { field: currentFieldLabel, order: orderText })
            : t('sortText')
        }
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
          border transition-all duration-200 ease-in-out
          ${
            isActive
              ? isDarkMode
                ? 'bg-gray-600 text-white border-gray-500'
                : 'bg-gray-200 text-gray-800 border-gray-300 font-semibold'
              : `${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`
          }
          hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
          ${isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
        `}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {currentSortOrder === 'ASC' ? (
          <SortAscendingOutlined className="w-3.5 h-3.5" />
        ) : (
          <SortDescendingOutlined className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">{t('sortText')}</span>
        {isActive && currentFieldLabel && (
          <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} max-w-16 truncate hidden md:inline`}>
            {currentFieldLabel}
          </span>
        )}
        <DownOutlined
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Panel - matching FilterDropdown style */}
      {open && (
        <div
          className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-sm border ${themeClasses.dropdownBorder}`}
        >
          {/* Clear Sort Option */}
          {isActive && (
            <div className={`p-2 border-b ${themeClasses.dividerBorder}`}>
              <button
                onClick={clearSort}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors duration-150 ${themeClasses.optionText} ${themeClasses.optionHover}`}
              >
                {t('clearSort')}
              </button>
            </div>
          )}
          
          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            <div className="p-0.5">
              {sortFieldsList.map(sortField => {
                const isSelected = currentSortField === sortField.key;

                return (
                  <button
                    key={sortField.key}
                    onClick={() => handleSortFieldChange(sortField.key)}
                    className={`
                      w-full flex items-center justify-between gap-2 px-2 py-1.5 text-xs rounded
                      transition-colors duration-150 text-left
                      ${
                        isSelected
                          ? isDarkMode
                            ? 'bg-gray-600 text-white'
                            : 'bg-gray-200 text-gray-800 font-semibold'
                          : `${themeClasses.optionText} ${themeClasses.optionHover}`
                      }
                    `}
                    title={
                      isSelected 
                        ? t('currentSort', { 
                            field: sortField.label, 
                            order: orderText 
                          }) + ` - ${t('sortDescending')}`
                        : t('sortByField', { field: sortField.label }) + ` - ${t('sortAscending')}`
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate">{sortField.label}</span>
                      {isSelected && (
                        <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          ({orderText})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isSelected ? (
                        currentSortOrder === 'ASC' ? (
                          <SortAscendingOutlined className="w-3.5 h-3.5" />
                        ) : (
                          <SortDescendingOutlined className="w-3.5 h-3.5" />
                        )
                      ) : (
                        <SortAscendingOutlined className="w-3.5 h-3.5 opacity-50" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LOCAL_STORAGE_KEY = 'worklenz.taskManagement.fields';

const FieldsDropdown: React.FC<{ themeClasses: any; isDarkMode: boolean }> = ({
  themeClasses,
  isDarkMode,
}) => {
  const { t } = useTranslation('task-list-filters');
  const { t: tTable } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();

  // Helper function to get translated field label using existing task-list-table translations
  const getFieldLabel = useCallback(
    (fieldKey: string) => {
      const keyMappings: Record<string, string> = {
        KEY: 'keyColumn',
        DESCRIPTION: 'descriptionColumn',
        PROGRESS: 'progressColumn',
        ASSIGNEES: 'assigneesColumn',
        LABELS: 'labelsColumn',
        PHASE: 'phaseColumn',
        STATUS: 'statusColumn',
        PRIORITY: 'priorityColumn',
        TIME_TRACKING: 'timeTrackingColumn',
        ESTIMATION: 'estimationColumn',
        START_DATE: 'startDateColumn',
        DUE_DATE: 'dueDateColumn',
        DUE_TIME: 'dueTimeColumn',
        COMPLETED_DATE: 'completedDateColumn',
        CREATED_DATE: 'createdDateColumn',
        LAST_UPDATED: 'lastUpdatedColumn',
        REPORTER: 'reporterColumn',
      };

      const translationKey = keyMappings[fieldKey];
      return translationKey ? tTable(translationKey) : fieldKey;
    },
    [tTable]
  );
  const fieldsRaw = useSelector((state: RootState) => state.taskManagementFields);
  const columns = useSelector(selectColumns);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const fields = Array.isArray(fieldsRaw) ? fieldsRaw : [];
  const sortedFields = useMemo(() => [...fields].sort((a, b) => a.order - b.order), [fields]);

  const [open, setOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced save to localStorage using enhanced debounce
  const debouncedSaveFields = useMemo(
    () =>
      createDebouncedFunction((fieldsToSave: typeof fields) => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fieldsToSave));
      }, 300),
    []
  );

  useEffect(() => {
    debouncedSaveFields(fields);
    // Cleanup debounce on unmount
    return () => debouncedSaveFields.cancel();
  }, [fields, debouncedSaveFields]);

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const visibleCount = useMemo(
    () => sortedFields.filter(field => field.visible).length,
    [sortedFields]
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button - matching FilterDropdown style */}
      <button
        onClick={() => setOpen(!open)}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
          border transition-all duration-200 ease-in-out
          ${
            visibleCount > 0
              ? isDarkMode
                ? 'bg-gray-600 text-white border-gray-500'
                : 'bg-gray-200 text-gray-800 border-gray-300 font-semibold'
              : `${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`
          }
          hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
          ${isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
        `}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <EyeOutlined className="w-3.5 h-3.5" />
        <span>{t('fieldsText')}</span>
        {visibleCount > 0 && (
          <span
            className={`inline-flex items-center justify-center w-4 h-4 text-xs font-bold ${isDarkMode ? 'text-white bg-gray-500' : 'text-gray-800 bg-gray-300'} rounded-full`}
          >
            {visibleCount}
          </span>
        )}
        <DownOutlined
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Panel - matching FilterDropdown style */}
      {open && (
        <div
          className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-sm border ${themeClasses.dropdownBorder}`}
        >
          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {sortedFields.length === 0 ? (
              <div className={`p-2 text-xs text-center ${themeClasses.secondaryText}`}>
                {t('noOptionsFound')}
              </div>
            ) : (
              <div className="p-0.5">
                {sortedFields.map(field => {
                  const isSelected = field.visible;

                  return (
                    <button
                      key={field.key}
                      onClick={() => {
                        // Toggle field locally first
                        dispatch(toggleField(field.key));

                        // Sync with database if projectId is available
                        if (projectId) {
                          dispatch(
                            syncFieldWithDatabase({
                              projectId,
                              fieldKey: field.key,
                              visible: !field.visible,
                              columns,
                            })
                          );
                        }
                      }}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded
                        transition-colors duration-150 text-left
                        ${
                          isSelected
                            ? isDarkMode
                              ? 'text-white font-semibold'
                              : 'text-gray-800 font-semibold'
                            : `${themeClasses.optionText} ${themeClasses.optionHover}`
                        }
                      `}
                    >
                      {/* Checkbox indicator - matching FilterDropdown style */}
                      <div
                        className={`
                        flex items-center justify-center w-3.5 h-3.5 border rounded
                        ${
                          isSelected
                            ? 'bg-gray-600 border-gray-600 text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        }
                      `}
                      >
                        {isSelected && <CheckOutlined className="w-2.5 h-2.5" />}
                      </div>

                      {/* Label and Count */}
                      <div className="flex-1 flex items-center justify-between">
                        <span className="truncate">{getFieldLabel(field.key)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Main Component
const ImprovedTaskFilters: React.FC<ImprovedTaskFiltersProps> = ({ position, className = '' }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();

  // Get current state values for filter updates
  const currentTaskAssignees = useAppSelector(state => state.taskReducer.taskAssignees);
  const currentTaskLabels = useAppSelector(state => state.taskReducer.labels);

  // Enhanced Kanban state
  const kanbanState = useAppSelector((state: RootState) => state.enhancedKanbanReducer);

  // Get archived state from the appropriate slice based on position
  const taskManagementArchived = useAppSelector(selectArchived);
  const taskReducerArchived = useAppSelector(state => state.taskReducer.archived);
  const showArchived = position === 'list' ? taskManagementArchived : taskReducerArchived;

  // Use the filter data loader hook
  const { refreshFilterData } = useFilterDataLoader();

  // Get search value from Redux based on position
  const taskManagementSearch = useAppSelector(state => state.taskManagement?.search || '');
  const kanbanSearch = useAppSelector(state => state.enhancedKanbanReducer?.search || '');

  const searchValue = position === 'board' ? kanbanSearch : taskManagementSearch;

  // Local state for filter sections
  const [filterSections, setFilterSections] = useState<FilterSection[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [clearingFilters, setClearingFilters] = useState(false);

  // Modal state
  const [showManageStatusModal, setShowManageStatusModal] = useState(false);
  const [showManagePhaseModal, setShowManagePhaseModal] = useState(false);

  // Refs for debounced functions
  const debouncedFilterChangeRef = useRef<
    (((projectId: string) => void) & { cancel: () => void }) | null
  >(null);
  const debouncedSearchChangeRef = useRef<
    (((projectId: string, value: string) => void) & { cancel: () => void }) | null
  >(null);

  // Get real filter data
  const filterSectionsData = useFilterData(position);

  // Check if data is loaded - memoize this computation
  // Keep filters visible even during refetch if we have any filter sections
  const isDataLoaded = useMemo(() => {
    return filterSectionsData.length > 0;
  }, [filterSectionsData]);

  // Initialize filter sections from data - memoize this to prevent unnecessary updates
  const memoizedFilterSections = useMemo(() => {
    return filterSectionsData;
  }, [filterSectionsData]);

  // Only update filter sections if they have actually changed
  useEffect(() => {
    const hasChanged = JSON.stringify(filterSections) !== JSON.stringify(memoizedFilterSections);
    if (hasChanged && memoizedFilterSections.length > 0) {
      setFilterSections(memoizedFilterSections);
    }
  }, [memoizedFilterSections, filterSections]);

  // Redux selectors for theme and other state
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const { projectId } = useAppSelector(state => state.projectReducer);
  const { projectView } = useTabSearchParam();
  const projectPhaseLabel = useAppSelector(state => state.projectReducer.project?.phase_label);

  // Theme-aware class names - memoize to prevent unnecessary re-renders
  // Using greyish colors for both dark and light modes
  const themeClasses = useMemo(
    () => ({
      containerBg: isDarkMode ? 'bg-[#1f1f1f]' : 'bg-white',
      containerBorder: isDarkMode ? 'border-[#303030]' : 'border-gray-200',
      buttonBg: isDarkMode ? 'bg-[#141414] hover:bg-[#262626]' : 'bg-white hover:bg-gray-50',
      buttonBorder: isDarkMode ? 'border-[#303030]' : 'border-gray-300',
      buttonText: isDarkMode ? 'text-[#d9d9d9]' : 'text-gray-700',
      dropdownBg: isDarkMode ? 'bg-[#1f1f1f]' : 'bg-white',
      dropdownBorder: isDarkMode ? 'border-[#303030]' : 'border-gray-200',
      optionText: isDarkMode ? 'text-[#d9d9d9]' : 'text-gray-700',
      optionHover: isDarkMode ? 'hover:bg-[#262626]' : 'hover:bg-gray-50',
      secondaryText: isDarkMode ? 'text-[#8c8c8c]' : 'text-gray-500',
      dividerBorder: isDarkMode ? 'border-[#404040]' : 'border-gray-200',
      pillBg: isDarkMode ? 'bg-[#141414]' : 'bg-gray-100',
      pillText: isDarkMode ? 'text-[#d9d9d9]' : 'text-gray-700',
      pillActiveBg: isDarkMode ? 'bg-gray-600' : 'bg-gray-200',
      pillActiveText: isDarkMode ? 'text-white' : 'text-gray-800',
      searchBg: isDarkMode ? 'bg-[#141414]' : 'bg-gray-50',
      searchBorder: isDarkMode ? 'border-[#303030]' : 'border-gray-300',
      searchText: isDarkMode ? 'text-[#d9d9d9]' : 'text-gray-900',
    }),
    [isDarkMode]
  );

  // Initialize debounced functions
  useEffect(() => {
    // Debounced filter change function
    debouncedFilterChangeRef.current = createDebouncedFunction((projectId: string) => {
      dispatch(fetchTasksV3(projectId));
    }, FILTER_DEBOUNCE_DELAY);

    // Debounced search change function
    debouncedSearchChangeRef.current = createDebouncedFunction(
      (projectId: string, value: string) => {
        // Use taskManagement search for list view
        dispatch(setTaskManagementSearch(value));

        // Trigger task refetch with new search value
        dispatch(fetchTasksV3(projectId));
      },
      SEARCH_DEBOUNCE_DELAY
    );

    // Cleanup function
    return () => {
      debouncedFilterChangeRef.current?.cancel();
      debouncedSearchChangeRef.current?.cancel();
    };
  }, [dispatch, projectView]);

  // Get sort fields for active count calculation
  const sortFields = useAppSelector(state => state.taskReducer.fields);
  const taskManagementSortField = useAppSelector(selectSortField);

  // Calculate active filters count - memoized to prevent unnecessary recalculations
  const calculatedActiveFiltersCount = useMemo(() => {
    const count = filterSections.reduce(
      (acc, section) => (section.id === 'groupBy' ? acc : acc + section.selectedValues.length),
      0
    );
    const sortFieldsCount = position === 'list' ? sortFields.length : 0;
    const taskManagementSortCount = position === 'list' && taskManagementSortField ? 1 : 0;
    return count + (searchValue ? 1 : 0) + sortFieldsCount + taskManagementSortCount;
  }, [filterSections, searchValue, sortFields, taskManagementSortField, position]);

  useEffect(() => {
    if (activeFiltersCount !== calculatedActiveFiltersCount) {
      setActiveFiltersCount(calculatedActiveFiltersCount);
    }
  }, [calculatedActiveFiltersCount, activeFiltersCount]);

  // Handlers
  const handleDropdownToggle = useCallback((sectionId: string) => {
    setOpenDropdown(current => (current === sectionId ? null : sectionId));
  }, []);

  const handleSelectionChange = useCallback(
    (sectionId: string, values: string[]) => {
      if (!projectId) return;
      if (position === 'board') {
        // Enhanced Kanban logic
        if (sectionId === 'groupBy' && values.length > 0) {
          dispatch(setKanbanGroupBy(values[0] as any));
          dispatch(fetchEnhancedKanbanGroups(projectId));
          return;
        }
        if (sectionId === 'priority') {
          dispatch(setKanbanPriorities(values));
          dispatch(fetchEnhancedKanbanGroups(projectId));
          return;
        }
        if (sectionId === 'assignees') {
          // Update individual assignee selections using the new action
          const currentAssignees = kanbanState.taskAssignees || [];
          const currentSelectedIds = currentAssignees
            .filter((m: any) => m.selected)
            .map((m: any) => m.id);

          // First, clear all selections
          currentAssignees.forEach((assignee: any) => {
            if (assignee.selected) {
              dispatch(setTaskAssigneeSelection({ id: assignee.id, selected: false }));
            }
          });

          // Then set the new selections
          values.forEach(id => {
            dispatch(setTaskAssigneeSelection({ id, selected: true }));
          });

          dispatch(fetchEnhancedKanbanGroups(projectId));
          return;
        }
        if (sectionId === 'labels') {
          // Update individual label selections using the new action
          const currentLabels = kanbanState.labels || [];
          const currentSelectedIds = currentLabels
            .filter((l: any) => l.selected)
            .map((l: any) => l.id);

          // First, clear all selections
          currentLabels.forEach((label: any) => {
            if (label.selected) {
              dispatch(setLabelSelection({ id: label.id, selected: false }));
            }
          });

          // Then set the new selections
          values.forEach(id => {
            dispatch(setLabelSelection({ id, selected: true }));
          });

          dispatch(fetchEnhancedKanbanGroups(projectId));
          return;
        }
      } else {
        // ... existing list logic ...
        if (sectionId === 'groupBy' && values.length > 0) {
          dispatch(setCurrentGrouping(values[0] as 'status' | 'priority' | 'phase'));
          dispatch(fetchTasksV3(projectId));
          return;
        }
        if (sectionId === 'priority') {
          dispatch(setPriorities(values));
          dispatch(fetchTasksV3(projectId));
          return;
        }
        if (sectionId === 'assignees') {
          const updatedAssignees = currentTaskAssignees.map(member => ({
            ...member,
            selected: values.includes(member.id || ''),
          }));
          dispatch(setMembers(updatedAssignees));
          dispatch(fetchTasksV3(projectId));
          return;
        }
        if (sectionId === 'labels') {
          const updatedLabels = currentTaskLabels.map(label => ({
            ...label,
            selected: values.includes(label.id || ''),
          }));
          dispatch(setLabels(updatedLabels));
          dispatch(fetchTasksV3(projectId));
          return;
        }
      }
    },
    [dispatch, projectId, position, currentTaskAssignees, currentTaskLabels, kanbanState]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      if (!projectId) return;

      if (position === 'board') {
        dispatch(setKanbanSearch(value));
        if (projectId) {
          dispatch(fetchEnhancedKanbanGroups(projectId));
        }
      } else {
        // Use debounced search for list view
        dispatch(setTaskManagementSearch(value));
        if (projectId) {
          debouncedSearchChangeRef.current?.(projectId, value);
        }
      }
    },
    [dispatch, projectId, position]
  );

  const clearAllFilters = useCallback(async () => {
    if (!projectId || clearingFilters) return;

    // Set loading state to prevent multiple clicks
    setClearingFilters(true);

    try {
      // Cancel any pending debounced calls
      debouncedFilterChangeRef.current?.cancel();
      debouncedSearchChangeRef.current?.cancel();

      // Batch all state updates together to prevent multiple re-renders
      const batchUpdates = () => {
        // Update local filter sections state immediately
        setFilterSections(prev =>
          prev.map(section => ({
            ...section,
            selectedValues: section.id === 'groupBy' ? section.selectedValues : [], // Keep groupBy, clear others
          }))
        );
      };

      // Execute all local state updates in a batch
      batchUpdates();

      // Prepare all Redux actions to be dispatched together
      const reduxUpdates = () => {
        // Clear search - use taskManagementSearch for list view
        dispatch(setTaskManagementSearch(''));

        // Clear label filters
        const clearedLabels = currentTaskLabels.map(label => ({
          ...label,
          selected: false,
        }));
        dispatch(setLabels(clearedLabels));

        // Clear assignee filters
        const clearedAssignees = currentTaskAssignees.map(member => ({
          ...member,
          selected: false,
        }));
        dispatch(setMembers(clearedAssignees));

        // Clear priority filters
        dispatch(setPriorities([]));

        // Clear sort fields
        dispatch(setFields([]));

        // Clear sort from task-management slice
        dispatch(setSort({ field: '', order: 'ASC' }));

        // Clear archived state based on position
        if (position === 'list') {
          dispatch(setTaskManagementArchived(false));
        } else {
          dispatch(setKanbanArchived(false));
        }
      };

      // Execute Redux updates
      reduxUpdates();

      // Use a short timeout to batch Redux state updates before API call
      // This ensures all filter state is updated before the API call
      setTimeout(() => {
        if (projectId) {
          dispatch(fetchTasksV3(projectId));
        }
        // Reset loading state after API call is initiated
        setTimeout(() => setClearingFilters(false), 100);
      }, 0);
    } catch (error) {
      console.error('Error clearing filters:', error);
      setClearingFilters(false);
    }
  }, [projectId, projectView, dispatch, currentTaskLabels, currentTaskAssignees, clearingFilters]);

  const toggleArchived = useCallback(() => {
    if (position === 'board') {
      dispatch(setKanbanArchived(!showArchived));
      if (projectId) {
        dispatch(fetchEnhancedKanbanGroups(projectId));
      }
    } else {
      // For TaskListV2, use the task management slice
      dispatch(toggleTaskManagementArchived());
      if (projectId) {
        dispatch(fetchTasksV3(projectId));
      }
    }
  }, [dispatch, projectId, position, showArchived]);

  return (
    <div
      className={`${themeClasses.containerBg} border ${themeClasses.containerBorder} rounded-md p-1.5 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 min-h-[36px]">
        {/* Left Section - Main Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Search */}
          <SearchFilter
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search tasks by name or key..."
            themeClasses={themeClasses}
          />

          {/* Sort Filter Button (for list view) - appears after search */}
          {position === 'list' && (
            <SortDropdown themeClasses={themeClasses} isDarkMode={isDarkMode} />
          )}

          {/* Filter Dropdowns - Only render when data is loaded */}
          {isDataLoaded ? (
            filterSectionsData.map(section => (
              <FilterDropdown
                key={section.id}
                section={section}
                onSelectionChange={handleSelectionChange}
                isOpen={openDropdown === section.id}
                onToggle={() => handleDropdownToggle(section.id)}
                themeClasses={themeClasses}
                isDarkMode={isDarkMode}
                dispatch={dispatch}
                onManageStatus={() => setShowManageStatusModal(true)}
                onManagePhase={() => setShowManagePhaseModal(true)}
                projectPhaseLabel={projectPhaseLabel}
              />
            ))
          ) : (
            // Loading state
            <div
              className={`flex items-center gap-2 px-2.5 py-1.5 text-xs ${themeClasses.secondaryText}`}
            >
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-500"></div>
              <span>{t('loadingFilters')}</span>
            </div>
          )}
        </div>

        {/* Right Section - Additional Controls */}
        <div className="flex flex-wrap items-center gap-2 ml-auto min-w-0 shrink-0">
          {/* Active Filters Indicator */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className={`text-xs ${themeClasses.secondaryText}`}>
                {activeFiltersCount}{' '}
                {activeFiltersCount !== 1 ? t('filtersActive') : t('filterActive')}
              </span>
              <button
                onClick={clearAllFilters}
                disabled={clearingFilters}
                className={`text-xs font-medium transition-colors duration-150 ${
                  clearingFilters
                    ? 'text-gray-400 cursor-not-allowed'
                    : isDarkMode
                      ? 'text-gray-400 hover:text-gray-300'
                      : 'text-gray-600 hover:text-gray-700'
                }`}
              >
                {clearingFilters ? t('clearing') : t('clearAll')}
              </button>
            </div>
          )}

          {/* Show Archived Toggle (for list view) */}
          {position === 'list' && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={toggleArchived}
                className={`w-3.5 h-3.5 text-gray-600 rounded focus:ring-gray-500 transition-colors duration-150 ${
                  isDarkMode
                    ? 'border-[#303030] bg-[#141414] focus:ring-offset-gray-800'
                    : 'border-gray-300 bg-white focus:ring-offset-white'
                }`}
              />
              <span className={`text-xs ${themeClasses.optionText}`}>{t('showArchivedText')}</span>
            </label>
          )}

          {/* Show Fields Button (for list view) */}
          {position === 'list' && (
            <FieldsDropdown themeClasses={themeClasses} isDarkMode={isDarkMode} />
          )}
        </div>
      </div>

      {/* Modals */}
      <ManageStatusModal
        open={showManageStatusModal}
        onClose={() => {
          setShowManageStatusModal(false);
          // Refresh filter data after status changes
          refreshFilterData();
        }}
        projectId={projectId || undefined}
      />

      <ManagePhaseModal
        open={showManagePhaseModal}
        onClose={() => {
          setShowManagePhaseModal(false);
          // Refresh filter data after phase changes
          refreshFilterData();
        }}
        projectId={projectId || undefined}
      />
    </div>
  );
};

export default React.memo(ImprovedTaskFilters);
