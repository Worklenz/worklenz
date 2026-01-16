import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
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
  CheckOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  SettingOutlined,
  MenuOutlined,
  Dropdown,
  Avatar,
} from '@/shared/antd-imports';
import { AvatarNamesMap } from '@/shared/constants';
import { RootState } from '@/app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { useFilterDataLoader } from '@/hooks/useFilterDataLoader';
import { toggleField, syncFieldWithDatabase } from '@/features/task-management/taskListFields.slice';
import { selectColumns } from '@/features/task-management/task-management.slice';

// Import Redux actions
import {
  fetchTasksV3,
  setSearch as setTaskManagementSearch,
  setArchived as setTaskManagementArchived,
  toggleArchived as toggleTaskManagementArchived,
  selectArchived,
  setSort,
  selectSortField,
  selectSortOrder,
} from '@/features/task-management/task-management.slice';

import { setCurrentGrouping, selectCurrentGrouping } from '@/features/task-management/grouping.slice';

import { setMembers, setLabels, setPriorities, setFields } from '@/features/tasks/tasks.slice';

// --- Enhanced Kanban imports ---
import {
  setGroupBy as setKanbanGroupBy,
  setSearch as setKanbanSearch,
  setArchived as setKanbanArchived,
  fetchEnhancedKanbanGroups,
  setPriorities as setKanbanPriorities,
  setTaskAssigneeSelection,
  setLabelSelection,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';

// Import modal components
import ManageStatusModal from '@/components/task-management/ManageStatusModal';
import ManagePhaseModal from '@/components/task-management/ManagePhaseModal';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';

// Performance constants
const FILTER_DEBOUNCE_DELAY = 300; // ms
const SEARCH_DEBOUNCE_DELAY = 500; // ms

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
  defaultLabel?: string;
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
    if (timeoutId) clearTimeout(timeoutId);
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

      return [
        {
          id: 'priority',
          label: t('priorityText', { defaultValue: 'Priority' }),
          defaultLabel: 'Priority',
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
          label: t('membersText', { defaultValue: 'Members' }),
          defaultLabel: 'Members',
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
          label: t('labelsText', { defaultValue: 'Labels' }),
          defaultLabel: 'Labels',
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
          label: t('groupByText', { defaultValue: 'Group by' }),
          defaultLabel: 'Group by',
          icon: GroupOutlined,
          multiSelect: false,
          searchable: false,
          selectedValues: [groupByValue],
          options: [
            { id: 'status', label: t('statusText', { defaultValue: 'Status' }), value: 'status' },
            { id: 'priority', label: t('priorityText', { defaultValue: 'Priority' }), value: 'priority' },
            {
              id: 'phase',
              label: (kanbanProject as any)?.phase_label || t('phaseText', { defaultValue: 'Phase' }),
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
          label: t('priorityText', { defaultValue: 'Priority' }),
          defaultLabel: 'Priority',
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
          label: t('membersText', { defaultValue: 'Members' }),
          defaultLabel: 'Members',
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
          label: t('labelsText', { defaultValue: 'Labels' }),
          defaultLabel: 'Labels',
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
          label: t('groupByText', { defaultValue: 'Group by' }),
          defaultLabel: 'Group by',
          icon: GroupOutlined,
          multiSelect: false,
          searchable: false,
          selectedValues: [groupByValue],
          options: [
            { id: 'status', label: t('statusText', { defaultValue: 'Status' }), value: 'status', defaultLabel: 'Status' },
            { id: 'priority', label: t('priorityText', { defaultValue: 'Priority' }), value: 'priority', defaultLabel: 'Priority' },
            {
              id: 'phase',
              label: filterData.project?.phase_label || t('phaseText', { defaultValue: 'Phase' }),
              value: 'phase',
              defaultLabel: 'Phase',
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
  projectPhaseLabel?: string;
}> = ({
  section,
  onSelectionChange,
  isOpen,
  onToggle,
  themeClasses,
  isDarkMode,
  className = '',
  onManageStatus,
  onManagePhase,
  projectPhaseLabel,
}) => {
  const { t } = useTranslation('task-list-filters');
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const canConfigure = isOwnerOrAdmin || isProjectManager;

  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(section.options);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptionsMemo = useMemo(() => {
    if (!section.searchable || !searchTerm.trim()) return section.options;
    const searchLower = searchTerm.toLowerCase();
    return section.options.filter(option => option.label.toLowerCase().includes(searchLower));
  }, [searchTerm, section.options, section.searchable]);

  useEffect(() => {
    setFilteredOptions(filteredOptionsMemo);
  }, [filteredOptionsMemo]);

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
    if (!isOpen) setSearchTerm('');
  }, [isOpen]);

  const buttonTitle = useMemo(() => {
    if (section.id === 'groupBy' && section.selectedValues[0]) {
      const selectedOpt = section.options.find(o => o.value === section.selectedValues[0]);
      if (selectedOpt?.label) {
        return t('groupBySelected', {
          label: section.label,
          value: selectedOpt.label,
          defaultValue: '{{label}}: {{value}}',
        });
      }
      return section.label;
    }

    if (section.id !== 'groupBy' && section.selectedValues.length > 0) {
      return t('selectedCount', {
        count: section.selectedValues.length,
        label: section.label,
        defaultValue: '{{label}}: {{count}} selected',
      });
    }

    return section.label;
  }, [section, t]);

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

  const selectedCount = section.selectedValues.length;
  const IconComponent = section.icon;

  return (
    <div className={`relative shrink-0 ${className}`} ref={dropdownRef}>
      <button
        onClick={onToggle}
        title={buttonTitle}
        aria-label={buttonTitle}
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

        {section.id === 'groupBy' && selectedCount > 0 && (
          <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {section.options.find(opt => opt.value === section.selectedValues[0])?.label}
          </span>
        )}

        {section.id !== 'groupBy' && selectedCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-gray-500 rounded-full">
            {selectedCount}
          </span>
        )}

        <DownOutlined className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {section.id === 'groupBy' && canConfigure && (
        <div className="inline-flex items-center gap-1 ml-2 shrink-0">
          {section.selectedValues[0] === 'phase' && (
            <button
              onClick={onManagePhase}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border-2 transition-all duration-200 ease-in-out hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 focus:ring-offset-gray-900'
                  : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600 focus:ring-offset-white'
              }`}
            >
              <SettingOutlined className="w-3.5 h-3.5" />
              {t('manage', { defaultValue: 'Manage' })} {projectPhaseLabel || t('phasesText', { defaultValue: 'Phases' })}
            </button>
          )}

          {section.selectedValues[0] === 'status' && (
            <button
              onClick={onManageStatus}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border-2 transition-all duration-200 ease-in-out hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 focus:ring-offset-gray-900'
                  : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600 focus:ring-offset-white'
              }`}
            >
              <SettingOutlined className="w-3.5 h-3.5" />
              {t('manageStatuses', { defaultValue: 'Manage Statuses' })}
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <div className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-sm border ${themeClasses.dropdownBorder}`}>
          {section.searchable && (
            <div className={`p-2 border-b ${themeClasses.dividerBorder}`}>
              <div className="relative w-full">
                <SearchOutlined className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={t('search', { defaultValue: 'Search' })}
                  className={`w-full pl-8 pr-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150 ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-100 placeholder-gray-400 border-gray-600'
                      : 'bg-white text-gray-900 placeholder-gray-400 border-gray-300'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className={`p-2 text-xs text-center ${themeClasses.secondaryText}`}>
                {t('noOptionsFound', { defaultValue: 'No options found' })}
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

                      {option.color && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: option.color }} />}

                      {section.id === 'assignees' && (
                        <div className="flex-shrink-0">
                          {option.avatar ? (
                            <Avatar src={option.avatar} alt={option.label} size={20} style={{ width: 20, height: 20 }} />
                          ) : (
                            <Avatar
                              size={20}
                              style={{
                                backgroundColor: AvatarNamesMap[option.label[0]?.toUpperCase()] || '#9e9e9e',
                                width: 20,
                                height: 20,
                                fontSize: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {option.label[0]?.toUpperCase()}
                            </Avatar>
                          )}
                        </div>
                      )}

                      <div className="flex-1 flex items-center justify-between">
                        <span className="truncate">{option.label}</span>
                        {option.count !== undefined && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{option.count}</span>
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

  useEffect(() => {
    setLocalValue(value);
    if (value) setIsExpanded(true);
  }, [value]);

  const handleToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) setTimeout(() => inputRef.current?.focus(), 100);
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

  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');

  return (
    <div className={`relative shrink-0 ${className}`}>
      {!isExpanded && !value ? (
        <button
          onClick={handleToggle}
          title={t('search', { defaultValue: 'Search' })}
          aria-label={t('search', { defaultValue: 'Search' })}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText} ${
            themeClasses.containerBg === 'bg-gray-800' ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'
          }`}
        >
          <SearchOutlined className="w-3.5 h-3.5" />
          <span>{t('search', { defaultValue: 'Search' })}</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5 shrink-0">
          <div className="relative w-[260px] max-w-[60vw]">
            <SearchOutlined className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={localValue}
              onChange={e => setLocalValue(e.target.value)}
              placeholder={placeholder || t('searchTasks', { defaultValue: 'Search tasks by name or key...' })}
              className={`w-full pr-8 pl-8 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-150 ${
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
                  isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CloseOutlined className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200 ${
              isDarkMode ? 'text-white bg-gray-600 hover:bg-gray-700' : 'text-gray-800 bg-gray-200 hover:bg-gray-300'
            }`}
          >
            {t('search', { defaultValue: 'Search' })}
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
            {t('cancel', { defaultValue: 'Cancel' })}
          </button>
        </form>
      )}
    </div>
  );
};

// Sort Dropdown Component
const SortDropdown: React.FC<{ themeClasses: any; isDarkMode: boolean }> = ({ themeClasses, isDarkMode }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const { projectId } = useAppSelector(state => state.projectReducer);

  const currentSortField = useAppSelector(selectSortField);
  const currentSortOrder = useAppSelector(selectSortOrder);
  const currentGrouping = useAppSelector(selectCurrentGrouping);

  const [open, setOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const sortFieldsList = useMemo(() => {
    const allFields = [
      { label: t('taskText', { defaultValue: 'Task' }), key: 'name' },
      { label: t('statusText', { defaultValue: 'Status' }), key: 'status' },
      { label: t('priorityText', { defaultValue: 'Priority' }), key: 'priority' },
      { label: t('startDateText', { defaultValue: 'Start Date' }), key: 'start_date' },
      { label: t('dueDateText', { defaultValue: 'Due Date' }), key: 'end_date' },
      { label: t('completedDateText', { defaultValue: 'Completed Date' }), key: 'completed_at' },
      { label: t('createdDateText', { defaultValue: 'Created Date' }), key: 'created_at' },
      { label: t('lastUpdatedText', { defaultValue: 'Last Updated' }), key: 'updated_at' },
    ];

    return allFields.filter(field => {
      if (currentGrouping === 'status' && field.key === 'status') return false;
      if (currentGrouping === 'priority' && field.key === 'priority') return false;
      return true;
    });
  }, [t, currentGrouping]);

  const handleSortFieldChange = (fieldKey: string) => {
    if (currentSortField === fieldKey) {
      const newOrder = currentSortOrder === 'ASC' ? 'DESC' : 'ASC';
      dispatch(setSort({ field: fieldKey, order: newOrder }));
    } else {
      dispatch(setSort({ field: fieldKey, order: 'ASC' }));
    }

    if (projectId) dispatch(fetchTasksV3(projectId));
    setOpen(false);
  };

  const clearSort = () => {
    dispatch(setSort({ field: '', order: 'ASC' }));
    if (projectId) dispatch(fetchTasksV3(projectId));
  };

  React.useEffect(() => {
    if (
      (currentGrouping === 'status' && currentSortField === 'status') ||
      (currentGrouping === 'priority' && currentSortField === 'priority')
    ) {
      clearSort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGrouping]);

  const isActive = currentSortField !== '';
  const currentFieldLabel = sortFieldsList.find(f => f.key === currentSortField)?.label;
  const orderText =
    currentSortOrder === 'ASC'
      ? t('ascendingOrder', { defaultValue: 'Ascending Order' })
      : t('descendingOrder', { defaultValue: 'Descending Order' });

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        title={
          isActive
            ? t('currentSort', { field: currentFieldLabel, order: orderText })
            : t('sortText', { defaultValue: 'Sort' })
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
        {currentSortOrder === 'ASC' ? <SortAscendingOutlined className="w-3.5 h-3.5" /> : <SortDescendingOutlined className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{t('sortText', { defaultValue: 'Sort' })}</span>
        {isActive && currentFieldLabel && (
          <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} max-w-16 truncate hidden md:inline`}>
            {currentFieldLabel}
          </span>
        )}
        <DownOutlined className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-sm border ${themeClasses.dropdownBorder}`}>
          {isActive && (
            <div className={`p-2 border-b ${themeClasses.dividerBorder}`}>
              <button
                onClick={clearSort}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors duration-150 ${themeClasses.optionText} ${themeClasses.optionHover}`}
              >
                {t('clearSort', { defaultValue: 'Clear Sort' })}
              </button>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto">
            <div className="p-0.5">
              {sortFieldsList.map((sortField: any) => {
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
                        ? t('currentSort', { field: sortField.label, order: orderText })
                        : t('sortByField', { field: sortField.label })
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate">{sortField.label}</span>
                      {isSelected && <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>({orderText})</span>}
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

const FieldsDropdown: React.FC<{ themeClasses: any; isDarkMode: boolean }> = ({ themeClasses, isDarkMode }) => {
  const { t } = useTranslation('task-list-filters');
  const { t: tTable } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();

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

  const debouncedSaveFields = useMemo(
    () =>
      createDebouncedFunction((fieldsToSave: typeof fields) => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fieldsToSave));
      }, 300),
    []
  );

  useEffect(() => {
    debouncedSaveFields(fields);
    return () => debouncedSaveFields.cancel();
  }, [fields, debouncedSaveFields]);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const visibleCount = useMemo(() => sortedFields.filter(field => field.visible).length, [sortedFields]);

  const fieldsTitle = useMemo(() => {
    return visibleCount > 0
      ? t('fieldsWithCount', { count: visibleCount, defaultValue: 'Fields: {{count}}' })
      : t('fieldsText', { defaultValue: 'Fields' });
  }, [visibleCount, t]);

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        title={fieldsTitle}
        aria-label={fieldsTitle}
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
        <span>{t('fieldsText', { defaultValue: 'Fields' })}</span>
        {visibleCount > 0 && (
          <span className={`inline-flex items-center justify-center w-4 h-4 text-xs font-bold ${isDarkMode ? 'text-white bg-gray-500' : 'text-gray-800 bg-gray-300'} rounded-full`}>
            {visibleCount}
          </span>
        )}
        <DownOutlined className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-sm border ${themeClasses.dropdownBorder}`}>
          <div className="max-h-48 overflow-y-auto">
            {sortedFields.length === 0 ? (
              <div className={`p-2 text-xs text-center ${themeClasses.secondaryText}`}>
                {t('noOptionsFound', { defaultValue: 'No Options Found' })}
              </div>
            ) : (
              <div className="p-0.5">
                {sortedFields.map((field: any) => {
                  const isSelected = field.visible;

                  return (
                    <button
                      key={field.key}
                      onClick={() => {
                        dispatch(toggleField(field.key));
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
                      <div
                        className={`
                          flex items-center justify-center w-3.5 h-3.5 border rounded
                          ${isSelected ? 'bg-gray-600 border-gray-600 text-white' : 'border-gray-300 dark:border-gray-600'}
                        `}
                      >
                        {isSelected && <CheckOutlined className="w-2.5 h-2.5" />}
                      </div>

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

  const currentTaskAssignees = useAppSelector(state => state.taskReducer.taskAssignees);
  const currentTaskLabels = useAppSelector(state => state.taskReducer.labels);
  const kanbanState = useAppSelector((state: RootState) => state.enhancedKanbanReducer);

  const taskManagementArchived = useAppSelector(selectArchived);
  const taskReducerArchived = useAppSelector(state => state.taskReducer.archived);
  const showArchived = position === 'list' ? taskManagementArchived : taskReducerArchived;

  const { refreshFilterData } = useFilterDataLoader();

  const taskManagementSearch = useAppSelector(state => state.taskManagement?.search || '');
  const kanbanSearch = useAppSelector(state => state.enhancedKanbanReducer?.search || '');
  const searchValue = position === 'board' ? kanbanSearch : taskManagementSearch;

  const [filterSections, setFilterSections] = useState<FilterSection[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [clearingFilters, setClearingFilters] = useState(false);

  const [showManageStatusModal, setShowManageStatusModal] = useState(false);
  const [showManagePhaseModal, setShowManagePhaseModal] = useState(false);

  // Responsive state for overflow behaviour
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setShowOverflowMenu(width < 1200);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const debouncedFilterChangeRef = useRef<(((projectId: string) => void) & { cancel: () => void }) | null>(null);
  const debouncedSearchChangeRef = useRef<(((projectId: string, value: string) => void) & { cancel: () => void }) | null>(null);

  const filterSectionsData = useFilterData(position);

  const isDataLoaded = useMemo(() => filterSectionsData.length > 0, [filterSectionsData]);
  const memoizedFilterSections = useMemo(() => filterSectionsData, [filterSectionsData]);

  useEffect(() => {
    const hasChanged = JSON.stringify(filterSections) !== JSON.stringify(memoizedFilterSections);
    if (hasChanged && memoizedFilterSections.length > 0) setFilterSections(memoizedFilterSections);
  }, [memoizedFilterSections, filterSections]);

  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const { projectId } = useAppSelector(state => state.projectReducer);
  const { projectView } = useTabSearchParam();
  const projectPhaseLabel = useAppSelector(state => state.projectReducer.project?.phase_label);

  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const canConfigure = isOwnerOrAdmin || isProjectManager;

  const currentGroupBySection = filterSectionsData.find(s => s.id === 'groupBy');
  const currentGroupByValue = currentGroupBySection?.selectedValues[0] || 'status';

  const overflowMenuItems = useMemo(() => {
    const items: any[] = [
      {
        key: 'group-by-header',
        type: 'group',
        label: <span className="font-semibold">{t('groupByText', { defaultValue: 'Group by' })}</span>,
        children: [
          {
            key: 'group-by-status',
            label: (
              <div className="flex items-center justify-between w-full">
                <span>{t('statusText', { defaultValue: 'Status' })}</span>
                {currentGroupByValue === 'status' && <CheckOutlined className="text-blue-500 ml-2" />}
              </div>
            ),
          },
          {
            key: 'group-by-priority',
            label: (
              <div className="flex items-center justify-between w-full">
                <span>{t('priorityText', { defaultValue: 'Priority' })}</span>
                {currentGroupByValue === 'priority' && <CheckOutlined className="text-blue-500 ml-2" />}
              </div>
            ),
          },
          {
            key: 'group-by-phase',
            label: (
              <div className="flex items-center justify-between w-full">
                <span>{projectPhaseLabel || t('phaseText', { defaultValue: 'Phase' })}</span>
                {currentGroupByValue === 'phase' && <CheckOutlined className="text-blue-500 ml-2" />}
              </div>
            ),
          },
        ],
      },
    ];

    if (canConfigure) {
      items.push({ type: 'divider' });

      if (currentGroupByValue === 'status') {
        items.push({
          key: 'manage-statuses',
          icon: <SettingOutlined />,
          label: t('manageStatuses', { defaultValue: 'Manage Statuses' }),
        });
      } else if (currentGroupByValue === 'phase') {
        items.push({
          key: 'manage-phases',
          icon: <SettingOutlined />,
          label: `${t('manage', { defaultValue: 'Manage' })} ${projectPhaseLabel || t('phasesText', { defaultValue: 'Phases' })}`,
        });
      }
    }

    return items;
  }, [currentGroupByValue, projectPhaseLabel, t, canConfigure]);

  const handleOverflowMenuClick = (info: any) => {
    const key: string = info.key;

    if (key === 'group-by-status') {
      if (position === 'board') {
        dispatch(setKanbanGroupBy('status' as any));
        if (projectId) dispatch(fetchEnhancedKanbanGroups(projectId));
      } else {
        dispatch(setCurrentGrouping('status'));
        if (projectId) dispatch(fetchTasksV3(projectId));
      }
      return;
    }

    if (key === 'group-by-priority') {
      if (position === 'board') {
        dispatch(setKanbanGroupBy('priority' as any));
        if (projectId) dispatch(fetchEnhancedKanbanGroups(projectId));
      } else {
        dispatch(setCurrentGrouping('priority'));
        if (projectId) dispatch(fetchTasksV3(projectId));
      }
      return;
    }

    if (key === 'group-by-phase') {
      if (position === 'board') {
        dispatch(setKanbanGroupBy('phase' as any));
        if (projectId) dispatch(fetchEnhancedKanbanGroups(projectId));
      } else {
        dispatch(setCurrentGrouping('phase'));
        if (projectId) dispatch(fetchTasksV3(projectId));
      }
      return;
    }

    if (key === 'manage-statuses') {
      setShowManageStatusModal(true);
      return;
    }

    if (key === 'manage-phases') {
      setShowManagePhaseModal(true);
      return;
    }
  };

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
    }),
    [isDarkMode]
  );

  useEffect(() => {
    debouncedFilterChangeRef.current = createDebouncedFunction((pid: string) => {
      dispatch(fetchTasksV3(pid));
    }, FILTER_DEBOUNCE_DELAY);

    debouncedSearchChangeRef.current = createDebouncedFunction((pid: string, value: string) => {
      dispatch(setTaskManagementSearch(value));
      dispatch(fetchTasksV3(pid));
    }, SEARCH_DEBOUNCE_DELAY);

    return () => {
      debouncedFilterChangeRef.current?.cancel();
      debouncedSearchChangeRef.current?.cancel();
    };
  }, [dispatch, projectView]);

  const sortFields = useAppSelector(state => state.taskReducer.fields);
  const taskManagementSortField = useAppSelector(selectSortField);

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
    if (activeFiltersCount !== calculatedActiveFiltersCount) setActiveFiltersCount(calculatedActiveFiltersCount);
  }, [calculatedActiveFiltersCount, activeFiltersCount]);

  const handleDropdownToggle = useCallback((sectionId: string) => {
    setOpenDropdown(current => (current === sectionId ? null : sectionId));
  }, []);

  const handleSelectionChange = useCallback(
    (sectionId: string, values: string[]) => {
      if (!projectId) return;

      if (position === 'board') {
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
          const currentAssignees = kanbanState.taskAssignees || [];
          currentAssignees.forEach((assignee: any) => {
            if (assignee.selected) dispatch(setTaskAssigneeSelection({ id: assignee.id, selected: false }));
          });
          values.forEach(id => dispatch(setTaskAssigneeSelection({ id, selected: true })));
          dispatch(fetchEnhancedKanbanGroups(projectId));
          return;
        }
        if (sectionId === 'labels') {
          const currentLabels = kanbanState.labels || [];
          currentLabels.forEach((label: any) => {
            if (label.selected) dispatch(setLabelSelection({ id: label.id, selected: false }));
          });
          values.forEach(id => dispatch(setLabelSelection({ id, selected: true })));
          dispatch(fetchEnhancedKanbanGroups(projectId));
          return;
        }
      } else {
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
        dispatch(fetchEnhancedKanbanGroups(projectId));
      } else {
        dispatch(setTaskManagementSearch(value));
        debouncedSearchChangeRef.current?.(projectId, value);
      }
    },
    [dispatch, projectId, position]
  );

  const clearAllFilters = useCallback(async () => {
    if (!projectId || clearingFilters) return;

    setClearingFilters(true);

    try {
      debouncedFilterChangeRef.current?.cancel();
      debouncedSearchChangeRef.current?.cancel();

      setFilterSections(prev =>
        prev.map(section => ({
          ...section,
          selectedValues: section.id === 'groupBy' ? section.selectedValues : [],
        }))
      );

      dispatch(setTaskManagementSearch(''));

      const clearedLabels = currentTaskLabels.map(label => ({ ...label, selected: false }));
      dispatch(setLabels(clearedLabels));

      const clearedAssignees = currentTaskAssignees.map(member => ({ ...member, selected: false }));
      dispatch(setMembers(clearedAssignees));

      dispatch(setPriorities([]));
      dispatch(setFields([]));
      dispatch(setSort({ field: '', order: 'ASC' }));

      if (position === 'list') dispatch(setTaskManagementArchived(false));
      else dispatch(setKanbanArchived(false));

      setTimeout(() => {
        dispatch(fetchTasksV3(projectId));
        setTimeout(() => setClearingFilters(false), 100);
      }, 0);
    } catch (error) {
      console.error('Error clearing filters:', error);
      setClearingFilters(false);
    }
  }, [projectId, dispatch, currentTaskLabels, currentTaskAssignees, clearingFilters, position]);

  const toggleArchived = useCallback(() => {
    if (position === 'board') {
      dispatch(setKanbanArchived(!showArchived));
      if (projectId) dispatch(fetchEnhancedKanbanGroups(projectId));
    } else {
      dispatch(toggleTaskManagementArchived());
      if (projectId) dispatch(fetchTasksV3(projectId));
    }
  }, [dispatch, projectId, position, showArchived]);

  return (
    <div className={`${themeClasses.containerBg} border ${themeClasses.containerBorder} rounded-md p-1.5 shadow-sm overflow-visible ${className}`}>
      {/* ✅ IMPORTANT CHANGE:
          - Removed flex-wrap from the main row (prevents "2nd line clipped" issues in some layouts)
          - Left side becomes horizontally scrollable so "More" can NEVER disappear.
      */}
      <div className="flex items-center justify-between gap-2 min-h-[36px]">
        {/* Left Section - Main Filters (scrollable) */}
        <div
          className="
            flex items-center gap-2 flex-1 min-w-0
            overflow-x-auto overflow-y-hidden whitespace-nowrap
            [&>*]:shrink-0
          "
          style={{ WebkitOverflowScrolling: 'touch' } as any}
        >
          <SearchFilter
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search tasks by name or key..."
            themeClasses={themeClasses}
          />

          {position === 'list' && <SortDropdown themeClasses={themeClasses} isDarkMode={isDarkMode} />}

          {isDataLoaded ? (
            filterSectionsData.map(section =>
              section.id === 'groupBy' && showOverflowMenu ? null : (
                <FilterDropdown
                  key={section.id}
                  section={section}
                  onSelectionChange={handleSelectionChange}
                  isOpen={openDropdown === section.id}
                  onToggle={() => handleDropdownToggle(section.id)}
                  themeClasses={themeClasses}
                  isDarkMode={isDarkMode}
                  onManageStatus={() => setShowManageStatusModal(true)}
                  onManagePhase={() => setShowManagePhaseModal(true)}
                  projectPhaseLabel={projectPhaseLabel}
                />
              )
            )
          ) : (
            <div className={`flex items-center gap-2 px-2.5 py-1.5 text-xs ${themeClasses.secondaryText} shrink-0`}>
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-500"></div>
              <span>{t('loadingFilters', { defaultValue: 'Loading Filters' })}</span>
            </div>
          )}

          {showOverflowMenu && (
            <Dropdown
              className="task-filters-overflow-menu shrink-0"
              menu={{
                items: overflowMenuItems,
                onClick: handleOverflowMenuClick,
              }}
              trigger={['click']}
              placement="bottomLeft"
            >
              <button
                aria-label={t('more', { defaultValue: 'More' })}
                className={`
                  inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
                  border transition-all duration-200 ease-in-out shrink-0
                  ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}
                  hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                  ${isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
                `}
              >
                <MenuOutlined className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('more', { defaultValue: 'More' })}</span>
              </button>
            </Dropdown>
          )}
        </div>

        {/* Right Section - Additional Controls (fixed, no shrinking) */}
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-xs ${themeClasses.secondaryText}`}>
                {activeFiltersCount}{' '}
                {activeFiltersCount !== 1
                  ? t('filtersActive', { defaultValue: 'Filters Active' })
                  : t('filterActive', { defaultValue: 'Filter Active' })}
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
                {clearingFilters ? t('clearing', { defaultValue: 'Clearing' }) : t('clearAll', { defaultValue: 'Clear All' })}
              </button>
            </div>
          )}

          {position === 'list' && (
            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={toggleArchived}
                className={`w-3.5 h-3.5 text-gray-600 rounded focus:ring-gray-500 transition-colors duration-150 ${
                  isDarkMode ? 'border-[#303030] bg-[#141414] focus:ring-offset-gray-800' : 'border-gray-300 bg-white focus:ring-offset-white'
                }`}
              />
              <span className={`text-xs ${themeClasses.optionText}`}>{t('showArchivedText', { defaultValue: 'Show Archived' })}</span>
            </label>
          )}

          {position === 'list' && <FieldsDropdown themeClasses={themeClasses} isDarkMode={isDarkMode} />}
        </div>
      </div>

      <ManageStatusModal
        open={showManageStatusModal}
        onClose={() => {
          setShowManageStatusModal(false);
          refreshFilterData();
        }}
        projectId={projectId || undefined}
      />

      <ManagePhaseModal
        open={showManagePhaseModal}
        onClose={() => {
          setShowManagePhaseModal(false);
          refreshFilterData();
        }}
        projectId={projectId || undefined}
      />
    </div>
  );
};

export default React.memo(ImprovedTaskFilters);
