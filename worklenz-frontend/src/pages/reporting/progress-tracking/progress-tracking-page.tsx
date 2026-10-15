import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  Pagination,
  Popover,
  Progress,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { TableProps } from '@/shared/antd-imports';
import { buildSkeletonRows, toSkeletonColumns } from '@/components/reporting/table-skeleton';
import {
  CaretDownFilled,
  EyeOutlined,
  MoreOutlined,
  FilterOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_progress_tracking } from '@/shared/worklenz-analytics-events';
import { fromNow } from '@/utils/dateUtils';
import { progressTrackingApiService } from '@/api/reporting/progress-tracking.api.service';
import {
  DeliveryConfidenceFilter,
  IProgressTrackingProject,
  IProgressTrackingSummary,
  ProgressTrackingPercentRange,
} from '@/types/reporting/progress-tracking.types';
import logger from '@/utils/errorLogger';

const EMPTY_SUMMARY: IProgressTrackingSummary = {
  total: 0,
  on_track: 0,
  at_risk: 0,
  off_track: 0,
  not_set: 0,
  archived_excluded: 0,
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const HIDDEN_COLUMNS_STORAGE_KEY = 'worklenz.reporting.progressTracking.hiddenColumns.v3';
const DEFAULT_HIDDEN_COLUMNS = ['start_date', 'end_date'];

// The Project and action columns are always shown.
const TOGGLEABLE_COLUMNS = [
  { key: 'client', labelKey: 'columnClient', defaultLabel: 'Client' },
  { key: 'manager', labelKey: 'columnManager', defaultLabel: 'Project Manager' },
  { key: 'start_date', labelKey: 'columnStartDate', defaultLabel: 'Start Date' },
  { key: 'end_date', labelKey: 'columnEndDate', defaultLabel: 'End Date' },
  { key: 'percent', labelKey: 'columnPercent', defaultLabel: '% Complete' },
  { key: 'blocked', labelKey: 'columnBlocked', defaultLabel: 'Blocked' },
  { key: 'confidence', labelKey: 'columnConfidence', defaultLabel: 'Delivery Confidence' },
  { key: 'updated', labelKey: 'columnUpdated', defaultLabel: 'Last updated' },
];

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

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

interface FilterMenuButtonProps {
  label: string;
  value: string[];
  options: { value: string; label: string }[];
  onChange: (value: string[]) => void;
}

const FilterMenuButton = ({ label, value, options, onChange }: FilterMenuButtonProps) => (
  <Popover
    trigger="click"
    placement="bottomLeft"
    content={
      <Checkbox.Group value={value} onChange={next => onChange(next as string[])}>
        <Flex vertical gap={4}>
          {options.map(option => (
            <Checkbox key={option.value} value={option.value}>
              {option.label}
            </Checkbox>
          ))}
        </Flex>
      </Checkbox.Group>
    }
  >
    <Button icon={<CaretDownFilled className="text-[10px]" />} iconPosition="end">
      {label}
      {value.length > 0 ? ` (${value.length})` : ''}
    </Button>
  </Popover>
);

type SortField =
  | 'name'
  | 'client'
  | 'percent'
  | 'blocked'
  | 'confidence'
  | 'updated'
  | 'manager'
  | 'start_date'
  | 'end_date';

const ProgressTrackingPage = () => {
  const { t } = useTranslation('reporting-progress-tracking');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();

  useDocumentTitle(t('documentTitle', { defaultValue: 'Reporting - Progress Tracking' }));

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [confidence, setConfidence] = useState<('green' | 'amber' | 'red' | 'unset')[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [managerOptions, setManagerOptions] = useState<{ id: string; name: string }[]>([]);
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([]);
  const [percentRange, setPercentRange] = useState<ProgressTrackingPercentRange[]>([]);
  const [hasBlockers, setHasBlockers] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sortField, setSortField] = useState<SortField | undefined>();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [projects, setProjects] = useState<IProgressTrackingProject[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<IProgressTrackingSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const requestIdRef = useRef(0);

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_progress_tracking);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      setSearch(current => (current === nextSearch ? current : nextSearch));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const isFirstSearchRef = useRef(true);
  useEffect(() => {
    if (isFirstSearchRef.current) {
      isFirstSearchRef.current = false;
      return;
    }
    setPage(1);
  }, [search]);

  const loadProjects = useCallback(
    async (silent = false) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      if (!silent) setIsLoading(true);
      setHasError(false);

      try {
        const response = await progressTrackingApiService.getProjects({
          search: search || undefined,
          client_ids: clientIds.length ? clientIds : undefined,
          manager_ids: managerIds.length ? managerIds : undefined,
          confidence: confidence.length ? confidence : undefined,
          percent_range: percentRange.length ? percentRange : undefined,
          has_blockers: hasBlockers || undefined,
          include_archived: includeArchived || undefined,
          field: sortField,
          order: sortOrder,
          page,
          page_size: pageSize,
        });

        if (requestId !== requestIdRef.current) return;
        if (!response.done || !response.body) {
          setHasError(true);
          return;
        }

        setProjects(response.body.projects);
        setTotal(response.body.total);
        setSummary(response.body.summary);
        setClientOptions(response.body.clients ?? []);
        setManagerOptions(response.body.managers ?? []);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        logger.error('Failed to load progress tracking', error);
        setHasError(true);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    [
      clientIds,
      managerIds,
      confidence,
      hasBlockers,
      includeArchived,
      page,
      pageSize,
      percentRange,
      search,
      sortField,
      sortOrder,
    ]
  );

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleOpenInsights = useCallback(
    (projectId: string) => {
      navigate(
        `/worklenz/projects/${projectId}?tab=project-insights-member-overview&pinned_tab=project-insights-member-overview`
      );
    },
    [navigate]
  );

  const chipItems = useMemo(() => {
    return [
      {
        key: 'all' as const,
        label: t('chipAll', { defaultValue: 'All' }),
        count: summary.total,
        color: token.colorPrimary,
      },
      {
        key: 'green' as const,
        label: t('chipOnTrack', { defaultValue: 'On track' }),
        count: summary.on_track,
        color: token.colorSuccess,
      },
      {
        key: 'amber' as const,
        label: t('chipAtRisk', { defaultValue: 'At risk' }),
        count: summary.at_risk,
        color: token.colorWarning,
      },
      {
        key: 'red' as const,
        label: t('chipOffTrack', { defaultValue: 'Off track' }),
        count: summary.off_track,
        color: token.colorError,
      },
      {
        key: 'unset' as const,
        label: t('chipNotSet', { defaultValue: 'Not set' }),
        count: summary.not_set,
        color: token.colorTextSecondary,
      },
    ];
  }, [summary, t, token]);

  const columns: TableProps<IProgressTrackingProject>['columns'] = useMemo(
    () => [
      {
        title: t('columnProject', { defaultValue: 'Project' }),
        key: 'name',
        width: 260,
        fixed: 'left',
        ellipsis: true,
        sorter: true,
        sortOrder: sortField === 'name' ? (sortOrder === 'desc' ? 'descend' : 'ascend') : null,
        render: (_value, record) => (
          <button
            type="button"
            className="block w-full truncate bg-transparent p-0 text-left font-semibold"
            style={{ color: token.colorText }}
            title={record.name}
            onClick={() => handleOpenInsights(record.id)}
          >
            <span
              aria-hidden
              className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
              style={{ background: record.color_code || token.colorTextQuaternary }}
            />
            {record.name}
          </button>
        ),
      },
      {
        title: t('columnClient', { defaultValue: 'Client' }),
        key: 'client',
        dataIndex: 'client_name',
        width: 200,
        ellipsis: true,
        sorter: true,
        sortOrder: sortField === 'client' ? (sortOrder === 'desc' ? 'descend' : 'ascend') : null,
        filters: clientOptions.map(client => ({ text: client.name, value: client.id })),
        filterSearch: true,
        filteredValue: clientIds.length ? clientIds : null,
        render: (value: string | null) => {
          if (!value) {
            return <Typography.Text type="secondary">—</Typography.Text>;
          }
          return (
            <Typography.Text ellipsis={{ tooltip: value }} style={{ color: token.colorText }}>
              {value}
            </Typography.Text>
          );
        },
      },
      {
        title: t('columnManager', { defaultValue: 'Project Manager' }),
        key: 'manager',
        dataIndex: 'manager',
        width: 180,
        ellipsis: true,
        sorter: true,
        sortOrder: sortField === 'manager' ? (sortOrder === 'desc' ? 'descend' : 'ascend') : null,
        filters: managerOptions.map(manager => ({ text: manager.name, value: manager.id })),
        filterSearch: true,
        filteredValue: managerIds.length ? managerIds : null,
        render: (value: string | null) =>
          value || <Typography.Text type="secondary">—</Typography.Text>,
      },
      {
        title: t('columnStartDate', { defaultValue: 'Start Date' }),
        key: 'start_date',
        width: 130,
        sorter: true,
        sortOrder:
          sortField === 'start_date' ? (sortOrder === 'desc' ? 'descend' : 'ascend') : null,
        render: (_value, record) => formatDate(record.start_date),
      },
      {
        title: t('columnEndDate', { defaultValue: 'End Date' }),
        key: 'end_date',
        width: 130,
        sorter: true,
        sortOrder: sortField === 'end_date' ? (sortOrder === 'desc' ? 'descend' : 'ascend') : null,
        render: (_value, record) => formatDate(record.end_date),
      },
      {
        title: t('columnPercent', { defaultValue: '% Complete' }),
        key: 'percent',
        width: 160,
        sorter: true,
        sortOrder: sortField === 'percent' ? (sortOrder === 'desc' ? 'descend' : 'ascend') : null,
        render: (_value, record) => {
          if (record.percent_complete === null) {
            return (
              <Typography.Text type="secondary" italic>
                {t('noTasksYet', { defaultValue: 'No tasks yet' })}
              </Typography.Text>
            );
          }
          return (
            <Tooltip
              title={t('percentTooltip', {
                done: record.done_tasks,
                total: record.total_tasks,
                defaultValue: '{{done}} of {{total}} tasks done',
              })}
            >
              <Flex align="center" gap={8}>
                <Progress
                  percent={record.percent_complete}
                  showInfo={false}
                  size="small"
                  strokeColor={token.colorPrimary}
                  className="m-0 w-20"
                />
                <span className="text-xs font-semibold">{record.percent_complete}%</span>
              </Flex>
            </Tooltip>
          );
        },
      },
      {
        title: t('columnBlocked', { defaultValue: 'Blocked' }),
        key: 'blocked',
        width: 110,
        align: 'center',
        sorter: true,
        sortOrder: sortField === 'blocked' ? (sortOrder === 'desc' ? 'descend' : 'ascend') : null,
        render: (_value, record) => {
          if (record.blocked_count <= 0) {
            return <Typography.Text type="secondary">—</Typography.Text>;
          }
          return (
            <Tooltip
              title={t('blockedTooltip', {
                count: record.blocked_count,
                defaultValue: '{{count}} tasks with an unresolved Blocked by dependency',
              })}
            >
              <Tag color="error" className="m-0 font-semibold">
                {record.blocked_count}
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: t('columnConfidence', { defaultValue: 'Delivery Confidence' }),
        key: 'confidence',
        width: 220,
        sorter: true,
        sortOrder:
          sortField === 'confidence' ? (sortOrder === 'desc' ? 'descend' : 'ascend') : null,
        filters: [
          { text: t('chipOnTrack', { defaultValue: 'On track' }), value: 'green' },
          { text: t('chipAtRisk', { defaultValue: 'At risk' }), value: 'amber' },
          { text: t('chipOffTrack', { defaultValue: 'Off track' }), value: 'red' },
          { text: t('chipNotSet', { defaultValue: 'Not set' }), value: 'unset' },
        ],
        filteredValue: confidence.length ? confidence : null,
        render: (_value, record) => {
          const status = record.confidence;
          const label =
            status === 'green'
              ? t('chipOnTrack', { defaultValue: 'On track' })
              : status === 'amber'
                ? t('chipAtRisk', { defaultValue: 'At risk' })
                : status === 'red'
                  ? t('chipOffTrack', { defaultValue: 'Off track' })
                  : t('chipNotSet', { defaultValue: 'Not set' });
          const color =
            status === 'green'
              ? token.colorSuccess
              : status === 'amber'
                ? token.colorWarning
                : status === 'red'
                  ? token.colorError
                  : token.colorTextSecondary;
          const background =
            status === 'green'
              ? token.colorSuccessBg
              : status === 'amber'
                ? token.colorWarningBg
                : status === 'red'
                  ? token.colorErrorBg
                  : token.colorFillQuaternary;

          const pill = (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                color,
                background,
                border: status ? '1px solid transparent' : `1px dashed ${token.colorBorder}`,
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: color }}
              />
              {label}
            </span>
          );
          return record.confidence_note ? (
            <Tooltip title={record.confidence_note}>{pill}</Tooltip>
          ) : (
            pill
          );
        },
      },
      {
        title: t('columnUpdated', { defaultValue: 'Last updated' }),
        key: 'updated',
        width: 150,
        sorter: true,
        sortOrder: sortField === 'updated' ? (sortOrder === 'desc' ? 'descend' : 'ascend') : null,
        render: (_value, record) => {
          if (!record.confidence_updated_at) {
            return <Typography.Text type="secondary">—</Typography.Text>;
          }
          const when = (
            <span className="text-xs" style={{ color: token.colorTextSecondary }}>
              {fromNow(record.confidence_updated_at)}
            </span>
          );
          return record.confidence_updated_by_name ? (
            <Tooltip
              title={t('updatedBy', {
                name: record.confidence_updated_by_name,
                defaultValue: 'by {{name}}',
              })}
            >
              {when}
            </Tooltip>
          ) : (
            when
          );
        },
      },
      {
        title: t('columnActions', { defaultValue: 'Actions' }),
        key: 'actions',
        width: 90,
        align: 'center',
        fixed: 'right',
        render: (_value, record) => (
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                {
                  key: 'view-insights',
                  icon: <EyeOutlined />,
                  label: t('viewInsights', { defaultValue: 'View insights' }),
                  onClick: () => handleOpenInsights(record.id),
                },
              ],
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              aria-label={t('rowActions', { defaultValue: 'Row actions' })}
            />
          </Dropdown>
        ),
      },
    ],
    [
      clientIds,
      clientOptions,
      managerIds,
      managerOptions,
      confidence,
      handleOpenInsights,
      sortField,
      sortOrder,
      t,
      token.colorBorder,
      token.colorError,
      token.colorErrorBg,
      token.colorFillQuaternary,
      token.colorPrimary,
      token.colorSuccess,
      token.colorSuccessBg,
      token.colorText,
      token.colorTextSecondary,
      token.colorWarning,
      token.colorWarningBg,
    ]
  );

  const handleTableChange: TableProps<IProgressTrackingProject>['onChange'] = (
    pagination,
    filters,
    sorter
  ) => {
    const nextSize = pagination.pageSize ?? pageSize;
    const nextPage = pagination.current ?? 1;
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    const nextClients = ((filters.client as string[] | null) ?? []).map(String);
    const nextManagers = ((filters.manager as string[] | null) ?? []).map(String);
    const nextConfidence = ((filters.confidence as string[] | null) ?? []) as typeof confidence;
    const filtersChanged =
      nextClients.join() !== clientIds.join() ||
      nextManagers.join() !== managerIds.join() ||
      nextConfidence.join() !== confidence.join();
    if (filtersChanged) {
      setClientIds(nextClients);
      setManagerIds(nextManagers);
      setConfidence(nextConfidence);
      setPage(1);
      return;
    }

    if (activeSorter?.order && activeSorter.columnKey) {
      const nextField = activeSorter.columnKey as SortField;
      const nextOrder = activeSorter.order === 'descend' ? 'desc' : 'asc';
      const sortChanged = nextField !== sortField || nextOrder !== sortOrder;
      setSortField(nextField);
      setSortOrder(nextOrder);
      setPageSize(nextSize);
      setPage(sortChanged || nextSize !== pageSize ? 1 : nextPage);
      return;
    }

    const sortCleared = sortField !== undefined;
    setSortField(undefined);
    setSortOrder(undefined);
    setPageSize(nextSize);
    setPage(sortCleared || nextSize !== pageSize ? 1 : nextPage);
  };

  const handleConfidenceChip = (key: DeliveryConfidenceFilter) => {
    setConfidence(key === 'all' ? [] : [key]);
    setPage(1);
  };

  const handleHiddenColumnsChange = useCallback((next: string[]) => {
    setHiddenColumns(next);
    try {
      localStorage.setItem(HIDDEN_COLUMNS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: the choice just won't persist
    }
  }, []);

  // The first load has no rows yet, so draw placeholder rows instead of an empty state.
  const showSkeleton = isLoading && projects.length === 0;

  const visibleColumns = useMemo(
    () => (columns ?? []).filter(column => !hiddenColumns.includes(String(column.key))),
    [columns, hiddenColumns]
  );

  const activeFilterCount =
    confidence.length +
    clientIds.length +
    managerIds.length +
    percentRange.length +
    (hasBlockers ? 1 : 0) +
    (includeArchived ? 1 : 0);

  const handleClearFilters = () => {
    setConfidence([]);
    setClientIds([]);
    setManagerIds([]);
    setPercentRange([]);
    setHasBlockers(false);
    setIncludeArchived(false);
    setPage(1);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState<number>(240);

  // Size the table body to the space left above the pagination footer so the header stays visible.
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const header = element.querySelector<HTMLElement>('.ant-table-header')?.offsetHeight ?? 40;
      setScrollY(Math.max(120, element.clientHeight - header - 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [projects, isLoading, hasError]);

  const handlePageSizeChange = (nextSize: number) => {
    setPageSize(nextSize);
    setPage(1);
  };

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const isFiltered = Boolean(
    search ||
    confidence.length ||
    clientIds.length ||
    managerIds.length ||
    percentRange.length ||
    hasBlockers ||
    includeArchived
  );

  return (
    // Fills the reporting layout (viewport - top bar - content padding) so only the table scrolls.
    <Flex vertical gap={16} style={{ height: 'calc(100vh - 52px - 48px)', overflow: 'hidden' }}>
      <Flex align="flex-end" justify="space-between" gap={12} wrap="wrap">
        <Flex vertical gap={4}>
          <Typography.Title level={3} className="!mb-0 !mt-1">
            {t('pageTitle', { defaultValue: 'Progress Tracking' })}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('pageSubtitle', {
              defaultValue:
                'Follow how far each project has come, how confident its managers are, and which ones need attention.',
            })}
          </Typography.Text>
        </Flex>
        <Flex gap={8} wrap="wrap" align="center" justify="end">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
            placeholder={t('searchPlaceholder', { defaultValue: 'Search project or client…' })}
            aria-label={t('searchLabel', { defaultValue: 'Search projects or clients' })}
            className="w-[320px] max-w-full"
          />
          <Flex gap={8} align="center">
            <Popover
              trigger="click"
              placement="bottomRight"
              title={t('filtersTitle', { defaultValue: 'Filters' })}
              content={
                <Flex vertical gap={12} className="max-w-[360px]">
                  <Typography.Text type="secondary" className="text-xs">
                    {t('quickFilters', { defaultValue: 'Quick filters' })}
                  </Typography.Text>
                  <Flex gap={8} wrap="wrap">
                    <FilterMenuButton
                      label={t('columnManager', { defaultValue: 'Project Manager' })}
                      value={managerIds}
                      onChange={value => {
                        setManagerIds(value);
                        setPage(1);
                      }}
                      options={managerOptions.map(manager => ({
                        value: manager.id,
                        label: manager.name,
                      }))}
                    />
                    <FilterMenuButton
                      label={t('columnClient', { defaultValue: 'Client' })}
                      value={clientIds}
                      onChange={value => {
                        setClientIds(value);
                        setPage(1);
                      }}
                      options={clientOptions.map(client => ({
                        value: client.id,
                        label: client.name,
                      }))}
                    />
                    <FilterMenuButton
                      label={t('columnConfidence', { defaultValue: 'Delivery Confidence' })}
                      value={confidence}
                      onChange={value => {
                        setConfidence(value as ('green' | 'amber' | 'red' | 'unset')[]);
                        setPage(1);
                      }}
                      options={chipItems
                        .filter(item => item.key !== 'all')
                        .map(item => ({ value: item.key, label: `${item.label} (${item.count})` }))}
                    />
                    <FilterMenuButton
                      label={t('percentRangeLabel', { defaultValue: 'Percent complete' })}
                      value={percentRange}
                      onChange={value => {
                        setPercentRange(value as ProgressTrackingPercentRange[]);
                        setPage(1);
                      }}
                      options={[
                        {
                          value: 'no_tasks',
                          label: t('percentRangeNoTasks', { defaultValue: 'No tasks yet' }),
                        },
                        { value: '0_25', label: t('percentRange0', { defaultValue: '0–25%' }) },
                        { value: '26_50', label: t('percentRange26', { defaultValue: '26–50%' }) },
                        { value: '51_75', label: t('percentRange51', { defaultValue: '51–75%' }) },
                        {
                          value: '76_100',
                          label: t('percentRange76', { defaultValue: '76–100%' }),
                        },
                      ]}
                    />
                    <FilterMenuButton
                      label={t('blockers', { defaultValue: 'Blockers' })}
                      value={hasBlockers ? ['blocked'] : []}
                      onChange={value => {
                        setHasBlockers(value.length > 0);
                        setPage(1);
                      }}
                      options={[
                        {
                          value: 'blocked',
                          label: t('hasBlockers', { defaultValue: 'Has blockers' }),
                        },
                      ]}
                    />
                  </Flex>
                  <Flex>
                    <Checkbox
                      checked={includeArchived}
                      onChange={event => {
                        setIncludeArchived(event.target.checked);
                        setPage(1);
                      }}
                    >
                      {t('includeArchived', { defaultValue: 'Include archived projects' })}
                    </Checkbox>
                  </Flex>
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
            <Popover
              trigger="click"
              placement="bottomRight"
              title={t('showHideColumns', { defaultValue: 'Show or hide columns' })}
              content={
                <Flex vertical gap={4} className="min-w-[200px]">
                  {TOGGLEABLE_COLUMNS.map(column => (
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
      </Flex>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[
          {
            key: 'all' as const,
            label: t('statTotal', { defaultValue: 'Total projects' }),
            sub: t('statTotalSub', { defaultValue: 'All active projects' }),
            count: summary.total,
            color: token.colorPrimary,
          },
          {
            key: 'green' as const,
            label: t('statOnTrack', { defaultValue: 'On track' }),
            sub: t('statOnTrackSub', { defaultValue: 'Delivering as planned' }),
            count: summary.on_track,
            color: token.colorSuccess,
          },
          {
            key: 'amber' as const,
            label: t('statAtRisk', { defaultValue: 'At risk' }),
            sub: t('statAtRiskSub', { defaultValue: 'Needs attention' }),
            count: summary.at_risk,
            color: token.colorWarning,
          },
          {
            key: 'red' as const,
            label: t('statOffTrack', { defaultValue: 'Off track' }),
            sub: t('statOffTrackSub', { defaultValue: 'Behind plan' }),
            count: summary.off_track,
            color: token.colorError,
          },
          {
            key: 'unset' as const,
            label: t('statNotSet', { defaultValue: 'Confidence not set' }),
            sub: t('statNotSetSub', { defaultValue: 'No confidence update yet' }),
            count: summary.not_set,
            color: token.purple,
          },
        ].map(item => {
          const isActive =
            item.key === 'all'
              ? confidence.length === 0
              : confidence.length === 1 && confidence[0] === item.key;
          return (
            <Card
              key={item.key}
              size="small"
              hoverable
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onClick={() => handleConfidenceChip(item.key)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleConfidenceChip(item.key);
                }
              }}
              style={{ borderColor: isActive ? token.colorPrimary : undefined }}
            >
              <Typography.Text type="secondary" className="text-xs uppercase">
                {item.label}
              </Typography.Text>
              <div className="text-3xl font-semibold" style={{ color: item.color }}>
                {item.count}
              </div>
              <Typography.Text type="secondary" className="text-xs">
                {item.sub}
              </Typography.Text>
            </Card>
          );
        })}
      </div>

      {hasError ? (
        <Alert
          type="error"
          showIcon
          message={t('loadFailed', { defaultValue: 'Could not load Progress Tracking.' })}
          action={
            <Button size="small" onClick={() => void loadProjects()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      ) : null}

      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
        style={{ borderColor: token.colorBorderSecondary, background: token.colorBgContainer }}
      >
        <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden">
          <Table<IProgressTrackingProject>
            size="middle"
            showSorterTooltip={false}
            rowKey="id"
            columns={showSkeleton ? toSkeletonColumns(visibleColumns) : visibleColumns}
            dataSource={showSkeleton ? buildSkeletonRows<IProgressTrackingProject>(pageSize) : projects}
            loading={isLoading && !showSkeleton}
            onChange={handleTableChange}
            scroll={{ x: 'max-content', y: scrollY }}
            locale={{
              emptyText: (
                <Empty
                  description={
                    isFiltered
                      ? t('emptyFiltered', { defaultValue: 'No projects match these filters.' })
                      : t('emptyTitle', { defaultValue: 'No projects to show' })
                  }
                />
              ),
            }}
            pagination={false}
          />
        </div>
        <Flex
          align="center"
          justify="space-between"
          gap={12}
          wrap="wrap"
          className="px-4 py-3"
          style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
        >
          <Flex align="center" gap={8}>
            <label htmlFor="progress-tracking-page-size" className="text-xs">
              {t('rowsPerPage', { defaultValue: 'Rows per page:' })}
            </label>
            <select
              id="progress-tracking-page-size"
              value={pageSize}
              onChange={event => handlePageSizeChange(Number(event.target.value))}
              className="rounded-md border px-2 py-1 text-xs"
              style={{
                background: token.colorBgContainer,
                color: token.colorText,
                borderColor: token.colorBorder,
              }}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-xs" style={{ color: token.colorTextSecondary }}>
              {t('rangeOfTotal', {
                start: rangeStart,
                end: rangeEnd,
                total,
                defaultValue: '{{start}}-{{end}} of {{total}}',
              })}
            </span>
          </Flex>
          <Flex align="center" gap={8}>
            <Button
              size="small"
              aria-label={t('firstPage', { defaultValue: 'First page' })}
              disabled={page <= 1}
              onClick={() => setPage(1)}
            >
              «
            </Button>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger={false}
              onChange={nextPage => setPage(nextPage)}
            />
            <Button
              size="small"
              aria-label={t('lastPage', { defaultValue: 'Last page' })}
              disabled={page >= lastPage}
              onClick={() => setPage(lastPage)}
            >
              »
            </Button>
          </Flex>
        </Flex>
      </div>
    </Flex>
  );
};

export default memo(ProgressTrackingPage);
