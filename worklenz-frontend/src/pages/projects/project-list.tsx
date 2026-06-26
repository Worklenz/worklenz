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
import { ActionButtons } from '@/components/project-list/project-list-table/project-list-actions/project-list-actions';
import { CategoryCell } from '@/components/project-list/project-list-table/project-list-category/project-list-category';
import { ProgressListProgress } from '@/components/project-list/project-list-table/project-list-progress/progress-list-progress';
import { ProjectListUpdatedAt } from '@/components/project-list/project-list-table/project-list-updated-at/project-list-updated';
import { ProjectNameCell } from '@/components/project-list/project-list-table/project-name/project-name-cell';
import { ProjectRateCell } from '@/components/project-list/project-list-table/project-list-favorite/project-rate-cell';

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
  setFilteredPriorities,
  setRequestParams,
  setGroupedRequestParams,
  fetchGroupedProjects,
} from '@/features/projects/projectsSlice';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import { fetchProjectPriorities } from '@/features/projects/priority/projectPrioritySlice';
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
const DEFAULT_GROUPED_PROJECT_SORT_FIELD = 'priority';
const DEFAULT_GROUPED_PROJECT_SORT_ORDER = 'descend';
const SEARCH_QUERY_PARAM = 'search';
const PAGE_QUERY_PARAM = 'page';
const SIZE_QUERY_PARAM = 'size';

const parsePositiveIntegerParam = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
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

  const { mode: viewMode, groupBy } = useAppSelector(state => state.projectViewReducer);
  const { requestParams, groupedRequestParams, groupedProjects } = useAppSelector(
    state => state.projectsReducer
  );
  const { projectStatuses } = useAppSelector(state => state.projectStatusesReducer);
  const { projectHealths } = useAppSelector(state => state.projectHealthReducer);
  const { projectCategories } = useAppSelector(state => state.projectCategoriesReducer);
  const { priorities } = useAppSelector(state => state.projectPriorityReducer);
  const { filteredCategories, filteredStatuses, filteredPriorities } = useAppSelector(
    state => state.projectsReducer
  );

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
      priorities: requestParams.priorities, // FIX #2: now included because type is correct
    }),
    [requestParams]
  );

  const {
    data: projectsData,
    isLoading: loadingProjects,
    isFetching: isFetchingProjects,
    refetch: refetchProjects,
    error: projectsError,
  } = useGetProjectsQuery(optimizedQueryParams, {
    refetchOnMountOrArgChange: 30,
    refetchOnFocus: false,
    refetchOnReconnect: true,
    skip: viewMode === ProjectViewType.GROUP,
  });

  const buildGroupedParams = useCallback(
    (overrides: Partial<typeof groupedRequestParams> = {}) => ({
      ...groupedRequestParams,
      ...overrides,
      groupBy:
        overrides.groupBy || groupedRequestParams.groupBy || groupBy || ProjectGroupBy.PRIORITY,
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
            dispatch(setRequestParams({ search: searchTerm, index: 1 }));
          } else if (viewMode === ProjectViewType.GROUP) {
            const newGroupedParams = {
              ...(currentGroupedParams || {}),
              search: searchTerm,
              index: 1,
              groupBy: currentGroupedParams?.groupBy || currentGroupBy || ProjectGroupBy.PRIORITY,
            };
            dispatch(setGroupedRequestParams(newGroupedParams));
            dispatch(fetchGroupedProjects(newGroupedParams));
          }
        },
        SEARCH_DEBOUNCE_MS
      ),
    [dispatch, viewMode]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newSearchValue = e.target.value;
      if (newSearchValue.length > MAX_SEARCH_LENGTH) return;
      setSearchValue(newSearchValue);
      trackMixpanelEvent(evt_projects_search);
      debouncedSearch(newSearchValue, groupedRequestParams, groupBy);
    },
    [debouncedSearch, trackMixpanelEvent, groupedRequestParams, groupBy]
  );

  const getFilterIndex = useCallback(() => +(localStorage.getItem(FILTER_INDEX_KEY) || 0), []);
  const setFilterIndex = useCallback((index: number) => {
    localStorage.setItem(FILTER_INDEX_KEY, index.toString());
  }, []);
  const setSortingValues = useCallback((field: string, order: string) => {
    localStorage.setItem(PROJECT_SORT_FIELD, field);
    localStorage.setItem(PROJECT_SORT_ORDER, order);
  }, []);

  const filters = useMemo(() => Object.values(IProjectFilter), []);

  const segmentOptions = useMemo(() => {
    return filters.map(filter => ({ value: filter, label: t(filter.toLowerCase()) }));
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
        value: ProjectGroupBy.PRIORITY,
        label: t('groupBy.priority', { defaultValue: 'Priority' }),
      },
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

  const categoryFilters = useMemo(
    () => createFilters(projectCategories.map(c => ({ id: c.id || '', name: c.name || '' }))),
    [projectCategories]
  );

  const statusFilters = useMemo(
    () => createFilters(projectStatuses.map(s => ({ id: s.id || '', name: s.name || '' }))),
    [projectStatuses]
  );

  const priorityFilters = useMemo(
    () => createFilters(priorities.map(p => ({ id: p.id || '', name: p.name || '' }))),
    [priorities]
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

  const projectCount = useMemo(() => {
    if (viewMode === ProjectViewType.LIST) return projectsData?.body?.total || 0;
    return (
      groupedProjects.data?.data?.reduce((total, group) => total + group.project_count, 0) || 0
    );
  }, [viewMode, projectsData?.body?.total, groupedProjects.data?.data]);

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

  const tableDataSource = useMemo(
    () => projectsData?.body?.data || [],
    [projectsData?.body?.data]
  );

  useEffect(() => {
    if (projectsError) {
      setErrorMessage(
        t('errors.loadFailed', { defaultValue: 'Failed to load projects. Please try again.' })
      );
    } else {
      setErrorMessage(null);
    }
  }, [projectsError, t]);

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

  const paginationShowTotal = useMemo(
    () => (total: number, range: [number, number]) => {
      let groupedLabel = t('groups', { defaultValue: 'groups' });

      if (groupBy === ProjectGroupBy.CATEGORY) {
        groupedLabel = t('groupBy.categories', { defaultValue: 'categories' });
      } else if (groupBy === ProjectGroupBy.PRIORITY) {
        groupedLabel = t('groupBy.priorities', { defaultValue: 'priorities' });
      } else if (groupBy === ProjectGroupBy.CLIENT) {
        groupedLabel = t('groupBy.clients', { defaultValue: 'clients' });
      }

      return `${range[0]}-${range[1]} of ${total} ${groupedLabel}`;
    },
    [groupBy, t]
  );

  const handleTableChange = useCallback(
    (
      newPagination: TablePaginationConfig,
      filters: Record<string, FilterValue | null>,
      sorter: SorterResult<IProjectViewModel> | SorterResult<IProjectViewModel>[]
    ) => {
      const updates: Partial<typeof requestParams> = {};
      let hasChanges = false;

      // Handle page and page-size changes
      const newPage = newPagination.current ?? 1;
      const newSize = newPagination.pageSize ?? DEFAULT_PAGE_SIZE;
      if (newPage !== requestParams.index || newSize !== requestParams.size) {
        updates.index = newPage;
        updates.size = newSize;
        hasChanges = true;
      }

      if (filters?.status_id !== filteredInfo.status_id) {
        if (!filters?.status_id) {
          updates.statuses = null;
          dispatch(setFilteredStatuses([]));
        } else {
          updates.statuses = filters.status_id.join(' ');
          dispatch(setFilteredStatuses(filters.status_id as string[]));
        }
        hasChanges = true;
      }

      if (filters?.category_id !== filteredInfo.category_id) {
        if (!filters?.category_id) {
          updates.categories = null;
          dispatch(setFilteredCategories([]));
        } else {
          updates.categories = filters.category_id.join(' ');
          dispatch(setFilteredCategories(filters.category_id as string[]));
        }
        hasChanges = true;
      }

      if (filters?.priority_name !== filteredInfo.priority_name) {
        if (!filters?.priority_name) {
          updates.priorities = null;
          dispatch(setFilteredPriorities([]));
        } else {
          updates.priorities = filters.priority_name.join(' ');
          dispatch(setFilteredPriorities(filters.priority_name as string[]));
        }
        hasChanges = true;
      }

      const newOrder = Array.isArray(sorter) ? sorter[0].order : sorter.order;
      const newField = (
        Array.isArray(sorter) ? sorter[0].columnKey : sorter.columnKey
      ) as string;

      // Detect whether this onChange was triggered by a sort interaction or a
      // pagination interaction. Ant Design calls onChange for both — we must
      // not reset the page to 1 when the user is simply navigating pages.
      //
      // A sort interaction is happening when:
      //   - newOrder is truthy AND it differs from the stored order/field  (sort applied/changed)
      //   - newOrder is falsy  AND requestParams.order is a *user-applied* sort (sort cleared)
      //
      // The loop bug: previously, clearing a sort stored order='ascend'/field='name' in Redux,
      // but the table UI had no active sort arrow. Every subsequent pagination click arrived
      // with newOrder=undefined, hitting the !newOrder branch again and again, forcing
      // index=1 on every page click.
      //
      // Fix: use a sentinel value '' (empty string) to represent "no active sort" in Redux.
      // When order==='' we know no sort is active, so !newOrder no longer incorrectly
      // triggers the sort-cleared branch during a plain pagination click.
      const isSortCleared = !newOrder && !!requestParams.order;
      const isSortChanged =
        !!newOrder &&
        !!newField &&
        (newOrder !== requestParams.order || newField !== requestParams.field);

      if (isSortCleared) {
        // Sort was just removed by the user — reset to default and go back to page 1.
        // Use '' as sentinel so subsequent pagination clicks don't re-enter this branch.
        updates.order = '';
        updates.field = '';
        updates.index = 1;
        setSortingValues('', '');
        hasChanges = true;
      } else if (isSortChanged) {
        // Sort column or direction changed — reset to page 1 so the user sees
        // the first page of the newly sorted result set.
        updates.order = newOrder!;
        updates.field = newField;
        updates.index = 1;
        setSortingValues(newField, newOrder!);
        hasChanges = true;
      }
      // else: no sort change — this is a pure pagination or filter event.
      // Do not touch order/field/index here; the pagination block above
      // already set updates.index and updates.size if they changed.

      if (hasChanges) {
        dispatch(setRequestParams(updates));
        dispatch(setGroupedRequestParams(buildGroupedParams(updates)));
      }

      setFilteredInfo(filters);
    },
    [dispatch, setSortingValues, filteredInfo, requestParams, buildGroupedParams]
  );

  // FIX #3: removed the stale-closure guard that was blocking valid page changes.
  // Previously, if groupedRequestParams hadn't updated in Redux yet (stale closure),
  // newIndex !== groupedRequestParams.index could evaluate to false even though the
  // user clicked a different page, silently swallowing the pagination event.
  // Now we always dispatch with the full current params spread to avoid losing any field.
  const handleGroupedTableChange = useCallback(
    (newPagination: TablePaginationConfig) => {
      const newIndex = newPagination.current || 1;
      const newSize = newPagination.pageSize || DEFAULT_PAGE_SIZE;

      const updatedParams = {
        ...groupedRequestParams,
        index: newIndex,
        size: newSize,
      };
      dispatch(setGroupedRequestParams(updatedParams));
      dispatch(fetchGroupedProjects(updatedParams));
    },
    [dispatch, groupedRequestParams]
  );

  const handleSegmentChange = useCallback(
    (value: IProjectFilter) => {
      const newFilterIndex = filters.indexOf(value);
      setFilterIndex(newFilterIndex);
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
          groupBy: groupBy || ProjectGroupBy.PRIORITY,
          field: DEFAULT_GROUPED_PROJECT_SORT_FIELD,
          order: DEFAULT_GROUPED_PROJECT_SORT_ORDER,
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
        field:
          value === ProjectGroupBy.PRIORITY
            ? DEFAULT_GROUPED_PROJECT_SORT_FIELD
            : DEFAULT_PROJECT_SORT_FIELD,
        order:
          value === ProjectGroupBy.PRIORITY
            ? DEFAULT_GROUPED_PROJECT_SORT_ORDER
            : DEFAULT_PROJECT_SORT_ORDER,
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

  const handleProjectHover = useCallback((project_id: string | undefined) => {
    if (project_id) {
      import('@/pages/projects/projectView/project-view').catch(() => {});
    }
  }, []);

  // Column order: Favorite → Name → Client → Priority → Status → Tasks Progress → Category → Last Updated → Actions
  const tableColumns: ColumnsType<IProjectViewModel> = useMemo(
    () => [
      // 1. Favorite
      {
        title: '',
        dataIndex: 'favorite',
        key: 'favorite',
        width: 56,
        align: 'center',
        render: (text: string, record: IProjectViewModel) => (
          <ProjectRateCell key={record.id} t={t} record={record} />
        ),
      },
      // 2. Name
      {
        title: t('name'),
        dataIndex: 'name',
        key: 'name',
        width: 280,
        sorter: true,
        defaultSortOrder: DEFAULT_PROJECT_SORT_ORDER,
        render: (text: string, record: IProjectViewModel) => (
          <ProjectNameCell navigate={navigate} key={record.id} t={t} record={record} />
        ),
      },
      // 3. Client
      {
        title: t('client'),
        dataIndex: 'client_name',
        key: 'client_name',
        sorter: true,
      },
      // 4. Priority
      {
        title: t('priority', { defaultValue: 'Priority' }),
        dataIndex: 'priority_name',
        key: 'priority_name',
        filters: priorityFilters,
        filteredValue: filteredInfo.priority_name || filteredPriorities || [],
        filterMultiple: true,
        sorter: true,
        render: (_: string, record: IProjectViewModel) => {
          if (!record.priority_name) {
            return <span style={{ color: 'var(--ant-color-text-quaternary)' }}>—</span>;
          }
          const themeMode =
            document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
          const color = themeMode === 'dark' ? record.priority_color_dark : record.priority_color;
          return (
            <span style={{ color: color || undefined, fontWeight: 500, fontSize: 13 }}>
              {record.priority_name}
            </span>
          );
        },
      },
      // 5. Status
      {
        title: t('status'),
        dataIndex: 'status',
        key: 'status_id',
        filters: statusFilters,
        filteredValue: filteredInfo.status_id || filteredStatuses || [],
        filterMultiple: true,
        sorter: true,
      },
      // 6. Tasks Progress
      {
        title: t('tasksProgress'),
        dataIndex: 'tasksProgress',
        key: 'tasksProgress',
        render: (_: string, record: IProjectViewModel) => <ProgressListProgress record={record} />,
      },
      // 7. Category
      {
        title: t('category'),
        dataIndex: 'category_name',
        key: 'category_id',
        filters: categoryFilters,
        filteredValue: filteredInfo.category_id || filteredCategories || [],
        filterMultiple: true,
        sorter: true,
        render: (text: string, record: IProjectViewModel) => (
          <CategoryCell key={record.id} t={t} record={record} />
        ),
      },
      // 8. Last Updated
      {
        title: t('updated_at', { defaultValue: 'Last Updated' }),
        dataIndex: 'updated_at',
        key: 'updated_at',
        sorter: true,
        render: (_: string, record: IProjectViewModel) => <ProjectListUpdatedAt record={record} />,
      },
      // 9. Actions
      {
        title: '',
        key: 'button',
        dataIndex: '',
        width: 76,
        align: 'center',
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
      priorityFilters,
      filteredInfo,
      filteredCategories,
      filteredStatuses,
      filteredPriorities,
      navigate,
      dispatch,
      isOwnerOrAdmin,
    ]
  );

  useEffect(() => {
    const filterIndex = getFilterIndex();
    const initialParams = { filter: filterIndex };
    if (requestParams.filter !== filterIndex) dispatch(setRequestParams(initialParams));
    if (!groupedRequestParams.groupBy) {
      const initialGroupBy = groupBy || ProjectGroupBy.PRIORITY;
      dispatch(
        setGroupedRequestParams({
          filter: filterIndex,
          index: 1,
          size: DEFAULT_PAGE_SIZE,
          search: '',
          groupBy: initialGroupBy,
          statuses: null,
          categories: null,
          priorities: null,
          field:
            initialGroupBy === ProjectGroupBy.PRIORITY
              ? DEFAULT_GROUPED_PROJECT_SORT_FIELD
              : DEFAULT_PROJECT_SORT_FIELD,
          order:
            initialGroupBy === ProjectGroupBy.PRIORITY
              ? DEFAULT_GROUPED_PROJECT_SORT_ORDER
              : DEFAULT_PROJECT_SORT_ORDER,
        })
      );
    }
  }, [dispatch, getFilterIndex, groupBy, groupedRequestParams.groupBy, requestParams.filter]);

  useEffect(() => {
    if (hasHydratedSearchFromUrl.current) return;
    hasHydratedSearchFromUrl.current = true;
    const searchFromUrl = (urlSearchParams.get(SEARCH_QUERY_PARAM) || '').trim();
    if (!searchFromUrl) return;
    if (requestParams.search !== searchFromUrl)
      dispatch(setRequestParams({ search: searchFromUrl, index: 1 }));
    if (groupedRequestParams.search !== searchFromUrl)
      dispatch(setGroupedRequestParams(buildGroupedParams({ search: searchFromUrl, index: 1 })));
    setSearchValue(prevValue => (prevValue === searchFromUrl ? prevValue : searchFromUrl));
  }, [
    dispatch,
    urlSearchParams,
    requestParams.search,
    groupedRequestParams.search,
    buildGroupedParams,
  ]);

  useEffect(() => {
    if (hasHydratedPaginationFromUrl.current) return;
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
    if (Object.keys(listUpdates).length > 0) dispatch(setRequestParams(listUpdates));
    if (Object.keys(groupedUpdates).length > 0)
      dispatch(setGroupedRequestParams(buildGroupedParams(groupedUpdates)));
  }, [
    dispatch,
    urlSearchParams,
    requestParams.index,
    requestParams.size,
    buildGroupedParams,
  ]);

  useEffect(() => {
    trackMixpanelEvent(evt_projects_page_visit);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    if (viewMode === ProjectViewType.GROUP && groupBy) {
      const shouldUpdateParams =
        !groupedRequestParams.groupBy || groupedRequestParams.groupBy !== groupBy;
      if (shouldUpdateParams) {
        const updatedParams = buildGroupedParams({
          groupBy,
          index: groupedRequestParams.index || 1,
          size: groupedRequestParams.size || DEFAULT_PAGE_SIZE,
          field:
            groupedRequestParams.field ||
            (groupBy === ProjectGroupBy.PRIORITY
              ? DEFAULT_GROUPED_PROJECT_SORT_FIELD
              : DEFAULT_PROJECT_SORT_FIELD),
          order:
            groupedRequestParams.order ||
            (groupBy === ProjectGroupBy.PRIORITY
              ? DEFAULT_GROUPED_PROJECT_SORT_ORDER
              : DEFAULT_PROJECT_SORT_ORDER),
        });
        dispatch(setGroupedRequestParams(updatedParams));
        dispatch(fetchGroupedProjects(updatedParams));
      } else if (!groupedProjects.data) {
        dispatch(fetchGroupedProjects(groupedRequestParams));
      }
    }
  }, [
    dispatch,
    viewMode,
    groupBy,
    groupedRequestParams,
    groupedProjects.data,
    buildGroupedParams,
  ]);

  useEffect(() => {
    const loadLookups = async () => {
      const promises = [];
      if (projectStatuses.length === 0) promises.push(dispatch(fetchProjectStatuses()));
      if (projectCategories.length === 0) promises.push(dispatch(fetchProjectCategories()));
      if (projectHealths.length === 0) promises.push(dispatch(fetchProjectHealth()));
      if (priorities.length === 0) promises.push(dispatch(fetchProjectPriorities()));
      if (promises.length > 0) await Promise.allSettled(promises);
    };
    loadLookups();
  }, [dispatch, projectStatuses.length, projectCategories.length, projectHealths.length, priorities.length]);

  useEffect(() => {
    const currentSearch =
      viewMode === ProjectViewType.LIST ? requestParams.search : groupedRequestParams.search;
    setSearchValue(prevValue => {
      const n = currentSearch || '';
      return prevValue === n ? prevValue : n;
    });
  }, [requestParams.search, groupedRequestParams.search, viewMode]);

  useEffect(() => {
    const activeSearch =
      (viewMode === ProjectViewType.LIST ? requestParams.search : groupedRequestParams.search) ||
      '';
    const normalizedSearch = activeSearch.trim();
    const currentUrlSearch = (urlSearchParams.get(SEARCH_QUERY_PARAM) || '').trim();
    if (currentUrlSearch === normalizedSearch) return;
    setUrlSearchParams(
      prevParams => {
        const nextParams = new URLSearchParams(prevParams);
        if (normalizedSearch) nextParams.set(SEARCH_QUERY_PARAM, normalizedSearch);
        else nextParams.delete(SEARCH_QUERY_PARAM);
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

  useEffect(() => {
    const activeIndex =
      viewMode === ProjectViewType.LIST ? requestParams.index : groupedRequestParams.index;
    const activeSize =
      viewMode === ProjectViewType.LIST ? requestParams.size : groupedRequestParams.size;
    const desiredPage = (activeIndex || 1).toString();
    const desiredSize = (activeSize || DEFAULT_PAGE_SIZE).toString();
    const currentUrlPage = urlSearchParams.get(PAGE_QUERY_PARAM) || '';
    const currentUrlSize = urlSearchParams.get(SIZE_QUERY_PARAM) || '';
    if (currentUrlPage === desiredPage && currentUrlSize === desiredSize) return;
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

  useEffect(() => {
    const newLoadingState =
      viewMode === ProjectViewType.LIST
        ? loadingProjects || isFetchingProjects
        : groupedProjects.loading;
    if (isLoading !== newLoadingState) setIsLoading(newLoadingState);
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
                icon={
                  <SyncOutlined spin={isFetchingProjects || groupedProjects.loading} />
                }
                onClick={handleRefresh}
                aria-label={t('refreshProjects', { defaultValue: 'Refresh projects' })}
              />
            </Tooltip>
            <Segmented<IProjectFilter>
               className="project-filter-segmented"
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
      <Card
        className="project-card"
      >
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
            scroll={{ y: 'calc(100vh - 280px)' }}
            sticky
            onRow={record => ({
              onClick: () => navigateToProject(record.id, record.team_member_default_view),
              onMouseEnter: () => handleProjectHover(record.id),
            })}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)' }}>
            {/* Scrollable groups list — scrollbar sits flush at card border like List view */}
            <div className="project-group-scroll-container">
              <ProjectGroupList
                groups={transformedGroupedProjects}
                navigate={navigate}
                onProjectSelect={(id, defaultView) => navigateToProject(id, defaultView)}
                onArchive={() => {}}
                isOwnerOrAdmin={isOwnerOrAdmin}
                loading={groupedProjects.loading}
                t={t}
              />
            </div>
            {/* Pagination stays fixed below — never scrolls */}
            {!groupedProjects.loading &&
              groupedProjects.data?.data &&
              groupedProjects.data.data.length > 0 && (
                <div
                  style={{
                    flexShrink: 0,
                    padding: '8px 24px',
                    textAlign: 'right',
                    borderTop: '1px solid var(--ant-color-border)',
                  }}
                >
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
