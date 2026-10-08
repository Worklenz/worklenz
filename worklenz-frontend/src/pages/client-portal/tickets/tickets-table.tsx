import {
  Alert,
  Card,
  Table,
  Typography,
  Empty,
  Select,
  Dropdown,
  Button,
  Flex,
  message,
  Tag,
  MoreOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  RetweetOutlined,
} from '@/shared/antd-imports';
import type { TableProps, MenuProps } from '@/shared/antd-imports';
import { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { durationDateFormat } from '../../../utils/durationDateFormat';
import { Link, useNavigate } from 'react-router-dom';
import TablePagination from '@/components/TablePagination';
import { PAGE_SIZE_OPTIONS, TICKET_BUILT_IN_STATUSES, TICKET_BUILT_IN_STATUS_I18N, ticketPriorityColor } from './tickets-list-helpers';
import ConvertToTaskModal from './ConvertToTaskModal';
import {
  useGetTicketsQuery,
  useUpdateTicketStatusMutation,
  useGetTicketCustomStatusesQuery,
  useGetClientsLookupQuery,
} from '../../../api/client-portal/client-portal-api';

const { Text } = Typography;

interface TicketsTableProps {
  /** Debounced search text — owned by the parent so the search box can live in the shared
   * List/Board toggle row instead of this table's own toolbar. */
  search: string;
  onClearSearch: () => void;
}

const TicketsTable: React.FC<TicketsTableProps> = ({ search, onClearSearch }) => {
  const { t } = useTranslation('client-portal-tickets');
  const { t: t2 } = useTranslation('client-portal-common');
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState<string[]>([]);

  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [convertingTicket, setConvertingTicket] = useState<any>(null);

  const { data: customStatusesData } = useGetTicketCustomStatusesQuery();
  const customStatuses = customStatusesData?.body ?? [];
  const { data: clientsData } = useGetClientsLookupQuery();
  const clientOptions = clientsData?.body ?? [];

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
    if (!containerRef.current || !cardRef.current) return;
    measureTableHeight();
    const observer = new ResizeObserver(measureTableHeight);
    observer.observe(containerRef.current);
    if (filtersRef.current) observer.observe(filtersRef.current);
    if (paginationRef.current) observer.observe(paginationRef.current);
    return () => observer.disconnect();
  }, [measureTableHeight]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, priorityFilter, clientFilter, sortBy, sortOrder, limit]);

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      status: statusFilter.length ? statusFilter.join(',') : undefined,
      priority: priorityFilter.length ? priorityFilter.join(',') : undefined,
      client_id: clientFilter.length ? clientFilter.join(',') : undefined,
      sortBy,
      sortOrder,
    }),
    [page, limit, search, statusFilter, priorityFilter, clientFilter, sortBy, sortOrder]
  );

  const { data: ticketsData, isFetching, error, refetch } = useGetTicketsQuery(queryParams, {
    refetchOnMountOrArgChange: true,
  });
  const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdateTicketStatusMutation();

  const ticketsResponse = ticketsData?.body || { total: 0, data: [] };
  const tickets = (ticketsResponse as any).data || [];
  const totalTickets = ticketsResponse.total || 0;
  const hasActiveFilters = Boolean(search) || statusFilter.length > 0 || priorityFilter.length > 0 || clientFilter.length > 0;
  const showsTable = tickets.length > 0 || isFetching;

  useLayoutEffect(() => {
    measureTableHeight();
  }, [measureTableHeight, showsTable]);

  const handleClearFilters = () => {
    onClearSearch();
    setStatusFilter([]);
    setPriorityFilter([]);
    setClientFilter([]);
  };

  const builtInStatusOptions = TICKET_BUILT_IN_STATUSES.map(status => ({
    label: t2(TICKET_BUILT_IN_STATUS_I18N[status].key, { defaultValue: TICKET_BUILT_IN_STATUS_I18N[status].defaultValue }),
    value: status,
  }));

  const statusOptions = [
    ...builtInStatusOptions,
    ...customStatuses.map(status => ({
      value: status.name,
      label: (
        <Flex align="center" gap={6}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: status.color === 'default' ? undefined : status.color,
              border: status.color === 'default' ? '1px solid currentColor' : 'none',
            }}
          />
          <span>{status.name}</span>
        </Flex>
      ),
    })),
  ];

  const ticketStatusLabel = (status: string): string => {
    const builtIn = builtInStatusOptions.find(option => option.value === status);
    if (builtIn) return builtIn.label as string;
    const custom = customStatuses.find(option => option.name === status);
    return custom?.name ?? status;
  };

  const priorityOptions = [
    { label: t('priorityHigh', { defaultValue: 'High' }), value: 'high' },
    { label: t('priorityMedium', { defaultValue: 'Medium' }), value: 'medium' },
    { label: t('priorityLow', { defaultValue: 'Low' }), value: 'low' },
  ];

  const sortOrderFor = (field: string): 'ascend' | 'descend' | null =>
    sortBy === field ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null;

  const handleTableChange: TableProps['onChange'] = (_pagination, tableFilters, sorter) => {
    const sort = Array.isArray(sorter) ? sorter[0] : sorter;
    if (sort?.field && sort.order) {
      setSortBy(String(sort.field));
      setSortOrder(sort.order === 'ascend' ? 'asc' : 'desc');
    } else {
      setSortBy('created_at');
      setSortOrder('desc');
    }

    setStatusFilter((tableFilters.status as string[] | null) || []);
    setPriorityFilter((tableFilters.priority as string[] | null) || []);
    setClientFilter((tableFilters.client_id as string[] | null) || []);
  };

  const handlePaginationChange = (nextPage: number, pageSize: number) => {
    if (pageSize !== limit) {
      setLimit(pageSize);
      return;
    }
    setPage(nextPage);
  };

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingTicketId(id);
    try {
      await updateStatus({ id, status }).unwrap();
      message.success(t('statusUpdateSuccess', { defaultValue: 'Status updated successfully' }));
    } catch (err) {
      const errorData = (err as { data?: { message?: string } })?.data;
      message.error(errorData?.message || t('statusUpdateError', { defaultValue: 'Failed to update status' }));
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const handleMarkResolved = (record: any) => handleStatusChange(record.id, 'resolved');

  const getTicketActionMenuItems = (record: any): MenuProps['items'] => [
    {
      key: 'view',
      label: t('viewDetailsMenuItem', { defaultValue: 'View' }),
      icon: <EyeOutlined />,
      onClick: () => navigate(`/worklenz/client-portal/ticketing/${record.id}`),
    },
    {
      key: 'markResolved',
      label: t('markAsResolvedButton', { defaultValue: 'Mark as Resolved' }),
      icon: <CheckCircleOutlined />,
      disabled: record.status === 'resolved',
      onClick: () => handleMarkResolved(record),
    },
    {
      key: 'convertToTask',
      label: t('convertToTaskButton', { defaultValue: 'Convert to Task' }),
      icon: <RetweetOutlined />,
      disabled: Boolean(record.converted_task_id),
      onClick: () => setConvertingTicket(record),
    },
  ];

  const columns: TableProps['columns'] = [
    {
      key: 'ticketNo',
      title: t('ticketNoColumn', { defaultValue: 'Ticket' }),
      render: record => <Text>{record.ticket_no}</Text>,
    },
    {
      key: 'clientName',
      title: t('clientColumn', { defaultValue: 'Client' }),
      dataIndex: 'client_id',
      filters: clientOptions.map(client => ({ text: client.name, value: client.id })),
      filteredValue: clientFilter.length ? clientFilter : null,
      render: (_clientId, record) =>
        record.client_id ? (
          <Link
            to={`/worklenz/client-portal/clients/${record.client_id}`}
            style={{ textTransform: 'capitalize' }}
            onClick={event => event.stopPropagation()}
          >
            {record.client_name}
          </Link>
        ) : (
          <Text style={{ textTransform: 'capitalize' }}>{record.client_name}</Text>
        ),
    },
    {
      key: 'subject',
      title: t('subjectColumn', { defaultValue: 'Subject' }),
      render: record => <Text>{record.subject}</Text>,
    },
    {
      key: 'description',
      title: t('descriptionLabel', { defaultValue: 'Description' }),
      render: record => (
        <Text ellipsis={{ tooltip: record.description }} style={{ maxWidth: 220 }} type="secondary">
          {record.description || '-'}
        </Text>
      ),
    },
    {
      key: 'priority',
      title: t('priorityColumn', { defaultValue: 'Priority' }),
      dataIndex: 'priority',
      sorter: true,
      sortOrder: sortOrderFor('priority'),
      filters: priorityOptions.map(option => ({ text: option.label, value: option.value })),
      filteredValue: priorityFilter.length ? priorityFilter : null,
      render: (priority: string) => (
        <Tag color={ticketPriorityColor(priority)} style={{ margin: 0 }}>
          {priorityOptions.find(o => o.value === priority)?.label || priority}
        </Tag>
      ),
    },
    {
      key: 'status',
      title: t('statusColumn', { defaultValue: 'Status' }),
      dataIndex: 'status',
      sorter: true,
      sortOrder: sortOrderFor('status'),
      filters: [...builtInStatusOptions, ...customStatuses.map(s => ({ label: s.name, value: s.name }))].map(
        option => ({ text: typeof option.label === 'string' ? option.label : option.value, value: option.value })
      ),
      filteredValue: statusFilter.length ? statusFilter : null,
      render: (_status, record) => (
        <div onClick={event => event.stopPropagation()}>
          <Select
            size="small"
            style={{ minWidth: 140 }}
            value={record.status}
            options={statusOptions}
            loading={isUpdatingStatus && updatingTicketId === record.id}
            disabled={isUpdatingStatus && updatingTicketId === record.id}
            onChange={value => handleStatusChange(record.id, value)}
            aria-label={t('statusSelectLabel', {
              ticketNo: record.ticket_no,
              defaultValue: 'Status for {{ticketNo}}',
            })}
          />
        </div>
      ),
    },
    {
      key: 'createdAt',
      title: t('createdAtLabel', { defaultValue: 'Created' }),
      render: record => <Text>{durationDateFormat(new Date(record.created_at))}</Text>,
    },
    {
      key: 'actions',
      title: '',
      width: 56,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <div onClick={event => event.stopPropagation()}>
          <Dropdown menu={{ items: getTicketActionMenuItems(record) }} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              aria-label={t('rowActionsLabel', {
                ticketNo: record.ticket_no,
                defaultValue: 'Actions for {{ticketNo}}',
              })}
            />
          </Dropdown>
        </div>
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
            {t('noTicketsTitle', { defaultValue: 'No tickets yet' })}
          </Typography.Title>
          <Text type="secondary">
            {hasActiveFilters
              ? t('noTicketsMatchingFilters', { defaultValue: 'No tickets match the current filters.' })
              : t('noTicketsDescription', {
                  defaultValue: 'Tickets clients raise from their portal will appear here.',
                })}
          </Text>
        </Flex>
      }
    >
      {hasActiveFilters && (
        <Button onClick={handleClearFilters}>{t('clearFiltersButton', { defaultValue: 'Clear Filters' })}</Button>
      )}
    </Empty>
  );

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('errorLoadingTickets', { defaultValue: 'Error Loading Tickets' })}
        description={t('errorLoadingTicketsDescription', {
          defaultValue: 'There was an error loading tickets. Please try again later.',
        })}
        action={
          <Button size="small" onClick={() => refetch()}>
            {t('retryButton', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {hasActiveFilters && (
        <Flex ref={filtersRef} gap={12} align="center" wrap="wrap" style={{ marginBottom: 16, flexShrink: 0 }}>
          <Button type="link" size="small" onClick={handleClearFilters}>
            {t('clearFiltersButton', { defaultValue: 'Clear Filters' })}
          </Button>
        </Flex>
      )}

      <ConvertToTaskModal ticket={convertingTicket} onClose={() => setConvertingTicket(null)} />

      <Card ref={cardRef} style={{ borderRadius: 8, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
        {showsTable ? (
          <Table
            columns={columns}
            dataSource={tickets}
            rowKey="id"
            size="middle"
            sticky
            pagination={false}
            loading={isFetching}
            onChange={handleTableChange}
            scroll={{ x: 'max-content', y: tableScrollY }}
            onRow={record => ({
              onClick: () => navigate(`/worklenz/client-portal/ticketing/${record.id}`),
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
            total={totalTickets}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={handlePaginationChange}
            rowsPerPageLabel={t('rowsPerPageLabel', { defaultValue: 'Rows per page:' })}
            renderSummary={(range, total) => {
              const [from, to] = range.split('-');
              return t('paginationSummary', {
                from,
                to,
                total,
                defaultValue: 'Showing {{from}}-{{to}} of {{total}} tickets',
              });
            }}
          />
        </div>
      </Card>
    </div>
  );
};

export default TicketsTable;
