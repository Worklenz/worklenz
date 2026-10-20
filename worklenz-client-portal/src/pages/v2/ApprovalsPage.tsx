import React, { useMemo, useState } from 'react';
import { Alert, AuditOutlined, Badge, Card, EyeOutlined, FolderOutlined, Table, Typography, theme } from '@/shared/antd-imports';
import type { TableColumnsType } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetApprovalsQuery, useGetProjectsV2Query } from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useFormatters } from '@/hooks/useFormatters';
import {
  DueTag,
  EmptyState,
  ListToolbar,
  PageHeader,
  ProjectName,
  QueryState,
  RowActions,
  StatusTag,
  TablePagination,
  clickableRow,
  tableBodyHeight,
  withHeaderMinWidth,
  useColumnVisibility,
  useLocalPaging,
  useRoleLabel,
} from '@/components/v2';
import type { ColumnField, FilterGroup, RowAction } from '@/components/v2';
import type { ClientApprovalV2 } from '@/types/v2';
import PillToggle from '@/components/PillToggle';
import { PORTAL_CONTROL_HEIGHT } from '@/config/theme.config';
import { ApprovalDetail } from './approvals/ApprovalDetail';

const LINK_TYPE_LABELS: Record<string, string> = {
  file: 'File',
  milestone: 'Milestone',
  task: 'Task',
  freeform: 'Details from your team',
};

const HIDDEN_COLUMNS_KEY = 'worklenz.clientportal.approvals.hiddenColumns.v2';
/** Extra detail columns stay out of the way until someone turns them on from the eye menu. */
const DEFAULT_HIDDEN = ['requested_on', 'requested_by', 'approver', 'decided_by', 'decided_on', 'updated_on'];
const TABLE_BODY_HEIGHT = tableBodyHeight(400);
const COMPLETED_STATUSES = ['approved', 'changes_requested', 'cancelled'] as const;

type ApprovalView = 'awaiting' | 'completed' | 'all';

/** `/approvals` is the list; `/approvals/:id` is one approval (spec #2522). */
export const ApprovalsPage: React.FC = () => {
  const { id } = useParams();
  return <ApprovalsList openId={id} />;
};

const ApprovalsList: React.FC<{ openId?: string }> = ({ openId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can, me } = useClientAccess();
  const roleLabel = useRoleLabel();
  const { dateTime } = useFormatters();
  const query = useGetApprovalsQuery();
  const { data: projects } = useGetProjectsV2Query();
  const projectColors = useMemo(() => new Map((projects ?? []).map(project => [project.id, project.color])), [projects]);
  const { token } = theme.useToken();
  const [tab, setTab] = useState<ApprovalView>('awaiting');
  const countLabel = (text: string, count: number, urgent = false) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {text}
      <Badge
        count={count}
        showZero
        overflowCount={99}
        color={urgent && count > 0 ? token.colorError : token.colorTextTertiary}
        style={{ boxShadow: 'none' }}
      />
    </span>
  );
  const showDue = tab !== 'completed';
  const showDecision = tab !== 'awaiting';
  const [searchText, setSearchText] = useState('');
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const columnVisibility = useColumnVisibility(HIDDEN_COLUMNS_KEY, DEFAULT_HIDDEN);

  const approvals = useMemo(() => query.data ?? [], [query.data]);
  const awaiting = approvals.filter(approval => approval.status === 'awaiting');
  const completed = approvals.filter(approval => approval.status !== 'awaiting');
  const tabRows = tab === 'awaiting' ? awaiting : tab === 'completed' ? completed : approvals;

  const filtered = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return tabRows.filter(
      approval =>
        (projectFilter.length === 0 || projectFilter.includes(approval.project_id)) &&
        (statusFilter.length === 0 || statusFilter.includes(approval.status)) &&
        (needle === '' ||
          [approval.title, approval.ref_no, approval.project_name, approval.linked_item.name].some(value =>
            value.toLowerCase().includes(needle)
          ))
    );
  }, [tabRows, searchText, projectFilter, statusFilter]);

  const paging = useLocalPaging(filtered, {
    ref_no: approval => approval.ref_no,
    approval: approval => approval.title,
    revision: approval => approval.revision,
    project: approval => approval.project_name,
    linked: approval => approval.linked_item.name,
    linked_type: approval => approval.linked_item.type,
    linked_version: approval => approval.linked_item.file_version,
    requested_on: approval => approval.requested_at,
    requested_by: approval => approval.requested_by,
    approver: approval => approval.approver_name,
    updated_on: approval => approval.updated_at,
    due: approval => approval.due_date,
    decided_by: approval => approval.decision?.decided_by,
    decided_on: approval => approval.decision?.decided_at,
    status: approval => approval.status,
  });
  const { sorting } = paging;

  const isFiltered = searchText.trim() !== '' || projectFilter.length > 0 || statusFilter.length > 0;

  const actionsFor = (approval: ClientApprovalV2): RowAction[] => [
    approval.can_decide
      ? { key: 'open', icon: <AuditOutlined />, label: t('approvals.review', { defaultValue: 'Review' }) }
      : { key: 'open', icon: <EyeOutlined />, label: t('approvals.viewDetails', { defaultValue: 'View details' }) },
    { key: 'project', icon: <FolderOutlined />, label: t('approvals.openProject', { defaultValue: 'Open project' }) },
  ];

  const runAction = (approval: ClientApprovalV2, key: string) => {
    if (key === 'open') navigate(`/approvals/${approval.id}`);
    if (key === 'project') navigate(`/projects?project=${approval.project_id}`);
  };

  const columns: TableColumnsType<ClientApprovalV2> = [
    {
      title: t('approvals.refNo', { defaultValue: 'ID' }),
      key: 'ref_no',
      dataIndex: 'ref_no',
      ...sorting.columnProps('ref_no'),
    },
    {
      title: t('approvals.approval', { defaultValue: 'Approval' }),
      key: 'approval',
      ...sorting.columnProps('approval'),
      render: (_: unknown, approval) => <Typography.Text strong>{approval.title}</Typography.Text>,
    },
    {
      title: t('approvals.revisionColumn', { defaultValue: 'Revision' }),
      key: 'revision',
      dataIndex: 'revision',
      responsive: ['lg'],
      ...sorting.columnProps('revision'),
    },
    {
      title: t('approvals.project', { defaultValue: 'Project' }),
      key: 'project',
      dataIndex: 'project_name',
      responsive: ['md'],
      ...sorting.columnProps('project'),
      render: (name: string, approval) => <ProjectName name={name} color={projectColors.get(approval.project_id)} />,
    },
    {
      title: t('approvals.linkedItem', { defaultValue: 'Linked item' }),
      key: 'linked',
      responsive: ['lg'],
      ...sorting.columnProps('linked'),
      render: (_: unknown, approval) => approval.linked_item.name,
    },
    {
      title: t('approvals.linkedType', { defaultValue: 'Item type' }),
      key: 'linked_type',
      responsive: ['lg'],
      ...sorting.columnProps('linked_type'),
      render: (_: unknown, approval) =>
        t(`approvals.linkType.${approval.linked_item.type}`, { defaultValue: LINK_TYPE_LABELS[approval.linked_item.type] }),
    },
    {
      title: t('approvals.linkedVersion', { defaultValue: 'Version' }),
      key: 'linked_version',
      responsive: ['xl'],
      ...sorting.columnProps('linked_version'),
      render: (_: unknown, approval) => (approval.linked_item.file_version ? `v${approval.linked_item.file_version}` : '—'),
    },
    ...(showDue
      ? [
          {
            title: t('approvals.due', { defaultValue: 'Due' }),
            key: 'due',
            responsive: ['sm' as const],
            ...sorting.columnProps('due'),
            render: (_: unknown, approval: ClientApprovalV2) =>
              approval.status === 'awaiting' && approval.due_date ? <DueTag date={approval.due_date} /> : '—',
          },
        ]
      : []),
    ...(showDecision
      ? [
          {
            title: t('approvals.decidedBy', { defaultValue: 'Approved / rejected by' }),
            key: 'decided_by',
            responsive: ['sm' as const],
            ...sorting.columnProps('decided_by'),
            render: (_: unknown, approval: ClientApprovalV2) => approval.decision?.decided_by ?? '—',
          },
          {
            title: t('approvals.decidedOn', { defaultValue: 'Approved / rejected on' }),
            key: 'decided_on',
            responsive: ['md' as const],
            ...sorting.columnProps('decided_on'),
            render: (_: unknown, approval: ClientApprovalV2) => (approval.decision ? dateTime(approval.decision.decided_at) : '—'),
          },
        ]
      : []),
    {
      title: t('approvals.requestedOn', { defaultValue: 'Request date' }),
      key: 'requested_on',
      responsive: ['md' as const],
      ...sorting.columnProps('requested_on'),
      render: (_: unknown, approval: ClientApprovalV2) => (approval.requested_at ? dateTime(approval.requested_at) : '—'),
    },
    {
      title: t('approvals.requestedByColumn', { defaultValue: 'Requested by' }),
      key: 'requested_by',
      responsive: ['md' as const],
      ...sorting.columnProps('requested_by'),
      render: (_: unknown, approval: ClientApprovalV2) => approval.requested_by || '—',
    },
    {
      title: t('approvals.requestedFrom', { defaultValue: 'Requested from' }),
      key: 'approver',
      responsive: ['md' as const],
      ...sorting.columnProps('approver'),
      render: (_: unknown, approval: ClientApprovalV2) => approval.approver_name || '—',
    },
    {
      title: t('approvals.updatedOn', { defaultValue: 'Last updated' }),
      key: 'updated_on',
      responsive: ['lg' as const],
      ...sorting.columnProps('updated_on'),
      render: (_: unknown, approval: ClientApprovalV2) => (approval.updated_at ? dateTime(approval.updated_at) : '—'),
    },
    {
      title: t('approvals.status', { defaultValue: 'Status' }),
      key: 'status',
      dataIndex: 'status',
      ...sorting.columnProps('status'),
      render: (status: string) => <StatusTag kind="approval" status={status} />,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_: unknown, approval) => (
        <RowActions name={approval.title} actions={actionsFor(approval)} onSelect={key => runAction(approval, key)} />
      ),
    },
  ];

  const fields: ColumnField[] = [
    { key: 'ref_no', label: t('approvals.refNo', { defaultValue: 'ID' }) },
    { key: 'revision', label: t('approvals.revisionColumn', { defaultValue: 'Revision' }) },
    { key: 'project', label: t('approvals.project', { defaultValue: 'Project' }) },
    { key: 'linked', label: t('approvals.linkedItem', { defaultValue: 'Linked item' }) },
    { key: 'linked_type', label: t('approvals.linkedType', { defaultValue: 'Item type' }) },
    { key: 'linked_version', label: t('approvals.linkedVersion', { defaultValue: 'Version' }) },
    { key: 'requested_on', label: t('approvals.requestedOn', { defaultValue: 'Request date' }) },
    { key: 'requested_by', label: t('approvals.requestedByColumn', { defaultValue: 'Requested by' }) },
    { key: 'approver', label: t('approvals.requestedFrom', { defaultValue: 'Requested from' }) },
    { key: 'updated_on', label: t('approvals.updatedOn', { defaultValue: 'Last updated' }) },
    ...(showDue ? [{ key: 'due', label: t('approvals.due', { defaultValue: 'Due' }) }] : []),
    ...(showDecision
      ? [
          { key: 'decided_by', label: t('approvals.decidedBy', { defaultValue: 'Approved / rejected by' }) },
          { key: 'decided_on', label: t('approvals.decidedOn', { defaultValue: 'Approved / rejected on' }) },
        ]
      : []),
    { key: 'status', label: t('approvals.status', { defaultValue: 'Status' }) },
  ];

  const projectOptions = useMemo(
    () =>
      Array.from(new Map(approvals.map(approval => [approval.project_id, approval.project_name])))
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [approvals]
  );

  const filterGroups: FilterGroup[] = [
    {
      key: 'project',
      label: t('approvals.project', { defaultValue: 'Project' }),
      options: projectOptions,
      value: projectFilter,
      onChange: value => {
        setProjectFilter(value);
        paging.resetPage();
      },
    },
    ...(tab !== 'awaiting'
      ? [
          {
            key: 'status',
            label: t('approvals.status', { defaultValue: 'Status' }),
            options: (tab === 'all' ? (['awaiting', ...COMPLETED_STATUSES] as const) : COMPLETED_STATUSES).map(value => ({ value, label: t(`status.approval.${value}`, { defaultValue: value }) })),
            value: statusFilter,
            onChange: (value: string[]) => {
              setStatusFilter(value);
              paging.resetPage();
            },
          },
        ]
      : []),
  ];

  const clearFilters = () => {
    setProjectFilter([]);
    setStatusFilter([]);
    paging.resetPage();
  };

  const changeTab = (key: ApprovalView) => {
    setTab(key);
    setStatusFilter([]);
    paging.resetPage();
  };

  return (
    <div>
      <PageHeader
        title={t('approvals.title', { defaultValue: 'Approvals' })}
        subtitle={t('approvals.subtitle', { defaultValue: 'Items your team needs you to approve, and the decisions already made.' })}
      />
      {me && !can.approve && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('approvals.roleBanner', {
            role: roleLabel(me.role),
            defaultValue: 'As a {{role}} you can see approvals but not decide them. Only a Client Admin can approve.',
          })}
        />
      )}
      <QueryState {...query} refetch={query.refetch}>
        <ListToolbar
          leading={
            <PillToggle<ApprovalView>
              value={tab}
              onChange={changeTab}
              ariaLabel={t('approvals.viewFilter', { defaultValue: 'Show approvals' })}
              style={{ height: PORTAL_CONTROL_HEIGHT }}
              options={[
                { value: 'awaiting', label: countLabel(t('approvals.awaitingTab', { defaultValue: 'Awaiting approval' }), awaiting.length, true) },
                { value: 'completed', label: countLabel(t('approvals.completedTab', { defaultValue: 'Completed' }), completed.length) },
                { value: 'all', label: countLabel(t('approvals.allTab', { defaultValue: 'All' }), approvals.length) },
              ]}
            />
          }
          searchText={searchText}
          onSearch={value => {
            setSearchText(value);
            paging.resetPage();
          }}
          searchPlaceholder={t('approvals.searchPlaceholder', { defaultValue: 'Search by approval, project or linked item…' })}
          filterGroups={filterGroups}
          onClearFilters={clearFilters}
          fields={fields}
          hiddenFields={columnVisibility.hidden}
          onToggleField={columnVisibility.toggle}
        />
        {tabRows.length === 0 ? (
          <EmptyState
            title={
              tab === 'awaiting'
                ? t('approvals.noneAwaiting', { defaultValue: 'Nothing is waiting for approval' })
                : tab === 'completed'
                  ? t('approvals.noneCompleted', { defaultValue: 'No completed approvals yet' })
                  : t('approvals.none', { defaultValue: 'No approvals yet' })
            }
          />
        ) : (
          <Card styles={{ body: { padding: 0 } }}>
            <Table<ClientApprovalV2>
              rowKey="id"
              showSorterTooltip={false}
              tableLayout="auto"
              columns={withHeaderMinWidth(columnVisibility.visibleColumns(columns))}
              dataSource={paging.pageRows}
              pagination={false}
              scroll={{ x: 'max-content', y: TABLE_BODY_HEIGHT }}
              locale={{
                emptyText: isFiltered
                  ? t('approvals.noMatches', { defaultValue: 'No approvals match your search or filters.' })
                  : undefined,
              }}
              onChange={(_pagination, _filters, sorter) => {
                sorting.applySorter(sorter);
                paging.resetPage();
              }}
              onRow={approval => clickableRow(() => navigate(`/approvals/${approval.id}`))}
            />
            <TablePagination page={paging.page} pageSize={paging.size} total={paging.total} onPageChange={paging.onPageChange} />
          </Card>
        )}
      </QueryState>
      <ApprovalDetail id={openId} onClose={() => navigate('/approvals')} />
    </div>
  );
};

export default ApprovalsPage;
