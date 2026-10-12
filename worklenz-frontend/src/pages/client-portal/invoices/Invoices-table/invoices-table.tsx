import {
  Alert,
  Button,
  Card,
  Dropdown,
  Empty,
  Flex,
  Input,
  InputNumber,
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
  useDeleteInvoiceMutation,
  useDuplicateInvoiceMutation,
  useGetInvoicesQuery,
  useRecordInvoicePaymentMutation,
  useUpdateInvoiceMutation,
} from '../../../../api/client-portal/client-portal-api';
import type { ClientPortalInvoice } from '../../../../api/client-portal/client-portal-api';
import { formatDate } from '../../../../utils/dateUtils';
import { RecordPaymentModal } from '../RecordPaymentModal';
import type { RecordPaymentTarget } from '../RecordPaymentModal';
import {
  INVOICE_PAYMENT_STATUS_VALUES,
  INVOICE_STATUS_VALUES,
  PAGE_SIZE_OPTIONS,
  clampPaidAmount,
  formatMoney,
  getInvoiceDownloadUrl,
  isInvoiceOverdue,
  normalizePaymentStatus,
  type InvoicePaymentStatus,
} from '../invoices-list-helpers';
import '../invoices.css';

const { Text } = Typography;

const SEARCH_DEBOUNCE_MS = 300;

// Column `dataIndex` -> the backend's sortable column names.
const SORT_FIELDS: Record<string, string> = {
  invoiceNumber: 'invoice_no',
  clientName: 'client_name',
  amount: 'amount',
  createdAt: 'created_at',
  dueDate: 'due_date',
};

interface InvoicesTableProps {
  /** Only this client's invoices, as in the client workspace's Billing tab. */
  clientId?: string;
  /** Drops the full-page fill-height layout, stat cards and client column, for use inside another page. */
  embedded?: boolean;
}

/** Commits on blur/Enter so typing a number doesn't fire a request per keystroke. */
const PaidAmountInput = ({
  invoice,
  onCommit,
  label,
}: {
  invoice: ClientPortalInvoice;
  onCommit: (amount: number) => void;
  label: string;
}) => {
  const paidAmount = invoice.paidAmount ?? 0;
  const [draft, setDraft] = useState<number>(paidAmount);
  // The input only reports a typed value through onChange once it is in range, and flushes on
  // blur in the same tick, so commit reads what is actually in the field.
  const draftRef = useRef<number>(paidAmount);

  useEffect(() => {
    setDraft(paidAmount);
    draftRef.current = paidAmount;
  }, [paidAmount]);

  const commit = (typedText?: string) => {
    const typed = typedText === undefined ? Number.NaN : Number(typedText.replace(/[^0-9.-]/g, ''));
    const next = clampPaidAmount(Number.isFinite(typed) ? typed : draftRef.current, invoice.amount);
    setDraft(next);
    draftRef.current = next;
    if (next !== paidAmount) onCommit(next);
  };

  return (
    <InputNumber
      size="small"
      style={{ width: 110 }}
      min={0}
      max={invoice.amount}
      step={0.01}
      precision={2}
      value={draft}
      aria-label={label}
      onChange={value => {
        const next = Number(value) || 0;
        draftRef.current = next;
        setDraft(next);
      }}
      onBlur={event => commit(event.target.value)}
      onPressEnter={event => commit((event.target as HTMLInputElement).value)}
    />
  );
};

export const InvoicesTable = ({ clientId, embedded = false }: InvoicesTableProps = {}) => {
  // localization
  const { t } = useTranslation('client-portal-invoices');
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [paymentTarget, setPaymentTarget] = useState<{
    invoice: RecordPaymentTarget;
    status: InvoicePaymentStatus;
  } | null>(null);

  // The card must hug its content (no dead space below the pagination bar when a page has
  // few rows) while never growing past the room actually left on screen (so a full page of
  // rows scrolls inside the table instead of the whole page scrolling). Neither the card nor
  // its table can simply flex-fill that space, since a flex-filled box doesn't shrink back
  // down when its content is short. Instead we measure the true ceiling directly — from the
  // bottom of the page's own container up to wherever the card happens to start — and cap
  // the table's scroll area at exactly what's left after its header and the pagination bar,
  // letting the table (and therefore the card) size itself naturally under that cap. None of
  // this applies when embedded: the host page owns scrolling then, so the table just renders
  // at its full natural height (see the `embedded` guard below and in `scroll={...}`).
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
    const available = maxAvailable - theadHeight - paginationHeight;
    setTableScrollY(Math.max(160, Math.round(available)));
  }, []);

  useLayoutEffect(() => {
    if (!containerRef.current || !cardRef.current || embedded) return undefined;

    measureTableHeight();
    const observer = new ResizeObserver(measureTableHeight);
    observer.observe(containerRef.current);
    if (filtersRef.current) observer.observe(filtersRef.current);
    if (paginationRef.current) observer.observe(paginationRef.current);
    return () => observer.disconnect();
  }, [measureTableHeight, embedded]);

  const {
    data: invoicesData,
    isFetching,
    error,
    refetch,
  } = useGetInvoicesQuery(
    {
      page,
      limit,
      clientId,
      search: search || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      paymentStatus: paymentStatusFilter !== 'all' ? paymentStatusFilter : undefined,
      sortBy,
      sortOrder,
    },
    { refetchOnMountOrArgChange: true }
  );

  const [updateInvoice] = useUpdateInvoiceMutation();
  const [recordPayment] = useRecordInvoicePaymentMutation();
  const [duplicateInvoice] = useDuplicateInvoiceMutation();
  const [deleteInvoice] = useDeleteInvoiceMutation();

  // Backend returns { invoices, total, page, limit, totals }.
  const invoicesResponse = invoicesData?.body;
  const invoices = useMemo(() => invoicesResponse?.invoices ?? [], [invoicesResponse]);
  const totalInvoices = invoicesResponse?.total ?? 0;
  const hasActiveFilters = Boolean(search) || statusFilter !== 'all' || paymentStatusFilter !== 'all';
  const showsTable = invoices.length > 0 || isFetching;

  // Stat cards use the organization-wide totals so they still reconcile when the list is paged;
  // without them, fall back to the rows on screen.
  const totals = useMemo(() => {
    if (invoicesResponse?.totals) return invoicesResponse.totals;
    const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);
    const totalPaid = invoices.reduce((sum, i) => sum + (i.paidAmount ?? 0), 0);
    return { totalInvoiced, totalPaid, totalOutstanding: totalInvoiced - totalPaid };
  }, [invoicesResponse, invoices]);
  const statCurrency = invoices[0]?.currency;

  // The header row only exists once the table (rather than the empty state) renders.
  useLayoutEffect(() => {
    if (!embedded) measureTableHeight();
  }, [measureTableHeight, showsTable, embedded]);

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
    setPaymentStatusFilter('all');
    setPage(1);
  };

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'draft':
        return t('statusDraft', { defaultValue: 'Draft' });
      case 'sent':
        return t('statusSent', { defaultValue: 'Sent' });
      case 'pending':
        return t('statusPending', { defaultValue: 'Pending' });
      case 'overdue':
        return t('statusOverdue', { defaultValue: 'Overdue' });
      case 'cancelled':
        return t('statusCancelled', { defaultValue: 'Cancelled' });
      case 'paid':
        return t('statusPaid', { defaultValue: 'Paid' });
      default:
        return status;
    }
  };

  const paymentStatusLabel = (status: string): string => {
    switch (status) {
      case 'paid':
        return t('paymentStatusPaid', { defaultValue: 'Paid' });
      case 'partially_paid':
        return t('paymentStatusPartiallyPaid', { defaultValue: 'Partially Paid' });
      default:
        return t('paymentStatusUnpaid', { defaultValue: 'Unpaid' });
    }
  };

  const statusFilterOptions = INVOICE_STATUS_VALUES.map(value => ({
    value,
    label: statusLabel(value),
  }));
  const paymentStatusFilterOptions = INVOICE_PAYMENT_STATUS_VALUES.map(value => ({
    value,
    label: paymentStatusLabel(value),
  }));

  const sortOrderFor = (field: string): 'ascend' | 'descend' | null =>
    sortBy === field ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null;

  const handleTableChange: TableProps<ClientPortalInvoice>['onChange'] = (_pagination, tableFilters, sorter) => {
    const sort = Array.isArray(sorter) ? sorter[0] : sorter;

    if (sort?.field && sort.order) {
      setSortBy(SORT_FIELDS[String(sort.field)] ?? String(sort.field));
      setSortOrder(sort.order === 'ascend' ? 'asc' : 'desc');
    } else {
      setSortBy('created_at');
      setSortOrder('desc');
    }

    // The column filters set the same values as the toolbar selects; one value applies at a time,
    // so a multi-tick selection keeps just the first.
    const statusValues = (tableFilters.status as string[] | null) || [];
    const nextStatus = statusValues.length > 0 ? statusValues[0] : 'all';
    if (nextStatus !== statusFilter) {
      setStatusFilter(nextStatus);
      setPage(1);
    }
    const paymentValues = (tableFilters.paymentStatus as string[] | null) || [];
    const nextPayment = paymentValues.length > 0 ? paymentValues[0] : 'all';
    if (nextPayment !== paymentStatusFilter) {
      setPaymentStatusFilter(nextPayment);
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

  const handleStatusChange = async (invoice: ClientPortalInvoice, status: string) => {
    try {
      await updateInvoice({ id: invoice.id, data: { status } }).unwrap();
      message.success(t('statusUpdateSuccess', { defaultValue: 'Status updated successfully' }));
    } catch (err) {
      showRequestError(err, t('statusUpdateError', { defaultValue: 'Failed to update status' }));
    }
  };

  // Unpaid applies straight away; Paid / Partially Paid ask for the details first.
  const handlePaymentStatusChange = async (
    invoice: ClientPortalInvoice,
    nextStatus: InvoicePaymentStatus
  ) => {
    if (nextStatus === 'unpaid') {
      try {
        await recordPayment({ id: invoice.id, paymentStatus: 'unpaid', paidAmount: 0 }).unwrap();
      } catch (err) {
        showRequestError(
          err,
          t('paymentRecordedError', { defaultValue: 'Failed to record the payment.' })
        );
      }
      return;
    }
    setPaymentTarget({ invoice, status: nextStatus });
  };

  const handlePaidAmountCommit = async (invoice: ClientPortalInvoice, amount: number) => {
    try {
      await recordPayment({
        id: invoice.id,
        paymentStatus: 'partially_paid',
        paidAmount: amount,
      }).unwrap();
    } catch (err) {
      showRequestError(
        err,
        t('paymentRecordedError', { defaultValue: 'Failed to record the payment.' })
      );
    }
  };

  const handleDuplicate = async (invoice: ClientPortalInvoice) => {
    try {
      const result = await duplicateInvoice(invoice.id).unwrap();
      message.success(
        t('duplicateSuccess', {
          number: result.body?.invoiceNumber ?? '',
          defaultValue: 'Duplicated as {{number}}.',
        })
      );
    } catch (err) {
      showRequestError(err, t('duplicateError', { defaultValue: 'Failed to duplicate invoice' }));
    }
  };

  const confirmDelete = (invoice: ClientPortalInvoice) => {
    Modal.confirm({
      title: t('deleteConfirmationTitle', { defaultValue: 'Delete Invoice' }),
      content: t('deleteConfirmationDescription', {
        defaultValue: 'Are you sure you want to delete this invoice? This cannot be undone.',
      }),
      okText: t('deleteConfirmationOk', { defaultValue: 'Delete' }),
      cancelText: t('deleteConfirmationCancel', { defaultValue: 'Cancel' }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteInvoice(invoice.id).unwrap();
          message.success(
            t('deleteInvoice.success', { defaultValue: 'Invoice deleted successfully' })
          );
        } catch (err) {
          showRequestError(
            err,
            t('deleteInvoice.failure', { defaultValue: 'Failed to delete invoice' })
          );
        }
      },
    });
  };

  const getActionMenuItems = (invoice: ClientPortalInvoice): MenuProps['items'] => [
    {
      key: 'view',
      label: t('viewMenuItem', { defaultValue: 'View' }),
      icon: <EyeOutlined />,
      onClick: () => navigate(`/worklenz/client-portal/invoices/${invoice.id}`),
    },
    {
      key: 'download',
      label: t('downloadInvoiceMenuItem', { defaultValue: 'Download Invoice' }),
      icon: <DownloadOutlined />,
      onClick: () => window.open(getInvoiceDownloadUrl(invoice.id), '_blank', 'noopener,noreferrer'),
    },
    {
      key: 'duplicate',
      label: t('duplicateInvoiceMenuItem', { defaultValue: 'Duplicate Invoice' }),
      icon: <CopyOutlined />,
      onClick: () => handleDuplicate(invoice),
    },
    { type: 'divider' },
    {
      key: 'delete',
      danger: true,
      // Deleting would erase the record of money received, in full or in part.
      disabled: normalizePaymentStatus(invoice.paymentStatus) !== 'unpaid',
      label: t('deleteMenuItem', { defaultValue: 'Delete' }),
      icon: <DeleteOutlined />,
      onClick: () => confirmDelete(invoice),
    },
  ];

  // Selects sit inside a clickable row, so they must not also open the invoice.
  const stopRowClick = (node: React.ReactNode) => (
    <div onClick={event => event.stopPropagation()}>{node}</div>
  );

  const clientColumn: NonNullable<TableProps<ClientPortalInvoice>['columns']>[number] = {
    key: 'clientName',
    title: t('clientColumn', { defaultValue: 'Client' }),
    dataIndex: 'clientName',
    sorter: true,
    sortOrder: sortOrderFor('client_name'),
    render: (_name, record: ClientPortalInvoice) =>
      record.clientId ? (
        // The row itself opens the invoice, so the client link must not also trigger it.
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
  };

  const columns: TableProps<ClientPortalInvoice>['columns'] = [
    {
      key: 'invoiceNumber',
      title: t('invoiceNoColumn', { defaultValue: 'Invoice' }),
      dataIndex: 'invoiceNumber',
      sorter: true,
      sortOrder: sortOrderFor('invoice_no'),
      render: (_no, record: ClientPortalInvoice) => (
        <Text strong style={{ color: token.colorPrimary }}>
          {record.invoiceNumber}
        </Text>
      ),
    },
    ...(embedded ? [] : [clientColumn]),
    {
      key: 'service',
      title: t('serviceColumn', { defaultValue: 'Service' }),
      render: (_v, record: ClientPortalInvoice) => (
        <Text type="secondary">{record.projectName || record.serviceName || '-'}</Text>
      ),
    },
    {
      key: 'amount',
      title: t('amountColumn', { defaultValue: 'Amount' }),
      dataIndex: 'amount',
      sorter: true,
      sortOrder: sortOrderFor('amount'),
      render: (_amount, record: ClientPortalInvoice) => (
        <Text strong>{formatMoney(record.amount, record.currency)}</Text>
      ),
    },
    {
      key: 'paymentStatus',
      title: t('paymentStatusColumn', { defaultValue: 'Payment Status' }),
      filters: paymentStatusFilterOptions.map(option => ({
        text: option.label,
        value: option.value,
      })),
      filteredValue: paymentStatusFilter !== 'all' ? [paymentStatusFilter] : null,
      render: (_v, record: ClientPortalInvoice) =>
        stopRowClick(
          <Select
            size="small"
            style={{ minWidth: 130 }}
            value={normalizePaymentStatus(record.paymentStatus)}
            options={paymentStatusFilterOptions}
            onChange={value => handlePaymentStatusChange(record, value as InvoicePaymentStatus)}
            aria-label={t('paymentStatusSelectLabel', {
              number: record.invoiceNumber,
              defaultValue: 'Payment status for {{number}}',
            })}
          />
        ),
    },
    {
      key: 'paidAmount',
      title: t('paidAmountColumn', { defaultValue: 'Paid Amount' }),
      render: (_v, record: ClientPortalInvoice) => {
        const status = normalizePaymentStatus(record.paymentStatus);
        const paid = record.paidAmount ?? 0;
        // Only a partial payment is editable in place; Paid is locked to the full amount.
        if (status === 'partially_paid') {
          return stopRowClick(
            <PaidAmountInput
              invoice={record}
              label={t('paidAmountSelectLabel', {
                number: record.invoiceNumber,
                defaultValue: 'Paid amount for {{number}}',
              })}
              onCommit={amount => handlePaidAmountCommit(record, amount)}
            />
          );
        }
        return (
          <Text type={paid > 0 ? 'success' : 'secondary'}>
            {paid > 0 ? formatMoney(paid, record.currency) : '-'}
          </Text>
        );
      },
    },
    {
      key: 'status',
      title: t('statusColumn', { defaultValue: 'Status' }),
      filters: statusFilterOptions.map(option => ({ text: option.label, value: option.value })),
      filteredValue: statusFilter !== 'all' ? [statusFilter] : null,
      render: (_v, record: ClientPortalInvoice) =>
        stopRowClick(
          <Select
            size="small"
            style={{ minWidth: 100 }}
            value={record.status}
            options={[
              ...statusFilterOptions,
              // A legacy status (e.g. cancelled) still shows its own label rather than a raw value.
              ...(INVOICE_STATUS_VALUES.includes(record.status as never)
                ? []
                : [{ value: record.status, label: statusLabel(record.status) }]),
            ]}
            onChange={value => handleStatusChange(record, value)}
            aria-label={t('statusSelectLabel', {
              number: record.invoiceNumber,
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
      render: (_v, record: ClientPortalInvoice) => (
        <Text type="secondary">
          {record.createdAt ? formatDate(record.createdAt, 'MMM D, YYYY') : '-'}
        </Text>
      ),
    },
    {
      key: 'dueDate',
      title: t('dueDateColumn', { defaultValue: 'Due' }),
      dataIndex: 'dueDate',
      sorter: true,
      sortOrder: sortOrderFor('due_date'),
      render: (_v, record: ClientPortalInvoice) => (
        // Overdue dates are red so they stand out from on-time ones.
        <Text type={isInvoiceOverdue(record) ? 'danger' : undefined}>
          {record.dueDate ? formatDate(record.dueDate, 'MMM D, YYYY') : '-'}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: t('actionsColumn', { defaultValue: 'Actions' }),
      width: 72,
      fixed: 'right',
      align: 'center',
      render: (_v, record: ClientPortalInvoice) =>
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
                number: record.invoiceNumber,
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
            {t('noInvoicesTitle', { defaultValue: 'No Invoices Found' })}
          </Typography.Title>
          <Text type="secondary">
            {hasActiveFilters
              ? t('noInvoicesMatchingFilters', {
                  defaultValue: 'No invoices match the current filters.',
                })
              : t('noInvoicesDescription', {
                  defaultValue:
                    "You haven't created any invoices yet. Create your first invoice to start billing clients.",
                })}
          </Text>
        </Flex>
      }
    >
      {hasActiveFilters && (
        <Button size="small" onClick={handleClearFilters}>
          {t('clearFiltersButton', { defaultValue: 'Clear Filters' })}
        </Button>
      )}
    </Empty>
  );

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('errorLoadingInvoices', { defaultValue: 'Error Loading Invoices' })}
        description={t('errorLoadingInvoicesDescription', {
          defaultValue: 'There was an error loading your invoices. Please try again later.',
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
      key: 'invoiced',
      label: t('totalInvoiced', { defaultValue: 'Total invoiced' }),
      value: totals.totalInvoiced,
      color: undefined,
    },
    {
      key: 'paid',
      label: t('totalPaid', { defaultValue: 'Total paid' }),
      value: totals.totalPaid,
      color: token.colorSuccess,
    },
    {
      key: 'outstanding',
      label: t('totalOutstanding', { defaultValue: 'Total outstanding' }),
      value: totals.totalOutstanding,
      color: token.colorError,
    },
  ];

  return (
    <div
      ref={containerRef}
      className="invoices-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: embedded ? undefined : '100%',
        minHeight: 0,
      }}
    >
      {!embedded && (
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
      )}

      <Flex ref={filtersRef} gap={12} align="center" wrap="wrap" style={{ marginBottom: 16, flexShrink: 0 }}>
        <Input.Search
          allowClear
          size="small"
          placeholder={t('searchInvoicesPlaceholder', {
            defaultValue: 'Search invoices, clients or projects...',
          })}
          aria-label={t('searchInvoicesPlaceholder', {
            defaultValue: 'Search invoices, clients or projects...',
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

        <Flex gap={8} style={{ marginInlineStart: 'auto' }}>
          <Select
            size="small"
            aria-label={t('paymentStatusFilterPlaceholder', {
              defaultValue: 'Filter by payment status',
            })}
            style={{ width: 170 }}
            value={paymentStatusFilter}
            onChange={value => {
              setPaymentStatusFilter(value);
              setPage(1);
            }}
            options={[
              {
                value: 'all',
                label: t('allPaymentStatusesOption', { defaultValue: 'All payment statuses' }),
              },
              ...paymentStatusFilterOptions,
            ]}
          />
          <Select
            size="small"
            aria-label={t('statusFilterPlaceholder', { defaultValue: 'Filter by status' })}
            style={{ width: 150 }}
            value={statusFilter}
            onChange={value => {
              setStatusFilter(value);
              setPage(1);
            }}
            options={[
              { value: 'all', label: t('allStatusesOption', { defaultValue: 'All statuses' }) },
              ...statusFilterOptions,
            ]}
          />
        </Flex>
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
            dataSource={invoices}
            rowKey="id"
            size="middle"
            sticky
            pagination={false}
            loading={isFetching}
            onChange={handleTableChange}
            scroll={embedded ? { x: 'max-content' } : { x: 'max-content', y: tableScrollY }}
            onRow={record => ({
              onClick: () => navigate(`/worklenz/client-portal/invoices/${record.id}`),
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
            total={totalInvoices}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={handlePaginationChange}
            rowsPerPageLabel={t('rowsPerPageLabel', { defaultValue: 'Rows per page:' })}
            renderSummary={(range, total) => {
              const [from, to] = range.split('-');
              return t('paginationSummary', {
                from,
                to,
                total,
                defaultValue: 'Showing {{from}}-{{to}} of {{total}} invoices',
              });
            }}
          />
        </div>
      </Card>

      <RecordPaymentModal
        open={Boolean(paymentTarget)}
        invoice={paymentTarget?.invoice ?? null}
        initialStatus={paymentTarget?.status}
        onClose={() => setPaymentTarget(null)}
      />
    </div>
  );
};
