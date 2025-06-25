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
  SettingOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { RootState } from '@/app/store';
import { AppDispatch } from '@/app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { colors } from '@/styles/colors';
import SingleAvatar from '@components/common/single-avatar/single-avatar';
import { useFilterDataLoader } from '@/hooks/useFilterDataLoader';
import { Dropdown, Checkbox, Button, Space } from 'antd';
import { toggleField, TaskListField } from '@/features/task-management/taskListFields.slice';

// Import Redux actions
import { fetchTasksV3, setSelectedPriorities } from '@/features/task-management/task-management.slice';
import { setCurrentGrouping, selectCurrentGrouping } from '@/features/task-management/grouping.slice';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { fetchLabelsByProject, fetchTaskAssignees, setMembers, setLabels } from '@/features/tasks/tasks.slice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { ITaskListColumn } from '@/types/tasks/taskList.types';
import { IGroupBy } from '@/features/tasks/tasks.slice';

// Memoized selectors to prevent unnecessary re-renders
const selectPriorities = createSelector(
  [(state: any) => state.priorityReducer.priorities],
  (priorities) => priorities || []
);

const selectTaskPriorities = createSelector(
  [(state: any) => state.taskReducer.priorities],
  (priorities) => priorities || []
);

const selectBoardPriorities = createSelector(
  [(state: any) => state.boardReducer.priorities],
  (priorities) => priorities || []
);

const selectTaskLabels = createSelector(
  [(state: any) => state.taskReducer.labels],
  (labels) => labels || []
);

const selectBoardLabels = createSelector(
  [(state: any) => state.boardReducer.labels],
  (labels) => labels || []
);

const selectTaskAssignees = createSelector(
  [(state: any) => state.taskReducer.taskAssignees],
  (assignees) => assignees || []
);

const selectBoardAssignees = createSelector(
  [(state: any) => state.boardReducer.taskAssignees],
  (assignees) => assignees || []
);

const selectProject = createSelector(
  [(state: any) => state.projectReducer.project],
  (project) => project
);

const selectSelectedPriorities = createSelector(
  [(state: any) => state.taskManagement.selectedPriorities],
  (selectedPriorities) => selectedPriorities || []
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

// Get real filter data from Redux state
const useFilterData = (): FilterSection[] => {
  const { t } = useTranslation('task-list-filters');
  const [searchParams] = useSearchParams();
  const { projectView } = useTabSearchParam();
  
  // Use memoized selectors to prevent unnecessary re-renders
  const priorities = useAppSelector(selectPriorities);
  const taskPriorities = useAppSelector(selectTaskPriorities);
  const boardPriorities = useAppSelector(selectBoardPriorities);
  const taskLabels = useAppSelector(selectTaskLabels);
  const boardLabels = useAppSelector(selectBoardLabels);
  const taskAssignees = useAppSelector(selectTaskAssignees);
  const boardAssignees = useAppSelector(selectBoardAssignees);
  const taskGroupBy = useAppSelector(state => state.taskReducer.groupBy);
  const boardGroupBy = useAppSelector(state => state.boardReducer.groupBy);
  const project = useAppSelector(selectProject);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const selectedPriorities = useAppSelector(selectSelectedPriorities);

  const tab = searchParams.get('tab');
  const currentProjectView = tab === 'tasks-list' ? 'list' : 'kanban';

  // Debug logging
  console.log('Filter Data Debug:', {
    priorities: priorities?.length,
    taskAssignees: taskAssignees?.length,
    boardAssignees: boardAssignees?.length,
    labels: taskLabels?.length,
    boardLabels: boardLabels?.length,
    currentProjectView,
    projectId: project?.id
  });

  return useMemo(() => {
    const currentPriorities = currentProjectView === 'list' ? taskPriorities : boardPriorities;
    const currentLabels = currentProjectView === 'list' ? taskLabels : boardLabels;
    const currentAssignees = currentProjectView === 'list' ? taskAssignees : boardAssignees;
    const groupByValue = currentGrouping || 'status';

    return [
      {
        id: 'priority',
        label: 'Priority',
        options: priorities.map((p: any) => ({
          value: p.id,
          label: p.name,
          color: p.color_code,
        })),
        selectedValues: selectedPriorities,
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
        selectedValues: currentAssignees.filter((m: any) => m.selected && m.id).map((m: any) => m.id || ''),
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
        selectedValues: currentLabels.filter((l: any) => l.selected && l.id).map((l: any) => l.id || ''),
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
          { id: 'phase', label: project?.phase_label || t('phaseText'), value: 'phase' },
        ],
      },
    ];
  }, [
    priorities, 
    taskPriorities, 
    boardPriorities, 
    taskLabels, 
    boardLabels, 
    taskAssignees, 
    boardAssignees, 
    taskGroupBy, 
    boardGroupBy, 
    project, 
    currentProjectView, 
    t, 
    currentGrouping,
    selectedPriorities
  ]);
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
}> = ({ section, onSelectionChange, isOpen, onToggle, themeClasses, isDarkMode, className = '' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(section.options);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter options based on search term
  useEffect(() => {
    if (!section.searchable || !searchTerm.trim()) {
      setFilteredOptions(section.options);
      return;
    }

    const filtered = section.options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredOptions(filtered);
  }, [searchTerm, section.options, section.searchable]);

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

  const handleOptionToggle = useCallback((optionValue: string) => {
    if (section.multiSelect) {
      const newValues = section.selectedValues.includes(optionValue)
        ? section.selectedValues.filter(v => v !== optionValue)
        : [...section.selectedValues, optionValue];
      onSelectionChange(section.id, newValues);
    } else {
      onSelectionChange(section.id, [optionValue]);
      onToggle();
    }
  }, [section, onSelectionChange, onToggle]);

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
          ${selectedCount > 0
            ? (isDarkMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-50 text-blue-800 border-blue-300 font-semibold')
            : `${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`
          }
          hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
          ${themeClasses.containerBg === 'bg-gray-800' ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
        `}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <IconComponent className="w-3.5 h-3.5" />
        <span>{section.label}</span>
        {selectedCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-blue-500 rounded-full">
            {selectedCount}
          </span>
        )}
        <DownOutlined 
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-lg border ${themeClasses.dropdownBorder}`}>
          {/* Search Input */}
          {section.searchable && (
            <div className={`p-2 border-b ${themeClasses.dividerBorder}`}>
              <div className="relative w-full">
                <SearchOutlined className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={`Search ${section.label.toLowerCase()}...`}
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
                No options found
              </div>
            ) : (
              <div className="p-0.5">
                {filteredOptions.map((option) => {
                  const isSelected = section.selectedValues.includes(option.value);
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionToggle(option.value)}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded
                        transition-colors duration-150 text-left
                        ${isSelected
                          ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 font-semibold')
                          : `${themeClasses.optionText} ${themeClasses.optionHover}`
                        }
                      `}
                    >
                      {/* Checkbox/Radio indicator */}
                      <div className={`
                        flex items-center justify-center w-3.5 h-3.5 border rounded
                        ${isSelected
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 dark:border-gray-600'
                        }
                      `}>
                        {isSelected && <CheckOutlined className="w-2.5 h-2.5" />}
                      </div>

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
}> = ({ value, onChange, placeholder = 'Search tasks...', themeClasses, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isExpanded]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onChange(localValue);
  }, [localValue, onChange]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
    setIsExpanded(false);
  }, [onChange]);

  // Redux selectors for theme and other state
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');

  return (
    <div className={`relative ${className}`}>
      {!isExpanded ? (
        <button
          onClick={handleToggle}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText} ${
            themeClasses.containerBg === 'bg-gray-800' ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'
          }`}
        >
          <SearchOutlined className="w-3.5 h-3.5" />
          <span>Search</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <div className="relative w-full">
            <SearchOutlined className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              placeholder={placeholder}
              className={`w-full pr-4 pl-8 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150 ${
                isDarkMode
                  ? 'bg-gray-700 text-gray-100 placeholder-gray-400 border-gray-600'
                  : 'bg-white text-gray-900 placeholder-gray-400 border-gray-300'
              }`}
            />
            {localValue && (
              <button
                type="button"
                onClick={handleClear}
                className={`absolute right-1.5 top-1/2 transform -translate-y-1/2 ${themeClasses.secondaryText} hover:${themeClasses.optionText} transition-colors duration-150`}
              >
                <CloseOutlined className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors duration-200"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 ${themeClasses.secondaryText} hover:${themeClasses.optionText}`}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
};

// Custom debounce implementation
function debounce(func: (...args: any[]) => void, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const LOCAL_STORAGE_KEY = 'worklenz.taskManagement.fields';

const FieldsDropdown: React.FC<{ themeClasses: any; isDarkMode: boolean }> = ({ themeClasses, isDarkMode }) => {
  const dispatch = useDispatch();
  const fieldsRaw = useSelector((state: RootState) => state.taskManagementFields);
  const fields = Array.isArray(fieldsRaw) ? fieldsRaw : [];
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  const [open, setOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced save to localStorage using custom debounce
  const debouncedSaveFields = useMemo(() => debounce((fieldsToSave: typeof fields) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fieldsToSave));
  }, 300), []);

  useEffect(() => {
    debouncedSaveFields(fields);
    // Cleanup debounce on unmount
    return () => { /* no cancel needed for custom debounce */ };
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

  const visibleCount = sortedFields.filter(field => field.visible).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button - matching FilterDropdown style */}
      <button
        onClick={() => setOpen(!open)}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
          border transition-all duration-200 ease-in-out
          ${visibleCount > 0
            ? (isDarkMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-50 text-blue-800 border-blue-300 font-semibold')
            : `${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`
          }
          hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
          ${themeClasses.containerBg === 'bg-gray-800' ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
        `}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <EyeOutlined className="w-3.5 h-3.5" />
        <span>Fields</span>
        {visibleCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-blue-500 rounded-full">
            {visibleCount}
          </span>
        )}
        <DownOutlined 
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Panel - matching FilterDropdown style */}
      {open && (
        <div className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-lg border ${themeClasses.dropdownBorder}`}>
          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {sortedFields.length === 0 ? (
              <div className={`p-2 text-xs text-center ${themeClasses.secondaryText}`}>
                No fields available
              </div>
            ) : (
              <div className="p-0.5">
                {sortedFields.map((field) => {
                  const isSelected = field.visible;
                  
                  return (
                    <button
                      key={field.key}
                      onClick={() => dispatch(toggleField(field.key))}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded
                        transition-colors duration-150 text-left
                        ${isSelected
                          ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 font-semibold')
                          : `${themeClasses.optionText} ${themeClasses.optionHover}`
                        }
                      `}
                    >
                      {/* Checkbox indicator - matching FilterDropdown style */}
                      <div className={`
                        flex items-center justify-center w-3.5 h-3.5 border rounded
                        ${isSelected
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 dark:border-gray-600'
                        }
                      `}>
                        {isSelected && <CheckOutlined className="w-2.5 h-2.5" />}
                      </div>

                      {/* Label and Count */}
                      <div className="flex-1 flex items-center justify-between">
                        <span className="truncate">{field.label}</span>
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
const ImprovedTaskFilters: React.FC<ImprovedTaskFiltersProps> = ({ 
  position, 
  className = '' 
}) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  
  // Get current state values for filter updates
  const currentTaskAssignees = useAppSelector(state => state.taskReducer.taskAssignees);
  const currentBoardAssignees = useAppSelector(state => state.boardReducer.taskAssignees);
  const currentTaskLabels = useAppSelector(state => state.taskReducer.labels);
  const currentBoardLabels = useAppSelector(state => state.boardReducer.labels);

  // Use the filter data loader hook
  useFilterDataLoader();

  // Local state for filter sections
  const [filterSections, setFilterSections] = useState<FilterSection[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Get real filter data
  const filterSectionsData = useFilterData();

  // Check if data is loaded - memoize this computation
  const isDataLoaded = useMemo(() => {
    return filterSectionsData.some(section => section.options.length > 0);
  }, [filterSectionsData]);

  // Initialize filter sections from data - memoize this to prevent unnecessary updates
  const memoizedFilterSections = useMemo(() => {
    return filterSectionsData;
  }, [filterSectionsData]);

  useEffect(() => {
    setFilterSections(memoizedFilterSections);
  }, [memoizedFilterSections]);

  // Redux selectors for theme and other state
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const { projectId } = useAppSelector(state => state.projectReducer);
  const { projectView } = useTabSearchParam();
  const { columns } = useAppSelector(state => state.taskReducer);

  // Theme-aware class names - memoize to prevent unnecessary re-renders
  const themeClasses = useMemo(() => ({
    containerBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    containerBorder: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    buttonBg: isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50',
    buttonBorder: isDarkMode ? 'border-gray-600' : 'border-gray-300',
    buttonText: isDarkMode ? 'text-gray-200' : 'text-gray-700',
    dropdownBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    dropdownBorder: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    optionText: isDarkMode ? 'text-gray-200' : 'text-gray-700',
    optionHover: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50',
    secondaryText: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    dividerBorder: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    pillBg: isDarkMode ? 'bg-gray-700' : 'bg-gray-100',
    pillText: isDarkMode ? 'text-gray-200' : 'text-gray-700',
    pillActiveBg: isDarkMode ? 'bg-blue-600' : 'bg-blue-100',
    pillActiveText: isDarkMode ? 'text-white' : 'text-blue-800',
    searchBg: isDarkMode ? 'bg-gray-700' : 'bg-gray-50',
    searchBorder: isDarkMode ? 'border-gray-600' : 'border-gray-300',
    searchText: isDarkMode ? 'text-gray-200' : 'text-gray-900',
  }), [isDarkMode]);

  // Calculate active filters count
  useEffect(() => {
    const count = filterSections.reduce((acc, section) => acc + section.selectedValues.length, 0);
    setActiveFiltersCount(count + (searchValue ? 1 : 0));
  }, [filterSections, searchValue]);

  // Handlers
  const handleDropdownToggle = useCallback((sectionId: string) => {
    setOpenDropdown(current => current === sectionId ? null : sectionId);
  }, []);

  const handleSelectionChange = useCallback((sectionId: string, values: string[]) => {
    if (!projectId) return;

    // Prevent clearing all group by options
    if (sectionId === 'groupBy' && values.length === 0) {
      return; // Do nothing
    }

    // Update local state first
    setFilterSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, selectedValues: values }
        : section
    ));

    // Use task management slices for groupBy
    if (sectionId === 'groupBy' && values.length > 0) {
      dispatch(setCurrentGrouping(values[0] as 'status' | 'priority' | 'phase'));
      dispatch(fetchTasksV3(projectId));
      return;
    }

    // Handle priorities
    if (sectionId === 'priority') {
      console.log('Priority selection changed:', { sectionId, values, projectId });
      dispatch(setSelectedPriorities(values));
      dispatch(fetchTasksV3(projectId));
      return;
    }

    // Handle assignees (members)
    if (sectionId === 'assignees') {
      // Update selected property for each assignee
      const updatedAssignees = currentTaskAssignees.map(member => ({
        ...member,
        selected: values.includes(member.id || '')
      }));
      dispatch(setMembers(updatedAssignees));
      dispatch(fetchTasksV3(projectId));
      return;
    }

    // Handle labels
    if (sectionId === 'labels') {
      // Update selected property for each label
      const updatedLabels = currentTaskLabels.map(label => ({
        ...label,
        selected: values.includes(label.id || '')
      }));
      dispatch(setLabels(updatedLabels));
      dispatch(fetchTasksV3(projectId));
      return;
    }
  }, [dispatch, projectId, currentTaskAssignees, currentTaskLabels]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    
    // Log the search change for now
    console.log('Search change:', value, { projectView, projectId });
    
    // TODO: Implement proper search dispatch
  }, [projectView, projectId]);

  const clearAllFilters = useCallback(() => {
    // TODO: Implement clear all filters
    console.log('Clear all filters');
    setSearchValue('');
    setShowArchived(false);
  }, []);

  const toggleArchived = useCallback(() => {
    setShowArchived(!showArchived);
    // TODO: Implement proper archived toggle
    console.log('Toggle archived:', !showArchived);
  }, [showArchived]);

  // Show fields dropdown functionality
  const handleColumnVisibilityChange = useCallback(async (col: ITaskListColumn) => {
    if (!projectId) return;
    console.log('Column visibility change:', col);
    // TODO: Implement column visibility change
  }, [projectId]);

  return (
    <div className={`${themeClasses.containerBg} border ${themeClasses.containerBorder} rounded-md p-3 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Left Section - Main Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <SearchFilter
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search tasks..."
            themeClasses={themeClasses}
          />

          {/* Filter Dropdowns - Only render when data is loaded */}
          {isDataLoaded ? (
            filterSectionsData.map((section) => (
              <FilterDropdown
                key={section.id}
                section={section}
                onSelectionChange={handleSelectionChange}
                isOpen={openDropdown === section.id}
                onToggle={() => handleDropdownToggle(section.id)}
                themeClasses={themeClasses}
                isDarkMode={isDarkMode}
              />
            ))
          ) : (
            // Loading state
            <div className={`flex items-center gap-2 px-2.5 py-1.5 text-xs ${themeClasses.secondaryText}`}>
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-500"></div>
              <span>Loading filters...</span>
            </div>
          )}
        </div>

        {/* Right Section - Additional Controls */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Active Filters Indicator */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className={`text-xs ${themeClasses.secondaryText}`}>
                {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} active
              </span>
              <button
                onClick={clearAllFilters}
                className={`text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors duration-150 ${
                  isDarkMode ? 'text-blue-400 hover:text-blue-300' : ''
                }`}
              >
                Clear all
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
                className={`w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500 transition-colors duration-150 ${
                  isDarkMode 
                    ? 'border-gray-600 bg-gray-700 focus:ring-offset-gray-800' 
                    : 'border-gray-300 bg-white focus:ring-offset-white'
                }`}
              />
              <span className={`text-xs ${themeClasses.optionText}`}>
                Show archived
              </span>
              <InboxOutlined className={`w-3.5 h-3.5 ${themeClasses.secondaryText}`} />
            </label>
          )}

          {/* Show Fields Button (for list view) */}
          {position === 'list' && <FieldsDropdown themeClasses={themeClasses} isDarkMode={isDarkMode} />}
        </div>
      </div>

      {/* Active Filters Pills */}
      {activeFiltersCount > 0 && (
        <div className={`flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t ${themeClasses.dividerBorder}`}>
          {searchValue && (
            <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full ${themeClasses.pillActiveBg} ${themeClasses.pillActiveText}`}>
              <SearchOutlined className="w-2.5 h-2.5" />
              <span>"{searchValue}"</span>
              <button
                onClick={() => setSearchValue('')}
                className={`ml-1 rounded-full p-0.5 transition-colors duration-150 ${
                  isDarkMode ? 'hover:bg-blue-800' : 'hover:bg-blue-200'
                }`}
              >
                <CloseOutlined className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
          
          {filterSectionsData
            .filter(section => section.id !== 'groupBy') // <-- skip groupBy
            .flatMap((section) =>
              section.selectedValues.map((value) => {
                const option = section.options.find(opt => opt.value === value);
                if (!option) return null;

                return (
                  <div
                    key={`${section.id}-${value}`}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full ${themeClasses.pillBg} ${themeClasses.pillText}`}
                  >
                    {option.color && (
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    <span>{option.label}</span>
                    <button
                      onClick={() => {
                        const newValues = section.selectedValues.filter(v => v !== value);
                        handleSelectionChange(section.id, newValues);
                      }}
                      className={`ml-1 rounded-full p-0.5 transition-colors duration-150 ${
                        isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                      }`}
                    >
                      <CloseOutlined className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              }).filter(Boolean)
            )}
        </div>
      )}
    </div>
  );
};

export default React.memo(ImprovedTaskFilters);