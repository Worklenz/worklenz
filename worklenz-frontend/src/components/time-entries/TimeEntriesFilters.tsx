import React from 'react';
import { Flex, Input, Dropdown, Button } from '@/shared/antd-imports';
import { SearchOutlined, CaretDownFilled, ExportOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import PillToggle from '@/pages/home/PillToggle';
import {
  TimeEntriesGroupBy,
  TimeEntriesScope,
  TimeEntriesTableView,
} from '@/api/tasks/task-time-logs.api.service';
import { TimeEntriesFilterPanel } from './TimeEntriesFilterPanel';

export type DateFilter = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'no_logged_time' | 'custom';

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

interface TimeEntriesFiltersProps {
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  dateRange: [string, string] | null;
  onDateRangeChange: (range: [string, string] | null) => void;
  projectIds: string[];
  onProjectIdsChange: (ids: string[]) => void;
  projects: Project[];
  onSearch: (q: string) => void;

  groupBy: TimeEntriesGroupBy;
  onGroupByChange: (groupBy: TimeEntriesGroupBy) => void;
  /** Hide "Member" from the Group-by dropdown — it would always resolve to a
   * single group (the viewer themself) for a Member-scope viewer. */
  hideMemberGroupOption: boolean;

  /** All/My toggle is only rendered when the viewer has an expanded scope. */
  hasExpandedScope: boolean;
  scope: TimeEntriesScope;
  onScopeChange: (scope: TimeEntriesScope) => void;

  /** Flat (entries as logged) vs By task (one row per task, time summed).
   * Only rendered when `showTableViewToggle` — it switches the flat table,
   * which isn't on screen while a Group-by is active. */
  tableView: TimeEntriesTableView;
  onTableViewChange: (view: TimeEntriesTableView) => void;
  showTableViewToggle: boolean;

  personOptions: PersonOption[];
  personIds: string[];
  onPersonIdsChange: (ids: string[]) => void;
  clientOptions: ClientOption[];
  clientIds: string[];
  onClientIdsChange: (ids: string[]) => void;

  onExport: (mode: 'filtered' | 'all') => void;
}

export const TimeEntriesFilters: React.FC<TimeEntriesFiltersProps> = ({
  dateFilter,
  onDateFilterChange,
  dateRange,
  onDateRangeChange,
  projectIds,
  onProjectIdsChange,
  projects,
  onSearch,
  groupBy,
  onGroupByChange,
  hideMemberGroupOption,
  hasExpandedScope,
  scope,
  onScopeChange,
  tableView,
  onTableViewChange,
  showTableViewToggle,
  personOptions,
  personIds,
  onPersonIdsChange,
  clientOptions,
  clientIds,
  onClientIdsChange,
  onExport,
}) => {
  const { t } = useTranslation('time-entries');
  const [searchValue, setSearchValue] = React.useState('');
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => onSearch(value), 300);
  };

  React.useEffect(() => () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  // Members filter only makes sense once the viewer can see more than their
  // own entries. Client filter is passed through unconditionally below —
  // it's always relevant since even a viewer's own projects can span
  // multiple clients, regardless of scope.
  const showPersonFilter = scope === 'all' && hasExpandedScope;

  // Order matches the Group-by dropdown's intended reading order: None,
  // Member, Project, Client. There's deliberately no "Task" option — per-task
  // totals are the "By task" table view (toggle above) instead.
  const groupByOptions: { key: TimeEntriesGroupBy; label: string }[] = [
    { key: 'none', label: t('groupByNone', { defaultValue: 'None' }) },
    ...(hideMemberGroupOption ? [] : [{ key: 'member' as const, label: t('groupByMember', { defaultValue: 'Member' }) }]),
    { key: 'project', label: t('groupByProject', { defaultValue: 'Project' }) },
    { key: 'client', label: t('groupByClient', { defaultValue: 'Client' }) },
  ];
  const selectedGroupByLabel = groupByOptions.find(o => o.key === groupBy)?.label ?? groupByOptions[0].label;

  return (
    // A single flat wrap row, not nested space-between groups: every control
    // is a direct child so flex-wrap can move any one of them onto its own
    // line predictably. The spacer absorbs leftover width on wide screens
    // (pushing Search/Filter/Group-by to the right, next to the Scope
    // toggle on the left) and just shrinks to ~0 once the row wraps, instead
    // of risking a control being squeezed past the edge of the viewport.
    <Flex gap={8} wrap="wrap" align="center" style={{ width: '100%' }}>
      {hasExpandedScope && (
        <PillToggle<TimeEntriesScope>
          value={scope}
          onChange={onScopeChange}
          ariaLabel={t('scopeToggleLabel', { defaultValue: 'Visible entries' })}
          options={[
            { value: 'all', label: t('scopeAll', { defaultValue: 'All Entries' }) },
            { value: 'my', label: t('scopeMy', { defaultValue: 'My Entries' }) },
          ]}
        />
      )}

      <div style={{ flex: '1 1 auto', minWidth: 0 }} />

      {showTableViewToggle && (
        <PillToggle<TimeEntriesTableView>
          value={tableView}
          onChange={onTableViewChange}
          ariaLabel={t('tableViewToggleLabel', { defaultValue: 'Table view' })}
          options={[
            { value: 'flat', label: t('tableViewFlat', { defaultValue: 'Flat' }) },
            { value: 'task', label: t('tableViewByTask', { defaultValue: 'By task' }) },
          ]}
        />
      )}

      <Input
        prefix={<SearchOutlined />}
        placeholder={t('searchPlaceholder', { defaultValue: 'Search task, ID, or description...' })}
        value={searchValue}
        onChange={e => handleSearchChange(e.target.value)}
        allowClear
        style={{ width: 240, maxWidth: '100%', height: 30, fontSize: 12, borderRadius: 7 }}
      />

      <TimeEntriesFilterPanel
        dateFilter={dateFilter}
        onDateFilterChange={onDateFilterChange}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        projectIds={projectIds}
        onProjectIdsChange={onProjectIdsChange}
        projects={projects}
        showPersonFilter={showPersonFilter}
        personOptions={personOptions}
        personIds={personIds}
        onPersonIdsChange={onPersonIdsChange}
        clientOptions={clientOptions}
        clientIds={clientIds}
        onClientIdsChange={onClientIdsChange}
      />

      <Dropdown
        trigger={['click']}
        menu={{
          items: groupByOptions.map(o => ({ key: o.key, label: o.label })),
          onClick: info => onGroupByChange(info.key as TimeEntriesGroupBy),
          selectedKeys: [groupBy],
        }}
      >
        <Button style={{ height: 30, fontSize: 12, borderRadius: 7, paddingInline: 12 }}>
          {t('groupByButtonLabel', { defaultValue: `Group by: ${selectedGroupByLabel}`, groupBy: selectedGroupByLabel })} <CaretDownFilled />
        </Button>
      </Dropdown>

      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            { key: 'filtered', label: t('exportFiltered', { defaultValue: 'Export Filtered (CSV)' }) },
            { key: 'all', label: t('exportAll', { defaultValue: 'Export All (CSV)' }) },
          ],
          onClick: info => onExport(info.key as 'filtered' | 'all'),
        }}
      >
        <Button icon={<ExportOutlined />} style={{ height: 30, fontSize: 12, borderRadius: 7, paddingInline: 12 }}>
          {t('exportButton', { defaultValue: 'Export' })} <CaretDownFilled />
        </Button>
      </Dropdown>
    </Flex>
  );
};
