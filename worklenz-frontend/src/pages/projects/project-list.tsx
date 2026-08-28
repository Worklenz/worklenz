import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import debounce from 'lodash-es/debounce';

import { Button, Card, Empty, Table, Typography, theme } from '@/shared/antd-imports';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';

import ProjectGroupList from '@/components/project-list/project-group/project-group-list';
import { ProjectSettingsModal } from '@/components/projects/project-settings-modal/project-settings-modal';
import TablePagination from '@/components/TablePagination';

import { useGetProjectsQuery } from '@/api/projects/projects.v1.api.service';
import { setGroupBy, setViewMode } from '@features/project/project-view-slice';
import { setProject, setProjectId } from '@/features/project/project.slice';
import {
  fetchGroupedProjects,
  setGroupedRequestParams,
  setRequestParams,
} from '@/features/projects/projectsSlice';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useLatestRef } from '@/hooks/useLatestRef';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';

import {
  DEFAULT_PAGE_SIZE,
  FILTER_INDEX_KEY,
  PAGE_SIZE_OPTIONS,
  PROJECT_SORT_FIELD,
  PROJECT_SORT_ORDER,
} from '@/shared/constants';
import {
  evt_projects_page_visit,
  evt_projects_refresh_click,
  evt_projects_search,
} from '@/shared/worklenz-analytics-events';
import { IProjectFilter, ProjectGroupBy, ProjectViewType } from '@/types/project/project.types';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';

import { ProjectListToolbar } from './projectList/ProjectListToolbar';
import { useProjectListColumns } from './projectList/useProjectListColumns';
import { useProjectListFilterOptions } from './projectList/useProjectListFilterOptions';
import { useProjectListUrlSync } from './projectList/useProjectListUrlSync';
import {
  ColumnFilterValues,
  DEFAULT_GROUPED_PROJECT_SORT_FIELD,
  DEFAULT_GROUPED_PROJECT_SORT_ORDER,
  DEFAULT_PROJECT_SORT_FIELD,
  DEFAULT_PROJECT_SORT_ORDER,
  FILTERABLE_COLUMNS,
  PROJECT_FILTER_SEGMENTS,
  SEARCH_DEBOUNCE_MS,
  buildProjectRoute,
  isColumnVisible,
  normalizeFilterParam,
  serializeFilterValue,
} from './projectList/project-list.constants';
import './project-list.css';

const SurveyPromptModal = React.lazy(() =>
  import('@/components/survey/SurveyPromptModal').then(m => ({ default: m.SurveyPromptModal }))
);

// Fills the SimpleRailLayout pane's available height exactly (no viewport
// calc guessing) — the box takes its natural height, the card (flex: 1 in
// project-list.css) takes the rest, and only the card's own contents scroll.
const PAGE_STYLE: React.CSSProperties = {
  height: '100%',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};
const FILTER_BOX_STYLE: React.CSSProperties = {
  flexShrink: 0,
  marginBottom: 16,
  padding: '10px 12px',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  rowGap: 12,
  gap: 16,
};
const GROUP_VIEW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
};
// This wrapper is flex: 1 inside the card (see the JSX below), so its own
// flexed height is however much room is actually left after the filter box
// and TablePagination — no viewport calc to drift out of sync. The table's
// scroll.y is measured off this wrapper's real rendered height (see the
// ResizeObserver effect below), rather than a hand-tuned calc(100vh - Npx).
const TABLE_WRAPPER_STYLE: React.CSSProperties = { flex: 1, minHeight: 0, overflow: 'hidden' };

const EMPTY_PROJECTS: IProjectViewModel[] = [];
const EMPTY_FILTERED_INFO: Record<string, FilterValue | null> = {};

const getRowKey = (record: IProjectViewModel) => record.id || '';
const noop = () => {};

const readFilterIndex = () => {
  const stored = Number(localStorage.getItem(FILTER_INDEX_KEY));
  return Number.isInteger(stored) && stored >= 0 && stored < PROJECT_FILTER_SEGMENTS.length
    ? stored
    : 0;
};

const ProjectList: React.FC = () => {
  useDocumentTitle('Projects');

  const { t } = useTranslation('all-project-list');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { token } = theme.useToken();

  // Narrow selectors: the page re-renders for the slices it actually reads,
  // not for every unrelated write to `projectsReducer`.
  const viewMode = useAppSelector(state => state.projectViewReducer.mode);
  const groupBy = useAppSelector(state => state.projectViewReducer.groupBy);
  const requestParams = useAppSelector(state => state.projectsReducer.requestParams);
  const groupedRequestParams = useAppSelector(state => state.projectsReducer.groupedRequestParams);
  const groupedProjects = useAppSelector(state => state.projectsReducer.groupedProjects);
  const filteredStatuses = useAppSelector(state => state.projectsReducer.filteredStatuses);
  const filteredCategories = useAppSelector(state => state.projectsReducer.filteredCategories);
  const filteredPriorities = useAppSelector(state => state.projectsReducer.filteredPriorities);
  const filteredClients = useAppSelector(state => state.projectsReducer.filteredClients);
  const projectListFields = useAppSelector(state => state.projectListFieldsReducer.fields);

  const [searchValue, setSearchValue] = useState('');
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [filteredInfo, setFilteredInfo] =
    useState<Record<string, FilterValue | null>>(EMPTY_FILTERED_INFO);

  const isListView = viewMode === ProjectViewType.LIST;

  const {
    data: projectsData,
    isLoading: loadingProjects,
    isFetching: isFetchingProjects,
    refetch: refetchProjects,
    error: projectsError,
  } = useGetProjectsQuery(requestParams, {
    refetchOnMountOrArgChange: 30,
    refetchOnFocus: false,
    refetchOnReconnect: true,
    skip: !isListView,
  });

  // Latest-value refs so every handler below can stay referentially stable —
  // otherwise each keystroke or page change would hand new callbacks to the
  // memoized toolbar and to <Table>, re-rendering both.
  const viewModeRef = useLatestRef(viewMode);
  const groupByRef = useLatestRef(groupBy);
  const requestParamsRef = useLatestRef(requestParams);
  const groupedRequestParamsRef = useLatestRef(groupedRequestParams);
  const groupedProjectsLoadingRef = useLatestRef(groupedProjects.loading);
  const projectListFieldsRef = useLatestRef(projectListFields);

  const buildGroupedParams = useCallback(
    (overrides: Partial<typeof groupedRequestParams> = {}) => {
      const current = groupedRequestParamsRef.current;
      return {
        ...current,
        ...overrides,
        groupBy:
          overrides.groupBy || current.groupBy || groupByRef.current || ProjectGroupBy.PRIORITY,
      };
    },
    [groupedRequestParamsRef, groupByRef]
  );

  useProjectListUrlSync({
    viewMode,
    requestParams,
    groupedRequestParams,
    buildGroupedParams,
  });

  /* ---------------------------------------------------------------- search */

  const applySearch = useCallback(
    (searchTerm: string) => {
      setRefreshError(null);
      // Tracked once per debounced search, not per keystroke — the actual
      // request is already debounced, so the analytics event should follow it.
      trackMixpanelEvent(evt_projects_search);
      if (viewModeRef.current === ProjectViewType.LIST) {
        dispatch(setRequestParams({ search: searchTerm, index: 1 }));
        return;
      }
      const groupedParams = buildGroupedParams({ search: searchTerm, index: 1 });
      dispatch(setGroupedRequestParams(groupedParams));
      dispatch(fetchGroupedProjects(groupedParams));
    },
    [dispatch, buildGroupedParams, trackMixpanelEvent, viewModeRef]
  );

  const applySearchRef = useLatestRef(applySearch);
  const debouncedSearch = useMemo(
    () => debounce((term: string) => applySearchRef.current(term), SEARCH_DEBOUNCE_MS),
    [applySearchRef]
  );
  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Mirror externally-applied searches (URL hydration, view switches) into the input.
  const activeSearch = isListView ? requestParams.search : groupedRequestParams.search;
  useEffect(() => {
    const next = activeSearch || '';
    setSearchValue(previous => (previous === next ? previous : next));
  }, [activeSearch]);

  /* ------------------------------------------------------------ table data */

  const tableDataSource = projectsData?.body?.data || EMPTY_PROJECTS;

  // Group pagination is over groups, not projects, so `data` only ever holds
  // the current page of groups — summing `project_count` across it would
  // undercount as soon as there's more than one page. `total_projects` is
  // computed server-side from the same filtered set, independent of paging.
  const projectCount = isListView
    ? projectsData?.body?.total || 0
    : groupedProjects.data?.total_projects || 0;

  const transformedGroupedProjects = useMemo(
    () =>
      groupedProjects.data?.data?.map(group => ({
        groupKey: group.group_key,
        groupName: group.group_name,
        groupColor: group.group_color,
        projects: group.projects,
        count: group.project_count,
        totalProgress: 0,
        totalTasks: 0,
      })) || [],
    [groupedProjects.data?.data]
  );

  const isRefreshing = isListView ? isFetchingProjects : groupedProjects.loading;

  const errorMessage =
    refreshError ??
    (projectsError
      ? t('errors.loadFailed', { defaultValue: 'Failed to load projects. Please try again.' })
      : null);

  /* -------------------------------------------------------------- columns */

  const filterOptions = useProjectListFilterOptions();

  const filterValues = useMemo(() => {
    const persisted = {
      statuses: filteredStatuses,
      categories: filteredCategories,
      priorities: filteredPriorities,
      clients: filteredClients,
    };
    return FILTERABLE_COLUMNS.reduce((acc, { columnKey, param }) => {
      // antd's own filter state wins once the user has touched a dropdown; the
      // Redux copy keeps the checkboxes correct across a remount.
      acc[columnKey] = filteredInfo[columnKey] ?? persisted[param];
      return acc;
    }, {} as ColumnFilterValues);
  }, [filteredInfo, filteredStatuses, filteredCategories, filteredPriorities, filteredClients]);

  const tableColumns = useProjectListColumns({
    filterOptions,
    filterValues,
    fields: projectListFields,
    navigate,
    isOwnerOrAdmin,
  });

  // Group view carries the same filters over from list view (handleViewModeChange,
  // below) but has no per-column filter UI to show or clear them — without this,
  // a filtered group view looks like it's silently showing fewer projects for no
  // visible reason.
  const activeFilterCount = useMemo(() => {
    const active = isListView ? requestParams : groupedRequestParams;
    return FILTERABLE_COLUMNS.reduce(
      (count, { param }) => count + (normalizeFilterParam(active[param]) ? 1 : 0),
      0
    );
  }, [isListView, requestParams, groupedRequestParams]);

  /* ------------------------------------------------------------- handlers */

  const setSortingValues = useCallback((field: string, order: string) => {
    localStorage.setItem(PROJECT_SORT_FIELD, field);
    localStorage.setItem(PROJECT_SORT_ORDER, order);
  }, []);

  // Filters come from the antd column-header dropdowns (FILTERABLE_COLUMNS)
  // and sorting from the column headers too — pagination is still driven by
  // TablePagination (handleListPageChange below), not by this handler.
  const handleTableChange = useCallback(
    (
      _pagination: unknown,
      filters: Record<string, FilterValue | null>,
      sorter: SorterResult<IProjectViewModel> | SorterResult<IProjectViewModel>[]
    ) => {
      const current = requestParamsRef.current;
      const updates: Partial<typeof current> = {};
      let hasChanges = false;

      // Column filters are keyed by the column's antd `key`; compare by content
      // (antd allocates a fresh array every call) against the request param,
      // which is what is actually applied right now.
      let filtersChanged = false;
      for (const { columnKey, param, setFiltered } of FILTERABLE_COLUMNS) {
        // antd only reports filter state for columns it actually rendered, so a
        // hidden column's key is simply absent here — indistinguishable from the
        // user having cleared it. Skip it instead, or hiding a filtered column
        // would silently drop that filter on the very next table interaction.
        if (!isColumnVisible(projectListFieldsRef.current, columnKey)) continue;
        const next = filters?.[columnKey] ?? null;
        if (serializeFilterValue(next) === normalizeFilterParam(current[param])) continue;
        const ids = (next ?? []).map(String);
        updates[param] = ids.length ? ids.join(' ') : null;
        dispatch(setFiltered(ids));
        hasChanges = true;
        filtersChanged = true;
      }
      // A narrower result set can drop the page the user is on.
      if (filtersChanged) updates.index = 1;

      const newOrder = Array.isArray(sorter) ? sorter[0].order : sorter.order;
      // `field` (the column's `dataIndex`, e.g. 'name', 'priority_name') is what
      // request params and the backend use. `columnKey` is the column's `key`,
      // which is a ProjectListFieldKey enum member ('NAME', 'PRIORITY', ...) —
      // comparing against that instead made every pagination click on a freshly
      // loaded table look like a sort change (enum key vs. lowercase default
      // field mismatch), resetting `index` back to 1 on the first click.
      const newField = (Array.isArray(sorter) ? sorter[0].field : sorter.field) as string;

      // '' is the sentinel for "no active sort".
      const isSortCleared = !newOrder && !!current.order;
      const isSortChanged =
        !!newOrder && !!newField && (newOrder !== current.order || newField !== current.field);

      if (isSortCleared) {
        updates.order = '';
        updates.field = '';
        updates.index = 1;
        setSortingValues('', '');
        hasChanges = true;
      } else if (isSortChanged) {
        updates.order = newOrder as string;
        updates.field = newField;
        updates.index = 1;
        setSortingValues(newField, newOrder as string);
        hasChanges = true;
      }

      if (hasChanges) {
        dispatch(setRequestParams(updates));
        dispatch(setGroupedRequestParams(buildGroupedParams(updates)));
      }

      setFilteredInfo(filters);
    },
    [dispatch, setSortingValues, buildGroupedParams, requestParamsRef]
  );

  const handleListPageChange = useCallback(
    (page: number, pageSize: number) => {
      dispatch(setRequestParams({ index: page, size: pageSize }));
    },
    [dispatch]
  );

  const handleGroupedPageChange = useCallback(
    (page: number, pageSize: number) => {
      const updatedParams = buildGroupedParams({ index: page, size: pageSize });
      dispatch(setGroupedRequestParams(updatedParams));
      dispatch(fetchGroupedProjects(updatedParams));
    },
    [dispatch, buildGroupedParams]
  );

  const handleClearFilters = useCallback(() => {
    const clearedParams: Partial<typeof requestParamsRef.current> = { index: 1 };
    for (const { param, setFiltered } of FILTERABLE_COLUMNS) {
      clearedParams[param] = null;
      dispatch(setFiltered([]));
    }
    dispatch(setRequestParams(clearedParams));
    const groupedParams = buildGroupedParams(clearedParams);
    dispatch(setGroupedRequestParams(groupedParams));
    setFilteredInfo(EMPTY_FILTERED_INFO);
    if (viewModeRef.current === ProjectViewType.GROUP && groupByRef.current) {
      dispatch(fetchGroupedProjects(groupedParams));
    }
  }, [dispatch, buildGroupedParams, viewModeRef, groupByRef]);

  const handleFilterSegmentChange = useCallback(
    (value: IProjectFilter) => {
      const filterIndex = PROJECT_FILTER_SEGMENTS.indexOf(value);
      localStorage.setItem(FILTER_INDEX_KEY, filterIndex.toString());

      const updates = { filter: filterIndex, index: 1 };
      dispatch(setRequestParams(updates));
      const groupedParams = buildGroupedParams(updates);
      dispatch(setGroupedRequestParams(groupedParams));
      if (viewModeRef.current === ProjectViewType.GROUP && groupByRef.current) {
        dispatch(fetchGroupedProjects(groupedParams));
      }
    },
    [dispatch, buildGroupedParams, viewModeRef, groupByRef]
  );

  const handleViewModeChange = useCallback(
    (value: ProjectViewType) => {
      dispatch(setViewMode(value));
      if (value !== ProjectViewType.GROUP) return;

      const current = requestParamsRef.current;
      const groupedParams = buildGroupedParams({
        groupBy: groupByRef.current || ProjectGroupBy.PRIORITY,
        field: DEFAULT_GROUPED_PROJECT_SORT_FIELD,
        order: DEFAULT_GROUPED_PROJECT_SORT_ORDER,
        search: current.search,
        filter: current.filter,
        statuses: current.statuses,
        categories: current.categories,
        priorities: current.priorities,
        clients: current.clients,
      });
      dispatch(setGroupedRequestParams(groupedParams));
      dispatch(fetchGroupedProjects(groupedParams));
    },
    [dispatch, buildGroupedParams, requestParamsRef, groupByRef]
  );

  const handleGroupByChange = useCallback(
    (value: ProjectGroupBy) => {
      dispatch(setGroupBy(value));
      const isPriority = value === ProjectGroupBy.PRIORITY;
      const groupedParams = buildGroupedParams({
        groupBy: value,
        field: isPriority ? DEFAULT_GROUPED_PROJECT_SORT_FIELD : DEFAULT_PROJECT_SORT_FIELD,
        order: isPriority ? DEFAULT_GROUPED_PROJECT_SORT_ORDER : DEFAULT_PROJECT_SORT_ORDER,
        index: 1,
      });
      dispatch(setGroupedRequestParams(groupedParams));
      dispatch(fetchGroupedProjects(groupedParams));
    },
    [dispatch, buildGroupedParams]
  );

  const handleRefresh = useCallback(async () => {
    trackMixpanelEvent(evt_projects_refresh_click);
    setRefreshError(null);
    try {
      if (viewModeRef.current === ProjectViewType.LIST) {
        await refetchProjects();
      } else if (groupByRef.current) {
        await dispatch(fetchGroupedProjects(groupedRequestParamsRef.current)).unwrap();
      }
    } catch {
      setRefreshError(
        t('errors.refreshFailed', { defaultValue: 'Failed to refresh projects. Please try again.' })
      );
    }
  }, [
    trackMixpanelEvent,
    refetchProjects,
    dispatch,
    t,
    viewModeRef,
    groupByRef,
    groupedRequestParamsRef,
  ]);

  const navigateToProject = useCallback(
    (projectId: string | undefined, defaultView: string | undefined) => {
      if (projectId) navigate(buildProjectRoute(projectId, defaultView));
    },
    [navigate]
  );

  // Warm the project view chunk on first hover only — the dynamic import is
  // cached, but re-entering it on every mouseenter is pointless work.
  const hasPrefetchedProjectView = useRef(false);
  const prefetchProjectView = useCallback(() => {
    if (hasPrefetchedProjectView.current) return;
    hasPrefetchedProjectView.current = true;
    import('@/pages/projects/projectView/project-view').catch(() => {});
  }, []);

  const handleRow = useCallback(
    (record: IProjectViewModel) => ({
      onClick: () => navigateToProject(record.id, record.team_member_default_view),
      onMouseEnter: prefetchProjectView,
    }),
    [navigateToProject, prefetchProjectView]
  );

  // antd's scroll.y needs a concrete pixel height, not a percentage — '100%'
  // doesn't reliably resolve through antd Table's own internal wrapper divs,
  // which silently drops the max-height and makes the body un-scrollable
  // (renders every row instead). Measure the flex-bounded wrapper itself
  // (TABLE_WRAPPER_STYLE below) and subtract the actual rendered thead
  // height, so this adapts to sidebar collapse/resize with no magic numbers.
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [tableBodyHeight, setTableBodyHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const wrapperEl = tableWrapperRef.current;
    if (!wrapperEl || !isListView) return;

    const measure = () => {
      const headEl = wrapperEl.querySelector<HTMLElement>('.ant-table-thead');
      const headerHeight = headEl?.getBoundingClientRect().height ?? 0;
      const available = wrapperEl.clientHeight - headerHeight;
      setTableBodyHeight(available > 0 ? available : undefined);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(wrapperEl);
    measure();

    return () => observer.disconnect();
  }, [isListView, tableColumns]);

  const handleDrawerClose = useCallback(() => {
    dispatch(setProject({} as IProjectViewModel));
    dispatch(setProjectId(null));
  }, [dispatch]);

  /* -------------------------------------------------------------- effects */

  useEffect(() => {
    trackMixpanelEvent(evt_projects_page_visit);
  }, [trackMixpanelEvent]);

  // Seed the persisted "All / Favorites / Archived" segment, and give the
  // grouped params their initial shape, once per mount.
  useEffect(() => {
    const filterIndex = readFilterIndex();
    if (requestParamsRef.current.filter !== filterIndex) {
      dispatch(setRequestParams({ filter: filterIndex }));
    }
    if (!groupedRequestParamsRef.current.groupBy) {
      const initialGroupBy = groupByRef.current || ProjectGroupBy.PRIORITY;
      const isPriority = initialGroupBy === ProjectGroupBy.PRIORITY;
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
          clients: null,
          field: isPriority ? DEFAULT_GROUPED_PROJECT_SORT_FIELD : DEFAULT_PROJECT_SORT_FIELD,
          order: isPriority ? DEFAULT_GROUPED_PROJECT_SORT_ORDER : DEFAULT_PROJECT_SORT_ORDER,
        })
      );
    }
  }, [dispatch, requestParamsRef, groupedRequestParamsRef, groupByRef]);

  // Group view owns its own fetching (it is not an RTK Query endpoint), so
  // re-fetch whenever the grouping changes or the cache is empty.
  useEffect(() => {
    if (viewMode !== ProjectViewType.GROUP || !groupBy) return;
    if (groupedRequestParams.groupBy !== groupBy) {
      const isPriority = groupBy === ProjectGroupBy.PRIORITY;
      const updatedParams = buildGroupedParams({
        groupBy,
        index: groupedRequestParams.index || 1,
        size: groupedRequestParams.size || DEFAULT_PAGE_SIZE,
        field:
          groupedRequestParams.field ||
          (isPriority ? DEFAULT_GROUPED_PROJECT_SORT_FIELD : DEFAULT_PROJECT_SORT_FIELD),
        order:
          groupedRequestParams.order ||
          (isPriority ? DEFAULT_GROUPED_PROJECT_SORT_ORDER : DEFAULT_PROJECT_SORT_ORDER),
      });
      dispatch(setGroupedRequestParams(updatedParams));
      dispatch(fetchGroupedProjects(updatedParams));
      // `groupedRequestParams` changing above re-runs this effect; without the
      // `loading` check that second pass would find `data` still null (the
      // fetch above hasn't resolved yet) and issue a duplicate request. Read
      // via ref rather than as a dependency — reacting to `loading` here would
      // re-fire this branch on every failed fetch, retrying forever.
    } else if (!groupedProjects.data && !groupedProjectsLoadingRef.current) {
      dispatch(fetchGroupedProjects(groupedRequestParams));
    }
  }, [
    dispatch,
    viewMode,
    groupBy,
    groupedRequestParams,
    groupedProjects.data,
    groupedProjectsLoadingRef,
    buildGroupedParams,
  ]);

  /* --------------------------------------------------------------- render */

  const PAGE_SIZE_NUMBER_OPTIONS = useMemo(() => PAGE_SIZE_OPTIONS.map(Number), []);
  const rowsPerPageLabel = t('rowsPerPage', { defaultValue: 'Rows per page:' });

  const groupedPaginationSummary = useCallback(
    (range: string, total: number) => {
      const label =
        groupBy === ProjectGroupBy.CATEGORY
          ? t('groupBy.categories', { defaultValue: 'categories' })
          : groupBy === ProjectGroupBy.PRIORITY
            ? t('groupBy.priorities', { defaultValue: 'priorities' })
            : groupBy === ProjectGroupBy.CLIENT
              ? t('groupBy.clients', { defaultValue: 'clients' })
              : t('groups', { defaultValue: 'groups' });
      return `${range} of ${total} ${label}`;
    },
    [groupBy, t]
  );

  const tableLocale = useMemo(
    () => ({
      emptyText: errorMessage ? (
        <Empty
          description={
            <div>
              <p>{errorMessage}</p>
              <Button type="primary" onClick={handleRefresh} loading={isRefreshing}>
                {t('retry', { defaultValue: 'Retry' })}
              </Button>
            </div>
          }
        />
      ) : (
        <Empty description={t('noProjects', { defaultValue: 'No Projects' })} />
      ),
    }),
    [errorMessage, handleRefresh, isRefreshing, t]
  );

  const hasGroups = (groupedProjects.data?.data?.length ?? 0) > 0;

  return (
    <div style={PAGE_STYLE}>
      {/* Boxed filter section — matches Recurring Tasks' bordered filter row (RecurringTasksPage.tsx),
          with the project count folded into the box's left side instead of a separate header line. */}
      <div
        style={{
          ...FILTER_BOX_STYLE,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
        }}
      >
        <Typography.Text strong style={{ fontSize: 16, flexShrink: 0 }}>
          {projectCount} {t('projects', { defaultValue: 'Projects' })}
        </Typography.Text>

        {/* flex-basis 260px (not 0) so this wraps onto its own full-width row
            once the box gets too narrow to fit both it and the count text on
            one line, rather than squeezing the toolbar's own controls. */}
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <ProjectListToolbar
            filterSegment={
              PROJECT_FILTER_SEGMENTS[requestParams.filter] ?? PROJECT_FILTER_SEGMENTS[0]
            }
            viewMode={viewMode}
            groupBy={groupBy}
            searchValue={searchValue}
            isRefreshing={isRefreshing}
            isOwnerOrAdmin={isOwnerOrAdmin}
            activeFilterCount={activeFilterCount}
            onRefresh={handleRefresh}
            onFilterSegmentChange={handleFilterSegmentChange}
            onViewModeChange={handleViewModeChange}
            onGroupByChange={handleGroupByChange}
            onSearchChange={handleSearchChange}
            onClearFilters={handleClearFilters}
          />
        </div>
      </div>

      <Card className="project-card">
        {isListView ? (
          <>
            <div ref={tableWrapperRef} style={TABLE_WRAPPER_STYLE}>
              <Table<IProjectViewModel>
                columns={tableColumns}
                dataSource={tableDataSource}
                rowKey={getRowKey}
                loading={loadingProjects || isFetchingProjects}
                size="small"
                showSorterTooltip={false}
                onChange={handleTableChange}
                pagination={false}
                locale={tableLocale}
                scroll={{ x: 'max-content', y: tableBodyHeight }}
                sticky
                onRow={handleRow}
              />
            </div>
            <TablePagination
              page={requestParams.index}
              pageSize={requestParams.size}
              total={projectsData?.body?.total || 0}
              onPageChange={handleListPageChange}
              pageSizeOptions={PAGE_SIZE_NUMBER_OPTIONS}
              rowsPerPageLabel={rowsPerPageLabel}
            />
          </>
        ) : (
          <div style={GROUP_VIEW_STYLE}>
            {/* Scrollable groups list — scrollbar sits flush at the card border like List view */}
            <div className="project-group-scroll-container">
              <ProjectGroupList
                groups={transformedGroupedProjects}
                navigate={navigate}
                onProjectSelect={navigateToProject}
                onArchive={noop}
                isOwnerOrAdmin={isOwnerOrAdmin}
                loading={groupedProjects.loading}
                t={t}
              />
            </div>
            {!groupedProjects.loading && hasGroups && (
              <TablePagination
                page={groupedRequestParams.index}
                pageSize={groupedRequestParams.size}
                total={groupedProjects.data?.total_groups || 0}
                onPageChange={handleGroupedPageChange}
                pageSizeOptions={PAGE_SIZE_NUMBER_OPTIONS}
                rowsPerPageLabel={rowsPerPageLabel}
                renderSummary={groupedPaginationSummary}
              />
            )}
          </div>
        )}
      </Card>

      {createPortal(
        <ProjectSettingsModal onClose={handleDrawerClose} />,
        document.body,
        'project-settings-modal'
      )}
      {createPortal(<SurveyPromptModal />, document.body, 'project-survey-modal')}
    </div>
  );
};

export default ProjectList;
