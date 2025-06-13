import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Skeleton,
  Table,
  TablePaginationConfig,
  Tooltip,
} from 'antd';
import { PageHeader } from '@ant-design/pro-components';
import {
  SearchOutlined,
  SyncOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
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
import { groupProjects } from '@/utils/project-group';

const createFilters = (items: { id: string; name: string }[]) =>
  items.map(item => ({ text: item.name, value: item.id })) as ColumnFilterItem[];

const ProjectList: React.FC = () => {
  const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const { t } = useTranslation('all-project-list');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  useDocumentTitle('Projects');
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Get view state from Redux
  const { mode: viewMode, groupBy } = useAppSelector((state) => state.projectViewReducer);
  const { requestParams, groupedRequestParams, groupedProjects } = useAppSelector(state => state.projectsReducer);
  const { projectStatuses } = useAppSelector(state => state.projectStatusesReducer);
  const { projectHealths } = useAppSelector(state => state.projectHealthReducer);
  const { projectCategories } = useAppSelector(state => state.projectCategoriesReducer);
  const { filteredCategories, filteredStatuses } = useAppSelector(
    state => state.projectsReducer
  );

  const {
    data: projectsData,
    isLoading: loadingProjects,
    isFetching: isFetchingProjects,
    refetch: refetchProjects,
  } = useGetProjectsQuery(requestParams);

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
  const categoryFilters = useMemo(() => 
    createFilters(
      projectCategories.map(category => ({ id: category.id || '', name: category.name || '' }))
    ), 
    [projectCategories]
  );

  // Memoize status filters to prevent unnecessary recalculations
  const statusFilters = useMemo(() => 
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
      return groupedProjects.data?.data?.reduce((total, group) => total + group.project_count, 0) || 0;
    }
  }, [viewMode, projectsData?.body?.total, groupedProjects.data?.data]);

  // Memoize the grouped projects data transformation
  const transformedGroupedProjects = useMemo(() => {
    return groupedProjects.data?.data?.map(group => ({
      groupKey: group.group_key,
      groupName: group.group_name,
      groupColor: group.group_color,
      projects: group.projects,
      count: group.project_count,
      totalProgress: 0,
      totalTasks: 0
    })) || [];
  }, [groupedProjects.data?.data]);

  // Memoize the table data source
  const tableDataSource = useMemo(() => 
    projectsData?.body?.data || [], 
    [projectsData?.body?.data]
  );

  // Memoize the empty text component
  const emptyText = useMemo(() => 
    <Empty description={t('noProjects')} />, 
    [t]
  );

  // Memoize the pagination show total function
  const paginationShowTotal = useMemo(() => 
    (total: number, range: [number, number]) => 
      `${range[0]}-${range[1]} of ${total} groups`,
    []
  );

  const handleTableChange = useCallback(
    (
      newPagination: TablePaginationConfig,
      filters: Record<string, FilterValue | null>,
      sorter: SorterResult<IProjectViewModel> | SorterResult<IProjectViewModel>[]
    ) => {
      const newParams: Partial<typeof requestParams> = {};
      if (!filters?.status_id) {
        newParams.statuses = null;
        dispatch(setFilteredStatuses([]));
      } else {
        newParams.statuses = filters.status_id.join(' ');
      }

      if (!filters?.category_id) {
        newParams.categories = null;
        dispatch(setFilteredCategories([]));
      } else {
        newParams.categories = filters.category_id.join(' ');
      }

      const newOrder = Array.isArray(sorter) ? sorter[0].order : sorter.order;
      const newField = (Array.isArray(sorter) ? sorter[0].columnKey : sorter.columnKey) as string;

      if (newOrder && newField) {
        newParams.order = newOrder ?? 'ascend';
        newParams.field = newField ?? 'name';
        setSortingValues(newParams.field, newParams.order);
      }

      newParams.index = newPagination.current || 1;
      newParams.size = newPagination.pageSize || DEFAULT_PAGE_SIZE;

      dispatch(setRequestParams(newParams));
      
      // Also update grouped request params to keep them in sync
      dispatch(setGroupedRequestParams({
        ...groupedRequestParams,
        statuses: newParams.statuses,
        categories: newParams.categories,
        order: newParams.order,
        field: newParams.field,
        index: newParams.index,
        size: newParams.size,
      }));
      
      setFilteredInfo(filters);
    },
    [dispatch, setSortingValues, groupedRequestParams]
  );

  const handleGroupedTableChange = useCallback(
    (newPagination: TablePaginationConfig) => {
      const newParams: Partial<typeof groupedRequestParams> = {
        index: newPagination.current || 1,
        size: newPagination.pageSize || DEFAULT_PAGE_SIZE,
      };
      dispatch(setGroupedRequestParams(newParams));
    },
    [dispatch, groupedRequestParams]
  );

  const handleRefresh = useCallback(() => {
    trackMixpanelEvent(evt_projects_refresh_click);
    if (viewMode === ProjectViewType.LIST) {
      refetchProjects();
    } else if (viewMode === ProjectViewType.GROUP && groupBy) {
      dispatch(fetchGroupedProjects(groupedRequestParams));
    }
  }, [trackMixpanelEvent, refetchProjects, viewMode, groupBy, dispatch, groupedRequestParams]);

  const handleSegmentChange = useCallback(
    (value: IProjectFilter) => {
      const newFilterIndex = filters.indexOf(value);
      setFilterIndex(newFilterIndex);
      
      // Update both request params for consistency
      dispatch(setRequestParams({ filter: newFilterIndex }));
      dispatch(setGroupedRequestParams({ 
        ...groupedRequestParams,
        filter: newFilterIndex,
        index: 1 // Reset to first page when changing filter
      }));
      
      // Refresh data based on current view mode
      if (viewMode === ProjectViewType.LIST) {
        refetchProjects();
      } else if (viewMode === ProjectViewType.GROUP && groupBy) {
        dispatch(fetchGroupedProjects({
          ...groupedRequestParams,
          filter: newFilterIndex,
          index: 1
        }));
      }
    },
    [filters, setFilterIndex, dispatch, refetchProjects, viewMode, groupBy, groupedRequestParams]
  );

  // Debounced search for grouped projects
  const debouncedGroupedSearch = useCallback(
    debounce((params: typeof groupedRequestParams) => {
      if (groupBy) {
        dispatch(fetchGroupedProjects(params));
      }
    }, 300),
    [dispatch, groupBy]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const searchValue = e.target.value;
      trackMixpanelEvent(evt_projects_search);
      
      // Update both request params for consistency
      dispatch(setRequestParams({ search: searchValue, index: 1 }));
      
      if (viewMode === ProjectViewType.GROUP) {
        const newGroupedParams = {
          ...groupedRequestParams,
          search: searchValue, 
          index: 1 
        };
        dispatch(setGroupedRequestParams(newGroupedParams));
        
        // Trigger debounced search in group mode
        debouncedGroupedSearch(newGroupedParams);
      }
    },
    [dispatch, trackMixpanelEvent, viewMode, groupedRequestParams, debouncedGroupedSearch]
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

  const navigateToProject = useCallback((project_id: string | undefined, default_view: string | undefined) => {
    if (project_id) {
      navigate(
        `/worklenz/projects/${project_id}?tab=${default_view === 'BOARD' ? 'board' : 'tasks-list'}&pinned_tab=${default_view === 'BOARD' ? 'board' : 'tasks-list'}`
      );
    }
  }, [navigate]);

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
        dataIndex: 'category',
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
        filteredValue: filteredInfo.status_id || [],
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
    [t, categoryFilters, statusFilters, filteredInfo, filteredCategories, filteredStatuses, navigate, dispatch, isOwnerOrAdmin]
  );

  useEffect(() => {
    if (viewMode === ProjectViewType.LIST) {
      setIsLoading(loadingProjects || isFetchingProjects);
    } else {
      setIsLoading(groupedProjects.loading);
    }
  }, [loadingProjects, isFetchingProjects, viewMode, groupedProjects.loading]);

  useEffect(() => {
    const filterIndex = getFilterIndex();
    dispatch(setRequestParams({ filter: filterIndex }));
    // Also sync with grouped request params on initial load
    dispatch(setGroupedRequestParams({ 
      filter: filterIndex,
      index: 1,
      size: DEFAULT_PAGE_SIZE,
      field: 'name',
      order: 'ascend',
      search: '',
      groupBy: '',
      statuses: null,
      categories: null,
    }));
  }, [dispatch, getFilterIndex]);

  useEffect(() => {
    trackMixpanelEvent(evt_projects_page_visit);
    if (viewMode === ProjectViewType.LIST) {
      refetchProjects();
    }
  }, [requestParams, refetchProjects, trackMixpanelEvent, viewMode]);

  // Separate useEffect for grouped projects
  useEffect(() => {
    if (viewMode === ProjectViewType.GROUP && groupBy) {
      dispatch(fetchGroupedProjects(groupedRequestParams));
    }
  }, [dispatch, viewMode, groupBy, groupedRequestParams]);

  useEffect(() => {
    if (projectStatuses.length === 0) dispatch(fetchProjectStatuses());
    if (projectCategories.length === 0) dispatch(fetchProjectCategories());
    if (projectHealths.length === 0) dispatch(fetchProjectHealth());
  }, [dispatch, projectStatuses.length, projectCategories.length, projectHealths.length]);

  return (
    <div style={{ marginBlock: 65, minHeight: '90vh' }}>
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
            <Segmented
              options={viewToggleOptions}
              value={viewMode}
              onChange={handleViewToggle}
            />
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
              value={requestParams.search}
              onChange={handleSearchChange}
              aria-label="Search projects"
            />
            {isOwnerOrAdmin && <CreateProjectButton />}
          </Flex>
        }
      />
      <Card className="project-card">
        <Skeleton active loading={isLoading} className="mt-4 p-4">
          {viewMode === ProjectViewType.LIST ? (
            <Table<IProjectViewModel>
              columns={tableColumns}
              dataSource={tableDataSource}
              rowKey={record => record.id || ''}
              loading={loadingProjects}
              size="small"
              onChange={handleTableChange}
              pagination={paginationConfig}
              locale={{ emptyText }}
              onRow={record => ({
                onClick: () => navigateToProject(record.id, record.team_member_default_view),
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
              {!groupedProjects.loading && groupedProjects.data?.data && groupedProjects.data.data.length > 0 && (
                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <Pagination
                    {...groupedPaginationConfig}
                    onChange={(page, pageSize) => handleGroupedTableChange({ current: page, pageSize })}
                    showTotal={paginationShowTotal}
                  />
                </div>
              )}
            </div>
          )}
        </Skeleton>
      </Card>

      {createPortal(<ProjectDrawer onClose={handleDrawerClose} />, document.body, 'project-drawer')}
    </div>
  );
};

export default ProjectList;