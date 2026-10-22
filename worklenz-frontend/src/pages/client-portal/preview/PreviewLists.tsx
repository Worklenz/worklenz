import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Modal,
  Progress,
  Row,
  Segmented,
  Table,
  Tabs,
  Tag,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { TableColumnsType } from 'antd';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { useGetPreviewProjectQuery } from '@/api/client-portal/portal-workflow-api';
import {
  ApprovalStatusTag,
  ChangeRequestStatusTag,
  ClientProjectStatusTag,
  MilestoneStatusTag,
  PortalLoader,
  PortalProjectName,
  PriorityTag,
  ROLE_LABEL_COPY,
  formatPortalDate,
  formatPortalDateTime,
} from '@/components/client-portal/v2';
import type {
  ChangeRequestStatus,
  ClientApprovalView,
  ClientChangeRequestView,
  ClientProjectView,
  ClientRole,
} from '@/types/client-portal/v2';
import {
  DueTag,
  PageHeader,
  PreviewEmpty,
  PreviewToolbar,
  StatTile,
  useHiddenColumns,
  type PreviewFilterGroup,
} from './PreviewShared';

const PAGE_SIZE = 10;
const DASH = '—';

const includesText = (needle: string, ...values: Array<string | null | undefined>) =>
  needle === '' || values.some(value => (value ?? '').toLowerCase().includes(needle));

const toOptions = (entries: Array<[string, string]>) =>
  Array.from(new Map(entries), ([value, label]) => ({ value, label: decodeHtmlEntities(label) })).sort((a, b) =>
    a.label.localeCompare(b.label)
  );

const useProjectColors = (projects: ClientProjectView[]) =>
  useMemo(() => new Map(projects.map(project => [project.id, project.color])), [projects]);

// ─── Projects ─────────────────────────────────────────────────────────────────────────────────

interface PreviewProjectsProps {
  projects: ClientProjectView[];
  contactId: string;
  openProjectId: string | null;
  onOpenProject: (projectId: string | null) => void;
}

export const PreviewProjects = ({ projects, contactId, openProjectId, onOpenProject }: PreviewProjectsProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-preview');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [phaseFilter, setPhaseFilter] = useState<string[]>([]);
  const columnVisibility = useHiddenColumns();
  const open = projects.find(project => project.id === openProjectId);

  const rows = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return projects.filter(
      project =>
        (statusFilter.length === 0 || statusFilter.includes(project.status)) &&
        (phaseFilter.length === 0 || phaseFilter.includes(project.phase ?? '')) &&
        includesText(needle, project.name, project.phase, project.primary_contact)
    );
  }, [projects, searchText, statusFilter, phaseFilter]);

  const statusLabels: Record<ClientProjectView['status'], string> = {
    on_track: t('status.onTrack', { defaultValue: 'On track' }),
    at_risk: t('status.atRisk', { defaultValue: 'At risk' }),
    on_hold: t('status.onHold', { defaultValue: 'On hold' }),
    completed: t('status.completed', { defaultValue: 'Completed' }),
  };
  const filterGroups: PreviewFilterGroup[] = [
    {
      key: 'status',
      label: t('projects.status', { defaultValue: 'Status' }),
      options: (Object.keys(statusLabels) as ClientProjectView['status'][]).map(value => ({ value, label: statusLabels[value] })),
      value: statusFilter,
      onChange: setStatusFilter,
    },
    {
      key: 'phase',
      label: t('projects.phase', { defaultValue: 'Phase' }),
      options: toOptions(projects.filter(project => project.phase).map(project => [project.phase as string, project.phase as string])),
      value: phaseFilter,
      onChange: setPhaseFilter,
    },
  ];
  const fields = [
    { key: 'status', label: t('projects.status', { defaultValue: 'Status' }) },
    { key: 'phase', label: t('projects.phase', { defaultValue: 'Phase' }) },
    { key: 'progress', label: t('projects.progress', { defaultValue: 'Progress' }) },
    { key: 'expected', label: t('projects.expectedCompletion', { defaultValue: 'Expected completion' }) },
    { key: 'contact', label: t('projects.contact', { defaultValue: 'Project contact' }) },
    { key: 'open', label: t('projects.openItems', { defaultValue: 'Open items' }) },
  ];

  const columns: TableColumnsType<ClientProjectView> = [
    {
      title: t('projects.project', { defaultValue: 'Project' }),
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (_: unknown, project) => <PortalProjectName name={project.name} color={project.color} fontWeight={600} fontSize={14} />,
    },
    {
      title: t('projects.status', { defaultValue: 'Status' }),
      key: 'status',
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (_: unknown, project) => <ClientProjectStatusTag status={project.status} />,
    },
    {
      title: t('projects.phase', { defaultValue: 'Phase' }),
      key: 'phase',
      render: (_: unknown, project) => project.phase ?? DASH,
    },
    {
      title: t('projects.progress', { defaultValue: 'Progress' }),
      key: 'progress',
      width: 170,
      sorter: (a, b) => a.progress - b.progress,
      render: (_: unknown, project) => <Progress percent={project.progress} size="small" strokeColor={project.color ?? undefined} />,
    },
    {
      title: t('projects.expectedCompletion', { defaultValue: 'Expected completion' }),
      key: 'expected',
      render: (_: unknown, project) => formatPortalDate(project.expected_completion, i18n.language) ?? DASH,
    },
    {
      title: t('projects.contact', { defaultValue: 'Project contact' }),
      key: 'contact',
      render: (_: unknown, project) => project.primary_contact ?? DASH,
    },
    {
      title: t('projects.openItems', { defaultValue: 'Open items' }),
      key: 'open',
      render: (_: unknown, project) => {
        const count = (project.open_approvals ?? 0) + (project.open_change_requests ?? 0);
        return count > 0 ? <Tag color="orange">{count}</Tag> : <Typography.Text type="secondary">{DASH}</Typography.Text>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('projects.title', { defaultValue: 'Projects' })}
        subtitle={t('projects.subtitle', { defaultValue: 'The projects your team has shared with you.' })}
      />
      {projects.length === 0 ? (
        <PreviewEmpty
          title={t('projects.none', { defaultValue: 'No projects are shared with you yet' })}
          description={t('projects.noneHelp', {
            defaultValue: 'Your project contact assigns projects to you. They show up here as soon as they do.',
          })}
        />
      ) : (
        <>
          <PreviewToolbar
            value={searchText}
            onChange={setSearchText}
            placeholder={t('projects.searchPlaceholder', { defaultValue: 'Search by project, phase or contact…' })}
            filterGroups={filterGroups}
            fields={fields}
            hiddenFields={columnVisibility.hidden}
            onToggleField={columnVisibility.toggle}
          />
          <Card styles={{ body: { padding: 0 } }}>
            <Table<ClientProjectView>
              rowKey="id"
              size="middle"
              showSorterTooltip={false}
              columns={columnVisibility.visible(columns)}
              dataSource={rows}
              pagination={rows.length > PAGE_SIZE ? { pageSize: PAGE_SIZE, size: 'small', showSizeChanger: false } : false}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: t('projects.noMatches', { defaultValue: 'No projects match your search.' }) }}
              onRow={project => ({ onClick: () => onOpenProject(project.id), style: { cursor: 'pointer' } })}
            />
          </Card>
        </>
      )}
      <ProjectModal contactId={contactId} project={open ?? null} onClose={() => onOpenProject(null)} />
    </div>
  );
};

const ProjectModal = ({ contactId, project, onClose }: { contactId: string; project: ClientProjectView | null; onClose: () => void }) => {
  const { t, i18n } = useTranslation('client-portal-v2-preview');
  const { token } = theme.useToken();
  const query = useGetPreviewProjectQuery({ contactId, projectId: project?.id ?? '' }, { skip: !project });
  const detail = query.data?.body;
  const notSet = t('project.notSet', { defaultValue: 'Not set' });

  const keyValue = (label: string, value: ReactNode) => (
    <Flex justify="space-between" gap={12} style={{ padding: '8px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Text strong>{value}</Typography.Text>
    </Flex>
  );

  const loadable = (render: () => ReactNode): ReactNode => {
    if (query.isLoading) return <PortalLoader />;
    if (query.isError || !detail) {
      return (
        <Alert
          type="error"
          showIcon
          message={t('project.loadFailed', { defaultValue: 'The project could not be previewed.' })}
          action={
            <Button size="small" onClick={() => query.refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      );
    }
    return render();
  };

  const emptyNote = (text: string) => <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text} />;

  return (
    <Modal
      open={Boolean(project)}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnClose
      title={
        project && (
          <Flex gap={10} align="center">
            <PortalProjectName name={project.name} color={project.color} fontWeight={600} fontSize={16} />
            <ClientProjectStatusTag status={project.status} />
          </Flex>
        )
      }
    >
      {project && (
        <Tabs
          items={[
            {
              key: 'overview',
              label: t('project.overview', { defaultValue: 'Overview' }),
              children: (
                <div>
                  <Typography.Paragraph type="secondary">{project.summary}</Typography.Paragraph>
                  <Progress percent={project.progress} strokeColor={project.color ?? undefined} />
                  {keyValue(t('project.phase', { defaultValue: 'Phase' }), project.phase ?? notSet)}
                  {keyValue(t('project.start', { defaultValue: 'Start' }), formatPortalDate(project.start_date, i18n.language) ?? notSet)}
                  {keyValue(
                    t('project.expectedCompletion', { defaultValue: 'Expected completion' }),
                    formatPortalDate(project.expected_completion, i18n.language) ?? notSet
                  )}
                  {keyValue(t('project.primaryContact', { defaultValue: 'Primary contact' }), project.primary_contact ?? notSet)}
                  {project.latest_update && (
                    <Card size="small" style={{ marginTop: 16 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {t('project.latestUpdate', {
                          date: formatPortalDate(project.latest_update.published_at, i18n.language) ?? '',
                          defaultValue: 'Latest update · {{date}}',
                        })}
                      </Typography.Text>
                      <div style={{ marginTop: 4 }}>{project.latest_update.body}</div>
                    </Card>
                  )}
                </div>
              ),
            },
            {
              key: 'milestones',
              label: t('project.milestones', { defaultValue: 'Milestones' }),
              children: loadable(() =>
                detail && detail.milestones.length > 0 ? (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={detail.milestones}
                    columns={[
                      { title: t('project.name', { defaultValue: 'Name' }), key: 'name', render: (_: unknown, row) => <Typography.Text strong>{decodeHtmlEntities(row.name)}</Typography.Text> },
                      {
                        title: t('project.targetDate', { defaultValue: 'Target date' }),
                        key: 'date',
                        render: (_: unknown, row) => (
                          <>
                            {formatPortalDate(row.target_date, i18n.language)}
                            {row.status === 'delayed' && row.date_moved && (
                              <Typography.Text type="secondary"> · {t('project.dateMoved', { defaultValue: 'The date has moved' })}</Typography.Text>
                            )}
                          </>
                        ),
                      },
                      { title: t('projects.status', { defaultValue: 'Status' }), key: 'status', render: (_: unknown, row) => <MilestoneStatusTag status={row.status} /> },
                    ]}
                  />
                ) : (
                  emptyNote(t('project.noMilestones', { defaultValue: 'No milestones are shared yet.' }))
                )
              ),
            },
            {
              key: 'tasks',
              label: t('project.tasks', { defaultValue: 'Tasks' }),
              children: loadable(() =>
                detail && detail.tasks.length > 0 ? (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={detail.tasks}
                    columns={[
                      { title: t('project.key', { defaultValue: 'ID' }), key: 'key', dataIndex: 'key' },
                      { title: t('project.task', { defaultValue: 'Task' }), key: 'title', render: (_: unknown, row) => <Typography.Text strong>{row.title}</Typography.Text> },
                      {
                        title: t('project.due', { defaultValue: 'Due' }),
                        key: 'due',
                        render: (_: unknown, row) => formatPortalDate(row.due_date, i18n.language) ?? DASH,
                      },
                      {
                        title: t('projects.status', { defaultValue: 'Status' }),
                        key: 'status',
                        render: (_: unknown, row) => (
                          <Tag color={row.status === 'done' ? 'green' : row.status === 'in_progress' ? 'processing' : 'default'}>
                            {{
                              not_started: t('status.notStarted', { defaultValue: 'Not started' }),
                              in_progress: t('status.inProgress', { defaultValue: 'In progress' }),
                              done: t('status.done', { defaultValue: 'Done' }),
                            }[row.status]}
                          </Tag>
                        ),
                      },
                    ]}
                  />
                ) : (
                  emptyNote(t('project.noTasks', { defaultValue: 'No tasks are shared yet.' }))
                )
              ),
            },
            {
              key: 'files',
              label: t('project.files', { defaultValue: 'Files' }),
              children: loadable(() =>
                detail && detail.files.length > 0 ? (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={detail.files}
                    columns={[
                      { title: t('project.name', { defaultValue: 'Name' }), key: 'name', render: (_: unknown, row) => <Typography.Text strong>{decodeHtmlEntities(row.name)}</Typography.Text> },
                      { title: t('project.category', { defaultValue: 'Category' }), key: 'category', dataIndex: 'category' },
                      {
                        title: t('project.version', { defaultValue: 'Version' }),
                        key: 'version',
                        render: (_: unknown, row) => t('project.fileVersion', { version: row.version, defaultValue: 'v{{version}}' }),
                      },
                      { title: t('project.size', { defaultValue: 'Size' }), key: 'size', dataIndex: 'size_label' },
                      {
                        title: t('project.uploaded', { defaultValue: 'Uploaded' }),
                        key: 'uploaded',
                        render: (_: unknown, row) => formatPortalDate(row.uploaded_at, i18n.language) ?? DASH,
                      },
                    ]}
                  />
                ) : (
                  emptyNote(t('project.noFiles', { defaultValue: 'No files are shared yet.' }))
                )
              ),
            },
          ]}
        />
      )}
    </Modal>
  );
};

// ─── Approvals ────────────────────────────────────────────────────────────────────────────────

type ApprovalFilter = 'awaiting' | 'completed' | 'all';

interface PreviewApprovalsProps {
  approvals: ClientApprovalView[];
  projects: ClientProjectView[];
  role: ClientRole | undefined;
  canApprove: boolean;
}

export const PreviewApprovals = ({ approvals, projects, role, canApprove }: PreviewApprovalsProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-preview');
  const { t: tShared } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();
  const projectColors = useProjectColors(projects);
  const [view, setView] = useState<ApprovalFilter>('awaiting');
  const [searchText, setSearchText] = useState('');
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const columnVisibility = useHiddenColumns(['requested']);

  const awaiting = approvals.filter(approval => approval.status === 'awaiting');
  const completed = approvals.filter(approval => approval.status !== 'awaiting');
  const viewRows = view === 'awaiting' ? awaiting : view === 'completed' ? completed : approvals;
  const rows = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return viewRows.filter(
      approval =>
        (projectFilter.length === 0 || projectFilter.includes(approval.project_id)) &&
        (statusFilter.length === 0 || statusFilter.includes(approval.status)) &&
        includesText(needle, approval.title, approval.ref_no, approval.project_name, approval.linked_item.name)
    );
  }, [viewRows, searchText, projectFilter, statusFilter]);

  const approvalStatusLabels: Record<string, string> = {
    awaiting: t('approvals.statusAwaiting', { defaultValue: 'Awaiting approval' }),
    approved: t('approvals.statusApproved', { defaultValue: 'Approved' }),
    changes_requested: t('approvals.statusChangesRequested', { defaultValue: 'Changes requested' }),
    cancelled: t('approvals.statusCancelled', { defaultValue: 'Cancelled' }),
  };
  const approvalFilterGroups: PreviewFilterGroup[] = [
    {
      key: 'project',
      label: t('approvals.project', { defaultValue: 'Project' }),
      options: toOptions(approvals.map(approval => [approval.project_id, approval.project_name])),
      value: projectFilter,
      onChange: setProjectFilter,
    },
    ...(view !== 'awaiting'
      ? [
          {
            key: 'status',
            label: t('approvals.status', { defaultValue: 'Status' }),
            options: Object.entries(approvalStatusLabels)
              .filter(([value]) => view === 'all' || value !== 'awaiting')
              .map(([value, label]) => ({ value, label })),
            value: statusFilter,
            onChange: setStatusFilter,
          },
        ]
      : []),
  ];
  const approvalFields = [
    { key: 'ref_no', label: t('approvals.refNo', { defaultValue: 'ID' }) },
    { key: 'project', label: t('approvals.project', { defaultValue: 'Project' }) },
    { key: 'linked', label: t('approvals.linkedItem', { defaultValue: 'Linked item' }) },
    { key: 'type', label: t('approvals.linkedType', { defaultValue: 'Item type' }) },
    {
      key: 'due',
      label: view === 'completed' ? t('approvals.decidedBy', { defaultValue: 'Approved / rejected by' }) : t('approvals.due', { defaultValue: 'Due' }),
    },
    { key: 'requested', label: t('approvals.requestedOn', { defaultValue: 'Request date' }) },
    { key: 'status', label: t('approvals.status', { defaultValue: 'Status' }) },
  ];
  const changeView = (next: ApprovalFilter) => {
    setView(next);
    setStatusFilter([]);
  };

  const countLabel = (text: string, count: number, isUrgent = false) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {text}
      <Badge
        count={count}
        showZero
        overflowCount={99}
        color={isUrgent && count > 0 ? token.colorError : token.colorTextTertiary}
        style={{ boxShadow: 'none' }}
      />
    </span>
  );

  const linkTypeLabel = (type: ClientApprovalView['linked_item']['type']) =>
    ({
      file: t('approvals.linkType.file', { defaultValue: 'File' }),
      milestone: t('approvals.linkType.milestone', { defaultValue: 'Milestone' }),
      task: t('approvals.linkType.task', { defaultValue: 'Task' }),
      freeform: t('approvals.linkType.freeform', { defaultValue: 'Details from your team' }),
    })[type];

  const columns: TableColumnsType<ClientApprovalView> = [
    { title: t('approvals.refNo', { defaultValue: 'ID' }), key: 'ref_no', dataIndex: 'ref_no', sorter: (a, b) => a.ref_no.localeCompare(b.ref_no) },
    {
      title: t('approvals.approval', { defaultValue: 'Approval' }),
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (_: unknown, approval) => (
        <Typography.Text strong>{decodeHtmlEntities(approval.title)}</Typography.Text>
      ),
    },
    {
      title: t('approvals.project', { defaultValue: 'Project' }),
      key: 'project',
      render: (_: unknown, approval) => <PortalProjectName name={approval.project_name} color={projectColors.get(approval.project_id)} fontSize={14} fontWeight={600} />,
    },
    {
      title: t('approvals.linkedItem', { defaultValue: 'Linked item' }),
      key: 'linked',
      render: (_: unknown, approval) =>
        approval.linked_item.available
          ? decodeHtmlEntities(approval.linked_item.name)
          : t('approvals.noLongerShared', { defaultValue: 'The linked item is no longer shared' }),
    },
    { title: t('approvals.linkedType', { defaultValue: 'Item type' }), key: 'type', render: (_: unknown, approval) => linkTypeLabel(approval.linked_item.type) },
    {
      title: view === 'completed' ? t('approvals.decidedBy', { defaultValue: 'Approved / rejected by' }) : t('approvals.due', { defaultValue: 'Due' }),
      key: 'due',
      render: (_: unknown, approval) =>
        view === 'completed'
          ? (approval.decision?.decided_by ?? DASH)
          : approval.status === 'awaiting' && approval.due_date
            ? <DueTag date={approval.due_date} />
            : DASH,
    },
    {
      title: t('approvals.requestedOn', { defaultValue: 'Request date' }),
      key: 'requested',
      render: (_: unknown, approval) => formatPortalDateTime(approval.requested_at, i18n.language) ?? DASH,
    },
    {
      title: t('approvals.status', { defaultValue: 'Status' }),
      key: 'status',
      render: (_: unknown, approval) => <ApprovalStatusTag status={approval.status} />,
    },
  ];

  const roleLabel = role ? tShared(ROLE_LABEL_COPY[role].key, { defaultValue: ROLE_LABEL_COPY[role].defaultValue }) : '';

  return (
    <div>
      <PageHeader
        title={t('approvals.title', { defaultValue: 'Approvals' })}
        subtitle={t('approvals.subtitle', { defaultValue: 'Items your team needs you to approve, and the decisions already made.' })}
      />
      {role && !canApprove && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('approvals.roleBanner', {
            role: roleLabel,
            defaultValue: 'As a {{role}} you can see approvals but not decide them. Only a Client Admin can approve.',
          })}
        />
      )}
      <PreviewToolbar
        value={searchText}
        onChange={setSearchText}
        placeholder={t('approvals.searchPlaceholder', { defaultValue: 'Search by approval, project or linked item…' })}
        filterGroups={approvalFilterGroups}
        fields={approvalFields}
        hiddenFields={columnVisibility.hidden}
        onToggleField={columnVisibility.toggle}
        leading={
          <Segmented<ApprovalFilter>
            value={view}
            onChange={changeView}
            aria-label={t('approvals.viewFilter', { defaultValue: 'Show approvals' })}
            options={[
              { value: 'awaiting', label: countLabel(t('approvals.awaitingTab', { defaultValue: 'Awaiting approval' }), awaiting.length, true) },
              { value: 'completed', label: countLabel(t('approvals.completedTab', { defaultValue: 'Completed' }), completed.length) },
              { value: 'all', label: countLabel(t('approvals.allTab', { defaultValue: 'All' }), approvals.length) },
            ]}
          />
        }
      />
      {viewRows.length === 0 ? (
        <PreviewEmpty
          title={
            view === 'awaiting'
              ? t('approvals.noneAwaiting', { defaultValue: 'Nothing is waiting for approval' })
              : view === 'completed'
                ? t('approvals.noneCompleted', { defaultValue: 'No completed approvals yet' })
                : t('approvals.none', { defaultValue: 'No approvals yet' })
          }
        />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <Table<ClientApprovalView>
            rowKey="id"
            size="middle"
            showSorterTooltip={false}
            columns={columnVisibility.visible(columns)}
            dataSource={rows}
            pagination={rows.length > PAGE_SIZE ? { pageSize: PAGE_SIZE, size: 'small', showSizeChanger: false } : false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: t('approvals.noMatches', { defaultValue: 'No approvals match your search.' }) }}
          />
        </Card>
      )}
    </div>
  );
};

// ─── Change requests ──────────────────────────────────────────────────────────────────────────

const OPEN_STATUSES = ['submitted', 'under_review', 'more_info'];
const PRIORITY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };

interface PreviewChangeRequestsProps {
  requests: ClientChangeRequestView[];
  projects: ClientProjectView[];
}

export const PreviewChangeRequests = ({ requests, projects }: PreviewChangeRequestsProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-preview');
  const projectColors = useProjectColors(projects);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const columnVisibility = useHiddenColumns();

  const count = (...statuses: string[]) => requests.filter(request => statuses.includes(request.status)).length;
  const needsReply = requests.filter(request => request.needs_your_reply).length;

  const rows = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return requests.filter(
      request =>
        (statusFilter.length === 0 || statusFilter.includes(request.status)) &&
        (priorityFilter.length === 0 || priorityFilter.includes(request.priority)) &&
        (projectFilter.length === 0 || projectFilter.includes(request.project_id)) &&
        includesText(needle, request.title, request.cr_no, request.requester_name, request.project_name)
    );
  }, [requests, searchText, statusFilter, priorityFilter, projectFilter]);

  const statusLabels: Record<string, string> = {
    submitted: t('changeRequests.statusSubmitted', { defaultValue: 'Submitted' }),
    under_review: t('changeRequests.statusUnderReview', { defaultValue: 'Under review' }),
    more_info: t('changeRequests.statusMoreInfo', { defaultValue: 'More information required' }),
    approved: t('changeRequests.statusApproved', { defaultValue: 'Approved' }),
    rejected: t('changeRequests.statusRejected', { defaultValue: 'Rejected' }),
    in_progress: t('changeRequests.statusInProgress', { defaultValue: 'In progress' }),
    completed: t('changeRequests.statusCompleted', { defaultValue: 'Completed' }),
    cancelled: t('changeRequests.statusCancelled', { defaultValue: 'Cancelled' }),
  };
  const priorityLabels: Record<string, string> = {
    low: t('changeRequests.priorityLow', { defaultValue: 'Low' }),
    medium: t('changeRequests.priorityMedium', { defaultValue: 'Medium' }),
    high: t('changeRequests.priorityHigh', { defaultValue: 'High' }),
  };
  const filterGroups: PreviewFilterGroup[] = [
    {
      key: 'status',
      label: t('changeRequests.status', { defaultValue: 'Status' }),
      options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
      value: statusFilter,
      onChange: setStatusFilter,
    },
    {
      key: 'priority',
      label: t('changeRequests.priority', { defaultValue: 'Priority' }),
      options: Object.entries(priorityLabels).map(([value, label]) => ({ value, label })),
      value: priorityFilter,
      onChange: setPriorityFilter,
    },
    {
      key: 'project',
      label: t('changeRequests.project', { defaultValue: 'Project' }),
      options: toOptions(requests.map(request => [request.project_id, request.project_name])),
      value: projectFilter,
      onChange: setProjectFilter,
    },
  ];
  const fields = [
    { key: 'cr_no', label: t('changeRequests.crNo', { defaultValue: 'ID' }) },
    { key: 'requester', label: t('changeRequests.requester', { defaultValue: 'Requested by' }) },
    { key: 'project', label: t('changeRequests.project', { defaultValue: 'Project' }) },
    { key: 'priority', label: t('changeRequests.priority', { defaultValue: 'Priority' }) },
    { key: 'submitted', label: t('changeRequests.requestDate', { defaultValue: 'Request date' }) },
    { key: 'hours', label: t('changeRequests.estimateHours', { defaultValue: 'Est. hours' }) },
    { key: 'cost', label: t('changeRequests.estimateCost', { defaultValue: 'Est. cost' }) },
    { key: 'status', label: t('changeRequests.status', { defaultValue: 'Status' }) },
  ];

  const columns: TableColumnsType<ClientChangeRequestView> = [
    { title: t('changeRequests.crNo', { defaultValue: 'ID' }), key: 'cr_no', dataIndex: 'cr_no', sorter: (a, b) => a.cr_no.localeCompare(b.cr_no) },
    {
      title: t('changeRequests.request', { defaultValue: 'Request' }),
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (_: unknown, request) => (
        <Typography.Text strong>{decodeHtmlEntities(request.title)}</Typography.Text>
      ),
    },
    { title: t('changeRequests.requester', { defaultValue: 'Requested by' }), key: 'requester', dataIndex: 'requester_name' },
    {
      title: t('changeRequests.project', { defaultValue: 'Project' }),
      key: 'project',
      render: (_: unknown, request) => <PortalProjectName name={request.project_name} color={projectColors.get(request.project_id)} fontSize={14} fontWeight={600} />,
    },
    {
      title: t('changeRequests.priority', { defaultValue: 'Priority' }),
      key: 'priority',
      sorter: (a, b) => (PRIORITY_RANK[a.priority] ?? 0) - (PRIORITY_RANK[b.priority] ?? 0),
      render: (_: unknown, request) => <PriorityTag priority={request.priority} />,
    },
    {
      title: t('changeRequests.requestDate', { defaultValue: 'Request date' }),
      key: 'submitted',
      sorter: (a, b) => a.submitted_at.localeCompare(b.submitted_at),
      render: (_: unknown, request) => formatPortalDate(request.submitted_at, i18n.language) ?? DASH,
    },
    {
      title: t('changeRequests.estimateHours', { defaultValue: 'Est. hours' }),
      key: 'hours',
      render: (_: unknown, request) =>
        request.estimate?.hours ? t('changeRequests.hours', { value: request.estimate.hours, defaultValue: '{{value}} h' }) : DASH,
    },
    {
      title: t('changeRequests.estimateCost', { defaultValue: 'Est. cost' }),
      key: 'cost',
      render: (_: unknown, request) => (request.estimate?.cost ? `$${request.estimate.cost.toLocaleString(i18n.language)}` : DASH),
    },
    {
      title: t('changeRequests.status', { defaultValue: 'Status' }),
      key: 'status',
      render: (_: unknown, request) => <ChangeRequestStatusTag status={request.status as ChangeRequestStatus} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('changeRequests.title', { defaultValue: 'Change Requests' })}
        subtitle={t('changeRequests.subtitle', { defaultValue: 'Ask for a change to scope, features or deliverables, and follow the answer.' })}
      />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <StatTile label={t('changeRequests.statOpen', { defaultValue: 'Open' })} value={count(...OPEN_STATUSES)} tone="warning" />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            label={t('changeRequests.statNeedsReply', { defaultValue: 'Needs your reply' })}
            value={needsReply}
            tone={needsReply ? 'error' : undefined}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile label={t('changeRequests.statApproved', { defaultValue: 'Approved / in progress' })} value={count('approved', 'in_progress')} />
        </Col>
        <Col xs={12} md={6}>
          <StatTile label={t('changeRequests.statCompleted', { defaultValue: 'Completed' })} value={count('completed')} tone="success" />
        </Col>
      </Row>
      {requests.length === 0 ? (
        <PreviewEmpty
          title={t('changeRequests.none', { defaultValue: 'No change requests yet' })}
          description={t('changeRequests.noneHelp', {
            defaultValue: 'Need something added, changed or removed? Submit a change request and your team will review it.',
          })}
        />
      ) : (
        <>
          <PreviewToolbar
            value={searchText}
            onChange={setSearchText}
            placeholder={t('changeRequests.searchPlaceholder', { defaultValue: 'Search by request, project or requester…' })}
            filterGroups={filterGroups}
            fields={fields}
            hiddenFields={columnVisibility.hidden}
            onToggleField={columnVisibility.toggle}
          />
          <Card styles={{ body: { padding: 0 } }}>
            <Table<ClientChangeRequestView>
              rowKey="id"
              size="middle"
              showSorterTooltip={false}
              columns={columnVisibility.visible(columns)}
              dataSource={rows}
              pagination={rows.length > PAGE_SIZE ? { pageSize: PAGE_SIZE, size: 'small', showSizeChanger: false } : false}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: t('changeRequests.noMatches', { defaultValue: 'No change requests match your search.' }) }}
            />
          </Card>
        </>
      )}
    </div>
  );
};
