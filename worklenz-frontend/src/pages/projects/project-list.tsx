import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProjectViewType, ProjectGroupBy } from '@/types/project/project.types';
import { setViewMode, setGroupBy } from '@features/project/project-view-slice';
import debounce from 'lodash/debounce';
import {
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Pagination,
  Segmented,
  Select,
  Table,
  TablePaginationConfig,
  Tooltip,
} from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import {
  SearchOutlined,
  SyncOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
} from '@/shared/antd-imports';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';

import ProjectDrawer from '@/components/projects/project-drawer/project-drawer';
import CreateProjectButton from '@/components/projects/project-create-button/project-create-button';
import { ColumnsType } from 'antd/es/table';
import { ColumnFilterItem } from 'antd/es/table/interface';
import Avatars from '@/components/avatars/avatars';
import { ActionButtons } from '@/components/project-list/project-list-table/project-list-actions/project-list-actions';
import { CategoryCell } from '@/components/project-list/project-list-table/project-list-category/project-list-category';
import { ProgressListProgress } from '@/components/project-list/project-list-table/project-list-progress/progress-list-progress';
import { ProjectListUpdatedAt } from '@/components/project-list/project-list-table/project-list-updated-at/project-list-updated';
import { ProjectNameCell } from '@/components/project-list/project-list-table/project-name/project-name-cell';
import { ProjectRateCell } from '@/components/project-list/project-list-table/project-list-favorite/project-rate-cell';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';

import { useGetProjectsQuery } from '@/api/projects/projects.v1.api.service';

import {
  DEFAULT_PAGE_SIZE,
  FILTER_INDEX_KEY,
  PAGE_SIZE_OPTIONS,
  PROJECT_SORT_FIELD,
  PROJECT_SORT_ORDER,
} from '@/shared/constants';

import { IProjectFilter } from '@/types/project/project.types';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';

import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import './project-list.css';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setFilteredCategories,
  setFilteredStatuses,
  setRequestParams,
  setGroupedRequestParams,
  fetchGroupedProjects,
} from '@/features/projects/projectsSlice';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import { setProjectId, setStatuses } from '@/features/project/project.slice';
import { setProject } from '@/features/project/project.slice';
import { createPortal } from 'react-dom';
import {
  evt_projects_page_visit,
  evt_projects_refresh_click,
  evt_projects_search,
} from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import ProjectGroupList from '@/components/project-list/project-group/project-group-list';

// Lazy load the survey modal
const SurveyPromptModal = React.lazy(() =>
  import('@/components/survey/SurveyPromptModal').then(m => ({ default: m.SurveyPromptModal }))
);

const createFilters = (items: { id: string; name: string }[]) =>
  items.map(item => ({ text: item.name, value: item.id })) as ColumnFilterItem[];

const ProjectList: React.FC = () => {
  const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastQueryParamsRef = useRef<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { t } = useTranslation('all-project-list');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  useDocumentTitle('Projects');
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Get view state from Redux
  const { mode: viewMode, groupBy } = useAppSelector(state => state.projectViewReducer);
  const { requestParams, groupedRequestParams, groupedProjects } = useAppSelector(
    state => state.projectsReducer
  );
  const { projectStatuses } = useAppSelector(state => state.projectStatusesReducer);
  const { projectHealths } = useAppSelector(state => state.projectHealthReducer);
  const { projectCategories } = useAppSelector(state => state.projectCategoriesReducer);
  const { filteredCategories, filteredStatuses } = useAppSelector(state => state.projectsReducer);

  // Optimize query parameters to prevent unnecessary re-renders
  const optimizedQueryParams = useMemo(() => {
    const params = {
      index: requestParams.index,
      size: requestParams.size,
      field: requestParams.field,
      order: requestParams.order,
      search: requestParams.search,
      filter: requestParams.filter,
      statuses: requestParams.statuses,
      categories: requestParams.categories,
    };
    
    // Create a stable key for comparison
    const paramsKey = JSON.stringify(params);
    
    // Only return new params if they've actually changed
    if (paramsKey !== lastQueryParamsRef.current) {
      lastQueryParamsRef.current = paramsKey;
      return params;
    }
    
    // Return the previous params to maintain reference stability
    return JSON.parse(lastQueryParamsRef.current || '{}');
  }, [requestParams]);

  // Use the optimized query with better error handling and caching
  const {
    data: projectsData,
    isLoading: loadingProjects,
    isFetching: isFetchingProjects,
    refetch: refetchProjects,
    error: projectsError,
  } = useGetProjectsQuery(optimizedQueryParams, {
    // Enable caching and reduce unnecessary refetches
    refetchOnMountOrArgChange: 30, // Refetch if data is older than 30 seconds
    refetchOnFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Refetch on network reconnect
    // Skip query if we're in group view mode
    skip: viewMode === ProjectViewType.GROUP,
  });



  // Add performance monitoring
  const performanceRef = useRef<{ startTime: number | null }>({ startTime: null });

  // Monitor query performance
  useEffect(() => {
    if (loadingProjects && !performanceRef.current.startTime) {
      performanceRef.current.startTime = performance.now();
    } else if (!loadingProjects && performanceRef.current.startTime) {
      performanceRef.current.startTime = null;
    }
  }, [loadingProjects]);

  // Optimized debounced search with better cleanup and performance
  const debouncedSearch = useCallback(
    debounce((searchTerm: string) => {      
      // Clear any error messages when starting a new search
      setErrorMessage(null);
      
      if (viewMode === ProjectViewType.LIST) {
        dispatch(setRequestParams({ 
          search: searchTerm, 
          index: 1 // Reset to first page on search
        }));
      } else if (viewMode === ProjectViewType.GROUP) {
        const newGroupedParams = {
          ...groupedRequestParams,
          search: searchTerm,
          index: 1,
        };
        dispatch(setGroupedRequestParams(newGroupedParams));
        
        // Add timeout for grouped search to prevent rapid API calls
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        
        searchTimeoutRef.current = setTimeout(() => {
          dispatch(fetchGroupedProjects(newGroupedParams));
        }, 100);
      }
    }, 500), // Increased debounce time for better performance
    [dispatch, viewMode, groupedRequestParams]
  );

  // Enhanced cleanup with better timeout management
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, [debouncedSearch]);

  // Improved search change handler with better validation
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newSearchValue = e.target.value;
      
      // Validate input length to prevent excessive API calls
      if (newSearchValue.length > 100) {
        return; // Prevent extremely long search terms
      }
      
      setSearchValue(newSearchValue);
      trackMixpanelEvent(evt_projects_search);
      
      // Clear any existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      
      // Debounce the actual search execution
      debouncedSearch(newSearchValue);
    },
    [debouncedSearch, trackMixpanelEvent]
  );

  const getFilterIndex = useCallback(() => {
    return +(localStorage.getItem(FILTER_INDEX_KEY) || 0);
  }, []);

  const setFilterIndex = useCallback((index: number) => {
    localStorage.setItem(FILTER_INDEX_KEY, index.toString());
  }, []);

  const setSortingValues = useCallback((field: string, order: string) => {
    localStorage.setItem(PROJECT_SORT_FIELD, field);
    localStorage.setItem(PROJECT_SORT_ORDER, order);
  }, []);

  const filters = useMemo(() => Object.values(IProjectFilter), []);

  const segmentOptions = useMemo(() => {
    return filters.map(filter => ({
      value: filter,
      label: t(filter.toLowerCase()),
    }));
  }, [filters, t]);

  const viewToggleOptions = useMemo(
    () => [
      {
        value: ProjectViewType.LIST,
        label: (
          <Tooltip title={t('listView')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UnorderedListOutlined />
              <span>{t('list')}</span>
            </div>
          </Tooltip>
        ),
      },
      {
        value: ProjectViewType.GROUP,
        label: (
          <Tooltip title={t('groupView')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AppstoreOutlined />
              <span>{t('group')}</span>
            </div>
          </Tooltip>
        ),
      },
    ],
    [t]
  );

  const groupByOptions = useMemo(
    () => [
      {
        value: ProjectGroupBy.CATEGORY,
        label: t('groupBy.category'),
      },
      {
        value: ProjectGroupBy.CLIENT,
        label: t('groupBy.client'),
      },
    ],
    [t]
  );

  // Memoize category filters to prevent unnecessary recalculations
  const categoryFilters = useMemo(
    () =>
      createFilters(
        projectCategories.map(category => ({ id: category.id || '', name: category.name || '' }))
      ),
    [projectCategories]
  );

  // Memoize status filters to prevent unnecessary recalculations
  const statusFilters = useMemo(
    () =>
      createFilters(
        projectStatuses.map(status => ({ id: status.id || '', name: status.name || '' }))
      ),
    [projectStatuses]
  );

  const paginationConfig = useMemo(
    () => ({
      current: requestParams.index,
      pageSize: requestParams.size,
      showSizeChanger: true,
      defaultPageSize: DEFAULT_PAGE_SIZE,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      size: 'small' as const,
      total: projectsData?.body?.total,
    }),
    [requestParams.index, requestParams.size, projectsData?.body?.total]
  );

  const groupedPaginationConfig = useMemo(
    () => ({
      current: groupedRequestParams.index,
      pageSize: groupedRequestParams.size,
      showSizeChanger: true,
      defaultPageSize: DEFAULT_PAGE_SIZE,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      size: 'small' as const,
      total: groupedProjects.data?.total_groups || 0,
    }),
    [groupedRequestParams.index, groupedRequestParams.size, groupedProjects.data?.total_groups]
  );

  // Memoize the project count calculation for the header
  const projectCount = useMemo(() => {
    if (viewMode === ProjectViewType.LIST) {
      return projectsData?.body?.total || 0;
    } else {
      return (
        groupedProjects.data?.data?.reduce((total, group) => total + group.project_count, 0) || 0
      );
    }
  }, [viewMode, projectsData?.body?.total, groupedProjects.data?.data]);

  // Memoize the grouped projects data transformation
  const transformedGroupedProjects = useMemo(() => {
    return (
      groupedProjects.data?.data?.map(group => ({
        groupKey: group.group_key,
        groupName: group.group_name,
        groupColor: group.group_color,
        projects: group.projects,
        count: group.project_count,
        totalProgress: 0,
        totalTasks: 0,
      })) || []
    );
  }, [groupedProjects.data?.data]);

  // Memoize the table data source
  const tableDataSource = useMemo(() => projectsData?.body?.data || [], [projectsData?.body?.data]);

  // Handle query errors
  useEffect(() => {
    if (projectsError) {
      setErrorMessage('Failed to load projects. Please try again.');
    } else {
      setErrorMessage(null);
    }
  }, [projectsError]);

  // Optimized refresh handler with better error handling
  const handleRefresh = useCallback(async () => {
    try {
      trackMixpanelEvent(evt_projects_refresh_click);
      setIsLoading(true);
      setErrorMessage(null);
      
      if (viewMode === ProjectViewType.LIST) {
        await refetchProjects();
      } else if (viewMode === ProjectViewType.GROUP && groupBy) {
        await dispatch(fetchGroupedProjects(groupedRequestParams)).unwrap();
      }
    } catch (error) {
      setErrorMessage('Failed to refresh projects. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [trackMixpanelEvent, refetchProjects, viewMode, groupBy, dispatch, groupedRequestParams]);

  // Enhanced empty text with error handling
  const emptyContent = useMemo(() => {
    if (errorMessage) {
      return (
        <Empty 
          description={
            <div>
              <p>{errorMessage}</p>
              <Button type="primary" onClick={handleRefresh} loading={isLoading}>
                Retry
              </Button>
            </div>
          } 
        />
      );
    }
    return <Empty description={t('noProjects')} />;
  }, [errorMessage, handleRefresh, isLoading, t]);

  // Memoize the pagination show total function
  const paginationShowTotal = useMemo(
    () => (total: number, range: [number, number]) => `${range[0]}-${range[1]} of ${total} groups`,
    []
  );

  const handleTableChange = useCallback(
    (
      newPagination: TablePaginationConfig,
      filters: Record<string, FilterValue | null>,
      sorter: SorterResult<IProjectViewModel> | SorterResult<IProjectViewModel>[]
    ) => {
      // Batch all parameter updates to reduce re-renders
      const updates: Partial<typeof requestParams> = {};
      let hasChanges = false;

      // Handle status filters
      if (filters?.status_id !== filteredInfo.status_id) {
        if (!filters?.status_id) {
          updates.statuses = null;
          dispatch(setFilteredStatuses([]));
        } else {
          updates.statuses = filters.status_id.join(' ');
        }
        hasChanges = true;
      }

      // Handle category filters
      if (filters?.category_id !== filteredInfo.category_id) {
        if (!filters?.category_id) {
          updates.categories = null;
          dispatch(setFilteredCategories([]));
        } else {
          updates.categories = filters.category_id.join(' ');
        }
        hasChanges = true;
      }

      // Handle sorting
      const newOrder = Array.isArray(sorter) ? sorter[0].order : sorter.order;
      const newField = (Array.isArray(sorter) ? sorter[0].columnKey : sorter.columnKey) as string;

      if (newOrder && newField && (newOrder !== requestParams.order || newField !== requestParams.field)) {
        updates.order = newOrder ?? 'ascend';
        updates.field = newField ?? 'name';
        setSortingValues(updates.field, updates.order);
        hasChanges = true;
      }

      // Handle pagination
      if (newPagination.current !== requestParams.index || newPagination.pageSize !== requestParams.size) {
        updates.index = newPagination.current || 1;
        updates.size = newPagination.pageSize || DEFAULT_PAGE_SIZE;
        hasChanges = true;
      }

      // Only dispatch if there are actual changes
      if (hasChanges) {
        dispatch(setRequestParams(updates));

        // Also update grouped request params to keep them in sync
        dispatch(
          setGroupedRequestParams({
            ...groupedRequestParams,
            ...updates,
          })
        );
      }

      setFilteredInfo(filters);
    },
    [dispatch, setSortingValues, groupedRequestParams, filteredInfo, requestParams]
  );

  // Optimized grouped table change handler
  const handleGroupedTableChange = useCallback(
    (newPagination: TablePaginationConfig) => {
      const newParams: Partial<typeof groupedRequestParams> = {
        index: newPagination.current || 1,
        size: newPagination.pageSize || DEFAULT_PAGE_SIZE,
      };
      
      // Only update if values actually changed
      if (newParams.index !== groupedRequestParams.index || newParams.size !== groupedRequestParams.size) {
        dispatch(setGroupedRequestParams(newParams));
      }
    },
    [dispatch, groupedRequestParams]
  );

  // Optimized segment change handler with better state management
  const handleSegmentChange = useCallback(
    (value: IProjectFilter) => {
      const newFilterIndex = filters.indexOf(value);
      setFilterIndex(newFilterIndex);

      // Batch updates to reduce re-renders
      const baseUpdates = { filter: newFilterIndex, index: 1 };
      
      dispatch(setRequestParams(baseUpdates));
      dispatch(setGroupedRequestParams({
        ...groupedRequestParams,
        ...baseUpdates,
      }));

      // Only trigger data fetch for group view (list view will auto-refetch via query)
      if (viewMode === ProjectViewType.GROUP && groupBy) {
        dispatch(fetchGroupedProjects({
          ...groupedRequestParams,
          ...baseUpdates,
        }));
      }
    },
    [filters, setFilterIndex, dispatch, groupedRequestParams, viewMode, groupBy]
  );

  const handleViewToggle = useCallback(
    (value: ProjectViewType) => {
      dispatch(setViewMode(value));
      if (value === ProjectViewType.GROUP) {
        // Initialize grouped request params when switching to group view
        const newGroupedParams = {
          ...groupedRequestParams,
          groupBy: groupBy || ProjectGroupBy.CATEGORY,
          search: requestParams.search,
          filter: requestParams.filter,
          statuses: requestParams.statuses,
          categories: requestParams.categories,
        };
        dispatch(setGroupedRequestParams(newGroupedParams));
        // Fetch grouped data immediately
        dispatch(fetchGroupedProjects(newGroupedParams));
      }
    },
    [dispatch, groupBy, groupedRequestParams, requestParams]
  );

  const handleGroupByChange = useCallback(
    (value: ProjectGroupBy) => {
      dispatch(setGroupBy(value));
      const newGroupedParams = {
        ...groupedRequestParams,
        groupBy: value,
        index: 1, // Reset to first page when changing grouping
      };
      dispatch(setGroupedRequestParams(newGroupedParams));
      // Fetch new grouped data
      dispatch(fetchGroupedProjects(newGroupedParams));
    },
    [dispatch, groupedRequestParams]
  );

  const handleDrawerClose = useCallback(() => {
    dispatch(setProject({} as IProjectViewModel));
    dispatch(setProjectId(null));
  }, [dispatch]);

  const navigateToProject = useCallback(
    (project_id: string | undefined, default_view: string | undefined) => {
      if (project_id) {
        navigate(
          `/worklenz/projects/${project_id}?tab=${default_view === 'BOARD' ? 'board' : 'tasks-list'}&pinned_tab=${default_view === 'BOARD' ? 'board' : 'tasks-list'}`
        );
      }
    },
    [navigate]
  );

  // Preload project view components on hover for smoother navigation
  const handleProjectHover = useCallback((project_id: string | undefined) => {
    if (project_id) {
      // Preload the project view route to reduce loading time
      import('@/pages/projects/projectView/project-view').catch(() => {
        // Silently fail if preload doesn't work
      });

      // Also preload critical task management components
      import('@/components/task-management/task-list-board').catch(() => {
        // Silently fail if preload doesn't work
      });
    }
  }, []);

  // Define table columns directly in the component to avoid hooks order issues
  const tableColumns: ColumnsType<IProjectViewModel> = useMemo(
    () => [
      {
        title: '',
        dataIndex: 'favorite',
        key: 'favorite',
        render: (text: string, record: IProjectViewModel) => (
          <ProjectRateCell key={record.id} t={t} record={record} />
        ),
      },
      {
        title: t('name'),
        dataIndex: 'name',
        key: 'name',
        sorter: true,
        showSorterTooltip: false,
        defaultSortOrder: 'ascend',
        render: (text: string, record: IProjectViewModel) => (
          <ProjectNameCell navigate={navigate} key={record.id} t={t} record={record} />
        ),
      },
      {
        title: t('client'),
        dataIndex: 'client_name',
        key: 'client_name',
        sorter: true,
        showSorterTooltip: false,
      },
      {
        title: t('category'),
        dataIndex: 'category_name',
        key: 'category_id',
        filters: categoryFilters,
        filteredValue: filteredInfo.category_id || filteredCategories || [],
        filterMultiple: true,
        render: (text: string, record: IProjectViewModel) => (
          <CategoryCell key={record.id} t={t} record={record} />
        ),
        sorter: true,
      },
      {
        title: t('status'),
        dataIndex: 'status',
        key: 'status_id',
        filters: statusFilters,
        filteredValue: filteredInfo.status_id || filteredStatuses || [],
        filterMultiple: true,
        sorter: true,
      },
      {
        title: t('tasksProgress'),
        dataIndex: 'tasksProgress',
        key: 'tasksProgress',
        render: (_: string, record: IProjectViewModel) => <ProgressListProgress record={record} />,
      },
      {
        title: t('updated_at'),
        dataIndex: 'updated_at',
        key: 'updated_at',
        sorter: true,
        showSorterTooltip: false,
        render: (_: string, record: IProjectViewModel) => <ProjectListUpdatedAt record={record} />,
      },
      {
        title: t('members'),
        dataIndex: 'names',
        key: 'members',
        render: (members: InlineMember[]) => <Avatars members={members} />,
      },
      {
        title: '',
        key: 'button',
        dataIndex: '',
        render: (record: IProjectViewModel) => (
          <ActionButtons
            t={t}
            record={record}
            dispatch={dispatch}
            isOwnerOrAdmin={isOwnerOrAdmin}
          />
        ),
      },
    ],
    [
      t,
      categoryFilters,
      statusFilters,
      filteredInfo,
      filteredCategories,
      filteredStatuses,
      navigate,
      dispatch,
      isOwnerOrAdmin,
    ]
  );

  // Optimize useEffect hooks to reduce unnecessary API calls
  useEffect(() => {
    const filterIndex = getFilterIndex();
    const initialParams = { filter: filterIndex };
    
    // Only update if values are different
    if (requestParams.filter !== filterIndex) {
      dispatch(setRequestParams(initialParams));
    }
    
    // Initialize grouped request params with proper groupBy value
    if (!groupedRequestParams.groupBy) {
      const initialGroupBy = groupBy || ProjectGroupBy.CATEGORY;
      dispatch(setGroupedRequestParams({
        filter: filterIndex,
        index: 1,
        size: DEFAULT_PAGE_SIZE,
        field: 'name',
        order: 'ascend',
        search: '',
        groupBy: initialGroupBy,
        statuses: null,
        categories: null,
      }));
    }
  }, [dispatch, getFilterIndex, groupBy]); // Add groupBy to deps to handle initial state

  // Separate effect for tracking page visits - only run once
  useEffect(() => {
    trackMixpanelEvent(evt_projects_page_visit);
  }, [trackMixpanelEvent]);

  // Enhanced effect for grouped projects - fetch data when in group view
  useEffect(() => {
    // Fetch grouped projects when:
    // 1. View mode is GROUP
    // 2. We have a groupBy value (either from Redux or default)
    if (viewMode === ProjectViewType.GROUP && groupBy) {
      // Always ensure grouped request params are properly set with current groupBy
      const shouldUpdateParams = !groupedRequestParams.groupBy || groupedRequestParams.groupBy !== groupBy;
      
      if (shouldUpdateParams) {
        const updatedParams = {
          ...groupedRequestParams,
          groupBy: groupBy,
          // Ensure we have all required params for the API call
          index: groupedRequestParams.index || 1,
          size: groupedRequestParams.size || DEFAULT_PAGE_SIZE,
          field: groupedRequestParams.field || 'name',
          order: groupedRequestParams.order || 'ascend',
        };
        dispatch(setGroupedRequestParams(updatedParams));
        dispatch(fetchGroupedProjects(updatedParams));
      } else if (groupedRequestParams.groupBy === groupBy && !groupedProjects.data) {
        // Params are set correctly but we don't have data yet - fetch it
        dispatch(fetchGroupedProjects(groupedRequestParams));
      }
    }
  }, [dispatch, viewMode, groupBy, groupedRequestParams, groupedProjects.data]);

  // Optimize lookups loading - only fetch once
  useEffect(() => {
    const loadLookups = async () => {
      const promises = [];
      
      if (projectStatuses.length === 0) {
        promises.push(dispatch(fetchProjectStatuses()));
      }
      if (projectCategories.length === 0) {
        promises.push(dispatch(fetchProjectCategories()));
      }
      if (projectHealths.length === 0) {
        promises.push(dispatch(fetchProjectHealth()));
      }
      
      // Load all lookups in parallel
      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }
    };
    
    loadLookups();
  }, [dispatch]); // Remove length dependencies to avoid re-runs

  // Sync search input value with Redux state
  useEffect(() => {
    const currentSearch = viewMode === ProjectViewType.LIST ? requestParams.search : groupedRequestParams.search;
    if (searchValue !== (currentSearch || '')) {
      setSearchValue(currentSearch || '');
    }
  }, [requestParams.search, groupedRequestParams.search, viewMode]); // Remove searchValue from deps to prevent loops

  // Optimize loading state management
  useEffect(() => {
    let newLoadingState = false;
    
    if (viewMode === ProjectViewType.LIST) {
      newLoadingState = loadingProjects || isFetchingProjects;
    } else {
      newLoadingState = groupedProjects.loading;
    }
    
    // Only update if loading state actually changed
    if (isLoading !== newLoadingState) {
      setIsLoading(newLoadingState);
    }
  }, [loadingProjects, isFetchingProjects, viewMode, groupedProjects.loading, isLoading]);

  return (
    <div style={{ minHeight: '90vh' }}>
      <PageHeader
        className="site-page-header"
        title={`${projectCount} ${t('projects')}`}
        style={{ padding: '16px 0' }}
        extra={
          <Flex gap={8} align="center">
            <Tooltip title={t('refreshProjects')}>
              <Button
                shape="circle"
                icon={<SyncOutlined spin={isFetchingProjects} />}
                onClick={handleRefresh}
                aria-label="Refresh projects"
              />
            </Tooltip>
            <Segmented<IProjectFilter>
              options={segmentOptions}
              defaultValue={filters[getFilterIndex()] ?? filters[0]}
              onChange={handleSegmentChange}
            />
            <Segmented options={viewToggleOptions} value={viewMode} onChange={handleViewToggle} />
            {viewMode === ProjectViewType.GROUP && (
              <Select
                value={groupBy}
                onChange={handleGroupByChange}
                options={groupByOptions}
                style={{ width: 150 }}
              />
            )}
            <Input
              placeholder={t('placeholder')}
              suffix={<SearchOutlined />}
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              aria-label="Search projects"
              allowClear
              onClear={() => {
                setSearchValue('');
                debouncedSearch('');
              }}
            />
            {isOwnerOrAdmin && <CreateProjectButton />}
          </Flex>
        }
      />
      <Card className="project-card">
        {viewMode === ProjectViewType.LIST ? (
          <Table<IProjectViewModel>
            columns={tableColumns}
            dataSource={tableDataSource}
            rowKey={record => record.id || ''}
            loading={loadingProjects || isFetchingProjects}
            size="small"
            onChange={handleTableChange}
            pagination={paginationConfig}
            locale={{ emptyText: emptyContent }}
            onRow={record => ({
              onClick: () => navigateToProject(record.id, record.team_member_default_view),
              onMouseEnter: () => handleProjectHover(record.id),
            })}
          />
        ) : (
          <div>
            <ProjectGroupList
              groups={transformedGroupedProjects}
              navigate={navigate}
              onProjectSelect={id => navigateToProject(id, undefined)}
              onArchive={() => {}}
              isOwnerOrAdmin={isOwnerOrAdmin}
              loading={groupedProjects.loading}
              t={t}
            />
            {!groupedProjects.loading &&
              groupedProjects.data?.data &&
              groupedProjects.data.data.length > 0 && (
                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <Pagination
                    {...groupedPaginationConfig}
                    onChange={(page, pageSize) =>
                      handleGroupedTableChange({ current: page, pageSize })
                    }
                    showTotal={paginationShowTotal}
                  />
                </div>
              )}
          </div>
        )}
      </Card>

      {createPortal(<ProjectDrawer onClose={handleDrawerClose} />, document.body, 'project-drawer')}
      {createPortal(<SurveyPromptModal />, document.body, 'project-survey-modal')}
    </div>
  );
};

export default ProjectList;
