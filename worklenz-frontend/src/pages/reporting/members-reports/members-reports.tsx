import {
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Flex,
  Input,
  Popover,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { DownOutlined, EyeOutlined, FilterOutlined, SearchOutlined } from '@/shared/antd-imports';
import MembersReportsTable, {
  MEMBERS_TOGGLEABLE_COLUMNS,
} from './components/members-reports-table/members-reports-table';
import { MembersTeamFilterDropdown } from './components/members-team-filter-dropdown';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import TimeWiseFilter from '@/components/reporting/time-wise-filter';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import {
  fetchMembersData,
  setArchived,
  setDuration,
  setDateRange,
  setSearchQuery,
  setTeams,
} from '@/features/reporting/membersReports/membersReportsSlice';
import { useAuthService } from '@/hooks/useAuth';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';
import { useCallback, useEffect, useState } from 'react';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_allocation } from '@/shared/worklenz-analytics-events';

const HIDDEN_COLUMNS_STORAGE_KEY = 'worklenz.reporting.members.hiddenColumns.v2';

const DEFAULT_HIDDEN_COLUMNS = ['email', 'role'];

const readHiddenColumns = (): string[] => {
  try {
    const stored = localStorage.getItem(HIDDEN_COLUMNS_STORAGE_KEY);
    if (stored === null) return DEFAULT_HIDDEN_COLUMNS;
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === 'string')
      : [];
  } catch {
    return DEFAULT_HIDDEN_COLUMNS;
  }
};

const MembersReports = () => {
  const { t } = useTranslation('reporting-members');
  const dispatch = useAppDispatch();
  useDocumentTitle(t('documentTitle', { defaultValue: 'Reporting - Member Overview' }));
  const currentSession = useAuthService().getCurrentSession();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { archived, teams, searchQuery } = useAppSelector(state => state.membersReportsReducer);
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

  const [teamOptions, setTeamOptions] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);

  useEffect(() => {
    let isActive = true;
    setIsLoadingTeams(true);
    reportingApiService
      .getOverviewTeams(true)
      .then(response => {
        if (!isActive) return;
        setTeamOptions((response.body ?? []).map(team => ({ value: team.id, label: team.name })));
      })
      .catch(() => {
        // The teams filter just stays empty if the list can't be loaded.
      })
      .finally(() => {
        if (isActive) setIsLoadingTeams(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  const handleHiddenColumnsChange = useCallback((next: string[]) => {
    setHiddenColumns(next);
    try {
      localStorage.setItem(HIDDEN_COLUMNS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: the choice just won't persist
    }
  }, []);

  const activeFilterCount = teams.length + (archived ? 1 : 0);

  const handleClearFilters = () => {
    dispatch(setTeams([]));
    dispatch(setArchived(false));
  };

  const handleExport = () => {
    if (!currentSession?.team_name) return;
    reportingExportApiService.exportMembers(
      currentSession.team_name,
      duration,
      dateRange,
      archived
    );
  };

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_allocation);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    dispatch(setDuration(duration));
    dispatch(setDateRange(dateRange));
  }, [dateRange, duration]);

  return (
    <Flex vertical gap={16} style={{ height: 'calc(100vh - 52px - 48px)', overflow: 'hidden' }}>
      <Flex align="flex-end" justify="space-between" gap={12} wrap="wrap">
        <Flex vertical gap={4}>
          <Typography.Title level={3} className="!mb-0 !mt-1">
            {t('pageTitle', { defaultValue: 'Member Overview' })}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('pageSubtitle', {
              defaultValue:
                'See workload, task progress and project assignments for every team member.',
            })}
          </Typography.Text>
        </Flex>

        <Flex gap={8} wrap="wrap" align="center" justify="end">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            className="w-[320px] max-w-full"
            placeholder={t('searchByNameInputPlaceholder', { defaultValue: 'Search by name' })}
            aria-label={t('searchByNameInputPlaceholder', { defaultValue: 'Search by name' })}
            value={searchQuery}
            onChange={event => dispatch(setSearchQuery(event.target.value))}
          />

          <TimeWiseFilter isPrimary />

          <Popover
            trigger="click"
            placement="bottomRight"
            title={t('filtersTitle', { defaultValue: 'Filters' })}
            content={
              <Flex vertical gap={12} className="w-[320px] max-w-full">
                <Typography.Text type="secondary" className="text-xs">
                  {t('quickFilters', { defaultValue: 'Quick filters' })}
                </Typography.Text>
                <Flex gap={8} wrap="wrap">
                  <MembersTeamFilterDropdown
                    options={teamOptions}
                    value={teams}
                    onChange={value => dispatch(setTeams(value))}
                    loading={isLoadingTeams}
                  />
                </Flex>
                <Divider className="!my-0" />
                <Checkbox checked={archived} onChange={() => dispatch(setArchived(!archived))}>
                  {t('includeArchivedButton', { defaultValue: 'Include Archived Projects' })}
                </Checkbox>
                {activeFilterCount > 0 && (
                  <Button
                    size="small"
                    type="link"
                    className="self-start !px-0"
                    onClick={handleClearFilters}
                  >
                    {t('clearFilters', { defaultValue: 'Clear filters' })}
                  </Button>
                )}
              </Flex>
            }
          >
            <Button
              icon={<FilterOutlined />}
              type={activeFilterCount > 0 ? 'primary' : 'default'}
              ghost={activeFilterCount > 0}
            >
              {t('filter', { defaultValue: 'Filter' })}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
          </Popover>

          <Dropdown
            menu={{
              items: [{ key: '1', label: t('excelButton', { defaultValue: 'Excel' }) }],
              onClick: handleExport,
            }}
          >
            <Button icon={<DownOutlined />} iconPosition="end">
              {t('exportButton', { defaultValue: 'Export' })}
            </Button>
          </Dropdown>

          <Popover
            trigger="click"
            placement="bottomRight"
            title={t('showHideColumns', { defaultValue: 'Show or hide columns' })}
            content={
              <Flex vertical gap={4} className="min-w-[200px]">
                {MEMBERS_TOGGLEABLE_COLUMNS.map(column => (
                  <Checkbox
                    key={column.key}
                    checked={!hiddenColumns.includes(column.key)}
                    onChange={event =>
                      handleHiddenColumnsChange(
                        event.target.checked
                          ? hiddenColumns.filter(key => key !== column.key)
                          : [...hiddenColumns, column.key]
                      )
                    }
                  >
                    {t(column.labelKey, { defaultValue: column.defaultLabel })}
                  </Checkbox>
                ))}
                {hiddenColumns.length > 0 && (
                  <Button
                    size="small"
                    type="link"
                    className="self-start !px-0"
                    onClick={() => handleHiddenColumnsChange([])}
                  >
                    {t('showAllColumns', { defaultValue: 'Show all columns' })}
                  </Button>
                )}
              </Flex>
            }
          >
            <Tooltip title={t('showHideColumns', { defaultValue: 'Show or hide columns' })}>
              <Button
                icon={<EyeOutlined />}
                aria-label={t('showHideColumns', { defaultValue: 'Show or hide columns' })}
              />
            </Tooltip>
          </Popover>
        </Flex>
      </Flex>

      <MembersReportsTable hiddenColumns={hiddenColumns} />
    </Flex>
  );
};

export default MembersReports;
