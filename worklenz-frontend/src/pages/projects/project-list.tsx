import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProjectViewType, ProjectGroupBy } from '@/types/project/project.types';
import { setViewMode, setGroupBy } from '@features/project/project-view-slice';
import debounce from 'lodash-es/debounce';
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
import WorklenzPageHeader from '@/components/common/WorklenzPageHeader';
import {
  SearchOutlined,
  SyncOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
} from '@/shared/antd-imports';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';

import { ProjectDrawer } from '@/components/projects/project-drawer/project-drawer';
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
import { setProjectId } from '@/features/project/project.slice';
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

const SEARCH_DEBOUNCE_MS = 500;
const MAX_SEARCH_LENGTH = 100;
const DEFAULT_PROJECT_SORT_FIELD = 'name';
const DEFAULT_PROJECT_SORT_ORDER = 'ascend';
const SEARCH_QUERY_PARAM = 'search';
const PAGE_QUERY_PARAM = 'page';
const SIZE_QUERY_PARAM = 'size';

const parsePositiveIntegerParam = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const ProjectList: React.FC = () => {
  const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasHydratedSearchFromUrl = useRef(false);
  const hasHydratedPaginationFromUrl = useRef(false);

  const { t } = useTranslation('all-project-list');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
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

  const optimizedQueryParams = useMemo(
    () => ({
      index: requestParams.index,
      size: requestParams.size,
      field: requestParams.field,
      order: requestParams.order,
      search: requestParams.search,
      filter: requestParams.filter,
      statuses: requestParams.statuses,
      categories: requestParams.categories,
    }),
    [requestParams]
  );

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

  const buildGroupedParams = useCallback(
    (overrides: Partial<typeof groupedRequestParams> = {}) => ({
      ...groupedRequestParams,
      ...overrides,
      groupBy:
        overrides.groupBy || groupedRequestParams.groupBy || groupBy || ProjectGroupBy.CATEGORY,
    }),
    [groupedRequestParams, groupBy]
  );

  const debouncedSearch = useMemo(
    () =>
      debounce(
        (
          searchTerm: string,
          currentGroupedParams: typeof groupedRequestParams,
          currentGroupBy: string
        ) => {
          setErrorMessage(null);

          if (viewMode === ProjectViewType.LIST) {
            dispatch(
              setRequestParams({
                search: searchTerm,
                index: 1, // Reset to first page on search
              })
            );
          } else if (viewMode === ProjectViewType.GROUP) {
            const newGroupedParams = {
              ...(currentGroupedParams || {}),
              search: searchTerm,
              index: 1,
              groupBy: currentGroupedParams?.groupBy || currentGroupBy || ProjectGroupBy.CATEGORY,
            };
            dispatch(setGroupedRequestParams(newGroupedParams));
            dispatch(fetchGroupedProjects(newGroupedParams));
          }
        },
        SEARCH_DEBOUNCE_MS
      ),
    [dispatch, viewMode]
  );

  // Enhanced cleanup with better timeout management
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Improved search change handler with better validation
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newSearchValue = e.target.value;

      if (newSearchValue.length > MAX_SEARCH_LENGTH) {
        return;
      }

      setSearchValue(newSearchValue);
      trackMixpanelEvent(evt_projects_search);

      debouncedSearch(newSearchValue, groupedRequestParams, groupBy);
    },
    [debouncedSearch, trackMixpanelEvent, groupedRequestParams, groupBy]
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
          <Tooltip title={t('listView', { defaultValue: 'List View' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UnorderedListOutlined />
              <span>{t('list', { defaultValue: 'List' })}</span>
            </div>
          </Tooltip>
        ),
      },
      {
        value: ProjectViewType.GROUP,
        label: (
          <Tooltip title={t('groupView', { defaultValue: 'Group View' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AppstoreOutlined />
              <span>{t('group', { defaultValue: 'Group' })}</span>
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
        label: t('groupBy.category', { defaultValue: 'Category' }),
      },
      {
        value: ProjectGroupBy.CLIENT,
        label: t('groupBy.client', { defaultValue: 'Client' }),
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
      setErrorMessage(
        t('errors.loadFailed', { defaultValue: 'Failed to load projects. Please try again.' })
      );
    } else {
      setErrorMessage(null);
    }
  }, [projectsError, t]);

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
      setErrorMessage(
        t('errors.refreshFailed', { defaultValue: 'Failed to refresh projects. Please try again.' })
      );
    } finally {
      setIsLoading(false);
    }
  }, [trackMixpanelEvent, refetchProjects, viewMode, groupBy, dispatch, groupedRequestParams, t]);

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
    return <Empty description={t('noProjects', { defaultValue: 'No Projects' })} />;
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

      if (
        newOrder &&
        newField &&
        (newOrder !== requestParams.order || newField !== requestParams.field)
      ) {
        updates.order = newOrder ?? DEFAULT_PROJECT_SORT_ORDER;
        updates.field = newField ?? DEFAULT_PROJECT_SORT_FIELD;
        setSortingValues(updates.field, updates.order);
        hasChanges = true;
      }

      // Handle pagination
      if (
        newPagination.current !== requestParams.index ||
        newPagination.pageSize !== requestParams.size
      ) {
        updates.index = newPagination.current || 1;
        updates.size = newPagination.pageSize || DEFAULT_PAGE_SIZE;
        hasChanges = true;
      }

      // Only dispatch if there are actual changes
      if (hasChanges) {
        dispatch(setRequestParams(updates));
        dispatch(setGroupedRequestParams(buildGroupedParams(updates)));
      }

      setFilteredInfo(filters);
    },
    [dispatch, setSortingValues, filteredInfo, requestParams, buildGroupedParams]
  );

  // Optimized grouped table change handler
  const handleGroupedTableChange = useCallback(
    (newPagination: TablePaginationConfig) => {
      const newParams: Partial<typeof groupedRequestParams> = {
        index: newPagination.current || 1,
        size: newPagination.pageSize || DEFAULT_PAGE_SIZE,
      };

      // Only update if values actually changed
      if (
        newParams.index !== groupedRequestParams.index ||
        newParams.size !== groupedRequestParams.size
      ) {
        const updatedParams = buildGroupedParams(newParams);
        dispatch(setGroupedRequestParams(updatedParams));
        dispatch(fetchGroupedProjects(updatedParams));
      }
    },
    [dispatch, groupedRequestParams, buildGroupedParams]
  );

  // Optimized segment change handler with better state management
  const handleSegmentChange = useCallback(
    (value: IProjectFilter) => {
      const newFilterIndex = filters.indexOf(value);
      setFilterIndex(newFilterIndex);

      // Batch updates to reduce re-renders
      const baseUpdates = { filter: newFilterIndex, index: 1 };

      dispatch(setRequestParams(baseUpdates));
      dispatch(setGroupedRequestParams(buildGroupedParams(baseUpdates)));

      if (viewMode === ProjectViewType.GROUP && groupBy) {
        dispatch(fetchGroupedProjects(buildGroupedParams(baseUpdates)));
      }
    },
    [filters, setFilterIndex, dispatch, viewMode, groupBy, buildGroupedParams]
  );

  const handleViewToggle = useCallback(
    (value: ProjectViewType) => {
      dispatch(setViewMode(value));
      if (value === ProjectViewType.GROUP) {
        const newGroupedParams = buildGroupedParams({
          groupBy: groupBy || ProjectGroupBy.CATEGORY,
          search: requestParams.search,
          filter: requestParams.filter,
          statuses: requestParams.statuses,
          categories: requestParams.categories,
        });
        dispatch(setGroupedRequestParams(newGroupedParams));
        dispatch(fetchGroupedProjects(newGroupedParams));
      }
    },
    [dispatch, groupBy, requestParams, buildGroupedParams]
  );

  const handleGroupByChange = useCallback(
    (value: ProjectGroupBy) => {
      dispatch(setGroupBy(value));
      const newGroupedParams = buildGroupedParams({
        groupBy: value,
        index: 1,
      });
      dispatch(setGroupedRequestParams(newGroupedParams));
      dispatch(fetchGroupedProjects(newGroupedParams));
    },
    [dispatch, buildGroupedParams]
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
        defaultSortOrder: DEFAULT_PROJECT_SORT_ORDER,
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

    if (!groupedRequestParams.groupBy) {
      const initialGroupBy = groupBy || ProjectGroupBy.CATEGORY;
      dispatch(
        setGroupedRequestParams({
          filter: filterIndex,
          index: 1,
          size: DEFAULT_PAGE_SIZE,
          field: DEFAULT_PROJECT_SORT_FIELD,
          order: DEFAULT_PROJECT_SORT_ORDER,
          search: '',
          groupBy: initialGroupBy,
          statuses: null,
          categories: null,
        })
      );
    }
  }, [dispatch, getFilterIndex, groupBy, groupedRequestParams.groupBy, requestParams.filter]);

  // Hydrate search from URL once on initial load
  useEffect(() => {
    if (hasHydratedSearchFromUrl.current) {
      return;
    }
    hasHydratedSearchFromUrl.current = true;

    const searchFromUrl = (urlSearchParams.get(SEARCH_QUERY_PARAM) || '').trim();

    if (!searchFromUrl) {
      return;
    }

    if (requestParams.search !== searchFromUrl) {
      dispatch(
        setRequestParams({
          search: searchFromUrl,
          index: 1,
        })
      );
    }

    if (groupedRequestParams.search !== searchFromUrl) {
      dispatch(
        setGroupedRequestParams(
          buildGroupedParams({
            search: searchFromUrl,
            index: 1,
          })
        )
      );
    }

    setSearchValue(prevValue => (prevValue === searchFromUrl ? prevValue : searchFromUrl));
  }, [
    dispatch,
    urlSearchParams,
    requestParams.search,
    groupedRequestParams.search,
    buildGroupedParams,
  ]);

  // Hydrate pagination from URL once on initial load
  useEffect(() => {
    if (hasHydratedPaginationFromUrl.current) {
      return;
    }
    hasHydratedPaginationFromUrl.current = true;

    const pageFromUrl = parsePositiveIntegerParam(urlSearchParams.get(PAGE_QUERY_PARAM));
    const sizeFromUrl = parsePositiveIntegerParam(urlSearchParams.get(SIZE_QUERY_PARAM));

    const listUpdates: Partial<typeof requestParams> = {};
    const groupedUpdates: Partial<typeof groupedRequestParams> = {};

    if (pageFromUrl && pageFromUrl !== requestParams.index) {
      listUpdates.index = pageFromUrl;
      groupedUpdates.index = pageFromUrl;
    }

    if (sizeFromUrl && sizeFromUrl !== requestParams.size) {
      listUpdates.size = sizeFromUrl;
      groupedUpdates.size = sizeFromUrl;
    }

    if (Object.keys(listUpdates).length > 0) {
      dispatch(setRequestParams(listUpdates));
    }

    if (Object.keys(groupedUpdates).length > 0) {
      dispatch(setGroupedRequestParams(buildGroupedParams(groupedUpdates)));
    }
  }, [
    dispatch,
    urlSearchParams,
    requestParams.index,
    requestParams.size,
    buildGroupedParams,
  ]);

  // Separate effect for tracking page visits - only run once
  useEffect(() => {
    trackMixpanelEvent(evt_projects_page_visit);
  }, [trackMixpanelEvent]);

  // Enhanced effect for grouped projects - fetch data when in group view
  useEffect(() => {
    if (viewMode === ProjectViewType.GROUP && groupBy) {
      const shouldUpdateParams =
        !groupedRequestParams.groupBy || groupedRequestParams.groupBy !== groupBy;

      if (shouldUpdateParams) {
        const updatedParams = buildGroupedParams({
          groupBy: groupBy,
          index: groupedRequestParams.index || 1,
          size: groupedRequestParams.size || DEFAULT_PAGE_SIZE,
          field: groupedRequestParams.field || DEFAULT_PROJECT_SORT_FIELD,
          order: groupedRequestParams.order || DEFAULT_PROJECT_SORT_ORDER,
        });
        dispatch(setGroupedRequestParams(updatedParams));
        dispatch(fetchGroupedProjects(updatedParams));
      } else if (!groupedProjects.data) {
        dispatch(fetchGroupedProjects(groupedRequestParams));
      }
    }
  }, [dispatch, viewMode, groupBy, groupedRequestParams, groupedProjects.data, buildGroupedParams]);

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
  }, [dispatch, projectStatuses.length, projectCategories.length, projectHealths.length]);

  // Sync search input only when Redux search changes (e.g. external resets/view switches)
  useEffect(() => {
    const currentSearch =
      viewMode === ProjectViewType.LIST ? requestParams.search : groupedRequestParams.search;

    setSearchValue(prevValue => {
      const normalizedSearch = currentSearch || '';
      return prevValue === normalizedSearch ? prevValue : normalizedSearch;
    });
  }, [requestParams.search, groupedRequestParams.search, viewMode]);

  // Keep URL search query in sync with the active view search
  useEffect(() => {
    const activeSearch =
      (viewMode === ProjectViewType.LIST ? requestParams.search : groupedRequestParams.search) || '';
    const normalizedSearch = activeSearch.trim();
    const currentUrlSearch = (urlSearchParams.get(SEARCH_QUERY_PARAM) || '').trim();

    if (currentUrlSearch === normalizedSearch) {
      return;
    }

    setUrlSearchParams(
      prevParams => {
        const nextParams = new URLSearchParams(prevParams);

        if (normalizedSearch) {
          nextParams.set(SEARCH_QUERY_PARAM, normalizedSearch);
        } else {
          nextParams.delete(SEARCH_QUERY_PARAM);
        }

        return nextParams;
      },
      { replace: true }
    );
  }, [
    viewMode,
    requestParams.search,
    groupedRequestParams.search,
    urlSearchParams,
    setUrlSearchParams,
  ]);

  // Keep URL pagination query in sync with active view pagination
  useEffect(() => {
    const activeIndex =
      viewMode === ProjectViewType.LIST ? requestParams.index : groupedRequestParams.index;
    const activeSize = viewMode === ProjectViewType.LIST ? requestParams.size : groupedRequestParams.size;

    const normalizedPage = activeIndex || 1;
    const normalizedSize = activeSize || DEFAULT_PAGE_SIZE;

    const desiredPage = normalizedPage.toString();
    const desiredSize = normalizedSize.toString();
    const currentUrlPage = urlSearchParams.get(PAGE_QUERY_PARAM) || '';
    const currentUrlSize = urlSearchParams.get(SIZE_QUERY_PARAM) || '';

    const isSamePage = currentUrlPage === desiredPage;
    const isSameSize = currentUrlSize === desiredSize;

    if (isSamePage && isSameSize) {
      return;
    }

    setUrlSearchParams(
      prevParams => {
        const nextParams = new URLSearchParams(prevParams);
        nextParams.set(PAGE_QUERY_PARAM, desiredPage);
        nextParams.set(SIZE_QUERY_PARAM, desiredSize);

        return nextParams;
      },
      { replace: true }
    );
  }, [
    viewMode,
    requestParams.index,
    requestParams.size,
    groupedRequestParams.index,
    groupedRequestParams.size,
    urlSearchParams,
    setUrlSearchParams,
  ]);

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
      <WorklenzPageHeader
        className="site-page-header"
        title={`${projectCount} ${t('projects', { defaultValue: 'Projects' })}`}
        style={{ padding: '16px 0' }}
        extra={
          <Flex gap={8} align="center">
            <Tooltip title={t('refreshProjects', { defaultValue: 'Refresh projects' })}>
              <Button
                shape="circle"
                icon={<SyncOutlined spin={isFetchingProjects || groupedProjects.loading} />}
                onClick={handleRefresh}
                aria-label={t('refreshProjects', { defaultValue: 'Refresh projects' })}
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
              placeholder={t('placeholder', { defaultValue: 'Search projects' })}
              suffix={<SearchOutlined />}
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              aria-label={t('searchProjects', { defaultValue: 'Search projects' })}
              allowClear
              onClear={() => {
                setSearchValue('');
                debouncedSearch('', groupedRequestParams, groupBy);
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
              onProjectSelect={(id, defaultView) => navigateToProject(id, defaultView)}
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
