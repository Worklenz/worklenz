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
  message,
  MoreOutlined,
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
} from '@/shared/antd-imports';
import type { TableProps, MenuProps } from '@/shared/antd-imports';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  setSearchFilter,
  setStatusFilter,
  setSortBy,
  setSortOrder,
  setPage,
  setLimit,
  clearFilters,
} from '../../../features/clients-portal/services/services-slice';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { durationDateFormat } from '../../../utils/durationDateFormat';
import TablePagination from '@/components/TablePagination';
import './services-table.css';
import { PAGE_SIZE_OPTIONS, SERVICE_STATUS_FILTER_VALUES } from './services-list-helpers';
import {
  useGetOrganizationServicesQuery,
  useUpdateOrganizationServiceMutation,
  useCreateOrganizationServiceMutation,
  useDeleteOrganizationServiceMutation,
} from '../../../api/client-portal/client-portal-api';

const { Text } = Typography;

const SEARCH_DEBOUNCE_MS = 300;

const ServicesTable = () => {
  const { t } = useTranslation('client-portal-services');
  const { t: t2 } = useTranslation('client-portal-common');

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { filters, pagination } = useAppSelector(
    state => state.clientsPortalReducer.servicesReducer
  );

  const [searchInput, setSearchInput] = useState(filters.search);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    [pagination.page, pagination.limit, filters.search, filters.status, filters.sortBy, filters.sortOrder]
  );

  const {
    data: servicesData,
    isFetching,
    error,
    refetch,
  } = useGetOrganizationServicesQuery(queryParams, { refetchOnMountOrArgChange: true });

  const [updateService, { isLoading: isUpdatingStatus }] = useUpdateOrganizationServiceMutation();
  const [createService] = useCreateOrganizationServiceMutation();
  const [deleteService] = useDeleteOrganizationServiceMutation();

  const servicesResponse = servicesData?.body || { total: 0, data: [] };
  const services = (servicesResponse as any).data || [];
  const totalServices = servicesResponse.total || 0;
  const hasActiveFilters = Boolean(filters.search) || filters.status !== 'all';
  const showsTable = services.length > 0 || isFetching;

  useLayoutEffect(() => {
    measureTableHeight();
  }, [measureTableHeight, showsTable]);

  useEffect(() => {
    if (searchInput === filters.search) return undefined;

    const timer = setTimeout(() => dispatch(setSearchFilter(searchInput)), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dispatch, searchInput, filters.search]);

  const handleClearFilters = () => {
    setSearchInput('');
    dispatch(clearFilters());
  };

  const statusOptions = [
    { label: t2('active'), value: 'active' },
    { label: t2('inactive'), value: 'inactive' },
  ];

  const statusLabel = (status: string): string => {
    const option = statusOptions.find(o => o.value === status);
    return option?.label ?? status;
  };

  const sortOrderFor = (field: string): 'ascend' | 'descend' | null =>
    filters.sortBy === field ? (filters.sortOrder === 'asc' ? 'ascend' : 'descend') : null;

  const handleTableChange: TableProps['onChange'] = (_pagination, tableFilters, sorter) => {
    const sort = Array.isArray(sorter) ? sorter[0] : sorter;

    if (sort?.field && sort.order) {
      dispatch(setSortBy(String(sort.field)));
      dispatch(setSortOrder(sort.order === 'ascend' ? 'asc' : 'desc'));
    } else {
      dispatch(setSortBy('name'));
      dispatch(setSortOrder('asc'));
    }

    const statusValues = (tableFilters.status as string[] | null) || [];
    const nextStatus = statusValues.length > 0 ? statusValues[0] : 'all';
    if (nextStatus !== filters.status) {
      dispatch(setStatusFilter(nextStatus));
    }
  };

  const handlePaginationChange = (page: number, pageSize: number) => {
    if (pageSize !== pagination.limit) {
      dispatch(setLimit(pageSize));
      return;
    }
    dispatch(setPage(page));
  };

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await updateService({ id, data: { status } }).unwrap();
      message.success(t('statusUpdateSuccess', { defaultValue: 'Status updated successfully' }));
    } catch (err) {
      message.error(t('statusUpdateError', { defaultValue: 'Failed to update status' }));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleVisibilityChange = async (id: string, isPublic: boolean) => {
    setUpdatingId(id);
    try {
      await updateService({ id, data: { is_public: isPublic } }).unwrap();
      message.success(t('visibilityUpdateSuccess', { defaultValue: 'Visibility updated successfully' }));
    } catch (err) {
      message.error(t('visibilityUpdateError', { defaultValue: 'Failed to update visibility' }));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEdit = (id: string) => navigate(`/worklenz/client-portal/services/${id}/edit`);

  const handleDuplicate = async (record: any) => {
    try {
      await createService({
        name: `${record.name} (copy)`,
        description: record.description,
        service_data: record.service_data,
        is_public: record.is_public,
        price: record.price,
        currency: record.currency,
        category: record.category,
        billing_type: record.billing_type,
      }).unwrap();
      message.success(
        t('serviceDuplicatedSuccess', {
          name: record.name,
          defaultValue: '"{{name}}" duplicated successfully',
        })
      );
    } catch (err) {
      message.error(t('serviceDuplicateFailed', { defaultValue: 'Failed to duplicate service' }));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteService(id).unwrap();
      message.success(
        t('serviceDeletedSuccessfully', { name, defaultValue: `Service "${name}" deleted successfully!` })
      );
    } catch (err) {
      message.error(t('serviceDeleteFailed', { defaultValue: 'Failed to delete service. Please try again.' }));
    }
  };

  const confirmDelete = (record: any) => {
    Modal.confirm({
      title: t('confirmDeleteTitle', { defaultValue: 'Confirm Delete' }),
      icon: <ExclamationCircleOutlined />,
      content: t('confirmDeleteMessage', {
        name: record.name,
        defaultValue: `Are you sure you want to delete "${record.name}"? This action cannot be undone.`,
      }),
      okText: t('deleteButton', { defaultValue: 'Delete' }),
      okType: 'danger',
      cancelText: t('cancelButton', { defaultValue: 'Cancel' }),
      onOk: () => handleDelete(record.id, record.name),
    });
  };

  const getServiceActionMenuItems = (record: any): MenuProps['items'] => [
    {
      key: 'edit',
      label: t('editButton', { defaultValue: 'Edit' }),
      icon: <EditOutlined />,
      onClick: () => handleEdit(record.id),
    },
    {
      key: 'duplicate',
      label: t('duplicateButton', { defaultValue: 'Duplicate' }),
      icon: <CopyOutlined />,
      onClick: () => handleDuplicate(record),
    },
    { type: 'divider' },
    {
      key: 'delete',
      danger: true,
      label: t('deleteButton', { defaultValue: 'Delete' }),
      icon: <DeleteOutlined />,
      onClick: () => confirmDelete(record),
    },
  ];

  const columns: TableProps['columns'] = [
    {
      key: 'name',
      title: t('nameColumn', { defaultValue: 'Name' }),
      dataIndex: 'name',
      sorter: true,
      sortOrder: sortOrderFor('name'),
      render: name => <Text strong>{name}</Text>,
    },
    {
      key: 'createdBy',
      title: t('createdByColumn', { defaultValue: 'Created By' }),
      render: record => (
        <Text style={{ textTransform: 'capitalize' }}>{record.created_by_name || '-'}</Text>
      ),
    },
    {
      key: 'createdAt',
      title: t('createdAtColumn', { defaultValue: 'Created At' }),
      dataIndex: 'created_at',
      sorter: true,
      sortOrder: sortOrderFor('created_at'),
      render: createdAt => <Text>{createdAt ? durationDateFormat(new Date(createdAt)) : '-'}</Text>,
    },
    {
      key: 'updatedAt',
      title: t('updatedAtColumn', { defaultValue: 'Updated At' }),
      dataIndex: 'updated_at',
      sorter: true,
      sortOrder: sortOrderFor('updated_at'),
      render: updatedAt => <Text>{updatedAt ? durationDateFormat(new Date(updatedAt)) : '-'}</Text>,
    },
    {
      key: 'status',
      title: t('statusColumn', { defaultValue: 'Status' }),
      dataIndex: 'status',
      sorter: true,
      sortOrder: sortOrderFor('status'),
      filters: SERVICE_STATUS_FILTER_VALUES.filter(value => value !== 'all').map(value => ({
        text: statusLabel(value),
        value,
      })),
      filteredValue: filters.status !== 'all' ? [filters.status] : null,
      render: (_status, record) => (
        <div onClick={event => event.stopPropagation()}>
          <Select
            size="small"
            style={{ minWidth: 110 }}
            value={record.status}
            options={statusOptions}
            loading={isUpdatingStatus && updatingId === record.id}
            disabled={isUpdatingStatus && updatingId === record.id}
            onChange={value => handleStatusChange(record.id, value)}
            aria-label={t('statusSelectLabel', {
              name: record.name,
              defaultValue: 'Status for {{name}}',
            })}
          />
        </div>
      ),
    },
    {
      key: 'visibility',
      title: t('visibilityColumn', { defaultValue: 'Visibility' }),
      dataIndex: 'is_public',
      sorter: true,
      sortOrder: sortOrderFor('is_public'),
      render: (_isPublic, record) => (
        <div onClick={event => event.stopPropagation()}>
          <Select
            size="small"
            style={{ minWidth: 100 }}
            value={record.is_public ?? true}
            options={[
              { label: t('visibilityVisible', { defaultValue: 'Visible' }), value: true },
              { label: t('visibilityHidden', { defaultValue: 'Hidden' }), value: false },
            ]}
            loading={isUpdatingStatus && updatingId === record.id}
            disabled={isUpdatingStatus && updatingId === record.id}
            onChange={value => handleVisibilityChange(record.id, value)}
            aria-label={t('visibilitySelectLabel', {
              name: record.name,
              defaultValue: 'Visibility for {{name}}',
            })}
          />
        </div>
      ),
    },
    {
      key: 'noOfRequests',
      title: t('noOfRequestsColumn', { defaultValue: 'No. of Requests' }),
      dataIndex: 'requests_count',
      sorter: true,
      sortOrder: sortOrderFor('requests_count'),
      align: 'center',
      render: requestsCount => <Text>{requestsCount || 0}</Text>,
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
            menu={{ items: getServiceActionMenuItems(record) }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              aria-label={t('rowActionsLabel', {
                name: record.name,
                defaultValue: 'Actions for {{name}}',
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
            {t('noServicesTitle', { defaultValue: 'No services yet' })}
          </Typography.Title>
          <Text type="secondary">
            {hasActiveFilters
              ? t('noServicesMatchingFilters', {
                  defaultValue: 'No services match the current filters.',
                })
              : t('noServicesDescription', {
                  defaultValue: 'Create your first service to start receiving client requests.',
                })}
          </Text>
        </Flex>
      }
    >
      {hasActiveFilters ? (
        <Button onClick={handleClearFilters}>
          {t('clearFiltersButton', { defaultValue: 'Clear Filters' })}
        </Button>
      ) : (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/worklenz/client-portal/services/create')}
        >
          {t('addServiceButton', { defaultValue: 'Add Service' })}
        </Button>
      )}
    </Empty>
  );

  if (error) {
    const isNotImplemented = (error as any)?.status === 404;
    return (
      <Alert
        type={isNotImplemented ? 'info' : 'error'}
        showIcon
        message={
          isNotImplemented
            ? t('featureNotAvailable', { defaultValue: 'Feature Not Available' })
            : t('errorLoadingServices', { defaultValue: 'Error Loading Services' })
        }
        description={
          isNotImplemented
            ? t('featureNotAvailableDescription', { defaultValue: 'This feature is currently under development.' })
            : t('errorLoadingServicesDescription', {
                defaultValue: 'There was an error loading the services. Please try again later.',
              })
        }
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
      <Flex
        ref={filtersRef}
        gap={12}
        align="center"
        wrap="wrap"
        style={{ marginBottom: 16, flexShrink: 0 }}
      >
        <Input.Search
          allowClear
          size="small"
          placeholder={t('searchServicesPlaceholder', {
            defaultValue: 'Search services...',
          })}
          aria-label={t('searchServicesPlaceholder', { defaultValue: 'Search services...' })}
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
          style={{ width: 150, marginInlineStart: 'auto' }}
          value={filters.status}
          onChange={value => dispatch(setStatusFilter(value))}
          options={SERVICE_STATUS_FILTER_VALUES.map(value => ({
            value,
            label: value === 'all' ? t('allStatusesOption', { defaultValue: 'All statuses' }) : statusLabel(value),
          }))}
        />
      </Flex>

      <Card
        ref={cardRef}
        className="services-table"
        style={{ borderRadius: 8, overflow: 'hidden' }}
        styles={{ body: { padding: 0 } }}
      >
        {showsTable ? (
          <Table
            columns={columns}
            dataSource={services}
            rowKey="id"
            size="middle"
            sticky
            pagination={false}
            loading={isFetching}
            onChange={handleTableChange}
            scroll={{ x: 'max-content', y: tableScrollY }}
            onRow={record => ({
              onClick: () => handleEdit(record.id),
              style: { cursor: 'pointer' },
            })}
          />
        ) : (
          renderEmptyState()
        )}

        <div ref={paginationRef}>
          <TablePagination
            page={pagination.page}
            pageSize={pagination.limit}
            total={totalServices}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={handlePaginationChange}
            rowsPerPageLabel={t('rowsPerPageLabel', { defaultValue: 'Rows per page:' })}
            renderSummary={(range, total) => {
              const [from, to] = range.split('-');
              return t('paginationSummary', {
                from,
                to,
                total,
                defaultValue: 'Showing {{from}}-{{to}} of {{total}} services',
              });
            }}
          />
        </div>
      </Card>
    </div>
  );
};

export default ServicesTable;
