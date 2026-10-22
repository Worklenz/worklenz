import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  CaretDownFilled,
  CheckOutlined,
  Checkbox,
  CloseCircleOutlined,
  Dropdown,
  Empty,
  Flex,
  Input,
  Progress,
  Table,
  Tag,
  Tooltip,
  Typography,
  SearchOutlined,
  theme,
} from '@/shared/antd-imports';
import type { MenuProps, TableProps } from '@/shared/antd-imports';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_progress_tracking } from '@/shared/worklenz-analytics-events';
import { fromNow } from '@/utils/dateUtils';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { progressTrackingApiService } from '@/api/reporting/progress-tracking.api.service';
import {
  DeliveryConfidenceFilter,
  IProgressTrackingProject,
  IProgressTrackingSummary,
  ProgressTrackingPercentRange,
} from '@/types/reporting/progress-tracking.types';
import logger from '@/utils/errorLogger';
import { useAppSelector } from '@/app/store';
import TablePagination from '@/components/TablePagination';

const FILTER_BUTTON_STYLE: React.CSSProperties = {
  height: 32,
  fontSize: 12,
  borderRadius: 7,
  paddingInline: 12,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)',
};

const EMPTY_SUMMARY: IProgressTrackingSummary = {
  total: 0,
  on_track: 0,
  at_risk: 0,
  off_track: 0,
  not_set: 0,
  archived_excluded: 0,
};

interface OpenInsightsLinkProps {
  projectId: string;
  onOpen: (projectId: string) => void;
}

const OpenInsightsLink = ({ projectId, onOpen }: OpenInsightsLinkProps) => {
  const { t } = useTranslation('reporting-progress-tracking');
  const { token } = theme.useToken();
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');
  const [isHovered, setIsHovered] = useState(false);

  const handleOpen = () => onOpen(projectId);
  const handleHoverStart = () => setIsHovered(true);
  const handleHoverEnd = () => setIsHovered(false);

  return (
    <Button
      type="link"
      className="rounded px-1"
      style={{
        color: isHovered
          ? (isDarkMode ? token.colorPrimaryHover : token.colorPrimaryActive)
          : token.colorLink,
        background: isHovered ? token.colorPrimaryBg : 'transparent',
      }}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
      onFocus={handleHoverStart}
      onBlur={handleHoverEnd}
      onClick={handleOpen}
    >
      {t('openInsights', { defaultValue: 'Open Insights' })}
    </Button>
  );
};

type SortField = 'name' | 'client' | 'percent' | 'blocked' | 'confidence' | 'updated';

const ProgressTrackingPage = () => {
  const { t } = useTranslation('reporting-progress-tracking');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();

  useDocumentTitle(t('documentTitle', { defaultValue: 'Reporting - Progress Tracking' }));

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [confidence, setConfidence] = useState<DeliveryConfidenceFilter>('all');
  const [percentRange, setPercentRange] = useState<ProgressTrackingPercentRange | undefined>();
  const [hasBlockers, setHasBlockers] = useState(false);
  const [sortField, setSortField] = useState<SortField | undefined>();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [projects, setProjects] = useState<IProgressTrackingProject[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<IProgressTrackingSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
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

  const loadProjects = useCallback(async (silent = false) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!silent) setIsLoading(true);
    setHasError(false);

    try {
      const response = await progressTrackingApiService.getProjects({
        search: search || undefined,
        confidence: confidence === 'all' ? undefined : confidence,
        percent_range: percentRange,
        has_blockers: hasBlockers || undefined,
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
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      logger.error('Failed to load progress tracking', error);
      setHasError(true);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [confidence, hasBlockers, page, pageSize, percentRange, search, sortField, sortOrder]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleOpenInsights = useCallback((projectId: string) => {
    navigate(
      `/worklenz/projects/${projectId}?tab=project-insights-member-overview&pinned_tab=project-insights-member-overview`
    );
  }, [navigate]);

  const percentRangeOptions: MenuProps['items'] = useMemo(
    () => [
      {
        key: 'all',
        label: t('percentRangeAll', { defaultValue: 'Any % complete' }),
        icon: !percentRange ? <CheckOutlined style={{ fontSize: 11 }} /> : <span style={{ display: 'inline-block', width: 11 }} />,
      },
      {
        type: 'divider',
      },
      {
        key: 'no_tasks',
        label: t('percentRangeNoTasks', { defaultValue: 'No tasks yet' }),
        icon: percentRange === 'no_tasks' ? <CheckOutlined style={{ fontSize: 11 }} /> : <span style={{ display: 'inline-block', width: 11 }} />,
      },
      {
        key: '0_25',
        label: t('percentRange0', { defaultValue: '0–25%' }),
        icon: percentRange === '0_25' ? <CheckOutlined style={{ fontSize: 11 }} /> : <span style={{ display: 'inline-block', width: 11 }} />,
      },
      {
        key: '26_50',
        label: t('percentRange26', { defaultValue: '26–50%' }),
        icon: percentRange === '26_50' ? <CheckOutlined style={{ fontSize: 11 }} /> : <span style={{ display: 'inline-block', width: 11 }} />,
      },
      {
        key: '51_75',
        label: t('percentRange51', { defaultValue: '51–75%' }),
        icon: percentRange === '51_75' ? <CheckOutlined style={{ fontSize: 11 }} /> : <span style={{ display: 'inline-block', width: 11 }} />,
      },
      {
        key: '76_100',
        label: t('percentRange76', { defaultValue: '76–100%' }),
        icon: percentRange === '76_100' ? <CheckOutlined style={{ fontSize: 11 }} /> : <span style={{ display: 'inline-block', width: 11 }} />,
      },
    ],
    [percentRange, t]
  );

  const selectedPercentRangeLabel = useMemo(() => {
    if (!percentRange) return t('percentRangeAll', { defaultValue: 'Any % complete' });
    const match = percentRangeOptions.find(opt => opt && 'key' in opt && opt.key === percentRange);
    const label = match && 'label' in match ? match.label : percentRange;
    return `${t('percentRangeLabel', { defaultValue: 'Percent complete' })}: ${label}`;
  }, [percentRange, percentRangeOptions, t]);

  const handlePercentRangeClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'all') {
      setPercentRange(undefined);
    } else {
      setPercentRange(key as ProgressTrackingPercentRange);
    }
    setPage(1);
  };

  const handleClearPercentRange = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setPercentRange(undefined);
    setPage(1);
  };

  const chipItems = useMemo(() => {
    return [
      {
        key: 'all' as const,
        label: t('chipAll', { defaultValue: 'All' }),
        count: summary.total,
        color: token.colorPrimary,
        bg: token.colorPrimaryBg,
      },
      {
        key: 'green' as const,
        label: t('chipOnTrack', { defaultValue: 'On track' }),
        count: summary.on_track,
        color: token.colorSuccess,
        bg: token.colorSuccessBg,
      },
      {
        key: 'amber' as const,
        label: t('chipAtRisk', { defaultValue: 'At risk' }),
        count: summary.at_risk,
        color: token.colorWarning,
        bg: token.colorWarningBg,
      },
      {
        key: 'red' as const,
        label: t('chipOffTrack', { defaultValue: 'Off track' }),
        count: summary.off_track,
        color: token.colorError,
        bg: token.colorErrorBg,
      },
      {
        key: 'unset' as const,
        label: t('chipNotSet', { defaultValue: 'Not set' }),
        count: summary.not_set,
        color: token.colorTextSecondary,
        bg: token.colorFillSecondary,
      },
    ];
  }, [
    summary,
    t,
    token.colorError,
    token.colorErrorBg,
    token.colorFillSecondary,
    token.colorPrimary,
    token.colorPrimaryBg,
    token.colorSuccess,
    token.colorSuccessBg,
    token.colorTextSecondary,
    token.colorWarning,
    token.colorWarningBg,
  ]);

  const columns: TableProps<IProgressTrackingProject>['columns'] = useMemo(() => [
    {
      title: t('columnProject', { defaultValue: 'Project' }),
      key: 'name',
      width: 280,
      ellipsis: true,
      sorter: true,
      sortOrder: sortField === 'name' ? (sortOrder === 'desc' ? 'descend' : 'ascend') : null,
      render: (_value, record) => (
        <button
          type="button"
          className="block w-full truncate bg-transparent p-0 text-left font-semibold"
          style={{ color: token.colorText }}
          title={decodeHtmlEntities(record.name)}
          onClick={() => handleOpenInsights(record.id)}
        >
          {decodeHtmlEntities(record.name)}
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
      render: (value: string | null) => {
        if (!value) {
          return <Typography.Text type="secondary">—</Typography.Text>;
        }
        const decoded = decodeHtmlEntities(value);
        return (
          <Typography.Text ellipsis={{ tooltip: decoded }} style={{ color: token.colorText }}>
            {decoded}
          </Typography.Text>
        );
      },
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
            <Tag color="error" className="m-0 font-semibold">{record.blocked_count}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('columnConfidence', { defaultValue: 'Delivery Confidence' }),
      key: 'confidence',
      width: 220,
      sorter: true,
      sortOrder: sortField === 'confidence' ? (sortOrder === 'desc' ? 'descend' : 'ascend') : null,
      render: (_value, record) => {
        const status = record.confidence;
        const label = status === 'green'
          ? t('chipOnTrack', { defaultValue: 'On track' })
          : status === 'amber'
            ? t('chipAtRisk', { defaultValue: 'At risk' })
            : status === 'red'
              ? t('chipOffTrack', { defaultValue: 'Off track' })
              : t('chipNotSet', { defaultValue: 'Not set' });
        const color = status === 'green'
          ? token.colorSuccess
          : status === 'amber'
            ? token.colorWarning
            : status === 'red'
              ? token.colorError
              : token.colorTextSecondary;
        const background = status === 'green'
          ? token.colorSuccessBg
          : status === 'amber'
            ? token.colorWarningBg
            : status === 'red'
              ? token.colorErrorBg
              : token.colorFillQuaternary;

        return (
          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                color,
                background,
                border: status ? '1px solid transparent' : `1px dashed ${token.colorBorder}`,
              }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              {label}
            </span>
            {record.confidence_note ? (
              <Typography.Text type="secondary" ellipsis className="mt-1 block max-w-full text-xs" title={record.confidence_note}>
                {record.confidence_note}
              </Typography.Text>
            ) : null}
          </div>
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
        return (
          <div>
            <div className="text-xs" style={{ color: token.colorTextSecondary }}>
              {fromNow(record.confidence_updated_at)}
            </div>
            {record.confidence_updated_by_name ? (
              <div className="text-xs" style={{ color: token.colorTextSecondary }}>
                {t('updatedBy', {
                  name: record.confidence_updated_by_name,
                  defaultValue: 'by {{name}}',
                })}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      title: '',
      key: 'open',
      width: 128,
      render: (_value, record) => (
        <OpenInsightsLink projectId={record.id} onOpen={handleOpenInsights} />
      ),
    },
  ], [
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
  ]);

  const handleTableChange: TableProps<IProgressTrackingProject>['onChange'] = (
    _pagination,
    _filters,
    sorter
  ) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    if (activeSorter?.order && activeSorter.columnKey) {
      const nextField = activeSorter.columnKey as SortField;
      const nextOrder = activeSorter.order === 'descend' ? 'desc' : 'asc';

      setSortField(nextField);
      setSortOrder(nextOrder);
      setPage(1);
      return;
    }

    setSortField(undefined);
    setSortOrder(undefined);
    setPage(1);
  };
  const handleConfidenceChip = (key: DeliveryConfidenceFilter) => {
    const nextKey = confidence === key && key !== 'all' ? 'all' : key;
    setConfidence(nextKey);
    setPage(1);
  };

  const isFiltered = Boolean(search || confidence !== 'all' || percentRange || hasBlockers);

  return (
    <Flex vertical gap={16}>
      <div>
        <Typography.Title level={3} className="!mb-0 !mt-1">
          {t('pageTitle', { defaultValue: 'Progress Tracking' })}
        </Typography.Title>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[
          { key: 'all' as const, label: t('statTotal', { defaultValue: 'Total projects' }), count: summary.total, color: token.colorText },
          { key: 'green' as const, label: t('statOnTrack', { defaultValue: 'On track' }), count: summary.on_track, color: token.colorSuccess },
          { key: 'amber' as const, label: t('statAtRisk', { defaultValue: 'At risk' }), count: summary.at_risk, color: token.colorWarning },
          { key: 'red' as const, label: t('statOffTrack', { defaultValue: 'Off track' }), count: summary.off_track, color: token.colorError },
          { key: 'unset' as const, label: t('statNotSet', { defaultValue: 'Confidence not set' }), count: summary.not_set, color: token.colorTextSecondary },
        ].map(item => (
          <button
            key={item.key}
            type="button"
            aria-pressed={confidence === item.key}
            onClick={() => handleConfidenceChip(item.key)}
            className="rounded-lg border px-4 py-3 text-left"
            style={{
              background: token.colorBgContainer,
              borderColor: confidence === item.key ? token.colorPrimary : token.colorBorderSecondary,
            }}
          >
            <div className="text-xs" style={{ color: token.colorTextSecondary }}>{item.label}</div>
            <div className="text-2xl font-semibold" style={{ color: item.color }}>{item.count}</div>
          </button>
        ))}
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

      <Card>
        <Flex gap={8} wrap="wrap" align="center" className="mb-4">
          <Input
            prefix={
              <SearchOutlined
                style={{ color: token.colorTextTertiary }}
              />
            }
            allowClear
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
            placeholder={t('searchPlaceholder', { defaultValue: 'Search project or client…' })}
            aria-label={t('searchLabel', { defaultValue: 'Search projects or clients' })}
            className="max-w-[280px]"
            style={{
              height: 32,
              fontSize: 12,
              borderRadius: 7,
            }}
          />
          <Flex gap={8} wrap="wrap" role="group" aria-label={t('columnConfidence', { defaultValue: 'Delivery Confidence' })}>
            {chipItems.map(item => {
              const isActive = confidence === item.key;
              const activeBorderColor = item.key === 'unset' ? token.colorBorder : item.color;
              return (
                <Button
                  key={item.key}
                  aria-pressed={isActive}
                  onClick={() => handleConfidenceChip(item.key)}
                  style={
                    isActive
                      ? {
                          ...FILTER_BUTTON_STYLE,
                          borderColor: activeBorderColor,
                          color: item.color,
                          background: item.bg,
                        }
                      : FILTER_BUTTON_STYLE
                  }
                >
                  <Flex align="center" gap={6}>
                    {item.key !== 'all' && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: item.color,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span>{item.label}</span>
                    <span
                      style={{
                        fontWeight: isActive ? 600 : 400,
                        opacity: isActive ? 0.95 : 0.65,
                      }}
                    >
                      {item.count}
                    </span>
                  </Flex>
                </Button>
              );
            })}
          </Flex>
          <Dropdown
            trigger={['click']}
            open={dropdownOpen}
            onOpenChange={setDropdownOpen}
            menu={{
              items: percentRangeOptions,
              onClick: handlePercentRangeClick,
              selectedKeys: [percentRange ?? 'all'],
            }}
          >
            <Button
              aria-label={selectedPercentRangeLabel || t('percentRangeLabel', { defaultValue: 'Percent complete' })}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              style={
                dropdownOpen || Boolean(percentRange)
                  ? {
                      ...FILTER_BUTTON_STYLE,
                      borderColor: token.colorPrimary,
                      color: token.colorPrimary,
                      background: percentRange ? token.colorPrimaryBg : undefined,
                    }
                  : FILTER_BUTTON_STYLE
              }
            >
              <Flex align="center" gap={6}>
                <span>{selectedPercentRangeLabel}</span>
                {percentRange && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={t('percentRangeAll', { defaultValue: 'Any % complete' })}
                    onClick={handleClearPercentRange}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClearPercentRange(e);
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: token.colorPrimary,
                      lineHeight: 1,
                    }}
                  >
                    <CloseCircleOutlined style={{ fontSize: 11 }} />
                  </span>
                )}
                <CaretDownFilled
                  style={{
                    fontSize: 10,
                    color: dropdownOpen || Boolean(percentRange) ? token.colorPrimary : undefined,
                    transition: 'transform 0.2s ease',
                    transform: dropdownOpen ? 'rotate(180deg)' : undefined,
                  }}
                />
              </Flex>
            </Button>
          </Dropdown>
          <Checkbox
            checked={hasBlockers}
            onChange={event => {
              setHasBlockers(event.target.checked);
              setPage(1);
            }}
          >
            {t('hasBlockers', { defaultValue: 'Has blockers' })}
          </Checkbox>
        </Flex>

        <Table<IProgressTrackingProject>
          rowKey="id"
          columns={columns}
          dataSource={projects}
          loading={isLoading}
          onChange={handleTableChange}
          scroll={{ x: 1248 }}
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
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(nextPage, nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(nextPageSize !== pageSize ? 1 : nextPage);
          }}
          rowsPerPageLabel={t('rowsPerPage', {
            defaultValue: 'Rows per page',
          })}
          variant="dropdown"
        />

        {summary.archived_excluded > 0 ? (
          <Typography.Text type="secondary" className="mt-2 block text-xs">
            {t('archivedExcluded', {
              count: summary.archived_excluded,
              defaultValue: '{{count}} archived projects excluded from this view.',
            })}
          </Typography.Text>
        ) : null}
      </Card>
    </Flex>
  );
};

export default memo(ProgressTrackingPage);
