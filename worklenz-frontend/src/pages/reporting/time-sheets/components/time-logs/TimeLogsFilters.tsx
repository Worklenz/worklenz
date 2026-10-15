import React from 'react';
import { Button, Dropdown, Flex, Input } from '@/shared/antd-imports';
import { CaretDownFilled, ExportOutlined, SearchOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  TimeLogsExportFormat,
  TimeLogsExportMode,
  TimeLogsGroupBy,
  TimeLogsTableView,
} from '@/types/reporting/time-logs.types';
import PillToggle from '@/pages/home/PillToggle';
import { ITimeLogsFilterOptions, TimeLogsFilterPanel } from './TimeLogsFilterPanel';
import { ITimeLogsFilterState } from './time-logs-filters';

const SEARCH_DEBOUNCE_MS = 300;

// Order of the Group by menu: none first, then Member, Project, Client.
const GROUP_BY_OPTIONS: TimeLogsGroupBy[] = ['none', 'member', 'project', 'client'];

interface TimeLogsFiltersProps {
  search: string;
  onSearch: (value: string) => void;
  filters: ITimeLogsFilterState;
  onApplyFilters: (next: ITimeLogsFilterState) => void;
  projects: ITimeLogsFilterOptions;
  practices: ITimeLogsFilterOptions;
  clients: ITimeLogsFilterOptions;
  members: ITimeLogsFilterOptions;
  /** Entries as logged (Flat) or one row per task (By task). Only shown while nothing is grouped. */
  tableView: TimeLogsTableView;
  onTableViewChange: (view: TimeLogsTableView) => void;
  groupBy: TimeLogsGroupBy;
  onGroupByChange: (groupBy: TimeLogsGroupBy) => void;
  onExport: (mode: TimeLogsExportMode, format: TimeLogsExportFormat) => void;
}

export const TimeLogsFilters: React.FC<TimeLogsFiltersProps> = ({
  search,
  onSearch,
  filters,
  onApplyFilters,
  projects,
  practices,
  clients,
  members,
  tableView,
  onTableViewChange,
  groupBy,
  onGroupByChange,
  onExport,
}) => {
  const { t } = useTranslation('time-report');
  const [searchValue, setSearchValue] = React.useState(search);
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last value this input pushed up, so a parent-side reset (e.g. "Clear
  // filters" in the empty state) can be told apart from our own debounced echo.
  const lastEmittedRef = React.useRef(search);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      lastEmittedRef.current = value;
      onSearch(value);
    }, SEARCH_DEBOUNCE_MS);
  };

  React.useEffect(() => {
    if (search !== lastEmittedRef.current) {
      lastEmittedRef.current = search;
      setSearchValue(search);
    }
  }, [search]);

  React.useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    []
  );

  const exportItems: MenuProps['items'] = (['filtered', 'all'] as const).map(mode => ({
    type: 'group' as const,
    key: mode,
    label:
      mode === 'filtered'
        ? t('timeLogsExportGroupFiltered', { defaultValue: 'Filtered results' })
        : t('timeLogsExportGroupAll', { defaultValue: 'All entries in the date range' }),
    children: [
      { key: `${mode}:xlsx`, label: t('timeLogsExportExcel', { defaultValue: 'Excel' }) },
      { key: `${mode}:csv`, label: t('timeLogsExportCsv', { defaultValue: 'CSV' }) },
    ],
  }));

  const groupByLabels: Record<TimeLogsGroupBy, string> = {
    none: t('timeLogsGroupByNone', { defaultValue: 'None' }),
    member: t('timeLogsGroupByMember', { defaultValue: 'Member' }),
    project: t('timeLogsGroupByProject', { defaultValue: 'Project' }),
    client: t('timeLogsGroupByClient', { defaultValue: 'Client' }),
  };

  const handleExportClick: MenuProps['onClick'] = ({ key }) => {
    const [mode, format] = String(key).split(':');
    onExport(mode as TimeLogsExportMode, format as TimeLogsExportFormat);
  };

  // A single flat wrap row, like Time Entries: every control is a direct child
  // so flex-wrap can move any one of them to its own line predictably.
  return (
    <Flex gap={8} wrap="wrap" align="center" style={{ width: '100%' }}>
      <div style={{ flex: '1 1 auto', minWidth: 0 }} />

      {/* Flat / By task switch the table itself, which is not on screen while a Group by is active. */}
      {groupBy === 'none' && (
        <PillToggle<TimeLogsTableView>
          value={tableView}
          onChange={onTableViewChange}
          ariaLabel={t('timeLogsTableViewLabel', { defaultValue: 'Table view' })}
          // Same size as the Filter button next to it.
          style={{ height: 32, borderRadius: 6 }}
          segmentStyle={{ padding: '0 15px', fontSize: 14, fontWeight: 400 }}
          options={[
            {
              value: 'flat',
              label: t('timeLogsViewFlat', { defaultValue: 'Flat' }),
              tooltip: t('timeLogsViewFlatTooltip', {
                defaultValue: 'Every time entry on its own row, as it was logged.',
              }),
            },
            {
              value: 'task',
              label: t('timeLogsViewByTask', { defaultValue: 'By task' }),
              tooltip: t('timeLogsViewByTaskTooltip', {
                defaultValue: 'One row per task, with the time of all its entries added up.',
              }),
            },
          ]}
        />
      )}

      <Input
        prefix={<SearchOutlined />}
        placeholder={t('Search logs', { defaultValue: 'Search logs' })}
        aria-label={t('Search logs', { defaultValue: 'Search logs' })}
        value={searchValue}
        onChange={e => handleSearchChange(e.target.value)}
        allowClear
        className="w-[320px] max-w-full"
      />

      <TimeLogsFilterPanel
        filters={filters}
        onApply={onApplyFilters}
        projects={projects}
        practices={practices}
        clients={clients}
        members={members}
      />

      <Dropdown
        trigger={['click']}
        menu={{
          items: GROUP_BY_OPTIONS.map(option => ({ key: option, label: groupByLabels[option] })),
          onClick: ({ key }) => onGroupByChange(key as TimeLogsGroupBy),
          selectedKeys: [groupBy],
        }}
      >
        <Button>
          {t('timeLogsGroupByButton', {
            defaultValue: 'Group by: {{groupBy}}',
            groupBy: groupByLabels[groupBy],
          })}{' '}
          <CaretDownFilled />
        </Button>
      </Dropdown>

      <Dropdown trigger={['click']} menu={{ items: exportItems, onClick: handleExportClick }}>
        <Button icon={<ExportOutlined />}>
          {t('export', { defaultValue: 'Export' })} <CaretDownFilled />
        </Button>
      </Dropdown>
    </Flex>
  );
};
