import {
  Alert,
  Card,
  Table,
  Typography,
  Empty,
  Input,
  Select,
  Dropdown,
  Button,
  Modal,
  Flex,
  Tooltip,
  message,
  MoreOutlined,
  EyeOutlined,
  ProjectOutlined,
  DollarOutlined,
  FileOutlined,
  DeleteOutlined,
  SettingOutlined,
  PlusOutlined,
} from '@/shared/antd-imports';
import type { TableProps, MenuProps } from '@/shared/antd-imports';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { durationDateFormat } from '../../../utils/durationDateFormat';
import { Link, useNavigate } from 'react-router-dom';
import {
  setSelectedRequestNo,
  setSearchFilter,
  setStatusFilter,
  setSortBy,
  setSortOrder,
  setPage,
  setLimit,
  clearFilters,
} from '../../../features/clients-portal/requests/requests-slice';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useAppSelector';
import TablePagination from '@/components/TablePagination';
import './requests-table.css';
import { PAGE_SIZE_OPTIONS, REQUEST_STATUS_FILTER_VALUES } from './requests-list-helpers';
import AddCustomStatusModal from './AddCustomStatusModal';
import {
  useGetOrganizationRequestsQuery,
  useUpdateOrganizationRequestStatusMutation,
  useDeleteOrganizationRequestMutation,
  useGetRequestCustomStatusesQuery,
} from '../../../api/client-portal/client-portal-api';

const { Text } = Typography;

const SEARCH_DEBOUNCE_MS = 300;

// A request can be invoiced once staff have started acting on it.
const isInvoiceableStatus = (status: string) => !['pending', 'rejected'].includes(status);

const RequestsTable = () => {
  // localization
  const { t } = useTranslation('client-portal-requests');
  const { t: t2 } = useTranslation('client-portal-common');

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { filters, pagination } = useAppSelector(
    state => state.clientsPortalReducer.requestsReducer
  );

  const [searchInput, setSearchInput] = useState(filters.search);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [isAddStatusModalOpen, setIsAddStatusModalOpen] = useState(false);

  const { data: customStatusesData } = useGetRequestCustomStatusesQuery();
  const customStatuses = customStatusesData?.body ?? [];

  // The card must hug its content (no dead space below the pagination bar when a page has
  // few rows) while never growing past the room actually left on screen (so a full page of
  // rows scrolls inside the table instead of the whole page scrolling). Neither the card nor
  // its table can simply flex-fill that space, since a flex-filled box doesn't shrink back
  // down when its content is short. Instead we measure the true ceiling directly — from the
  // bottom of the page's own container up to wherever the card happens to start — and cap
  // the table's scroll area at exactly what's left after its header and the pagination bar,
  // letting the table (and therefore the card) size itself naturally under that cap.
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

  const queryParams = useMemo(
    () => ({
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search || undefined,
      status: filters.status !== 'all' ? filters.status : undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    }),
    [
      pagination.page,
      pagination.limit,
      filters.search,
      filters.status,
      filters.sortBy,
      filters.sortOrder,
    ]
  );

  // Fetch requests from API
  const {
    data: requestsData,
    isFetching,
    error,
    refetch,
  } = useGetOrganizationRequestsQuery(queryParams, { refetchOnMountOrArgChange: true });

  const [updateStatus, { isLoading: isUpdatingStatus }] =
    useUpdateOrganizationRequestStatusMutation();
  const [deleteRequest] = useDeleteOrganizationRequestMutation();

  // Extract requests from API response - backend returns IServerResponse with {total, data} structure
  const requestsResponse = requestsData?.body || { total: 0, data: [] };
  const requests = (requestsResponse as any).data || [];
  const totalRequests = requestsResponse.total || 0;
  const hasActiveFilters = Boolean(filters.search) || filters.status !== 'all';
  const showsTable = requests.length > 0 || isFetching;

  // The table's header row only exists once the table itself (rather than the empty state)
  // renders, so re-measure when that swap happens.
  useLayoutEffect(() => {
    measureTableHeight();
  }, [measureTableHeight, showsTable]);

  // Search runs on the server, so wait for a pause in typing instead of querying per keystroke.
  useEffect(() => {
    if (searchInput === filters.search) return undefined;

    const timer = setTimeout(() => dispatch(setSearchFilter(searchInput)), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dispatch, searchInput, filters.search]);

  const handleClearFilters = () => {
    setSearchInput('');
    dispatch(clearFilters());
  };

  const builtInStatusOptions = [
    { label: t2('pending'), value: 'pending' },
    { label: t2('accepted'), value: 'accepted' },
    { label: t2('inProgress'), value: 'in_progress' },
    { label: t2('completed'), value: 'completed' },
    { label: t2('rejected'), value: 'rejected' },
  ];

  // Team-defined statuses (per organization) sit alongside the 5 built-in workflow states,
  // in every place a request's status can be picked, filtered or displayed.
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

  const statusFilterValues = [
    ...REQUEST_STATUS_FILTER_VALUES,
    ...customStatuses.map(status => status.name),
  ];

  const requestStatusLabel = (status: string): string => {
    const builtIn = builtInStatusOptions.find(option => option.value === status);
    if (builtIn) return builtIn.label;
    const custom = customStatuses.find(option => option.name === status);
    return custom?.name ?? status;
  };

  const sortOrderFor = (field: string): 'ascend' | 'descend' | null =>
    filters.sortBy === field ? (filters.sortOrder === 'asc' ? 'ascend' : 'descend') : null;

  const handleTableChange: TableProps['onChange'] = (_pagination, tableFilters, sorter) => {
    const sort = Array.isArray(sorter) ? sorter[0] : sorter;

    if (sort?.field && sort.order) {
      dispatch(setSortBy(String(sort.field)));
      dispatch(setSortOrder(sort.order === 'ascend' ? 'asc' : 'desc'));
    } else {
      dispatch(setSortBy('created_at'));
      dispatch(setSortOrder('desc'));
    }

    // The Status column filter is a second way to set the same status the toolbar Select
    // controls. Only one status applies at a time, so a multi-tick selection keeps just the
    // first value.
    const statusValues = (tableFilters.status as string[] | null) || [];
    const nextStatus = statusValues.length > 0 ? statusValues[0] : 'all';
    if (nextStatus !== filters.status) {
      dispatch(setStatusFilter(nextStatus));
    }
  };

  const handlePaginationChange = (page: number, pageSize: number) => {
    // Changing the page size resets to the first page (handled by the slice).
    if (pageSize !== pagination.limit) {
      dispatch(setLimit(pageSize));
      return;
    }
    dispatch(setPage(page));
  };

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingRequestId(id);
    try {
      await updateStatus({ id, status }).unwrap();
      message.success(t('statusUpdateSuccess', { defaultValue: 'Status updated successfully' }));
    } catch (err) {
      message.error(t('statusUpdateError', { defaultValue: 'Failed to update status' }));
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const confirmDelete = (record: any) => {
    Modal.confirm({
      title: t('deleteConfirmationTitle', { defaultValue: 'Delete Request' }),
      content: t('deleteConfirmationDescription', {
        defaultValue: 'Are you sure you want to delete this request? This cannot be undone.',
      }),
      okText: t('deleteConfirmationOk', { defaultValue: 'Delete' }),
      cancelText: t('deleteConfirmationCancel', { defaultValue: 'Cancel' }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteRequest(record.id).unwrap();
          message.success(t('deleteSuccessMessage', { defaultValue: 'Request deleted successfully' }));
        } catch (err) {
          const errorData = (err as { data?: { message?: string } })?.data;
          message.error(
            errorData?.message ||
              t('deleteErrorMessage', { defaultValue: 'Failed to delete request' })
          );
        }
      },
    });
  };

  const getRequestActionMenuItems = (record: any): MenuProps['items'] => [
    {
      key: 'view',
      label: t('viewDetailsMenuItem', { defaultValue: 'View' }),
      icon: <EyeOutlined />,
      onClick: () => {
        dispatch(setSelectedRequestNo(record.req_no));
        navigate(`/worklenz/client-portal/requests/${record.id}`);
      },
    },
    {
      key: 'convertToProject',
      disabled: true,
      icon: <ProjectOutlined />,
      label: (
        <Flex align="center" justify="space-between" gap={12}>
          <span>{t('convertToProjectMenuItem', { defaultValue: 'Convert to Project' })}</span>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {t('createQuoteComingSoon', { defaultValue: 'Coming soon' })}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'createQuote',
      label: t('createQuoteMenuItem', { defaultValue: 'Create Quote' }),
      icon: <FileOutlined />,
      // Quotable under the same rule as invoicing: once staff have started acting on the request.
      disabled: !isInvoiceableStatus(record.status),
      onClick: () => navigate(`/worklenz/client-portal/quotes/create?requestId=${record.id}`),
    },
    {
      key: 'createInvoice',
      label: t('createInvoiceButton', { defaultValue: 'Create Invoice' }),
      icon: <DollarOutlined />,
      disabled: !isInvoiceableStatus(record.status),
      onClick: () => navigate(`/worklenz/client-portal/invoices/create?requestId=${record.id}`),
    },
    { type: 'divider' },
    {
      key: 'delete',
      danger: true,
      label: t('deleteMenuItem', { defaultValue: 'Delete' }),
      icon: <DeleteOutlined />,
      onClick: () => confirmDelete(record),
    },
  ];

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'requestNumber',
      title: t('reqNoColumn'),
      render: record => <Text>{record.req_no}</Text>,
    },
    {
      key: 'title',
      title: t('titleLabel'),
      render: record => <Text>{record.request_data?.title || '-'}</Text>,
    },
    {
      key: 'serviceName',
      title: t('serviceColumn'),
      render: record => <Text>{record.service_name}</Text>,
    },
    {
      key: 'clientName',
      title: t('clientColumn'),
      dataIndex: 'client_name',
      sorter: true,
      sortOrder: sortOrderFor('client_name'),
      render: (_clientName, record) =>
        record.client_id ? (
          // The row itself opens the request, so the client link must not also trigger it.
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
      key: 'notes',
      title: t('notesColumn', { defaultValue: 'Notes' }),
      render: record => (
        <Text ellipsis={{ tooltip: record.notes }} style={{ maxWidth: 220 }}>
          {record.notes || '-'}
        </Text>
      ),
    },
    {
      key: 'status',
      title: t('statusColumn'),
      dataIndex: 'status',
      sorter: true,
      sortOrder: sortOrderFor('status'),
      filters: statusFilterValues
        .filter(value => value !== 'all')
        .map(value => ({
          text: requestStatusLabel(value),
          value,
        })),
      filteredValue: filters.status !== 'all' ? [filters.status] : null,
      render: (_status, record) => (
        <div onClick={event => event.stopPropagation()}>
          <Select
            size="small"
            style={{ minWidth: 130 }}
            value={record.status}
            options={statusOptions}
            loading={isUpdatingStatus && updatingRequestId === record.id}
            disabled={isUpdatingStatus && updatingRequestId === record.id}
            onChange={value => handleStatusChange(record.id, value)}
            aria-label={t('statusSelectLabel', {
              reqNo: record.req_no,
              defaultValue: 'Status for {{reqNo}}',
            })}
          />
        </div>
      ),
    },
    {
      key: 'createdAt',
      title: t('createdAtLabel'),
      render: record => <Text>{durationDateFormat(new Date(record.created_at))}</Text>,
    },
    {
      key: 'actions',
      title: t('actionsColumn', { defaultValue: 'Actions' }),
      width: 72,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <div onClick={event => event.stopPropagation()}>
          <Dropdown
            menu={{ items: getRequestActionMenuItems(record) }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              aria-label={t('rowActionsLabel', {
                reqNo: record.req_no,
                defaultValue: 'Actions for {{reqNo}}',
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
            {t('noRequestsTitle')}
          </Typography.Title>
          <Text type="secondary">
            {hasActiveFilters
              ? t('noRequestsMatchingFilters', {
                  defaultValue: 'No requests match the current filters.',
                })
              : t('noRequestsDescription')}
          </Text>
        </Flex>
      }
    >
      {hasActiveFilters && (
        <Button onClick={handleClearFilters}>
          {t('clearFiltersButton', { defaultValue: 'Clear Filters' })}
        </Button>
      )}
    </Empty>
  );

  // Handle error state
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('errorLoadingRequests')}
        description={t('errorLoadingRequestsDescription')}
        action={
          <Button size="small" onClick={() => refetch()}>
            {t('retryButton', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <Flex ref={filtersRef} gap={12} align="center" wrap="wrap" style={{ marginBottom: 16, flexShrink: 0 }}>
        <Input.Search
          allowClear
          size="small"
          placeholder={t('searchRequestsPlaceholder', {
            defaultValue: 'Search requests, clients or services...',
          })}
          aria-label={t('searchRequestsPlaceholder', {
            defaultValue: 'Search requests, clients or services...',
          })}
          style={{ width: '100%', maxWidth: 280 }}
          value={searchInput}
          onChange={event => setSearchInput(event.target.value)}
          onSearch={value => {
            setSearchInput(value);
            dispatch(setSearchFilter(value));
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
          style={{ width: 170, marginInlineStart: 'auto' }}
          value={filters.status}
          onChange={value => dispatch(setStatusFilter(value))}
          options={statusFilterValues.map(value => ({
            value,
            label:
              value === 'all'
                ? t('allStatusesOption', { defaultValue: 'All statuses' })
                : requestStatusLabel(value),
          }))}
        />

        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: [
              {
                key: 'configureServices',
                label: t('configureServicesLink', { defaultValue: 'Configure Services' }),
                icon: <SettingOutlined />,
                onClick: () => navigate('/worklenz/client-portal/services'),
              },
              {
                key: 'addCustomStatus',
                label: t('addCustomStatusMenuItem', { defaultValue: 'Add Custom Status' }),
                icon: <PlusOutlined />,
                onClick: () => setIsAddStatusModalOpen(true),
              },
            ],
          }}
        >
          <Tooltip title={t('moreOptionsLabel', { defaultValue: 'More options' })}>
            <Button
              size="small"
              icon={<SettingOutlined />}
              aria-label={t('moreOptionsLabel', { defaultValue: 'More options' })}
            />
          </Tooltip>
        </Dropdown>
      </Flex>

      <AddCustomStatusModal
        open={isAddStatusModalOpen}
        onClose={() => setIsAddStatusModalOpen(false)}
      />

      <Card
        ref={cardRef}
        className="requests-table"
        style={{ borderRadius: 8, overflow: 'hidden' }}
        styles={{ body: { padding: 0 } }}
      >
        {showsTable ? (
          <Table
            columns={columns}
            dataSource={requests}
            rowKey="id"
            size="middle"
            sticky
            pagination={false}
            loading={isFetching}
            onChange={handleTableChange}
            scroll={{ x: 'max-content', y: tableScrollY }}
            onRow={record => {
              return {
                onClick: () => {
                  dispatch(setSelectedRequestNo(record.req_no));
                  navigate(`/worklenz/client-portal/requests/${record.id}`);
                },
                style: { cursor: 'pointer' },
              };
            }}
          />
        ) : (
          renderEmptyState()
        )}

        <div ref={paginationRef}>
          <TablePagination
            page={pagination.page}
            pageSize={pagination.limit}
            total={totalRequests}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={handlePaginationChange}
            rowsPerPageLabel={t('rowsPerPageLabel', { defaultValue: 'Rows per page:' })}
            renderSummary={(range, total) => {
              const [from, to] = range.split('-');
              return t('paginationSummary', {
                from,
                to,
                total,
                defaultValue: 'Showing {{from}}-{{to}} of {{total}} requests',
              });
            }}
          />
        </div>
      </Card>
    </div>
  );
};

export default RequestsTable;
