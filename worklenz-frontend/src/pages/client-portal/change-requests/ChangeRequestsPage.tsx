import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  CloseCircleOutlined,
  DollarOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LinkOutlined,
  MessageOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { Button, Col, Dropdown, Row, Tooltip, Typography, message } from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';
import { useGetPortalOrganizationsQuery } from '@/api/client-portal/portal-access-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { useApplyChangeRequestActionMutation, useGetChangeRequestsQuery } from '@/api/client-portal/portal-workflow-api';
import {
  ChangeRequestStatusTag,
  ColumnTitle,
  ConfirmEffectModal,
  PortalFieldsButton,
  PortalFilterButton,
  PortalListToolbar,
  PortalAvatar,
  PortalPagedTable,
  PortalPerson,
  PriorityTag,
  StatCard,
  formatPortalDate,
  useDebouncedValue,
  usePortalColumnVisibility,
  usePortalPaging,
  usePortalSort,
  PortalProjectName,
} from '@/components/client-portal/v2';
import type { PortalField, PortalFilterGroup } from '@/components/client-portal/v2';
import type { ChangeRequest, ChangeRequestPriority, ChangeRequestStatus } from '@/types/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { portalPaths } from '../portal-paths';
import { isBillable, isTerminal } from './cr-helpers';

const STATUS_OPTIONS: { value: ChangeRequestStatus; key: string; defaultValue: string }[] = [
  { value: 'submitted', key: 'crSubmitted', defaultValue: 'Submitted' },
  { value: 'under_review', key: 'crUnderReview', defaultValue: 'Under Review' },
  { value: 'more_info', key: 'crMoreInfo', defaultValue: 'More Information Required' },
  { value: 'approved', key: 'crApproved', defaultValue: 'Approved' },
  { value: 'rejected', key: 'crRejected', defaultValue: 'Rejected' },
  { value: 'in_progress', key: 'crInProgress', defaultValue: 'In Progress' },
  { value: 'completed', key: 'crCompleted', defaultValue: 'Completed' },
  { value: 'cancelled', key: 'crCancelled', defaultValue: 'Cancelled' },
];

const PRIORITY_OPTIONS: { value: ChangeRequestPriority; key: string; defaultValue: string }[] = [
  { value: 'high', key: 'priorityHigh', defaultValue: 'High' },
  { value: 'medium', key: 'priorityMedium', defaultValue: 'Medium' },
  { value: 'low', key: 'priorityLow', defaultValue: 'Low' },
];

/** Scope and feature changes clients ask for: review, estimate, decide, then convert approved ones into work. */
const ChangeRequestsPage = () => {
  const { t, i18n } = useTranslation('client-portal-v2-change-requests');
  const { t: tShared } = useTranslation('client-portal-v2');
  const navigate = useNavigate();
  const paging = usePortalPaging();
  const sorting = usePortalSort();

  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<ChangeRequestStatus[]>([]);
  const [organizationIds, setOrganizationIds] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<ChangeRequestPriority[]>([]);
  const [cancelling, setCancelling] = useState<ChangeRequest | null>(null);
  const [applyAction, { isLoading: isCancelling }] = useApplyChangeRequestActionMutation();
  const debouncedSearch = useDebouncedValue(search);
  const columnVisibility = usePortalColumnVisibility('worklenz.portal.changeRequests.hiddenColumns');

  useEffect(() => {
    paging.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statuses, organizationIds, priorities, sorting.sort, sorting.order]);

  const organizations = useGetPortalOrganizationsQuery({ limit: 100 });
  const query = useGetChangeRequestsQuery({
    page: paging.page,
    limit: paging.limit,
    search: debouncedSearch.trim() || undefined,
    status: statuses.length ? statuses.join(',') : undefined,
    organization_id: organizationIds.length ? organizationIds.join(',') : undefined,
    priority: priorities.length ? priorities.join(',') : undefined,
    sort: sorting.sort,
    order: sorting.order,
  });
  const list = query.data?.body;
  const stats = list?.stats;

  const activeFilterCount =
    (statuses.length > 0 ? 1 : 0) + (organizationIds.length > 0 ? 1 : 0) + (priorities.length > 0 ? 1 : 0);

  const clearFilters = () => {
    setStatuses([]);
    setOrganizationIds([]);
    setPriorities([]);
  };

  const statusOptions = STATUS_OPTIONS.map(option => ({
    value: option.value,
    label: tShared(option.key, { defaultValue: option.defaultValue }),
  }));
  const priorityOptions = PRIORITY_OPTIONS.map(option => ({
    value: option.value,
    label: tShared(option.key, { defaultValue: option.defaultValue }),
  }));
  const clientOptions = (organizations.data?.body?.items ?? []).map(item => ({
    value: item.id,
    label: decodeHtmlEntities(item.name),
  }));

  const filterGroups: PortalFilterGroup[] = [
    {
      key: 'status',
      label: t('list.statusLabel', { defaultValue: 'Status' }),
      options: statusOptions,
      value: statuses,
      onChange: value => setStatuses(value as ChangeRequestStatus[]),
    },
    {
      key: 'client',
      label: t('list.clientLabel', { defaultValue: 'Client' }),
      options: clientOptions,
      value: organizationIds,
      onChange: setOrganizationIds,
      searchPlaceholder: t('list.searchClients', { defaultValue: 'Search clients…' }),
    },
    {
      key: 'priority',
      label: t('list.priorityLabel', { defaultValue: 'Priority' }),
      options: priorityOptions,
      value: priorities,
      onChange: value => setPriorities(value as ChangeRequestPriority[]),
    },
  ];

  /** The request title stays visible so a row is never anonymous. */
  const fields: PortalField[] = [
    { key: 'ref', label: t('list.columns.id', { defaultValue: 'ID' }) },
    { key: 'project', label: t('list.columns.project', { defaultValue: 'Project' }) },
    { key: 'requestedBy', label: t('list.columns.requestedBy', { defaultValue: 'Requested by' }) },
    { key: 'client', label: t('list.columns.client', { defaultValue: 'Client' }) },
    { key: 'priority', label: t('list.columns.priority', { defaultValue: 'Priority' }) },
    { key: 'submitted', label: t('list.columns.submitted', { defaultValue: 'Submitted' }) },
    { key: 'updated', label: t('list.columns.updated', { defaultValue: 'Updated' }) },
    { key: 'status', label: t('list.columns.status', { defaultValue: 'Status' }) },
    { key: 'attachments', label: t('list.columns.attachments', { defaultValue: 'Files' }) },
    { key: 'assignee', label: t('list.columns.assignee', { defaultValue: 'Assignee' }) },
    { key: 'estimateTime', label: t('list.columns.estimateTime', { defaultValue: 'Est. time' }) },
    { key: 'estimateCost', label: t('list.columns.estimateCost', { defaultValue: 'Est. cost' }) },
  ];

  /** Header filters and sorters share their state with the Filter popover. */
  const handleTableChange: TableProps<ChangeRequest>['onChange'] = (_pagination, filters, sorter) => {
    sorting.applySorter(sorter);
    setStatuses((filters.status ?? []) as ChangeRequestStatus[]);
    setOrganizationIds((filters.client ?? []) as string[]);
    setPriorities((filters.priority ?? []) as ChangeRequestPriority[]);
  };

  const toFilters = (options: { value: string; label: string }[]) =>
    options.map(option => ({ text: option.label, value: option.value }));

  /** A blank estimate stays blank: the value is never shown as 0 unless staff entered zero on purpose. */
  const formatHours = (hours: number | null | undefined) =>
    hours === null || hours === undefined ? null : t('estimate.hours', { value: hours, defaultValue: '{{value}} h' });
  const formatCost = (cost: number | null | undefined) =>
    cost === null || cost === undefined ? null : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(cost);

  const menuFor = (request: ChangeRequest): MenuProps['items'] => [
    {
      key: 'open',
      icon: <EyeOutlined />,
      label: t('list.menu.open', { defaultValue: 'View Details' }),
      onClick: () => navigate(portalPaths.changeRequest(request.id)),
    },
    ...(isTerminal(request.status)
      ? []
      : [
          {
            key: 'reply',
            icon: <MessageOutlined />,
            label: t('list.menu.reply', { defaultValue: 'Reply to request' }),
            onClick: () => navigate(portalPaths.changeRequest(request.id, { tab: 'conversation' })),
          },
          {
            key: 'notes',
            icon: <EditOutlined />,
            label: t('list.menu.addNotes', { defaultValue: 'Add notes' }),
            onClick: () => navigate(portalPaths.changeRequest(request.id, { tab: 'assessment' })),
          },
        ]),
    {
      key: 'history',
      icon: <HistoryOutlined />,
      label: t('list.menu.viewHistory', { defaultValue: 'View history' }),
      onClick: () => navigate(portalPaths.changeRequest(request.id, { tab: 'history' })),
    },
    // Only an approved request can be turned into (or linked to) a task.
    ...(request.status === 'approved'
      ? [
          {
            key: 'link',
            icon: <LinkOutlined />,
            label: t('list.menu.linkTask', { defaultValue: 'Link to task' }),
            onClick: () => navigate(portalPaths.changeRequest(request.id, { tab: 'work', action: 'convert' })),
          },
        ]
      : []),
    ...(isBillable(request.status)
      ? [
          { type: 'divider' as const },
          {
            key: 'quote',
            icon: <FileTextOutlined />,
            label: t('list.menu.createQuote', { defaultValue: 'Create quote' }),
            onClick: () => navigate(portalPaths.newQuote(request.id)),
          },
          {
            key: 'invoice',
            icon: <DollarOutlined />,
            label: t('list.menu.createInvoice', { defaultValue: 'Create invoice' }),
            onClick: () => navigate(portalPaths.newInvoice(request.id)),
          },
        ]
      : []),
    ...(isTerminal(request.status)
      ? []
      : [
          { type: 'divider' as const },
          {
            key: 'cancel',
            icon: <CloseCircleOutlined />,
            danger: true,
            label: t('list.menu.cancelRequest', { defaultValue: 'Cancel request' }),
            onClick: () => setCancelling(request),
          },
        ]),
  ];

  const cancelRequest = async () => {
    if (!cancelling) return;
    try {
      await applyAction({ id: cancelling.id, body: { action: 'cancel' } }).unwrap();
      message.success(t('detail.cancelled', { ref: cancelling.cr_no, defaultValue: '{{ref}} was cancelled.' }));
      setCancelling(null);
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('detail.actionFailed', { defaultValue: 'The action could not be completed.' })));
    }
  };

  const columns: ColumnsType<ChangeRequest> = [
    {
      key: 'ref',
      ...sorting.columnProps('ref'),
      title: (
        <ColumnTitle
          label={t('list.columns.id', { defaultValue: 'ID' })}
          help={t('list.columnHelp.id', { defaultValue: 'Unique reference of the change request.' })}
        />
      ),
      render: (_value, request) => <Typography.Link>{request.cr_no}</Typography.Link>,
    },
    {
      key: 'request',
      ...sorting.columnProps('request'),
      title: (
        <ColumnTitle
          label={t('list.columns.request', { defaultValue: 'Request' })}
          help={t('list.columnHelp.request', { defaultValue: 'A short summary of the change the client asked for.' })}
        />
      ),
      render: (_value, request) => (
        <span style={{ fontSize: 13, fontWeight: 600 }}>{decodeHtmlEntities(request.title)}</span>
      ),
    },
    {
      key: 'project',
      ...sorting.columnProps('project'),
      title: (
        <ColumnTitle
          label={t('list.columns.project', { defaultValue: 'Project' })}
          help={t('list.columnHelp.project', { defaultValue: 'The project the change applies to.' })}
        />
      ),
      render: (_value, request) => request.project_name ? (
          <PortalProjectName name={request.project_name} color={request.project_color} />
        ) : (
          '—'
        ),
    },
    {
      key: 'requestedBy',
      ...sorting.columnProps('requestedBy'),
      title: (
        <ColumnTitle
          label={t('list.columns.requestedBy', { defaultValue: 'Requested by' })}
          help={t('list.columnHelp.requestedBy', { defaultValue: 'The client user who submitted the request.' })}
        />
      ),
      render: (_value, request) => <PortalPerson name={request.requester_name} />,
    },
    {
      key: 'client',
      ...sorting.columnProps('client'),
      filters: toFilters(clientOptions),
      filterSearch: true,
      filteredValue: organizationIds.length ? organizationIds : null,
      title: (
        <ColumnTitle
          label={t('list.columns.client', { defaultValue: 'Client' })}
          help={t('list.columnHelp.client', { defaultValue: 'The client organization that sent the request.' })}
        />
      ),
      render: (_value, request) => (
        <span style={{ fontSize: 12.5 }}>{decodeHtmlEntities(request.organization_name) || '—'}</span>
      ),
    },
    {
      key: 'priority',
      ...sorting.columnProps('priority'),
      filters: toFilters(priorityOptions),
      filteredValue: priorities.length ? priorities : null,
      title: (
        <ColumnTitle
          label={t('list.columns.priority', { defaultValue: 'Priority' })}
          help={t('list.columnHelp.priority', { defaultValue: 'Urgency set by the client. Staff cannot change it.' })}
        />
      ),
      render: (_value, request) => <PriorityTag priority={request.priority} />,
    },
    {
      key: 'submitted',
      ...sorting.columnProps('submitted'),
      title: (
        <ColumnTitle
          label={t('list.columns.submitted', { defaultValue: 'Submitted' })}
          help={t('list.columnHelp.submitted', { defaultValue: 'The date the client submitted the request.' })}
        />
      ),
      render: (_value, request) => formatPortalDate(request.submitted_at, i18n.language) ?? '—',
    },
    {
      key: 'updated',
      ...sorting.columnProps('updated'),
      title: (
        <ColumnTitle
          label={t('list.columns.updated', { defaultValue: 'Updated' })}
          help={t('list.columnHelp.updated', { defaultValue: 'The date of the latest change to the request.' })}
        />
      ),
      render: (_value, request) => formatPortalDate(request.updated_at, i18n.language) ?? '—',
    },
    {
      key: 'status',
      ...sorting.columnProps('status'),
      filters: toFilters(statusOptions),
      filteredValue: statuses.length ? statuses : null,
      title: (
        <ColumnTitle
          label={t('list.columns.status', { defaultValue: 'Status' })}
          help={t('list.columnHelp.status', { defaultValue: 'Where the request is in the review and delivery process.' })}
        />
      ),
      render: (_value, request) => <ChangeRequestStatusTag status={request.status} />,
    },
    {
      key: 'attachments',
      ...sorting.columnProps('attachments'),
      title: (
        <ColumnTitle
          label={t('list.columns.attachments', { defaultValue: 'Files' })}
          help={t('list.columnHelp.attachments', { defaultValue: 'Number of files the client attached.' })}
        />
      ),
      render: (_value, request) =>
        request.attachments.length > 0 ? (
          <Tooltip title={request.attachments.map(attachment => attachment.name).join(', ')}>
            <span>{request.attachments.length}</span>
          </Tooltip>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      key: 'assignee',
      ...sorting.columnProps('assignee'),
      title: (
        <ColumnTitle
          label={t('list.columns.assignee', { defaultValue: 'Assignee' })}
          help={t('list.columnHelp.assignee', { defaultValue: 'The team member handling this request. Clients never see this.' })}
        />
      ),
      render: (_value, request) =>
        request.assignee ? (
          <Tooltip title={request.assignee.name}>
            <span style={{ display: 'inline-flex' }}>
              <PortalAvatar name={request.assignee.name} color={request.assignee.color} />
            </span>
          </Tooltip>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      key: 'estimateTime',
      ...sorting.columnProps('estimateTime'),
      title: (
        <ColumnTitle
          label={t('list.columns.estimateTime', { defaultValue: 'Est. time' })}
          help={t('list.columnHelp.estimateTime', { defaultValue: 'Estimated extra time in hours, if staff entered one.' })}
        />
      ),
      render: (_value, request) => formatHours(request.estimate?.hours) ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      key: 'estimateCost',
      ...sorting.columnProps('estimateCost'),
      title: (
        <ColumnTitle
          label={t('list.columns.estimateCost', { defaultValue: 'Est. cost' })}
          help={t('list.columnHelp.estimateCost', { defaultValue: 'Estimated extra cost, if staff entered one.' })}
        />
      ),
      render: (_value, request) => formatCost(request.estimate?.cost) ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      key: 'actions',
      align: 'right',
      render: (_value, request) => (
        // The row opens the request on click, so the menu must not bubble to it.
        <span onClick={event => event.stopPropagation()}>
          <Dropdown menu={{ items: menuFor(request) }} trigger={['click']}>
            <Button
              size="small"
              type="text"
              icon={<MoreOutlined />}
              aria-label={t('list.rowActions', { ref: request.cr_no, defaultValue: 'Actions for {{ref}}' })}
            />
          </Dropdown>
        </span>
      ),
    },
  ];

  const hasFilters = debouncedSearch.trim() !== '' || activeFilterCount > 0;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0, fontSize: 22 }}>
          {t('list.title', { defaultValue: 'Change Requests' })}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t('list.description', {
            defaultValue:
              'Scope and feature changes your clients ask for. Review, estimate, decide, then convert approved ones into work.',
          })}
        </Typography.Text>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('list.stats.needsReview', { defaultValue: 'Needs your review' })}
            value={stats?.needs_review ?? '—'}
            tone="warning"
            sub={t('list.stats.needsReviewSub', { defaultValue: 'Submitted and under review' })}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('list.stats.waiting', { defaultValue: 'Waiting on client' })}
            value={stats?.waiting_on_client ?? '—'}
            tone="danger"
            sub={t('list.stats.waitingSub', { defaultValue: 'More information required' })}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('list.stats.inFlight', { defaultValue: 'Approved / in progress' })}
            value={stats?.approved_or_in_progress ?? '—'}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard label={t('list.stats.completed', { defaultValue: 'Completed' })} value={stats?.completed ?? '—'} tone="success" />
        </Col>
      </Row>

      <PortalListToolbar
        controls={
          <>
            <PortalFilterButton groups={filterGroups} onClear={clearFilters} />
            <PortalFieldsButton fields={fields} hidden={columnVisibility.hidden} onToggle={columnVisibility.toggle} />
          </>
        }
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('list.search', {
          defaultValue: 'Search by ID, title, project, client, requester, assignee…',
        })}
        searchLabel={t('list.searchLabel', { defaultValue: 'Search change requests' })}
      />

      <PortalPagedTable<ChangeRequest>
        ariaLabel={t('list.tableLabel', { defaultValue: 'Change requests' })}
        columns={columnVisibility.visibleColumns(columns)}
        onTableChange={handleTableChange}
        rows={list?.items ?? []}
        rowKey={request => request.id}
        total={list?.total ?? 0}
        paging={paging}
        loading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={request => navigate(portalPaths.changeRequest(request.id))}
        emptyText={
          hasFilters
            ? t('list.emptyFiltered', { defaultValue: 'No change requests match these filters.' })
            : t('list.empty', { defaultValue: 'No change requests yet. They appear here when a client submits one from their portal.' })
        }
      />

      <ConfirmEffectModal
        open={cancelling !== null}
        danger
        title={t('detail.cancelTitle', { defaultValue: 'Cancel this change request?' })}
        confirmLabel={t('detail.cancelConfirm', { defaultValue: 'Cancel request' })}
        loading={isCancelling}
        onClose={() => setCancelling(null)}
        onConfirm={() => void cancelRequest()}
      >
        {t('detail.cancelBody', { defaultValue: 'The client sees \u201cCancelled\u201d. Nothing is deleted and the history stays.' })}
      </ConfirmEffectModal>

      {/* change-requests/:id renders here as a modal over the list. */}
      <Outlet />
    </div>
  );
};

export default ChangeRequestsPage;
