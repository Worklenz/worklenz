import { CSSProperties, memo, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Popover,
  Select,
  Skeleton,
  Table,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';
import { DownOutlined, EyeOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_portfolio } from '@/shared/worklenz-analytics-events';
import {
  buildPortfolioExportUrl,
  PortfolioCategory,
  PortfolioExportType,
  PortfolioPeriod,
  PortfolioProject,
  useGetPortfolioQuery,
} from '@/api/reporting/portfolio.api.service';
import type {
  PortfolioCounts,
  PortfolioKpis,
  PortfolioLookupItem,
  PortfolioLookups,
} from '@/api/reporting/portfolio.api.service';

const YEARS_BACK = 4;
const COUNT_COLUMN_WIDTH = 110;
const HIDDEN_COLUMNS_STORAGE_KEY = 'worklenz.reporting.portfolio.hiddenColumns';
const OVERDUE_COLUMN_KEY = 'overdue';

type ColumnGroup = 'status' | 'priority' | 'health';

const compareText = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '');

/** Missing dates sort as the earliest value. */
const compareDate = (a: string | null, b: string | null) =>
  (a ? new Date(a).getTime() : 0) - (b ? new Date(b).getTime() : 0);

const NO_CATEGORY_KEY = '__none__';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const columnKey = (group: ColumnGroup, id: string) => `${group}:${id}`;

const readHiddenColumns = (): string[] => {
  try {
    const stored = localStorage.getItem(HIDDEN_COLUMNS_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
};

/** Reads a count for a table column key (`total`, `overdue` or `<group>:<id>`). */
const readCount = (counts: PortfolioCounts, key: string): number => {
  if (key === 'total') return counts.total;
  if (key === OVERDUE_COLUMN_KEY) return counts.overdue;
  const [group, id] = key.split(':') as [ColumnGroup, string];
  return counts[group]?.[id] ?? 0;
};

export const PortfolioDashboard = () => {
  const { t, i18n } = useTranslation('reporting-portfolio');
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle(t('title', { defaultValue: 'Project Portfolio' }));

  const now = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState<PortfolioPeriod>('monthly');
  const [year, setYear] = useState<number>(now.getFullYear());
  const [quarter, setQuarter] = useState<number>(Math.floor(now.getMonth() / 3) + 1);
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const handleHiddenColumnsChange = useCallback((next: string[]) => {
    setHiddenColumns(next);
    try {
      localStorage.setItem(HIDDEN_COLUMNS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: the choice just won't persist
    }
  }, []);

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_portfolio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selection = useMemo(() => ({ period, year, quarter, month }), [period, year, quarter, month]);
  const { data, isLoading, isFetching, isError, refetch } = useGetPortfolioQuery(selection);
  const portfolio = data?.body;

  const periodOptions = [
    { value: 'yearly', label: t('yearly', { defaultValue: 'Yearly' }) },
    { value: 'quarterly', label: t('quarterly', { defaultValue: 'Quarterly' }) },
    { value: 'monthly', label: t('monthly', { defaultValue: 'Monthly' }) },
  ];
  const yearOptions = Array.from({ length: YEARS_BACK + 1 }, (_, index) => {
    const value = now.getFullYear() - index;
    return { value, label: String(value) };
  });
  const quarterOptions = [1, 2, 3, 4].map(value => ({
    value,
    label: t('quarterLabel', { quarter: value, defaultValue: 'Q{{quarter}}' }),
  }));
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Intl.DateTimeFormat(i18n.language, { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2000, index, 1))
    ),
  }));

  const handleExport = (type: PortfolioExportType) => {
    window.location.href = buildPortfolioExportUrl(selection, type);
  };

  const exportItems = [
    {
      key: 'detailed',
      label: t('detailedReport', { defaultValue: 'Detailed Report' }),
      onClick: () => handleExport('detailed'),
    },
    {
      key: 'summary',
      label: t('summaryReport', { defaultValue: 'Summary Report' }),
      onClick: () => handleExport('summary'),
    },
  ];

  return (
    // Fills the reporting layout (viewport - top bar - content padding) so only the table scrolls.
    <Flex vertical gap={16} style={{ height: 'calc(100vh - 52px - 48px)', overflow: 'hidden' }}>
      <CustomPageHeader
        title={t('title', { defaultValue: 'Project Portfolio' })}
        style={{ padding: 0 }}
      />

      <Card size="small">
        <Flex gap={12} wrap="wrap" align="center" justify="space-between">
          <Flex gap={8} wrap="wrap" align="center">
            <Typography.Text strong>{t('reportingPeriod', { defaultValue: 'Reporting Period' })}</Typography.Text>
            <Select
              className="min-w-[130px]"
              value={period}
              options={periodOptions}
              onChange={setPeriod}
              aria-label={t('reportingPeriod', { defaultValue: 'Reporting Period' })}
            />
            {period === 'quarterly' && (
              <Select
                className="min-w-[90px]"
                value={quarter}
                options={quarterOptions}
                onChange={setQuarter}
                aria-label={t('quarter', { defaultValue: 'Quarter' })}
              />
            )}
            {period === 'monthly' && (
              <Select
                className="min-w-[140px]"
                value={month}
                options={monthOptions}
                onChange={setMonth}
                aria-label={t('month', { defaultValue: 'Month' })}
              />
            )}
            <Select
              className="min-w-[100px]"
              value={year}
              options={yearOptions}
              onChange={setYear}
              aria-label={t('year', { defaultValue: 'Year' })}
            />
          </Flex>
          <Flex gap={8} align="center">
            <Dropdown menu={{ items: exportItems }} trigger={['click']} disabled={!portfolio}>
              <Button icon={<DownOutlined />} iconPosition="end">
                {t('exportReports', { defaultValue: 'Export' })}
              </Button>
            </Dropdown>
            {portfolio && (
              <ColumnVisibilityPopover
                lookups={portfolio.lookups}
                hidden={hiddenColumns}
                onChange={handleHiddenColumnsChange}
              />
            )}
          </Flex>
        </Flex>
      </Card>

      {isError ? (
        <Alert
          type="error"
          showIcon
          message={t('errorTitle', { defaultValue: 'Could not load the portfolio' })}
          description={t('errorDescription', { defaultValue: 'Something went wrong while loading the report.' })}
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      ) : isLoading || !portfolio ? (
        <PortfolioSkeleton />
      ) : (
        <>
          <PortfolioKpiCards kpis={portfolio.kpis} />
          <PortfolioCategoryTable
            categories={portfolio.categories}
            lookups={portfolio.lookups}
            hiddenColumns={hiddenColumns}
            loading={isFetching}
          />
        </>
      )}
    </Flex>
  );
};

const SKELETON_TABLE_ROWS = 6;

/** Loading placeholder shaped like the real page: four KPI cards over a table. */
const PortfolioSkeleton = () => {
  const { t } = useTranslation('reporting-portfolio');
  return (
    <Flex
      vertical
      gap={16}
      className="min-h-0 flex-1"
      role="status"
      aria-busy="true"
      aria-label={t('loading', { defaultValue: 'Loading portfolio' })}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} size="small">
            <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 2, width: ['40%', '50%'] }} />
          </Card>
        ))}
      </div>
      <Card size="small" className="min-h-0 flex-1 overflow-hidden">
        <Flex vertical gap={12}>
          <Skeleton.Input active block size="default" />
          {Array.from({ length: SKELETON_TABLE_ROWS }, (_, index) => (
            <Skeleton.Input key={index} active block size="small" />
          ))}
        </Flex>
      </Card>
    </Flex>
  );
};

const PortfolioKpiCards = memo(({ kpis }: { kpis: PortfolioKpis }) => {
  const { t } = useTranslation('reporting-portfolio');
  const { token } = theme.useToken();

  const cards = [
    { key: 'opening', label: t('openingCount', { defaultValue: 'Opening project count' }), sub: t('openingSub', { defaultValue: 'Ongoing projects' }), value: kpis.opening },
    { key: 'new', label: t('newCount', { defaultValue: 'New' }), sub: t('newSub', { defaultValue: 'New projects' }), value: kpis.new },
    { key: 'close', label: t('closeCount', { defaultValue: 'Close' }), sub: t('closeSub', { defaultValue: 'Closed projects' }), value: kpis.close },
    { key: 'closing', label: t('closingCount', { defaultValue: 'Closing project count' }), sub: t('closingSub', { defaultValue: 'Portfolio balance' }), value: kpis.closing },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => (
        <Card key={card.key} size="small">
          <Flex justify="space-between" align="start">
            <Typography.Text type="secondary" className="text-xs uppercase">
              {card.label}
            </Typography.Text>
            {(card.key === 'close' || card.key === 'opening') && (
              <Tooltip
                title={t('kpiNote', {
                  defaultValue:
                    'Projects have no closed date, so Opening and Close are estimated from each project’s last update.',
                })}
              >
                <InfoCircleOutlined
                  tabIndex={0}
                  aria-label={t('kpiNoteLabel', { defaultValue: 'How this is calculated' })}
                  style={{ color: token.colorTextSecondary }}
                />
              </Tooltip>
            )}
          </Flex>
          <div className="text-3xl font-semibold" style={{ color: token.colorText }}>
            {card.value}
          </div>
          <Typography.Text type="secondary" className="text-xs">
            {card.sub}
          </Typography.Text>
        </Card>
      ))}
    </div>
  );
});
PortfolioKpiCards.displayName = 'PortfolioKpiCards';

interface ColumnVisibilityPopoverProps {
  lookups: PortfolioLookups;
  hidden: string[];
  onChange: (hidden: string[]) => void;
}

const ColumnVisibilityPopover = memo(({ lookups, hidden, onChange }: ColumnVisibilityPopoverProps) => {
  const { t } = useTranslation('reporting-portfolio');
  const label = t('showHideColumns', { defaultValue: 'Show or hide columns' });

  const sections: { group: ColumnGroup; title: string; items: { key: string; name: string }[] }[] = [
    {
      group: 'status',
      title: t('projectStatus', { defaultValue: 'Project Status' }),
      items: [
        ...lookups.statuses.map(item => ({ key: columnKey('status', item.id), name: item.name })),
        { key: OVERDUE_COLUMN_KEY, name: t('overdue', { defaultValue: 'Overdue' }) },
      ],
    },
    {
      group: 'priority',
      title: t('projectPriority', { defaultValue: 'Project Priority' }),
      items: lookups.priorities.map(item => ({ key: columnKey('priority', item.id), name: item.name })),
    },
    {
      group: 'health',
      title: t('projectHealth', { defaultValue: 'Project Health' }),
      items: lookups.healths.map(item => ({ key: columnKey('health', item.id), name: item.name })),
    },
  ];

  const toggle = (key: string, isVisible: boolean) =>
    onChange(isVisible ? hidden.filter(value => value !== key) : [...hidden, key]);

  const content = (
    <Flex vertical gap={12} className="min-w-[200px]">
      {sections.map(section => (
        <Flex vertical gap={4} key={section.group}>
          <Typography.Text strong>{section.title}</Typography.Text>
          {section.items.map(item => (
            <Checkbox
              key={item.key}
              checked={!hidden.includes(item.key)}
              onChange={event => toggle(item.key, event.target.checked)}
            >
              {item.name}
            </Checkbox>
          ))}
        </Flex>
      ))}
      {hidden.length > 0 && (
        <Button size="small" type="link" className="self-start !px-0" onClick={() => onChange([])}>
          {t('showAllColumns', { defaultValue: 'Show all columns' })}
        </Button>
      )}
    </Flex>
  );

  return (
    <Popover trigger="click" placement="bottomRight" title={label} content={content}>
      <Tooltip title={label}>
        <Button icon={<EyeOutlined />} aria-label={label} />
      </Tooltip>
    </Popover>
  );
});
ColumnVisibilityPopover.displayName = 'ColumnVisibilityPopover';

interface PortfolioCategoryTableProps {
  categories: PortfolioCategory[];
  lookups: PortfolioLookups;
  hiddenColumns: string[];
  loading: boolean;
}

const PortfolioCategoryTable = memo(
  ({ categories, lookups, hiddenColumns, loading }: PortfolioCategoryTableProps) => {
  const { t } = useTranslation('reporting-portfolio');
  const { token } = theme.useToken();

  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

  const countColumn = (key: string, title: ReactNode) => ({
    key,
    title,
    width: COUNT_COLUMN_WIDTH,
    align: 'center' as const,
    sorter: (a: PortfolioCategory, b: PortfolioCategory) => readCount(a, key) - readCount(b, key),
    render: (_: unknown, record: PortfolioCategory) => readCount(record, key),
  });

  const optionTitle = (item: PortfolioLookupItem) => (
    <Flex gap={6} align="center" justify="center">
      {item.color && (
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: item.color }}
        />
      )}
      <span>{item.name}</span>
    </Flex>
  );

  const optionColumns = (group: ColumnGroup, items: PortfolioLookupItem[]) =>
    items
      .filter(item => !hiddenColumns.includes(columnKey(group, item.id)))
      .map(item => countColumn(columnKey(group, item.id), optionTitle(item)));

  const statusChildren = [
    ...optionColumns('status', lookups.statuses),
    ...(hiddenColumns.includes(OVERDUE_COLUMN_KEY)
      ? []
      : [
          countColumn(
            OVERDUE_COLUMN_KEY,
            <span style={{ color: token.colorError }}>{t('overdue', { defaultValue: 'Overdue' })}</span>
          ),
        ]),
  ];
  const priorityChildren = optionColumns('priority', lookups.priorities);
  const healthChildren = optionColumns('health', lookups.healths);

  const groupColumn = (key: string, title: string, children: ReturnType<typeof countColumn>[]) =>
    children.length ? [{ key, title, align: 'center' as const, children }] : [];

  const columns: TableColumnsType<PortfolioCategory> = [
    {
      key: 'category',
      title: t('projectCategory', { defaultValue: 'Project Category' }),
      width: 220,
      fixed: 'left',
      sorter: (a, b) => {
        if (a.id === null || b.id === null) return a.id === b.id ? 0 : a.id === null ? 1 : -1;
        return compareText(a.name, b.name);
      },
      filters: categories.map(category => ({
        text: category.name ?? t('uncategorized', { defaultValue: 'Uncategorized' }),
        value: category.id ?? NO_CATEGORY_KEY,
      })),
      filterSearch: true,
      filteredValue: categoryFilter.length ? categoryFilter : null,
      render: (_, record) => {
        const rowKey = record.id ?? '__none__';
        const isExpanded = expandedKeys.includes(rowKey);
        const name = record.name ?? t('uncategorized', { defaultValue: 'Uncategorized' });
        return (
          <Flex gap={4} align="center">
            {record.projects.length > 0 ? (
              <Button
                type="text"
                size="small"
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded
                    ? t('collapseRow', { name, defaultValue: 'Collapse {{name}}' })
                    : t('expandRow', { name, defaultValue: 'Expand {{name}}' })
                }
                icon={
                  <RightOutlined
                    style={{
                      fontSize: 10,
                      transition: 'transform 200ms',
                      transform: isExpanded ? 'rotate(90deg)' : 'none',
                    }}
                  />
                }
                onClick={() =>
                  setExpandedKeys(keys => (isExpanded ? keys.filter(key => key !== rowKey) : [...keys, rowKey]))
                }
              />
            ) : (
              <span className="inline-block w-6" aria-hidden />
            )}
            <span>{name}</span>
          </Flex>
        );
      },
    },
    countColumn('total', t('totalProjects', { defaultValue: 'Total Projects' })),
    ...groupColumn('group-status', t('projectStatus', { defaultValue: 'Project Status' }), statusChildren),
    ...groupColumn('group-priority', t('projectPriority', { defaultValue: 'Project Priority' }), priorityChildren),
    ...groupColumn('group-health', t('projectHealth', { defaultValue: 'Project Health' }), healthChildren),
  ];

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState<number>(240);

  // Size the table body to the space left in the page so the header and Total row stay visible.
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const header = element.querySelector<HTMLElement>('.ant-table-header')?.offsetHeight ?? 80;
      const footer = element.querySelector<HTMLElement>('.ant-table-summary')?.offsetHeight ?? 40;
      setScrollY(Math.max(120, element.clientHeight - header - footer - 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [categories, hiddenColumns, loading]);

  const visibleCategories = categoryFilter.length
    ? categories.filter(category => categoryFilter.includes(category.id ?? NO_CATEGORY_KEY))
    : categories;

  /** The Total row follows the category filter. */
  const visibleTotal = (key: string) => visibleCategories.reduce((sum, category) => sum + readCount(category, key), 0);

  const summaryKeys = ['total', ...[...statusChildren, ...priorityChildren, ...healthChildren].map(column => column.key as string)];

  const projectColumns: TableColumnsType<PortfolioProject> = [
    {
      key: 'name',
      title: t('projectName', { defaultValue: 'Project Name' }),
      dataIndex: 'name',
      sorter: (a, b) => compareText(a.name, b.name),
    },
    {
      key: 'status',
      title: t('status', { defaultValue: 'Status' }),
      dataIndex: 'status',
      sorter: (a, b) => compareText(a.status, b.status),
    },
    {
      key: 'priority',
      title: t('priority', { defaultValue: 'Priority' }),
      sorter: (a, b) => (a.priorityValue ?? -1) - (b.priorityValue ?? -1),
      render: (_, project) => project.priority ?? '-',
    },
    {
      key: 'health',
      title: t('health', { defaultValue: 'Health' }),
      sorter: (a, b) => compareText(a.health, b.health),
      render: (_, project) =>
        project.health ? (
          <span style={{ color: project.healthColor ?? token.colorText, fontWeight: 600 }}>{project.health}</span>
        ) : (
          '-'
        ),
    },
    {
      key: 'manager',
      title: t('projectManager', { defaultValue: 'Project Manager' }),
      sorter: (a, b) => compareText(a.manager, b.manager),
      render: (_, project) => project.manager ?? '-',
    },
    {
      key: 'startDate',
      title: t('startDate', { defaultValue: 'Start Date' }),
      sorter: (a, b) => compareDate(a.startDate, b.startDate),
      render: (_, project) => formatDate(project.startDate),
    },
    {
      key: 'endDate',
      title: t('endDate', { defaultValue: 'End Date' }),
      sorter: (a, b) => compareDate(a.endDate, b.endDate),
      render: (_, project) => formatDate(project.endDate),
    },
  ];

  // Summary cells only take a className, so the theme tokens are passed down as CSS variables.
  const totalRowClass =
    '!bg-[var(--portfolio-total-bg)] !border-t-2 !border-t-[var(--portfolio-total-border)] font-semibold';

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-hidden"
      style={
        {
          '--portfolio-total-bg': token.colorPrimaryBg,
          '--portfolio-total-border': token.colorPrimary,
        } as CSSProperties
      }
    >
      <Table<PortfolioCategory>
        size="small"
        showSorterTooltip={false}
        bordered
        loading={loading}
        pagination={false}
        rowKey={record => record.id ?? '__none__'}
        columns={columns}
        dataSource={visibleCategories}
        onChange={(_pagination, filters) => setCategoryFilter((filters.category as string[] | null) ?? [])}
        scroll={{ x: 'max-content', y: scrollY }}
        locale={{
          emptyText: (
            <Empty
              description={t('noData', {
                defaultValue: 'No projects found for this period. Try a different reporting period.',
              })}
            />
          ),
        }}
        expandable={{
          showExpandColumn: false,
          expandedRowKeys: expandedKeys,
          rowExpandable: record => record.projects.length > 0,
          expandedRowRender: record => (
            <Table<PortfolioProject>
              size="small"
              showSorterTooltip={false}
              pagination={false}
              rowKey="id"
              columns={projectColumns}
              dataSource={record.projects}
              scroll={{ x: 'max-content' }}
            />
          ),
        }}
        summary={() =>
          categories.length ? (
            <Table.Summary fixed="bottom">
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} className={totalRowClass}>
                  <strong style={{ paddingLeft: 28 }}>{t('total', { defaultValue: 'Total' })}</strong>
                </Table.Summary.Cell>
                {summaryKeys.map((key, index) => (
                  <Table.Summary.Cell key={key} index={index + 1} align="center" className={totalRowClass}>
                    <strong>{visibleTotal(key)}</strong>
                  </Table.Summary.Cell>
                ))}
              </Table.Summary.Row>
            </Table.Summary>
          ) : null
        }
      />
    </div>
  );
  }
);
PortfolioCategoryTable.displayName = 'PortfolioCategoryTable';

export default PortfolioDashboard;
