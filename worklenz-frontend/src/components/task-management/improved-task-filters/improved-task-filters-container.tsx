import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { createSelector } from '@reduxjs/toolkit';
import {
  CheckOutlined,
  Dropdown,
  FlagOutlined,
  GroupOutlined,
  MenuOutlined,
  SettingOutlined,
  TagOutlined,
  TeamOutlined,
} from '@/shared/antd-imports';
import { RootState } from '@/app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useFilterDataLoader } from '@/hooks/useFilterDataLoader';
import {
  fetchTasksV3,
  setArchived as setTaskManagementArchived,
  setSearch as setTaskManagementSearch,
  setSort,
  selectArchived,
  toggleArchived as toggleTaskManagementArchived,
} from '@/features/task-management/task-management.slice';
import { selectSortField } from '@/features/task-management/task-management.selectors';
import {
  selectCurrentGrouping,
  setCurrentGrouping,
} from '@/features/task-management/grouping.slice';
import { setLabels, setMembers, setPriorities, setFields } from '@/features/tasks/tasks.slice';
import {
  fetchEnhancedKanbanGroups,
  setArchived as setKanbanArchived,
  setGroupBy as setKanbanGroupBy,
  setLabelSelection,
  setPriorities as setKanbanPriorities,
  setSearch as setKanbanSearch,
  setTaskAssigneeSelection,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import ManageStatusModal from '@/components/task-management/ManageStatusModal';
import ManagePhaseModal from '@/components/task-management/ManagePhaseModal';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { FieldsDropdown } from './fields-dropdown';
import { FilterDropdown } from './filter-dropdown';
import { SearchFilter } from './search-filter';
import { SortDropdown } from './sort-dropdown';
import { FilterSection, ImprovedTaskFiltersProps } from './types';
import { projectsApiService } from '@/api/projects/projects.api.service';

const FILTER_DEBOUNCE_DELAY = 300;
const SEARCH_DEBOUNCE_DELAY = 500;

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
    selectedPriorities: taskPriorities || [],
    kanbanTaskAssignees: kanbanOriginalTaskAssignees || [],
    kanbanLabels: kanbanOriginalLabels || [],
    kanbanPriorities: kanbanPriorities || [],
  })
);

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

const useFilterData = (position: 'board' | 'list'): FilterSection[] => {
  const { t } = useTranslation('task-list-filters');
  const [searchParams] = useSearchParams();
  const filterData = useAppSelector(selectFilterData);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const kanbanState = useAppSelector((state: RootState) => state.enhancedKanbanReducer);
  const kanbanProject = useAppSelector((state: RootState) => state.projectReducer.project);
  const isBoard = position === 'board';
  const tab = searchParams.get('tab');
  const currentProjectView = tab === 'tasks-list' ? 'list' : 'kanban';

  return useMemo(() => {
    if (isBoard) {
      const currentPriorities = kanbanState.priorities || [];
      const currentLabels = kanbanState.labels || [];
      const currentAssignees = kanbanState.taskAssignees || [];
      const groupByValue = kanbanState.groupBy || 'status';

      return [
        {
          id: 'priority',
          label: t('priorityText', { defaultValue: 'Priority' }),
          options: filterData.priorities.map((p: any) => ({
            id: p.id,
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
          icon: GroupOutlined,
          multiSelect: false,
          searchable: false,
          selectedValues: [groupByValue],
          options: [
            { id: 'status', label: t('statusText', { defaultValue: 'Status' }), value: 'status' },
            {
              id: 'priority',
              label: t('priorityText', { defaultValue: 'Priority' }),
              value: 'priority',
            },
            {
              id: 'phase',
              label:
                (kanbanProject as any)?.phase_label || t('phaseText', { defaultValue: 'Phase' }),
              value: 'phase',
            },
          ],
        },
      ];
    }

    const currentLabels =
      currentProjectView === 'list' ? filterData.taskLabels : filterData.boardLabels;
    const currentAssignees =
      currentProjectView === 'list' ? filterData.taskAssignees : filterData.boardAssignees;
    const groupByValue = currentGrouping || 'status';

    return [
      {
        id: 'priority',
        label: t('priorityText', { defaultValue: 'Priority' }),
        options: filterData.priorities.map((p: any) => ({
          id: p.id,
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
        icon: GroupOutlined,
        multiSelect: false,
        searchable: false,
        selectedValues: [groupByValue],
        options: [
          { id: 'status', label: t('statusText', { defaultValue: 'Status' }), value: 'status' },
          {
            id: 'priority',
            label: t('priorityText', { defaultValue: 'Priority' }),
            value: 'priority',
          },
          {
            id: 'phase',
            label: filterData.project?.phase_label || t('phaseText', { defaultValue: 'Phase' }),
            value: 'phase',
          },
        ],
      },
    ];
  }, [isBoard, kanbanState, kanbanProject, filterData, currentProjectView, t, currentGrouping]);
};

const ImprovedTaskFiltersContainer: React.FC<ImprovedTaskFiltersProps> = ({
  position,
  className = '',
}) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const currentTaskAssignees = useAppSelector(state => state.taskReducer.taskAssignees);
  const currentTaskLabels = useAppSelector(state => state.taskReducer.labels);
  const kanbanState = useAppSelector((state: RootState) => state.enhancedKanbanReducer);
  const taskManagementArchived = useAppSelector(selectArchived);
  const enhancedKanbanArchived = useAppSelector(state => state.enhancedKanbanReducer.archived);
  const showArchived = position === 'list' ? taskManagementArchived : enhancedKanbanArchived;
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
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const debouncedFilterChangeRef = useRef<
    (((projectId: string) => void) & { cancel: () => void }) | null
  >(null);
  const debouncedSearchChangeRef = useRef<
    (((projectId: string, value: string) => void) & { cancel: () => void }) | null
  >(null);
  const debouncedGroupBySaveRef = useRef<
    (((projectId: string, view: 'list' | 'board', groupBy: string) => void) & { cancel: () => void }) | null
  >(null);
  const filterSectionsData = useFilterData(position);
  const isDataLoaded = useMemo(() => filterSectionsData.length > 0, [filterSectionsData]);
  const memoizedFilterSections = useMemo(() => filterSectionsData, [filterSectionsData]);
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const { projectId } = useAppSelector(state => state.projectReducer);
  const projectPhaseLabel = useAppSelector(state => state.projectReducer.project?.phase_label);
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const canConfigure = isOwnerOrAdmin || isProjectManager;
  const currentGroupBySection = filterSectionsData.find(s => s.id === 'groupBy');
  const currentGroupByValue = currentGroupBySection?.selectedValues[0] || 'status';
  const sortFields = useAppSelector(state => state.taskReducer.fields);
  const taskManagementSortField = useAppSelector(selectSortField);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setShowOverflowMenu(width < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const hasChanged = JSON.stringify(filterSections) !== JSON.stringify(memoizedFilterSections);
    if (hasChanged && memoizedFilterSections.length > 0) {
      setFilterSections(memoizedFilterSections);
    }
  }, [memoizedFilterSections, filterSections]);

  const overflowMenuItems = useMemo(() => {
    const items: any[] = [
      {
        key: 'group-by-header',
        type: 'group',
        label: (
          <span className="font-semibold">{t('groupByText', { defaultValue: 'Group by' })}</span>
        ),
        children: [
          {
            key: 'group-by-status',
            label: (
              <div className="flex items-center justify-between w-full">
                <span>{t('statusText', { defaultValue: 'Status' })}</span>
                {currentGroupByValue === 'status' && (
                  <CheckOutlined className="text-blue-500 ml-2" />
                )}
              </div>
            ),
          },
          {
            key: 'group-by-priority',
            label: (
              <div className="flex items-center justify-between w-full">
                <span>{t('priorityText', { defaultValue: 'Priority' })}</span>
                {currentGroupByValue === 'priority' && (
                  <CheckOutlined className="text-blue-500 ml-2" />
                )}
              </div>
            ),
          },
          {
            key: 'group-by-phase',
            label: (
              <div className="flex items-center justify-between w-full">
                <span>{projectPhaseLabel || t('phaseText', { defaultValue: 'Phase' })}</span>
                {currentGroupByValue === 'phase' && (
                  <CheckOutlined className="text-blue-500 ml-2" />
                )}
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

  useEffect(() => {
    debouncedFilterChangeRef.current = createDebouncedFunction((nextProjectId: string) => {
      dispatch(fetchTasksV3(nextProjectId));
    }, FILTER_DEBOUNCE_DELAY);

    debouncedSearchChangeRef.current = createDebouncedFunction(
      (nextProjectId: string, value: string) => {
        dispatch(setTaskManagementSearch(value));
        dispatch(fetchTasksV3(nextProjectId));
      },
      SEARCH_DEBOUNCE_DELAY
    );

    debouncedGroupBySaveRef.current = createDebouncedFunction(
      (nextProjectId: string, view: 'list' | 'board', groupBy: string) => {
        const body =
          view === 'list'
            ? { project_id: nextProjectId, task_list_group_by: groupBy }
            : { project_id: nextProjectId, board_group_by: groupBy };
        projectsApiService.updateDefaultTab(body).catch(err => {
          console.warn('Failed to save group-by preference:', err);
        });
      },
      800
    );

    return () => {
      debouncedFilterChangeRef.current?.cancel();
      debouncedSearchChangeRef.current?.cancel();
      debouncedGroupBySaveRef.current?.cancel();
    };
  }, [dispatch]);

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
          // Persist board groupBy preference
          debouncedGroupBySaveRef.current?.(projectId, 'board', values[0]);
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
            if (assignee.selected) {
              dispatch(setTaskAssigneeSelection({ id: assignee.id, selected: false }));
            }
          });
          values.forEach(id => {
            dispatch(setTaskAssigneeSelection({ id, selected: true }));
          });
          dispatch(fetchEnhancedKanbanGroups(projectId));
          return;
        }
        if (sectionId === 'labels') {
          const currentLabels = kanbanState.labels || [];
          currentLabels.forEach((label: any) => {
            if (label.selected) {
              dispatch(setLabelSelection({ id: label.id, selected: false }));
            }
          });
          values.forEach(id => {
            dispatch(setLabelSelection({ id, selected: true }));
          });
          dispatch(fetchEnhancedKanbanGroups(projectId));
        }
        return;
      }

      if (sectionId === 'groupBy' && values.length > 0) {
        dispatch(setCurrentGrouping(values[0] as 'status' | 'priority' | 'phase'));
        dispatch(fetchTasksV3(projectId));
        // Persist task list groupBy preference
        debouncedGroupBySaveRef.current?.(projectId, 'list', values[0]);
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
        return;
      }

      dispatch(setTaskManagementSearch(value));
      debouncedSearchChangeRef.current?.(projectId, value);
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
      const clearedLabels = currentTaskLabels.map(label => ({
        ...label,
        selected: false,
      }));
      dispatch(setLabels(clearedLabels));

      const clearedAssignees = currentTaskAssignees.map(member => ({
        ...member,
        selected: false,
      }));
      dispatch(setMembers(clearedAssignees));
      dispatch(setPriorities([]));
      dispatch(setFields([]));
      dispatch(setSort({ field: '', order: 'ASC' }));

      if (position === 'list') {
        dispatch(setTaskManagementArchived(false));
      } else {
        dispatch(setKanbanArchived(false));
      }

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
      if (projectId) {
        dispatch(fetchEnhancedKanbanGroups(projectId));
      }
      return;
    }

    dispatch(toggleTaskManagementArchived());
    if (projectId) {
      dispatch(fetchTasksV3(projectId));
    }
  }, [dispatch, projectId, position, showArchived]);

  const handleOverflowMenuClick = (info: { key: string }) => {
    const { key } = info;

    if (key === 'group-by-status') {
      if (position === 'board') {
        dispatch(setKanbanGroupBy('status' as any));
        if (projectId) dispatch(fetchEnhancedKanbanGroups(projectId));
      } else {
        dispatch(setCurrentGrouping('status'));
        if (projectId) dispatch(fetchTasksV3(projectId));
      }
      if (projectId) debouncedGroupBySaveRef.current?.(projectId, position === 'board' ? 'board' : 'list', 'status');
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
      if (projectId) debouncedGroupBySaveRef.current?.(projectId, position === 'board' ? 'board' : 'list', 'priority');
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
      if (projectId) debouncedGroupBySaveRef.current?.(projectId, position === 'board' ? 'board' : 'list', 'phase');
      return;
    }

    if (key === 'manage-statuses') {
      setShowManageStatusModal(true);
      return;
    }

    if (key === 'manage-phases') {
      setShowManagePhaseModal(true);
    }
  };

  return (
    <div
      className={`${themeClasses.containerBg} border ${themeClasses.containerBorder} rounded-md p-1.5 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 min-h-[36px]">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <SearchFilter
            value={searchValue}
            onChange={handleSearchChange}
            placeholder={t('searchTasks', { defaultValue: 'Search tasks by name or key...' })}
            themeClasses={themeClasses}
          />

          {position === 'list' && (
            <SortDropdown themeClasses={themeClasses} isDarkMode={isDarkMode} />
          )}

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
            <div
              className={`flex items-center gap-2 px-2.5 py-1.5 text-xs ${themeClasses.secondaryText}`}
            >
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-500"></div>
              <span>{t('loadingFilters', { defaultValue: 'Loading Filters' })}</span>
            </div>
          )}

          {showOverflowMenu && (
            <Dropdown
              className="task-filters-overflow-menu"
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
                  border transition-all duration-200 ease-in-out flex-shrink-0
                  ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}
                  hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                  ${isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
                `}
              >
                <MenuOutlined className="w-3.5 h-3.5" />
                <span>{t('more', { defaultValue: 'More' })}</span>
              </button>
            </Dropdown>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto min-w-0 shrink-0">
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5">
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
                {clearingFilters
                  ? t('clearing', { defaultValue: 'Clearing' })
                  : t('clearAll', { defaultValue: 'Clear All' })}
              </button>
            </div>
          )}

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
            <span className={`text-xs ${themeClasses.optionText}`}>
              {t('showArchivedText', { defaultValue: 'Show Archived' })}
            </span>
          </label>

          {position === 'list' && (
            <FieldsDropdown
              themeClasses={themeClasses}
              isDarkMode={isDarkMode}
              createDebouncedFunction={createDebouncedFunction}
            />
          )}
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

export default React.memo(ImprovedTaskFiltersContainer);
