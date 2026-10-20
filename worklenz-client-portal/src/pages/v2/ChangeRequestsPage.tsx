import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  EyeOutlined,
  FolderOutlined,
  Row,
  Table,
  Typography,
  PlusOutlined,
} from '@/shared/antd-imports';
import type { TableColumnsType } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetChangeRequestsQuery, useGetProjectsV2Query } from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useFormatters } from '@/hooks/useFormatters';
import {
  EmptyState,
  ListToolbar,
  LockedNote,
  PageHeader,
  ProjectName,
  QueryState,
  RowActions,
  StatTile,
  StatusTag,
  TablePagination,
  clickableRow,
  tableBodyHeight,
  withHeaderMinWidth,
  useColumnVisibility,
  useLocalPaging,
} from '@/components/v2';
import type { ColumnField, FilterGroup, RowAction } from '@/components/v2';
import type { ClientChangeRequestV2 } from '@/types/v2';
import { NewChangeRequestModal } from '@/components/v2/NewChangeRequestModal';
import { ChangeRequestDetail } from './change-requests/ChangeRequestDetail';

const OPEN_STATUSES = ['submitted', 'under_review', 'more_info'];
const STATUS_FILTERS = ['submitted', 'under_review', 'more_info', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled'] as const;
const PRIORITY_FILTERS = ['low', 'medium', 'high'] as const;
const PRIORITY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };
const HIDDEN_COLUMNS_KEY = 'worklenz.clientportal.changeRequests.hiddenColumns.v2';
/** Extra detail columns stay out of the way until someone turns them on from the eye menu. */
const DEFAULT_HIDDEN = ['requester', 'updated_on', 'closed_on'];
const TABLE_BODY_HEIGHT = tableBodyHeight(560);

/** `/change-requests` is the list; `/change-requests/:id` is one request (spec #2525). */
export const ChangeRequestsPage: React.FC = () => {
  const { id } = useParams();
  return <ChangeRequestList openId={id} />;
};

const ChangeRequestList: React.FC<{ openId?: string }> = ({ openId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useClientAccess();
  const { date } = useFormatters();
  const query = useGetChangeRequestsQuery();
  const { data: projects } = useGetProjectsV2Query();
  const projectColors = useMemo(() => new Map((projects ?? []).map(project => [project.id, project.color])), [projects]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [showNew, setShowNew] = useState(false);
  const columnVisibility = useColumnVisibility(HIDDEN_COLUMNS_KEY, DEFAULT_HIDDEN);

  const requests = useMemo(() => query.data ?? [], [query.data]);
  const count = (...statuses: string[]) => requests.filter(request => statuses.includes(request.status)).length;
  const needsReply = requests.filter(request => request.needs_your_reply).length;

  const filtered = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return requests.filter(
      request =>
        (statusFilter.length === 0 || statusFilter.includes(request.status)) &&
        (priorityFilter.length === 0 || priorityFilter.includes(request.priority)) &&
        (projectFilter.length === 0 || projectFilter.includes(request.project_id)) &&
        (needle === '' ||
          [request.title, request.cr_no, request.requester_name, request.project_name].some(value =>
            value.toLowerCase().includes(needle)
          ))
    );
  }, [requests, searchText, statusFilter, priorityFilter, projectFilter]);

  const paging = useLocalPaging(filtered, {
    cr_no: request => request.cr_no,
    request: request => request.title,
    requester: request => request.requester_name,
    project: request => request.project_name,
    priority: request => PRIORITY_RANK[request.priority] ?? 0,
    submitted: request => request.submitted_at,
    updated_on: request => request.updated_at,
    closed_on: request => request.closed_at,
    estimate_hours: request => request.estimate?.hours ?? null,
    estimate_cost: request => request.estimate?.cost ?? null,
    status: request => request.status,
  });
  const { sorting } = paging;

  const isFiltered =
    searchText.trim() !== '' || statusFilter.length > 0 || priorityFilter.length > 0 || projectFilter.length > 0;

  const actionsFor = (): RowAction[] => [
    { key: 'open', icon: <EyeOutlined />, label: t('changeRequests.viewDetails', { defaultValue: 'View details' }) },
    { key: 'project', icon: <FolderOutlined />, label: t('changeRequests.openProject', { defaultValue: 'Open project' }) },
  ];

  const runAction = (request: ClientChangeRequestV2, key: string) => {
    if (key === 'open') navigate(`/change-requests/${request.id}`);
    if (key === 'project') navigate(`/projects?project=${request.project_id}`);
  };

  const columns: TableColumnsType<ClientChangeRequestV2> = [
    {
      title: t('changeRequests.crNo', { defaultValue: 'ID' }),
      key: 'cr_no',
      dataIndex: 'cr_no',
      ...sorting.columnProps('cr_no'),
    },
    {
      title: t('changeRequests.request', { defaultValue: 'Request' }),
      key: 'request',
      ...sorting.columnProps('request'),
      render: (_: unknown, request) => <Typography.Text strong>{request.title}</Typography.Text>,
    },
    {
      title: t('changeRequests.requester', { defaultValue: 'Requested by' }),
      key: 'requester',
      dataIndex: 'requester_name',
      responsive: ['md'],
      ...sorting.columnProps('requester'),
    },
    {
      title: t('changeRequests.project', { defaultValue: 'Project' }),
      key: 'project',
      dataIndex: 'project_name',
      responsive: ['md'],
      ...sorting.columnProps('project'),
      render: (name: string, request) => <ProjectName name={name} color={projectColors.get(request.project_id)} />,
    },
    {
      title: t('changeRequests.priority', { defaultValue: 'Priority' }),
      key: 'priority',
      dataIndex: 'priority',
      responsive: ['md'],
      ...sorting.columnProps('priority'),
      render: (priority: string) => <StatusTag kind="priority" status={priority} />,
    },
    {
      title: t('changeRequests.requestDate', { defaultValue: 'Request date' }),
      key: 'submitted',
      dataIndex: 'submitted_at',
      responsive: ['lg'],
      ...sorting.columnProps('submitted'),
      render: (value: string) => date(value),
    },
    {
      title: t('changeRequests.estimateHours', { defaultValue: 'Est. hours' }),
      key: 'estimate_hours',
      responsive: ['lg'],
      ...sorting.columnProps('estimate_hours'),
      render: (_: unknown, request) => (request.estimate?.hours ? `${request.estimate.hours} h` : '—'),
    },
    {
      title: t('changeRequests.estimateCost', { defaultValue: 'Est. cost' }),
      key: 'estimate_cost',
      responsive: ['lg'],
      ...sorting.columnProps('estimate_cost'),
      render: (_: unknown, request) => (request.estimate?.cost ? `$${request.estimate.cost.toLocaleString()}` : '—'),
    },
    {
      title: t('changeRequests.updatedOn', { defaultValue: 'Last updated' }),
      key: 'updated_on',
      responsive: ['lg'],
      ...sorting.columnProps('updated_on'),
      render: (_: unknown, request) => (request.updated_at ? date(request.updated_at) : '—'),
    },
    {
      title: t('changeRequests.closedOn', { defaultValue: 'Closed on' }),
      key: 'closed_on',
      responsive: ['lg'],
      ...sorting.columnProps('closed_on'),
      render: (_: unknown, request) => (request.closed_at ? date(request.closed_at) : '—'),
    },
    {
      title: t('changeRequests.status', { defaultValue: 'Status' }),
      key: 'status',
      dataIndex: 'status',
      ...sorting.columnProps('status'),
      render: (value: string) => <StatusTag kind="changeRequest" status={value} />,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_: unknown, request) => (
        <RowActions name={request.title} actions={actionsFor()} onSelect={key => runAction(request, key)} />
      ),
    },
  ];

  const fields: ColumnField[] = [
    { key: 'cr_no', label: t('changeRequests.crNo', { defaultValue: 'ID' }) },
    { key: 'requester', label: t('changeRequests.requester', { defaultValue: 'Requested by' }) },
    { key: 'project', label: t('changeRequests.project', { defaultValue: 'Project' }) },
    { key: 'priority', label: t('changeRequests.priority', { defaultValue: 'Priority' }) },
    { key: 'submitted', label: t('changeRequests.requestDate', { defaultValue: 'Request date' }) },
    { key: 'updated_on', label: t('changeRequests.updatedOn', { defaultValue: 'Last updated' }) },
    { key: 'closed_on', label: t('changeRequests.closedOn', { defaultValue: 'Closed on' }) },
    { key: 'estimate_hours', label: t('changeRequests.estimateHours', { defaultValue: 'Est. hours' }) },
    { key: 'estimate_cost', label: t('changeRequests.estimateCost', { defaultValue: 'Est. cost' }) },
    { key: 'status', label: t('changeRequests.status', { defaultValue: 'Status' }) },
  ];

  const projectOptions = useMemo(
    () =>
      Array.from(new Map(requests.map(request => [request.project_id, request.project_name])))
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [requests]
  );

  const filterGroup = (key: string, label: string, options: FilterGroup['options'], value: string[], set: (v: string[]) => void): FilterGroup => ({
    key,
    label,
    options,
    value,
    onChange: next => {
      set(next);
      paging.resetPage();
    },
  });

  const filterGroups: FilterGroup[] = [
    filterGroup(
      'status',
      t('changeRequests.status', { defaultValue: 'Status' }),
      STATUS_FILTERS.map(value => ({ value, label: t(`status.changeRequest.${value}`, { defaultValue: value }) })),
      statusFilter,
      setStatusFilter
    ),
    filterGroup(
      'priority',
      t('changeRequests.priority', { defaultValue: 'Priority' }),
      PRIORITY_FILTERS.map(value => ({ value, label: t(`status.priority.${value}`, { defaultValue: value }) })),
      priorityFilter,
      setPriorityFilter
    ),
    filterGroup('project', t('changeRequests.project', { defaultValue: 'Project' }), projectOptions, projectFilter, setProjectFilter),
  ];

  const clearFilters = () => {
    setStatusFilter([]);
    setPriorityFilter([]);
    setProjectFilter([]);
    paging.resetPage();
  };

  const newButton = can.submitChangeRequest ? (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowNew(true)}>
      {t('changeRequests.new', { defaultValue: 'New change request' })}
    </Button>
  ) : null;
  const lockedNote = can.submitChangeRequest ? undefined : (
    <LockedNote>{t('locked.changeRequest', { defaultValue: "Client Viewers can't submit change requests." })}</LockedNote>
  );

  return (
    <div>
      <PageHeader
        title={t('changeRequests.title', { defaultValue: 'Change Requests' })}
        subtitle={t('changeRequests.subtitle', { defaultValue: 'Ask for a change to scope, features or deliverables, and follow the answer.' })}
        extra={lockedNote}
      />
      <QueryState {...query} refetch={query.refetch}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <StatTile label={t('changeRequests.statOpen', { defaultValue: 'Open' })} value={count(...OPEN_STATUSES)} tone="warning" />
          </Col>
          <Col xs={12} md={6}>
            <StatTile label={t('changeRequests.statNeedsReply', { defaultValue: 'Needs your reply' })} value={needsReply} tone={needsReply ? 'error' : undefined} />
          </Col>
          <Col xs={12} md={6}>
            <StatTile label={t('changeRequests.statApproved', { defaultValue: 'Approved / in progress' })} value={count('approved', 'in_progress')} />
          </Col>
          <Col xs={12} md={6}>
            <StatTile label={t('changeRequests.statCompleted', { defaultValue: 'Completed' })} value={count('completed')} tone="success" />
          </Col>
        </Row>

        {requests.length === 0 ? (
          <EmptyState
            title={t('changeRequests.none', { defaultValue: 'No change requests yet' })}
            description={t('changeRequests.noneHelp', {
              defaultValue: 'Need something added, changed or removed? Submit a change request and your team will review it.',
            })}
            action={
              can.submitChangeRequest && (
                <Button type="primary" onClick={() => setShowNew(true)}>
                  {t('changeRequests.firstRequest', { defaultValue: 'Submit your first request' })}
                </Button>
              )
            }
          />
        ) : (
          <>
            <ListToolbar
              leading={newButton}
              searchText={searchText}
              onSearch={value => {
                setSearchText(value);
                paging.resetPage();
              }}
              searchPlaceholder={t('changeRequests.searchPlaceholder', { defaultValue: 'Search by request, project or requester…' })}
              filterGroups={filterGroups}
              onClearFilters={clearFilters}
              fields={fields}
              hiddenFields={columnVisibility.hidden}
              onToggleField={columnVisibility.toggle}
            />
            <Card styles={{ body: { padding: 0 } }}>
              <Table<ClientChangeRequestV2>
                rowKey="id"
                showSorterTooltip={false}
                tableLayout="auto"
                columns={withHeaderMinWidth(columnVisibility.visibleColumns(columns))}
                dataSource={paging.pageRows}
                pagination={false}
                scroll={{ x: 'max-content', y: TABLE_BODY_HEIGHT }}
                locale={{
                  emptyText: isFiltered
                    ? t('changeRequests.noMatches', { defaultValue: 'No change requests match your search or filters.' })
                    : undefined,
                }}
                onChange={(_pagination, _filters, sorter) => {
                  sorting.applySorter(sorter);
                  paging.resetPage();
                }}
                onRow={request => clickableRow(() => navigate(`/change-requests/${request.id}`))}
              />
              <TablePagination page={paging.page} pageSize={paging.size} total={paging.total} onPageChange={paging.onPageChange} />
            </Card>
          </>
        )}
      </QueryState>
      <ChangeRequestDetail id={openId} onClose={() => navigate('/change-requests')} />
      <NewChangeRequestModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
};

export default ChangeRequestsPage;
