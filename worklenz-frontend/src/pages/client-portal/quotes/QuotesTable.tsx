import {
  Alert,
  Button,
  Card,
  Dropdown,
  Empty,
  Flex,
  Input,
  Modal,
  Select,
  Table,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import type { MenuProps, TableProps } from '@/shared/antd-imports';
import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import TablePagination from '@/components/TablePagination';
import {
  useDeleteQuoteMutation,
  useDuplicateQuoteMutation,
  useGetQuotesQuery,
  useUpdateQuoteStatusMutation,
} from '../../../api/client-portal/client-portal-quotes-api';
import type {
  ClientPortalQuote,
  ClientPortalQuoteStatus,
  ClientPortalQuoteTotals,
} from '../../../api/client-portal/client-portal-quotes-api';
import { formatDate } from '../../../utils/dateUtils';
import {
  PAGE_SIZE_OPTIONS,
  PENDING_QUOTE_STATUSES,
  QUOTE_STATUS_VALUES,
  formatMoney,
  getQuoteDownloadUrl,
  isQuoteExpired,
} from './quotes-list-helpers';
// Quotes share the invoices module's type scale and table/modal styling.
import '../invoices/invoices.css';

const { Text } = Typography;

const SEARCH_DEBOUNCE_MS = 300;
const QUOTES_PATH = '/worklenz/client-portal/quotes';

// Column `dataIndex` -> the backend's sortable column names.
const SORT_FIELDS: Record<string, string> = {
  quoteNumber: 'quote_no',
  clientName: 'client_name',
  amount: 'amount',
  createdAt: 'created_at',
  validUntil: 'valid_until',
};

export const QuotesTable = () => {
  const { t } = useTranslation('client-portal-quotes');
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // The card hugs its content but never grows past the room left on screen, so a full page of
  // rows scrolls inside the table instead of the whole page (same approach as the Invoices table).
  const containerRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const paginationRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(360);

  const measureTableHeight = useCallback(() => {
    const container = containerRef.current;
    const card = cardRef.current;
    if (!container || !card) return;
    const theadHeight = card.querySelector('.ant-table-thead')?.getBoundingClientRect().height ?? 0;
    const paginationHeight = paginationRef.current?.getBoundingClientRect().height ?? 0;
    const maxAvailable = container.getBoundingClientRect().bottom - card.getBoundingClientRect().top;
    setTableScrollY(Math.max(160, Math.round(maxAvailable - theadHeight - paginationHeight)));
  }, []);

  useLayoutEffect(() => {
    if (!containerRef.current || !cardRef.current) return undefined;
    measureTableHeight();
    const observer = new ResizeObserver(measureTableHeight);
    observer.observe(containerRef.current);
    if (filtersRef.current) observer.observe(filtersRef.current);
    if (paginationRef.current) observer.observe(paginationRef.current);
    return () => observer.disconnect();
  }, [measureTableHeight]);

  const {
    data: quotesData,
    isFetching,
    error,
    refetch,
  } = useGetQuotesQuery(
    {
      page,
      limit,
      search: search || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      sortBy,
      sortOrder,
    },
    { refetchOnMountOrArgChange: true }
  );

  const [updateQuoteStatus] = useUpdateQuoteStatusMutation();
  const [duplicateQuote] = useDuplicateQuoteMutation();
  const [deleteQuote] = useDeleteQuoteMutation();

  const quotesResponse = quotesData?.body;
  const quotes = useMemo(() => quotesResponse?.quotes ?? [], [quotesResponse]);
  const totalQuotes = quotesResponse?.total ?? 0;
  const hasActiveFilters = Boolean(search) || statusFilter !== 'all';
  const showsTable = quotes.length > 0 || isFetching;

  // Stat cards use the organization-wide totals so they still reconcile when the list is paged
  // or filtered; without them, fall back to the rows on screen.
  const totals: ClientPortalQuoteTotals = useMemo(() => {
    if (quotesResponse?.totals) return quotesResponse.totals;
    const sumWhere = (predicate: (quote: ClientPortalQuote) => boolean) =>
      quotes.filter(predicate).reduce((sum, quote) => sum + quote.amount, 0);
    return {
      totalQuoted: sumWhere(() => true),
      totalAccepted: sumWhere(quote => quote.status === 'accepted'),
      totalPending: sumWhere(quote => PENDING_QUOTE_STATUSES.includes(quote.status)),
    };
  }, [quotesResponse, quotes]);
  const statCurrency = quotes[0]?.currency;

  // The header row only exists once the table (rather than the empty state) renders.
  useLayoutEffect(() => {
    measureTableHeight();
  }, [measureTableHeight, showsTable]);

  // Search runs on the server, so wait for a pause in typing.
  useEffect(() => {
    if (searchInput === search) return undefined;
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  };

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'draft':
        return t('statusDraft', { defaultValue: 'Draft' });
      case 'sent':
        return t('statusSent', { defaultValue: 'Sent' });
      case 'accepted':
        return t('statusAccepted', { defaultValue: 'Accepted' });
      case 'declined':
        return t('statusDeclined', { defaultValue: 'Declined' });
      case 'expired':
        return t('statusExpired', { defaultValue: 'Expired' });
      default:
        return status;
    }
  };

  const statusOptions = QUOTE_STATUS_VALUES.map(value => ({ value, label: statusLabel(value) }));

  const sortOrderFor = (field: string): 'ascend' | 'descend' | null =>
    sortBy === field ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null;

  const handleTableChange: TableProps<ClientPortalQuote>['onChange'] = (
    _pagination,
    tableFilters,
    sorter
  ) => {
    const sort = Array.isArray(sorter) ? sorter[0] : sorter;

    if (sort?.field && sort.order) {
      setSortBy(SORT_FIELDS[String(sort.field)] ?? String(sort.field));
      setSortOrder(sort.order === 'ascend' ? 'asc' : 'desc');
    } else {
      setSortBy('created_at');
      setSortOrder('desc');
    }

    // The column filter sets the same value as the toolbar select; one value applies at a time.
    const statusValues = (tableFilters.status as string[] | null) || [];
    const nextStatus = statusValues.length > 0 ? statusValues[0] : 'all';
    if (nextStatus !== statusFilter) {
      setStatusFilter(nextStatus);
      setPage(1);
    }
  };

  const handlePaginationChange = (nextPage: number, pageSize: number) => {
    if (pageSize !== limit) {
      setLimit(pageSize);
      setPage(1);
      return;
    }
    setPage(nextPage);
  };

  const showRequestError = (err: unknown, fallback: string) => {
    const serverMessage = (err as { data?: { message?: string } })?.data?.message;
    message.error(serverMessage || fallback);
  };

  const handleStatusChange = async (quote: ClientPortalQuote, status: ClientPortalQuoteStatus) => {
    try {
      await updateQuoteStatus({ id: quote.id, status }).unwrap();
      message.success(t('statusUpdateSuccess', { defaultValue: 'Status updated successfully' }));
    } catch (err) {
      showRequestError(err, t('statusUpdateError', { defaultValue: 'Failed to update status' }));
    }
  };

  const handleDuplicate = async (quote: ClientPortalQuote) => {
    try {
      const result = await duplicateQuote(quote.id).unwrap();
      message.success(
        t('duplicateSuccess', {
          number: result.body?.quoteNumber ?? '',
          defaultValue: 'Duplicated as {{number}}.',
        })
      );
    } catch (err) {
      showRequestError(err, t('duplicateError', { defaultValue: 'Failed to duplicate quote' }));
    }
  };

  const confirmDelete = (quote: ClientPortalQuote) => {
    Modal.confirm({
      title: t('deleteConfirmationTitle', { defaultValue: 'Delete Quote' }),
      content: t('deleteConfirmationDescription', {
        number: quote.quoteNumber,
        defaultValue: 'Are you sure you want to delete {{number}}? This cannot be undone.',
      }),
      okText: t('deleteConfirmationOk', { defaultValue: 'Delete' }),
      cancelText: t('cancelButton', { defaultValue: 'Cancel' }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteQuote(quote.id).unwrap();
          message.success(t('deleteQuoteSuccess', { defaultValue: 'Quote deleted successfully' }));
        } catch (err) {
          showRequestError(err, t('deleteQuoteError', { defaultValue: 'Failed to delete quote' }));
        }
      },
    });
  };

  const getActionMenuItems = (quote: ClientPortalQuote): MenuProps['items'] => [
    {
      key: 'view',
      label: t('viewMenuItem', { defaultValue: 'View' }),
      icon: <EyeOutlined />,
      onClick: () => navigate(`${QUOTES_PATH}/${quote.id}`),
    },
    {
      key: 'download',
      label: t('downloadQuoteMenuItem', { defaultValue: 'Download Quote' }),
      icon: <DownloadOutlined />,
      onClick: () => window.open(getQuoteDownloadUrl(quote.id), '_blank', 'noopener,noreferrer'),
    },
    {
      key: 'duplicate',
      label: t('duplicateQuoteMenuItem', { defaultValue: 'Duplicate Quote' }),
      icon: <CopyOutlined />,
      onClick: () => handleDuplicate(quote),
    },
    { type: 'divider' },
    {
      key: 'delete',
      danger: true,
      label: t('deleteMenuItem', { defaultValue: 'Delete' }),
      icon: <DeleteOutlined />,
      onClick: () => confirmDelete(quote),
    },
  ];

  // Selects sit inside a clickable row, so they must not also open the quote.
  const stopRowClick = (node: React.ReactNode) => (
    <div onClick={event => event.stopPropagation()}>{node}</div>
  );

  const columns: TableProps<ClientPortalQuote>['columns'] = [
    {
      key: 'quoteNumber',
      title: t('quoteNoColumn', { defaultValue: 'Quote' }),
      dataIndex: 'quoteNumber',
      sorter: true,
      sortOrder: sortOrderFor('quote_no'),
      render: (_no, record) => (
        <Text strong style={{ color: token.colorPrimary }}>
          {record.quoteNumber}
        </Text>
      ),
    },
    {
      key: 'clientName',
      title: t('clientColumn', { defaultValue: 'Client' }),
      dataIndex: 'clientName',
      sorter: true,
      sortOrder: sortOrderFor('client_name'),
      render: (_name, record) =>
        record.clientId ? (
          // The row itself opens the quote, so the client link must not also trigger it.
          <Link
            to={`/worklenz/client-portal/clients/${record.clientId}`}
            style={{ textTransform: 'capitalize' }}
            onClick={event => event.stopPropagation()}
          >
            {record.clientName || '-'}
          </Link>
        ) : (
          <Text style={{ textTransform: 'capitalize' }}>{record.clientName || '-'}</Text>
        ),
    },
    {
      key: 'project',
      title: t('projectColumn', { defaultValue: 'Project' }),
      render: (_v, record) => (
        <Text type="secondary">{record.projectName || record.serviceName || '-'}</Text>
      ),
    },
    {
      key: 'amount',
      title: t('amountColumn', { defaultValue: 'Amount' }),
      dataIndex: 'amount',
      sorter: true,
      sortOrder: sortOrderFor('amount'),
      render: (_amount, record) => <Text strong>{formatMoney(record.amount, record.currency)}</Text>,
    },
    {
      key: 'status',
      title: t('statusColumn', { defaultValue: 'Status' }),
      filters: statusOptions.map(option => ({ text: option.label, value: option.value })),
      filteredValue: statusFilter !== 'all' ? [statusFilter] : null,
      render: (_v, record) =>
        stopRowClick(
          <Select
            size="small"
            style={{ minWidth: 110 }}
            value={record.status}
            options={statusOptions}
            onChange={value => handleStatusChange(record, value)}
            aria-label={t('statusSelectLabel', {
              number: record.quoteNumber,
              defaultValue: 'Status for {{number}}',
            })}
          />
        ),
    },
    {
      key: 'createdAt',
      title: t('issuedColumn', { defaultValue: 'Issued' }),
      dataIndex: 'createdAt',
      sorter: true,
      sortOrder: sortOrderFor('created_at'),
      render: (_v, record) => (
        <Text type="secondary">
          {record.createdAt ? formatDate(record.createdAt, 'MMM D, YYYY') : '-'}
        </Text>
      ),
    },
    {
      key: 'validUntil',
      title: t('validUntilColumn', { defaultValue: 'Valid Until' }),
      dataIndex: 'validUntil',
      sorter: true,
      sortOrder: sortOrderFor('valid_until'),
      render: (_v, record) => (
        // Red once the quote has been marked Expired.
        <Text type={isQuoteExpired(record) ? 'danger' : undefined}>
          {record.validUntil ? formatDate(record.validUntil, 'MMM D, YYYY') : '-'}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: t('actionsColumn', { defaultValue: 'Actions' }),
      width: 72,
      fixed: 'right',
      align: 'center',
      render: (_v, record) =>
        stopRowClick(
          <Dropdown
            menu={{ items: getActionMenuItems(record) }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              aria-label={t('rowActionsLabel', {
                number: record.quoteNumber,
                defaultValue: 'Actions for {{number}}',
              })}
            />
          </Dropdown>
        ),
    },
  ];

  const renderEmptyState = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      style={{ padding: '40px 0' }}
      description={
        <Flex vertical gap={4}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t('noQuotesTitle', { defaultValue: 'No Quotes Found' })}
          </Typography.Title>
          <Text type="secondary">
            {hasActiveFilters
              ? t('noQuotesMatchingFilters', { defaultValue: 'No quotes match the current filters.' })
              : t('noQuotesDescription', {
                  defaultValue:
                    "You haven't created any quotes yet. Create your first quote to send a client an estimate.",
                })}
          </Text>
        </Flex>
      }
    >
      {hasActiveFilters ? (
        <Button size="small" onClick={handleClearFilters}>
          {t('clearFiltersButton', { defaultValue: 'Clear Filters' })}
        </Button>
      ) : (
        <Button size="small" type="primary" onClick={() => navigate(`${QUOTES_PATH}/create`)}>
          {t('createQuoteButton', { defaultValue: 'Create Quote' })}
        </Button>
      )}
    </Empty>
  );

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('errorLoadingQuotes', { defaultValue: 'Error Loading Quotes' })}
        description={t('errorLoadingQuotesDescription', {
          defaultValue: 'There was an error loading your quotes. Please try again later.',
        })}
        action={
          <Button size="small" onClick={() => refetch()}>
            {t('retryButton', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  const statCards = [
    {
      key: 'quoted',
      label: t('totalQuoted', { defaultValue: 'Total quoted' }),
      value: totals.totalQuoted,
      color: undefined,
    },
    {
      key: 'accepted',
      label: t('totalAccepted', { defaultValue: 'Accepted' }),
      value: totals.totalAccepted,
      color: token.colorSuccess,
    },
    {
      key: 'pending',
      label: t('totalPending', { defaultValue: 'Pending' }),
      value: totals.totalPending,
      color: token.colorWarning,
    },
  ];

  return (
    <div
      ref={containerRef}
      className="invoices-page"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        {statCards.map(card => (
          <Card key={card.key} size="small" style={{ borderRadius: 8 }}>
            <div className="invoices-stat-label" style={{ color: token.colorTextSecondary }}>
              {card.label}
            </div>
            <div className="invoices-stat-value" style={{ color: card.color }}>
              {formatMoney(card.value, statCurrency)}
            </div>
          </Card>
        ))}
      </div>

      <Flex ref={filtersRef} gap={12} align="center" wrap="wrap" style={{ marginBottom: 16, flexShrink: 0 }}>
        <Input.Search
          allowClear
          size="small"
          placeholder={t('searchQuotesPlaceholder', {
            defaultValue: 'Search quotes, clients or projects...',
          })}
          aria-label={t('searchQuotesPlaceholder', {
            defaultValue: 'Search quotes, clients or projects...',
          })}
          style={{ width: '100%', maxWidth: 280 }}
          value={searchInput}
          onChange={event => setSearchInput(event.target.value)}
          onSearch={value => {
            setSearchInput(value);
            setSearch(value);
            setPage(1);
          }}
        />

        {hasActiveFilters && (
          <Button type="link" size="small" onClick={handleClearFilters}>
            {t('clearFiltersButton', { defaultValue: 'Clear Filters' })}
          </Button>
        )}

        <Select
          size="small"
          aria-label={t('statusFilterPlaceholder', { defaultValue: 'Filter by status' })}
          style={{ width: 150, marginInlineStart: 'auto' }}
          value={statusFilter}
          onChange={value => {
            setStatusFilter(value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: t('allStatusesOption', { defaultValue: 'All statuses' }) },
            ...statusOptions,
          ]}
        />
      </Flex>

      <Card
        ref={cardRef}
        className="invoices-table"
        style={{ borderRadius: 8, overflow: 'hidden' }}
        styles={{ body: { padding: 0 } }}
      >
        {showsTable ? (
          <Table
            columns={columns}
            dataSource={quotes}
            rowKey="id"
            size="middle"
            sticky
            pagination={false}
            loading={isFetching}
            onChange={handleTableChange}
            scroll={{ x: 'max-content', y: tableScrollY }}
            onRow={record => ({
              onClick: () => navigate(`${QUOTES_PATH}/${record.id}`),
              style: { cursor: 'pointer' },
            })}
          />
        ) : (
          renderEmptyState()
        )}

        <div ref={paginationRef}>
          <TablePagination
            page={page}
            pageSize={limit}
            total={totalQuotes}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={handlePaginationChange}
            rowsPerPageLabel={t('rowsPerPageLabel', { defaultValue: 'Rows per page:' })}
            renderSummary={(range, total) => {
              const [from, to] = range.split('-');
              return t('paginationSummary', {
                from,
                to,
                total,
                defaultValue: 'Showing {{from}}-{{to}} of {{total}} quotes',
              });
            }}
          />
        </div>
      </Card>
    </div>
  );
};
