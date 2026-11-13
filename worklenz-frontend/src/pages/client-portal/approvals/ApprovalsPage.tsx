import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { Button, Col, Dropdown, Flex, Row, Typography, message } from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { useGetPortalOrganizationsQuery } from '@/api/client-portal/portal-access-api';
import {
  useCancelApprovalMutation,
  useDeleteApprovalMutation,
  useGetApprovalsQuery,
} from '@/api/client-portal/portal-workflow-api';
import {
  ApprovalStatusTag,
  ColumnTitle,
  ConfirmEffectModal,
  PORTAL_TOOLBAR_BUTTON_STYLE,
  PortalFieldsButton,
  PortalFilterButton,
  PortalListToolbar,
  PortalPagedTable,
  PortalPerson,
  StatCard,
  StatusTag,
  formatPortalDate,
  useDebouncedValue,
  usePortalColumnVisibility,
  usePortalPaging,
  usePortalSort,
  PortalProjectName,
} from '@/components/client-portal/v2';
import type { PortalField, PortalFilterGroup } from '@/components/client-portal/v2';
import type { Approval, ApprovalStatus } from '@/types/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { portalPaths } from '../portal-paths';
import { EditApprovalModal } from './EditApprovalModal';

const STATUS_OPTIONS: { value: ApprovalStatus; key: string; defaultValue: string }[] = [
  { value: 'draft', key: 'approvalDraft', defaultValue: 'Draft' },
  { value: 'awaiting', key: 'approvalAwaiting', defaultValue: 'Awaiting Approval' },
  { value: 'approved', key: 'approvalApproved', defaultValue: 'Approved' },
  { value: 'changes_requested', key: 'approvalChangesRequested', defaultValue: 'Changes Requested' },
  { value: 'cancelled', key: 'approvalCancelled', defaultValue: 'Cancelled' },
];

/** The client has not reacted yet, so the request can still be edited or deleted. */
const isUnreacted = (status: ApprovalStatus) => status === 'draft' || status === 'awaiting';
/** A request that was sent can be withdrawn, including after the client reacted. A draft is deleted instead. */
const canCancel = (status: ApprovalStatus) =>
  status === 'awaiting' || status === 'approved' || status === 'changes_requested';

/** Formal sign-off on a client-visible item. The exact version or revision is recorded and every decision is kept. */
const ApprovalsPage = () => {
  const { t, i18n } = useTranslation('client-portal-v2-approvals');
  const { t: tShared } = useTranslation('client-portal-v2');
  const navigate = useNavigate();
  const paging = usePortalPaging();
  const sorting = usePortalSort();

  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<ApprovalStatus[]>([]);
  const [organizationIds, setOrganizationIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<Approval | null>(null);
  const [confirming, setConfirming] = useState<{ approval: Approval; action: 'cancel' | 'delete' } | null>(null);
  const [cancelApproval, { isLoading: isCancelling }] = useCancelApprovalMutation();
  const [deleteApproval, { isLoading: isDeleting }] = useDeleteApprovalMutation();
  const debouncedSearch = useDebouncedValue(search);
  const columnVisibility = usePortalColumnVisibility('worklenz.portal.approvals.hiddenColumns');

  useEffect(() => {
    paging.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statuses, organizationIds, sorting.sort, sorting.order]);

  const organizations = useGetPortalOrganizationsQuery({ limit: 100 });
  const query = useGetApprovalsQuery({
    page: paging.page,
    limit: paging.limit,
    search: debouncedSearch.trim() || undefined,
    status: statuses.length ? statuses.join(',') : undefined,
    organization_id: organizationIds.length ? organizationIds.join(',') : undefined,
    sort: sorting.sort,
    order: sorting.order,
  });
  const list = query.data?.body;
  const stats = list?.stats;

  const clearFilters = () => {
    setStatuses([]);
    setOrganizationIds([]);
  };

  const statusOptions = STATUS_OPTIONS.map(option => ({
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
      onChange: value => setStatuses(value as ApprovalStatus[]),
    },
    {
      key: 'client',
      label: t('list.clientLabel', { defaultValue: 'Client' }),
      options: clientOptions,
      value: organizationIds,
      onChange: setOrganizationIds,
      searchPlaceholder: t('list.searchClients', { defaultValue: 'Search clients…' }),
    },
  ];

  /** The approval title stays visible so a row is never anonymous. */
  const fields: PortalField[] = [
    { key: 'ref', label: t('list.columns.id', { defaultValue: 'ID' }) },
    { key: 'client', label: t('list.columns.client', { defaultValue: 'Client' }) },
    { key: 'project', label: t('list.columns.project', { defaultValue: 'Project' }) },
    { key: 'linked', label: t('list.columns.linked', { defaultValue: 'Linked item' }) },
    { key: 'type', label: t('list.columns.type', { defaultValue: 'Type' }) },
    { key: 'approver', label: t('list.columns.approver', { defaultValue: 'Approver' }) },
    { key: 'requested', label: t('list.columns.requested', { defaultValue: 'Requested' }) },
    { key: 'due', label: t('list.columns.due', { defaultValue: 'Due' }) },
    { key: 'status', label: t('list.columns.status', { defaultValue: 'Status' }) },
  ];

  const confirmAction = async () => {
    if (!confirming) return;
    const { approval, action } = confirming;
    try {
      if (action === 'cancel') {
        await cancelApproval(approval.id).unwrap();
        message.success(
          t('detail.cancelled', {
            ref: approval.ref_no,
            defaultValue: '{{ref}} cancelled. It disappears from the client\u2019s pending actions.',
          })
        );
      } else {
        await deleteApproval(approval.id).unwrap();
        message.success(t('list.deleted', { ref: approval.ref_no, defaultValue: '{{ref}} deleted.' }));
      }
      setConfirming(null);
    } catch (error) {
      message.error(
        getPortalErrorMessage(
          error,
          action === 'cancel'
            ? t('detail.cancelFailed', { defaultValue: 'The approval could not be cancelled.' })
            : t('list.deleteFailed', { defaultValue: 'The approval could not be deleted.' })
        )
      );
    }
  };

  /** View always; Edit and Delete only until the client reacts; Cancel once it has been sent. */
  const menuFor = (approval: Approval): MenuProps['items'] => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: t('list.view', { defaultValue: 'View' }),
      onClick: () => navigate(portalPaths.approval(approval.id)),
    },
    ...(isUnreacted(approval.status)
      ? [
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: t('list.edit', { defaultValue: 'Edit' }),
            onClick: () => setEditing(approval),
          },
        ]
      : []),
    ...(canCancel(approval.status)
      ? [
          {
            key: 'cancel',
            icon: <CloseCircleOutlined />,
            label: t('list.cancelRequest', { defaultValue: 'Cancel request' }),
            onClick: () => setConfirming({ approval, action: 'cancel' }),
          },
        ]
      : []),
    ...(isUnreacted(approval.status)
      ? [
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            danger: true,
            label: t('list.delete', { defaultValue: 'Delete' }),
            onClick: () => setConfirming({ approval, action: 'delete' }),
          },
        ]
      : []),
  ];

  const handleTableChange: TableProps<Approval>['onChange'] = (_pagination, filters, sorter) => {
    sorting.applySorter(sorter);
    setStatuses((filters.status ?? []) as ApprovalStatus[]);
  };

  const typeLabel = (type: Approval['linked_item']['type']) =>
    type === 'file'
      ? t('list.typeFile', { defaultValue: 'File' })
      : type === 'milestone'
        ? t('list.typeMilestone', { defaultValue: 'Milestone' })
        : type === 'task'
          ? t('list.typeTask', { defaultValue: 'Task' })
          : t('list.typeFreeform', { defaultValue: 'Free-form item' });

  const columns: ColumnsType<Approval> = [
    {
      key: 'ref',
      ...sorting.columnProps('ref'),
      title: (
        <ColumnTitle
          label={t('list.columns.id', { defaultValue: 'ID' })}
          help={t('list.columnHelp.id', { defaultValue: 'Unique reference of the approval request.' })}
        />
      ),
      render: (_value, approval) => <Typography.Link>{approval.ref_no}</Typography.Link>,
    },
    {
      key: 'approval',
      ...sorting.columnProps('approval'),
      title: (
        <ColumnTitle
          label={t('list.columns.approval', { defaultValue: 'Approval' })}
          help={t('list.columnHelp.approval', { defaultValue: 'What the client is asked to approve.' })}
        />
      ),
      render: (_value, approval) => (
        <span style={{ fontSize: 13, fontWeight: 600 }}>{decodeHtmlEntities(approval.title)}</span>
      ),
    },
    {
      key: 'client',
      ...sorting.columnProps('client'),
      title: (
        <ColumnTitle
          label={t('list.columns.client', { defaultValue: 'Client' })}
          help={t('list.columnHelp.client', { defaultValue: 'The client organization asked to approve.' })}
        />
      ),
      render: (_value, approval) => (
        <span style={{ fontSize: 12.5 }}>{decodeHtmlEntities(approval.organization_name)}</span>
      ),
    },
    {
      key: 'project',
      ...sorting.columnProps('project'),
      title: (
        <ColumnTitle
          label={t('list.columns.project', { defaultValue: 'Project' })}
          help={t('list.columnHelp.project', { defaultValue: 'The project this approval belongs to.' })}
        />
      ),
      render: (_value, approval) => <PortalProjectName name={approval.project_name} color={approval.project_color} />,
    },
    {
      key: 'linked',
      ...sorting.columnProps('linked'),
      title: (
        <ColumnTitle
          label={t('list.columns.linked', { defaultValue: 'Linked item' })}
          help={t('list.columnHelp.linked', { defaultValue: 'The file, milestone or task the approval covers, with its version.' })}
        />
      ),
      render: (_value, approval) => (
        <div style={{ fontSize: 12.5 }}>
          {decodeHtmlEntities(approval.linked_item.name)}
          {approval.linked_item.file_version ? ` \u00b7 v${approval.linked_item.file_version}` : ''}
          {approval.revision > 1 && (
            <span style={{ marginLeft: 6 }}>
              <StatusTag tone="gray">
                {t('list.revision', { revision: approval.revision, defaultValue: 'Rev {{revision}}' })}
              </StatusTag>
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      ...sorting.columnProps('type'),
      title: (
        <ColumnTitle
          label={t('list.columns.type', { defaultValue: 'Type' })}
          help={t('list.columnHelp.type', { defaultValue: 'Whether it covers a file, milestone, task or free-form item.' })}
        />
      ),
      render: (_value, approval) => <span style={{ fontSize: 12.5 }}>{typeLabel(approval.linked_item.type)}</span>,
    },
    {
      key: 'approver',
      ...sorting.columnProps('approver'),
      title: (
        <ColumnTitle
          label={t('list.columns.approver', { defaultValue: 'Approver' })}
          help={t('list.columnHelp.approver', { defaultValue: 'The client user who must approve.' })}
        />
      ),
      render: (_value, approval) => <PortalPerson name={approval.approver_name} />,
    },
    {
      key: 'requested',
      ...sorting.columnProps('requested'),
      title: (
        <ColumnTitle
          label={t('list.columns.requested', { defaultValue: 'Requested' })}
          help={t('list.columnHelp.requested', { defaultValue: 'The date the approval was requested.' })}
        />
      ),
      render: (_value, approval) => formatPortalDate(approval.requested_at, i18n.language) ?? '—',
    },
    {
      key: 'due',
      ...sorting.columnProps('due'),
      title: (
        <ColumnTitle
          label={t('list.columns.due', { defaultValue: 'Due' })}
          help={t('list.columnHelp.due', { defaultValue: 'The date the decision is due. Overdue dates show in red.' })}
        />
      ),
      render: (_value, approval) => {
        const due = formatPortalDate(approval.due_date, i18n.language);
        return due ? (
          <Typography.Text type={approval.is_overdue ? 'danger' : undefined}>{due}</Typography.Text>
        ) : (
          '\u2014'
        );
      },
    },
    {
      key: 'status',
      ...sorting.columnProps('status'),
      filters: STATUS_OPTIONS.map(option => ({
        text: tShared(option.key, { defaultValue: option.defaultValue }),
        value: option.value,
      })),
      filteredValue: statuses.length ? statuses : null,
      title: (
        <ColumnTitle
          label={t('list.columns.status', { defaultValue: 'Status' })}
          help={t('list.columnHelp.status', { defaultValue: 'Where the approval stands: draft, awaiting, approved or changes requested.' })}
        />
      ),
      render: (_value, approval) => <ApprovalStatusTag status={approval.status} />,
    },
    {
      key: 'actions',
      align: 'right',
      title: t('list.columns.actions', { defaultValue: 'Actions' }),
      render: (_value, approval) => (
        // The row opens the approval on click, so the menu must not bubble to it.
        <span onClick={event => event.stopPropagation()}>
          <Dropdown menu={{ items: menuFor(approval) }} trigger={['click']}>
            <Button
              size="small"
              type="text"
              icon={<MoreOutlined />}
              aria-label={t('list.rowActions', { ref: approval.ref_no, defaultValue: 'Actions for {{ref}}' })}
            />
          </Dropdown>
        </span>
      ),
    },
  ];

  const hasFilters = debouncedSearch.trim() !== '' || statuses.length > 0 || organizationIds.length > 0;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0, fontSize: 22 }}>
          {t('list.title', { defaultValue: 'Approvals' })}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t('list.description', {
            defaultValue:
              'Ask a client to approve a file, milestone, task or free-form item. The exact version or revision is recorded and every decision is kept.',
          })}
        </Typography.Text>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('list.stats.awaiting', { defaultValue: 'Awaiting approval' })}
            value={stats?.awaiting ?? '—'}
            tone="warning"
            sub={
              stats && stats.overdue > 0
                ? t('list.stats.overdue', { count: stats.overdue, defaultValue: '{{count}} overdue' })
                : t('list.stats.noneOverdue', { defaultValue: 'None overdue' })
            }
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard label={t('list.stats.approved', { defaultValue: 'Approved' })} value={stats?.approved ?? '—'} tone="success" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('list.stats.changes', { defaultValue: 'Changes requested' })}
            value={stats?.changes_requested ?? '—'}
            tone="danger"
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('list.stats.drafts', { defaultValue: 'Drafts' })}
            value={stats?.drafts ?? '—'}
            sub={t('list.stats.draftsSub', { defaultValue: 'Not visible to clients' })}
          />
        </Col>
      </Row>

      <PortalListToolbar
        lead={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={PORTAL_TOOLBAR_BUTTON_STYLE}
            onClick={() => navigate(portalPaths.newApproval())}
          >
            {t('list.new', { defaultValue: 'Request Approval' })}
          </Button>
        }
        controls={
          <>
            <PortalFilterButton groups={filterGroups} onClear={clearFilters} />
            <PortalFieldsButton fields={fields} hidden={columnVisibility.hidden} onToggle={columnVisibility.toggle} />
          </>
        }
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('list.search', {
          defaultValue: 'Search by ID, title, client, project, linked item, approver…',
        })}
        searchLabel={t('list.searchLabel', { defaultValue: 'Search approvals' })}
      />

      <PortalPagedTable<Approval>
        ariaLabel={t('list.tableLabel', { defaultValue: 'Approvals' })}
        columns={columnVisibility.visibleColumns(columns)}
        onTableChange={handleTableChange}
        rows={list?.items ?? []}
        rowKey={approval => approval.id}
        total={list?.total ?? 0}
        paging={paging}
        loading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={approval => navigate(portalPaths.approval(approval.id))}
        emptyText={
          hasFilters ? (
            t('list.emptyFiltered', { defaultValue: 'No approvals match these filters.' })
          ) : (
            <Flex vertical align="center" gap={12}>
              <span>{t('list.empty', { defaultValue: 'No approvals yet. Create one to ask a client for sign-off.' })}</span>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={PORTAL_TOOLBAR_BUTTON_STYLE}
                onClick={() => navigate(portalPaths.newApproval())}
              >
                {t('list.new', { defaultValue: 'Request Approval' })}
              </Button>
            </Flex>
          )
        }
      />

      {editing && <EditApprovalModal approval={editing} onClose={() => setEditing(null)} />}

      <ConfirmEffectModal
        open={confirming !== null}
        danger
        title={
          confirming?.action === 'delete'
            ? t('list.deleteTitle', { defaultValue: 'Delete this approval request?' })
            : t('detail.cancelTitle', { defaultValue: 'Cancel this approval request?' })
        }
        confirmLabel={
          confirming?.action === 'delete'
            ? t('list.delete', { defaultValue: 'Delete' })
            : t('detail.cancelConfirm', { defaultValue: 'Cancel request' })
        }
        loading={isCancelling || isDeleting}
        onClose={() => setConfirming(null)}
        onConfirm={() => void confirmAction()}
      >
        {confirming?.action === 'delete'
          ? t('list.deleteBody', {
              ref: confirming.approval.ref_no,
              defaultValue: '{{ref}} and its history are removed for good. This cannot be undone.',
            })
          : confirming
            ? t('detail.cancelBody', {
                ref: confirming.approval.ref_no,
                approver: confirming.approval.approver_name,
                defaultValue: '{{ref}} is withdrawn and {{approver}} no longer sees it as pending. The history is kept.',
              })
            : null}
      </ConfirmEffectModal>

      {/* approvals/new and approvals/:id render here as modals over the list. */}
      <Outlet />
    </div>
  );
};

export default ApprovalsPage;
