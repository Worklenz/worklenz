import React from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Typography, Flex, Button, Skeleton, theme } from '@/shared/antd-imports';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  taskTimeLogsApiService,
  IMySummary,
  IRecentTimeLog,
  ITimeEntriesGroup,
  ITimeEntriesVisibilityScope,
  ITimeEntriesStatusOption,
  TimeEntriesGroupBy,
  TimeEntriesScope,
  TimeEntriesTableView,
} from '@/api/tasks/task-time-logs.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { clientsApiService } from '@/api/clients/clients.api.service';
import { TimeEntriesSummaryBar } from '@/components/time-entries/TimeEntriesSummaryBar';
import { TimeEntriesFilters, DateFilter } from '@/components/time-entries/TimeEntriesFilters';
import { TimeEntriesGroupedList } from '@/components/time-entries/TimeEntriesGroupedList';
import { TimeEntriesLogTable, LogSortField } from '@/components/time-entries/TimeEntriesLogTable';
import { LogTimeModal } from '@/components/time-entries/LogTimeModal';
import TaskDrawer from '@components/task-drawer/task-drawer';
import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { useAppSelector } from '@/hooks/useAppSelector';
import './time-entries.css';

const { Title } = Typography;
const DEFAULT_PAGE_SIZE = 20;
const PREFERENCE_SAVE_DEBOUNCE_MS = 800;

interface Project {
  id: string;
  name: string;
}

interface PersonOption {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

// "task" used to be a Group-by option; it's now the flat table's "By task"
// view (TimeEntriesTableView). A saved preference or an old bookmarked URL can
// still carry it, so it's recognised here only to be mapped onto that view.
const LEGACY_TASK_GROUP_BY = 'task';

const isValidGroupBy = (v: string | null): v is TimeEntriesGroupBy =>
  v === 'none' || v === 'member' || v === 'client' || v === 'project';

const isValidScope = (v: string | null): v is TimeEntriesScope => v === 'my' || v === 'all';

const isValidTableView = (v: string | null): v is TimeEntriesTableView => v === 'flat' || v === 'task';

const TimeEntriesPage: React.FC = () => {
  const { t } = useTranslation('time-entries');
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  // Resolved server-side: what this viewer is allowed to see, and their saved
  // Group-by/Scope choice. Loaded once on mount; nothing else fetches until
  // this resolves, so the very first data fetch already has the right params.
  const [visibilityScope, setVisibilityScope] = React.useState<ITimeEntriesVisibilityScope | null>(null);
  const [contextLoaded, setContextLoaded] = React.useState(false);
  const skipNextPreferenceWriteRef = React.useRef(true);

  const [groupBy, setGroupBy] = React.useState<TimeEntriesGroupBy>('none');
  const [scope, setScope] = React.useState<TimeEntriesScope>('all');
  // Flat table only (groupBy === 'none'): entries as logged vs. one row per
  // task with time summed. Lives in the URL like group_by/scope, so a shared
  // link reproduces it; unlike them it has no server-side saved preference.
  const [tableView, setTableView] = React.useState<TimeEntriesTableView>(() => {
    const urlView = searchParams.get('view');
    return isValidTableView(urlView) ? urlView : 'flat';
  });
  // Shared across both views (flat table / Member-Client-Project-grouped
  // list) — only one is ever visible at a time, so one "rows per page"
  // preference carries over when switching between them, matching
  // TablePagination's contract (components/TablePagination.tsx, also used by
  // Recurring Tasks).
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [personIds, setPersonIds] = React.useState<string[]>([]);
  const [clientIds, setClientIds] = React.useState<string[]>([]);
  const [personOptions, setPersonOptions] = React.useState<PersonOption[]>([]);
  const [clientOptions, setClientOptions] = React.useState<ClientOption[]>([]);
  const [statusOptions, setStatusOptions] = React.useState<ITimeEntriesStatusOption[]>([]);

  // Flat table's column-header filters (Project/Status/Priority/Billable) —
  // Project mirrors the "Filters" panel's own project select (same state,
  // two control surfaces); Status/Priority/Billable have no other UI.
  const [statusNames, setStatusNames] = React.useState<string[]>([]);
  const [priorityIds, setPriorityIds] = React.useState<string[]>([]);
  const [billableValues, setBillableValues] = React.useState<string[]>([]);

  // Flat log-entry view state (groupBy === 'none'). The per-view loading flags
  // (and summaryLoading below) start `true`: the first fetch is kicked off from
  // an effect, so without this the first committed render after the context
  // resolves would paint an empty list (and "0:00" totals) for a frame before
  // the fetch flips them on.
  const [logs, setLogs] = React.useState<IRecentTimeLog[]>([]);
  const [logsTotal, setLogsTotal] = React.useState(0);
  const [logsPage, setLogsPage] = React.useState(1);
  const [logsLoading, setLogsLoading] = React.useState(true);
  // No column is tied to created_at anymore (the old Date column is now Due
  // Date, sorted on due_date) — start with no active sort indicator, while
  // the backend still defaults to most-recently-logged-first under the hood.
  const [logSortField, setLogSortField] = React.useState<LogSortField>(null);
  const [logSortOrder, setLogSortOrder] = React.useState<'asc' | 'desc'>('desc');

  // Member/Client/Project grouping.
  const [groups, setGroups] = React.useState<ITimeEntriesGroup[]>([]);
  const [groupsTotal, setGroupsTotal] = React.useState(0);
  const [groupsPage, setGroupsPage] = React.useState(1);
  const [groupsLoading, setGroupsLoading] = React.useState(true);

  const [summary, setSummary] = React.useState<IMySummary | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  const [dateFilter, setDateFilter] = React.useState<DateFilter>('this_week');
  const [dateRange, setDateRange] = React.useState<[string, string] | null>(null);
  const [projectIds, setProjectIds] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState('');

  const [logTimeOpen, setLogTimeOpen] = React.useState(false);

  // Store original task names to restore if drawer closes without saving
  const originalTaskNamesRef = React.useRef<Map<string, string>>(new Map());

  const projectIdParam = projectIds.length ? projectIds.join(',') : undefined;
  const personIdParam = personIds.length ? personIds.join(',') : undefined;
  const clientIdParam = clientIds.length ? clientIds.join(',') : undefined;
  const statusParam = statusNames.length ? statusNames.join(',') : undefined;
  const priorityIdParam = priorityIds.length ? priorityIds.join(',') : undefined;
  const billableParam = billableValues.length ? billableValues.join(',') : undefined;
  const usesGroupedEndpoint = groupBy !== 'none';

  const fetchLogs = React.useCallback(async (currentPage: number, currentPageSize: number) => {
    setLogsLoading(true);
    try {
      const res = await taskTimeLogsApiService.getMyTimeLogEntries({
        date_filter: dateFilter,
        project_id: projectIdParam,
        search: search || undefined,
        date_from: dateFilter === 'custom' && dateRange ? dateRange[0] : undefined,
        date_to: dateFilter === 'custom' && dateRange ? dateRange[1] : undefined,
        sort_field: logSortField || undefined,
        sort_order: logSortOrder,
        page: currentPage,
        page_size: currentPageSize,
        scope,
        person_id: personIdParam,
        client_id: clientIdParam,
        status: statusParam,
        priority_id: priorityIdParam,
        billable: billableParam,
        view: tableView === 'task' ? 'task' : undefined,
      });
      if (res.done) {
        setLogs(res.body.logs || []);
        setLogsTotal(res.body.total ?? 0);
      }
    } catch {
      setLogs([]);
      setLogsTotal(0);
    } finally {
      setLogsLoading(false);
    }
  }, [dateFilter, projectIdParam, search, dateRange, logSortField, logSortOrder, scope, personIdParam, clientIdParam, statusParam, priorityIdParam, billableParam, tableView]);

  const fetchGroups = React.useCallback(async (currentPage: number, currentPageSize: number) => {
    if (groupBy === 'none') return;
    setGroupsLoading(true);
    try {
      const res = await taskTimeLogsApiService.getMyGroupedEntries({
        group_by: groupBy,
        date_filter: dateFilter,
        project_id: projectIdParam,
        search: search || undefined,
        date_from: dateFilter === 'custom' && dateRange ? dateRange[0] : undefined,
        date_to: dateFilter === 'custom' && dateRange ? dateRange[1] : undefined,
        // The grouped-entries endpoint caps page_size at 50 server-side —
        // within TablePagination's default [10, 20, 50] options, so this
        // never silently gets clamped to a smaller value than requested.
        page: currentPage,
        page_size: currentPageSize,
        scope,
        person_id: personIdParam,
        client_id: clientIdParam,
      });
      if (res.done) {
        setGroups(res.body.groups || []);
        setGroupsTotal(res.body.total_groups ?? 0);
      }
    } catch {
      setGroups([]);
      setGroupsTotal(0);
    } finally {
      setGroupsLoading(false);
    }
  }, [groupBy, dateFilter, projectIdParam, search, dateRange, scope, personIdParam, clientIdParam]);

  const fetchSummary = React.useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await taskTimeLogsApiService.getMySummary({
        scope,
        person_id: personIdParam,
        client_id: clientIdParam,
      });
      if (res.done) setSummary(res.body as IMySummary);
    } catch {
      // ignore
    } finally {
      setSummaryLoading(false);
    }
  }, [scope, personIdParam, clientIdParam]);

  const fetchProjects = React.useCallback(async () => {
    try {
      const res = await apiClient.get(`${API_BASE_URL}/projects/my-task-projects`);
      const list: any[] = res.data?.body || [];
      setProjects(list.map((p: any) => ({ id: p.id, name: p.name })));
    } catch {
      // ignore
    }
  }, []);

  // Filter option lists for the Person/Client selects — harmless to load
  // broadly since the server always clamps results to the viewer's resolved
  // scope regardless of which ids are requested.
  const fetchFilterOptions = React.useCallback(async () => {
    try {
      const [membersRes, clientsRes, statusesRes] = await Promise.all([
        teamMembersApiService.getAll(),
        clientsApiService.getClientsLookup(),
        // scope: 'all' — the broadest set of statuses this viewer could ever
        // filter to, regardless of which scope they're currently viewing
        // (server still clamps to their actual resolved scope), mirroring
        // why members/clients are also loaded broadly above.
        taskTimeLogsApiService.getMyFilterOptions({ scope: 'all' }),
      ]);
      if (membersRes.done) {
        const list = (membersRes.body || []) as any[];
        setPersonOptions(
          list
            .filter(m => m.user_id || m.id)
            .map(m => ({ id: m.user_id || m.id, name: m.name || m.email || '', avatar_url: m.avatar_url }))
        );
      }
      if (clientsRes.done) {
        const list = (clientsRes.body || []) as any[];
        setClientOptions(list.map(c => ({ id: c.id, name: c.name })));
      }
      if (statusesRes.done) {
        setStatusOptions(statusesRes.body.statuses || []);
      }
    } catch {
      // ignore — filters simply show no options
    }
  }, []);

  // Resolve the viewer's visibility scope + saved preferences once on mount
  // (and implicitly again on every team switch, since that forces a full SPA
  // reload). URL params win over the saved preference when present.
  React.useEffect(() => {
    (async () => {
      try {
        const res = await taskTimeLogsApiService.getMyContext();
        if (res.done) {
          const vs = res.body.visibility_scope;
          setVisibilityScope(vs);

          const urlGroupBy = searchParams.get('group_by');
          const urlScope = searchParams.get('scope');

          // Typed as a plain string, not TimeEntriesGroupBy: the server may
          // still hand back the legacy "task" value (see LEGACY_TASK_GROUP_BY).
          const requestedGroupBy: string =
            isValidGroupBy(urlGroupBy) || urlGroupBy === LEGACY_TASK_GROUP_BY
              ? urlGroupBy
              : res.body.preferences.group_by;
          let resolvedScope = isValidScope(urlScope) ? urlScope : res.body.preferences.scope;
          // Never trust a stale "all" from the URL or a saved preference once
          // the viewer's actual scope has narrowed (e.g. a PM assignment or
          // Team Lead membership was removed) — the server would silently
          // clamp it anyway, so keep the UI consistent with that.
          if (resolvedScope === 'all' && !vs.has_expanded_scope) resolvedScope = 'my';

          // "Task" is no longer a Group-by option (per-task totals are the
          // flat table's "By task" view now), but a saved preference or an
          // old bookmarked URL can still carry it — map it to that view
          // rather than landing in a grouping the dropdown can't represent.
          if (requestedGroupBy === LEGACY_TASK_GROUP_BY) {
            setGroupBy('none');
            setTableView('task');
          } else {
            setGroupBy(isValidGroupBy(requestedGroupBy) ? requestedGroupBy : 'none');
          }
          setScope(resolvedScope);
        }
      } catch {
        // ignore — page still usable with defaults (own entries, flat view)
      } finally {
        setContextLoaded(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  React.useEffect(() => {
    fetchProjects();
    fetchFilterOptions();
  }, [fetchProjects, fetchFilterOptions]);

  // Persist Group-by/Scope choices server-side, per user — debounced so
  // quickly trying a few options doesn't fire a write per click. Skips the
  // very first application (loading the saved preference back in shouldn't
  // immediately re-save it).
  React.useEffect(() => {
    if (!contextLoaded) return;
    if (skipNextPreferenceWriteRef.current) {
      skipNextPreferenceWriteRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      taskTimeLogsApiService.updateMyPreferences({ group_by: groupBy, scope }).catch(() => {
        // best-effort — a failed preference save shouldn't interrupt the view
      });
    }, PREFERENCE_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [groupBy, scope, contextLoaded]);

  // Keep group_by/scope shareable via URL, so a bookmarked link reproduces
  // the same view (subject to the viewer's own resolved permission).
  React.useEffect(() => {
    if (!contextLoaded) return;
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.set('group_by', groupBy);
        next.set('scope', scope);
        next.set('view', tableView);
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, scope, tableView, contextLoaded]);

  React.useEffect(() => {
    if (!contextLoaded) return;
    if (usesGroupedEndpoint) {
      setGroupsPage(1);
      fetchGroups(1, pageSize);
    } else {
      setLogsPage(1);
      fetchLogs(1, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextLoaded, usesGroupedEndpoint, fetchGroups, fetchLogs]);

  React.useEffect(() => {
    if (!contextLoaded) return;
    fetchSummary();
  }, [contextLoaded, fetchSummary]);

  // (newPage, newPageSize) matches TablePagination's onPageChange contract —
  // it always passes both, resetting to page 1 itself when the rows-per-page
  // select changes, so pageSize is taken as a real argument here rather than
  // read back off state (which wouldn't have committed yet in this same tick).
  const handleLogsPageChange = (newPage: number, newPageSize: number) => {
    setLogsPage(newPage);
    setPageSize(newPageSize);
    fetchLogs(newPage, newPageSize);
  };

  const handleGroupsPageChange = (newPage: number, newPageSize: number) => {
    setGroupsPage(newPage);
    setPageSize(newPageSize);
    fetchGroups(newPage, newPageSize);
  };

  const handleLogSortChange = (field: LogSortField) => {
    setLogsPage(1);
    setLogSortOrder(prev => (logSortField === field && prev === 'asc' ? 'desc' : 'asc'));
    setLogSortField(field);
  };

  const refetchActiveView = React.useCallback(
    (change?: { deleted?: boolean }) => {
      fetchSummary();
      if (usesGroupedEndpoint) {
        fetchGroups(groupsPage, pageSize);
        return;
      }
      // Deleting the only row on a later page would leave that page empty - step back one.
      const stepBack = !!change?.deleted && logs.length === 1 && logsPage > 1;
      const targetPage = stepBack ? logsPage - 1 : logsPage;
      if (stepBack) setLogsPage(targetPage);
      fetchLogs(targetPage, pageSize);
    },
    [usesGroupedEndpoint, fetchGroups, fetchLogs, fetchSummary, groupsPage, logsPage, logs.length, pageSize]
  );

  const handleEntryChange = refetchActiveView;
  const handleLogTimeSuccess = refetchActiveView;

  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);
    if (filter !== 'custom') setDateRange(null);
  };

  const handleGroupByChange = (next: TimeEntriesGroupBy) => setGroupBy(next);
  const handleScopeChange = (next: TimeEntriesScope) => setScope(next);
  const handleTableViewChange = (next: TimeEntriesTableView) => setTableView(next);

  const handleExport = (mode: 'filtered' | 'all') => {
    // "Filtered" mirrors the table on screen, so it needs to know which flat
    // table view that is and how it's sorted. (Grouped views export their
    // entries; "all" ignores both — the server only honors them when filtered.)
    const isFlatTable = groupBy === 'none';
    taskTimeLogsApiService.exportMyTimeLogEntriesCsv({
      mode,
      view: isFlatTable && tableView === 'task' ? 'task' : undefined,
      sort_field: isFlatTable ? logSortField || undefined : undefined,
      sort_order: isFlatTable && logSortField ? logSortOrder : undefined,
      date_filter: dateFilter,
      project_id: projectIdParam,
      search: search || undefined,
      date_from: dateFilter === 'custom' && dateRange ? dateRange[0] : undefined,
      date_to: dateFilter === 'custom' && dateRange ? dateRange[1] : undefined,
      scope,
      person_id: personIdParam,
      client_id: clientIdParam,
      status: statusParam,
      priority_id: priorityIdParam,
      billable: billableParam,
    });
  };

  // Real-time task name updates: Listen to socket events for changes from other sources
  React.useEffect(() => {
    if (!socket) return;

    const handleTaskNameChange = (data: { id: string; name: string }) => {
      if (!data?.id || !data.name) return;

      const decodedName = decodeHtmlEntities(data.name);

      // Update flat table (both Flat and By task — a By task row's task_id
      // is the task itself)
      setLogs(prevLogs =>
        prevLogs.map(log =>
          log.task_id === data.id ? { ...log, task_name: decodedName } : log
        )
      );

      // Update Member/Client/Project grouped views — the task name appears
      // inside each group's nested entries.
      setGroups(prevGroups =>
        prevGroups.map(group => ({
          ...group,
          entries: group.entries.map(entry =>
            entry.task_id === data.id ? { ...entry, task_name: decodedName } : entry
          ),
        }))
      );
    };

    socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), handleTaskNameChange);

    return () => {
      socket.off(SocketEvents.TASK_NAME_CHANGE.toString(), handleTaskNameChange);
    };
  }, [socket]);

  // Real-time task name updates: Sync with Redux state for immediate updates while editing in drawer
  const selectedTaskId = useAppSelector(state => state.taskDrawerReducer.selectedTaskId);
  const showTaskDrawer = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);
  const taskFormViewModel = useAppSelector(state => state.taskDrawerReducer.taskFormViewModel);
  const taskManagementEntities = useAppSelector(state => state.taskManagement.entities);

  // Capture original task name when drawer opens
  React.useEffect(() => {
    if (showTaskDrawer && selectedTaskId) {
      // Find the original task name from our local state
      const originalName = logs.find(l => l.task_id === selectedTaskId)?.task_name;

      if (originalName && !originalTaskNamesRef.current.has(selectedTaskId)) {
        originalTaskNamesRef.current.set(selectedTaskId, originalName);
      }
    } else if (!showTaskDrawer && selectedTaskId) {
      // Drawer closed - restore original name if current name is empty or invalid
      const originalName = originalTaskNamesRef.current.get(selectedTaskId);
      if (originalName) {
        const currentTask = taskManagementEntities[selectedTaskId];
        const currentName = taskFormViewModel?.task?.name || currentTask?.title;

        // If current name is empty or whitespace-only, restore the original
        if (!currentName || !currentName.trim()) {
          setLogs(prevLogs =>
            prevLogs.map(log =>
              log.task_id === selectedTaskId ? { ...log, task_name: originalName } : log
            )
          );
        }

        // Clean up the stored original name
        originalTaskNamesRef.current.delete(selectedTaskId);
      }
    }
  }, [showTaskDrawer, selectedTaskId, logs, taskFormViewModel, taskManagementEntities]);

  // Real-time sync: Update list as user types, but show original name if empty
  const currentTaskName = React.useMemo(() => {
    if (!selectedTaskId || !showTaskDrawer) return null;

    const drawerTaskName = taskFormViewModel?.task?.name;
    const taskEntity = taskManagementEntities[selectedTaskId];
    const taskName = drawerTaskName !== undefined ? drawerTaskName : (taskEntity?.title || null);

    // If the name is empty or whitespace-only, return a special marker
    if (!taskName || !taskName.trim()) {
      return '__EMPTY__';
    }

    return taskName;
  }, [selectedTaskId, showTaskDrawer, taskFormViewModel?.task?.name, taskManagementEntities]);

  React.useEffect(() => {
    if (!selectedTaskId || !currentTaskName) return;

    // If name is empty, show the original name
    if (currentTaskName === '__EMPTY__') {
      const originalName = originalTaskNamesRef.current.get(selectedTaskId);
      if (originalName) {
        setLogs(prevLogs =>
          prevLogs.map(log =>
            log.task_id === selectedTaskId ? { ...log, task_name: originalName } : log
          )
        );
      }
      return;
    }

    // Normal case: update with the current name
    const decodedName = decodeHtmlEntities(currentTaskName);

    setLogs(prevLogs =>
      prevLogs.map(log =>
        log.task_id === selectedTaskId ? { ...log, task_name: decodedName } : log
      )
    );
  }, [selectedTaskId, currentTaskName]);

  const hasExpandedScope = !!visibilityScope?.has_expanded_scope;
  const showAuthorColumn = scope === 'all' && hasExpandedScope;

  return (
    // Fills the Projects rail's content pane exactly (SimpleRailLayout gives
    // it a definite height via flex-stretch) and lays out its children as a
    // flex column: everything above the list is fixed-height (flexShrink: 0)
    // and the active list view is the one flexible region (flex: 1,
    // minHeight: 0) that claims whatever space is left. Each list component
    // stretches to 100% of that region and measures its own box height
    // (useFillRemainingHeight) to size its internal scroll area, so that
    // area is the only thing that scrolls — the pane itself never needs a
    // scrollbar of its own alongside the table's.
    <div className="time-entries-page" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Flex align="center" justify="space-between" wrap="wrap" gap={12} style={{ marginBottom: 20, flexShrink: 0 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('pageTitle', { defaultValue: 'Time Entries' })}
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setLogTimeOpen(true)}
          style={{ height: 30, fontSize: 12, borderRadius: 7, paddingInline: 12 }}
        >
          {t('quickLogButton', { defaultValue: 'Log time' })}
        </Button>
      </Flex>

      <div style={{ flexShrink: 0 }}>
        <TimeEntriesSummaryBar summary={summary} loading={summaryLoading} />
      </div>

      {/* Everything below depends on what getMyContext() resolves — the viewer's
          visibility scope (All/My toggle, Member column, Group-by options) and
          their saved Group-by/Scope. Rendering it earlier would paint a
          member-only, empty flat table first and then swap to the real UI
          once the context lands, so hold it back behind a skeleton. */}
      {!contextLoaded ? (
        <TimeEntriesInitialSkeleton />
      ) : (
        <>
          <div className="time-entries-filters-row" style={{ marginBottom: 16, flexShrink: 0 }}>
            <TimeEntriesFilters
              dateFilter={dateFilter}
              onDateFilterChange={handleDateFilterChange}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              projectIds={projectIds}
              onProjectIdsChange={setProjectIds}
              projects={projects}
              onSearch={setSearch}
              groupBy={groupBy}
              onGroupByChange={handleGroupByChange}
              hideMemberGroupOption={!hasExpandedScope}
              hasExpandedScope={hasExpandedScope}
              scope={scope}
              onScopeChange={handleScopeChange}
              tableView={tableView}
              onTableViewChange={handleTableViewChange}
              showTableViewToggle={groupBy === 'none'}
              personOptions={personOptions}
              personIds={personIds}
              onPersonIdsChange={setPersonIds}
              clientOptions={clientOptions}
              clientIds={clientIds}
              onClientIdsChange={setClientIds}
              onExport={handleExport}
            />
          </div>

          <div className="time-entries-list-region" style={{ flex: '1 1 auto', minHeight: 0 }}>
            {usesGroupedEndpoint ? (
              <TimeEntriesGroupedList
                groups={groups}
                groupBy={groupBy as Exclude<TimeEntriesGroupBy, 'none'>}
                scope={scope}
                loading={groupsLoading}
                total={groupsTotal}
                page={groupsPage}
                pageSize={pageSize}
                onPageChange={handleGroupsPageChange}
                onEntryChange={handleEntryChange}
              />
            ) : (
              <TimeEntriesLogTable
                logs={logs}
                loading={logsLoading}
                total={logsTotal}
                page={logsPage}
                pageSize={pageSize}
                onPageChange={handleLogsPageChange}
                sortField={logSortField}
                sortOrder={logSortOrder}
                onSortChange={handleLogSortChange}
                onLogTime={() => setLogTimeOpen(true)}
                showAuthor={showAuthorColumn}
                projectOptions={projects}
                selectedProjectIds={projectIds}
                onProjectFilterChange={setProjectIds}
                statusOptions={statusOptions}
                selectedStatusNames={statusNames}
                onStatusFilterChange={setStatusNames}
                selectedPriorityIds={priorityIds}
                onPriorityFilterChange={setPriorityIds}
                selectedBillableValues={billableValues}
                onBillableFilterChange={setBillableValues}
                onEntryChange={handleEntryChange}
                allowEntryActions={tableView === 'flat'}
              />
            )}
          </div>
        </>
      )}

      <LogTimeModal
        open={logTimeOpen}
        onClose={() => setLogTimeOpen(false)}
        onSuccess={handleLogTimeSuccess}
      />

      {createPortal(<TaskDrawer />, document.body, 'time-entries-task-drawer')}
    </div>
  );
};

const TimeEntriesInitialSkeleton: React.FC = () => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('loadingEntries', { defaultValue: 'Loading time entries' })}
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        overflow: 'hidden',
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
      }}
    >
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Skeleton active paragraph={{ rows: 0 }} title={{ width: '60%' }} />
        </div>
      ))}
    </div>
  );
};

export default TimeEntriesPage;
