import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';
import { EyeOutlined, MoreOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { Button, Col, Dropdown, Progress, Row, Select, Typography, message, theme } from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';
import { useGetPortalOrganizationsQuery } from '@/api/client-portal/portal-access-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { useGetPortalProjectsQuery, useSaveProjectOverviewMutation } from '@/api/client-portal/portal-projects-api';
import {
  ColumnTitle,
  PortalFieldsButton,
  PortalFilterButton,
  PortalListToolbar,
  PortalPagedTable,
  PortalSwitch,
  StatCard,
  formatPortalDate,
  useDebouncedValue,
  usePortalColumnVisibility,
  usePortalPaging,
  usePortalSort,
  PortalProjectName,
} from '@/components/client-portal/v2';
import type { PortalField, PortalFilterGroup } from '@/components/client-portal/v2';
import {
  PROJECT_PHASES,
  type ClientProjectStatus,
  type PortalProject,
  type ProjectPhase,
  type UpdateProjectOverviewRequest,
} from '@/types/client-portal/v2';
import { portalPaths } from '../portal-paths';
import { clientWorkspacePath } from '../clients/workspace/workspace-helpers';

type PortalFilter = 'on' | 'off';

/** The `organization_id` value the API uses for projects that have no client yet. */
const NO_CLIENT = 'none';

const STATUS_FILTERS: { value: ClientProjectStatus; defaultValue: string }[] = [
  { value: 'on_track', defaultValue: 'On track' },
  { value: 'at_risk', defaultValue: 'At risk' },
  { value: 'on_hold', defaultValue: 'On hold' },
  { value: 'completed', defaultValue: 'Completed' },
];

/** Which projects are visible in the Client Portal, and a way into what is shared inside each one. */
const PortalProjectsPage = () => {
  const { t, i18n } = useTranslation('client-portal-v2-projects');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const paging = usePortalPaging();
  const sorting = usePortalSort();

  const [search, setSearch] = useState('');
  const [organizationIds, setOrganizationIds] = useState<string[]>([]);
  const [portals, setPortals] = useState<PortalFilter[]>([]);
  const [statuses, setStatuses] = useState<ClientProjectStatus[]>([]);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [saveOverview] = useSaveProjectOverviewMutation();
  /** `<project id>:<field>` of the cell being saved, so only that select shows as busy. */
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const columnVisibility = usePortalColumnVisibility('worklenz.portal.projects.hiddenColumns');

  useEffect(() => {
    paging.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, organizationIds, portals, statuses, phases, sorting.sort, sorting.order]);

  const organizations = useGetPortalOrganizationsQuery({ limit: 100 });
  const query = useGetPortalProjectsQuery({
    page: paging.page,
    limit: paging.limit,
    search: debouncedSearch.trim() || undefined,
    organization_id: organizationIds.length ? organizationIds.join(',') : undefined,
    // Choosing both Portal on and Portal off is the same as no filter.
    portal: portals.length === 1 ? portals[0] : undefined,
    status: statuses.length ? statuses.join(',') : undefined,
    phase: phases.length ? phases.join(',') : undefined,
    sort: sorting.sort,
    order: sorting.order,
  });
  const list = query.data?.body;
  const stats = list?.stats;

  // The project opens as a modal over this list, like a client does.
  const openProject = (project: PortalProject) => navigate(portalPaths.project(project.id));

  /** Changes one client-facing field straight from the table; the list refetches after the save. */
  const saveField = async (project: PortalProject, field: 'status' | 'phase', body: UpdateProjectOverviewRequest) => {
    setSavingCell(`${project.id}:${field}`);
    try {
      await saveOverview({ projectId: project.id, body }).unwrap();
      message.success(t('list.fieldSaved', { name: project.name, defaultValue: '{{name}} updated.' }));
    } catch (error) {
      message.error(
        getPortalErrorMessage(error, t('list.fieldSaveFailed', { defaultValue: 'The project could not be updated.' }))
      );
    } finally {
      setSavingCell(null);
    }
  };

  const handleTableChange: TableProps<PortalProject>['onChange'] = (_pagination, filters, sorter) => {
    sorting.applySorter(sorter);
    setOrganizationIds((filters.client ?? []) as string[]);
    setStatuses((filters.status ?? []) as ClientProjectStatus[]);
    setPhases((filters.phase ?? []) as ProjectPhase[]);
    setPortals((filters.portal ?? []) as PortalFilter[]);
  };

  const menuFor = (project: PortalProject): MenuProps['items'] => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: t('menu.view', { defaultValue: 'View details' }),
      onClick: () => openProject(project),
    },
    ...(project.organization_id
      ? [
          {
            key: 'client',
            icon: <TeamOutlined />,
            label: t('menu.client', { defaultValue: 'Open client' }),
            onClick: () => navigate(clientWorkspacePath(project.organization_id as string)),
          },
        ]
      : []),
  ];

  const clientOptions = [
    { value: NO_CLIENT, label: t('list.noClient', { defaultValue: 'No client' }) },
    ...(organizations.data?.body?.items ?? []).map(item => ({ value: item.id, label: item.name })),
  ];
  const statusOptions = STATUS_FILTERS.map(item => ({
    value: item.value,
    label: t(`list.statusFilter.${item.value}`, { defaultValue: item.defaultValue }),
  }));
  const phaseOptions = PROJECT_PHASES.map(value => ({ value, label: value }));
  const portalOptions = [
    { value: 'on', label: t('list.portalOn', { defaultValue: 'Portal on' }) },
    { value: 'off', label: t('list.portalOff', { defaultValue: 'Portal off' }) },
  ];

  const filterGroups: PortalFilterGroup[] = [
    {
      key: 'client',
      label: t('list.columns.client', { defaultValue: 'Client' }),
      options: clientOptions,
      value: organizationIds,
      onChange: setOrganizationIds,
      searchPlaceholder: t('list.searchClients', { defaultValue: 'Search clients…' }),
    },
    {
      key: 'status',
      label: t('list.columns.status', { defaultValue: 'Client-facing status' }),
      options: statusOptions,
      value: statuses,
      onChange: value => setStatuses(value as ClientProjectStatus[]),
    },
    {
      key: 'phase',
      label: t('list.columns.phase', { defaultValue: 'Phase' }),
      options: phaseOptions,
      value: phases,
      onChange: value => setPhases(value as ProjectPhase[]),
    },
    {
      key: 'portal',
      label: t('list.columns.portal', { defaultValue: 'Portal' }),
      options: portalOptions,
      value: portals,
      onChange: value => setPortals(value as PortalFilter[]),
    },
  ];

  const clearFilters = () => {
    setOrganizationIds([]);
    setStatuses([]);
    setPhases([]);
    setPortals([]);
  };

  /** The project name stays visible so a row is never anonymous. */
  const fields: PortalField[] = [
    { key: 'client', label: t('list.columns.client', { defaultValue: 'Client' }) },
    { key: 'status', label: t('list.columns.status', { defaultValue: 'Client-facing status' }) },
    { key: 'phase', label: t('list.columns.phase', { defaultValue: 'Phase' }) },
    { key: 'progress', label: t('list.columns.progress', { defaultValue: 'Progress' }) },
    { key: 'next_milestone', label: t('list.columns.nextMilestone', { defaultValue: 'Next milestone' }) },
    { key: 'users', label: t('list.columns.users', { defaultValue: 'Client users' }) },
    { key: 'portal', label: t('list.columns.portal', { defaultValue: 'Portal' }) },
  ];

  const columns: ColumnsType<PortalProject> = [
    {
      key: 'project',
      ...sorting.columnProps('project'),
      title: (
        <ColumnTitle
          label={t('list.columns.project', { defaultValue: 'Project' })}
          help={t('list.columnHelp.project', { defaultValue: 'The workspace project.' })}
        />
      ),
      render: (_value, project) => <PortalProjectName name={project.name} color={project.color} fontSize={13} fontWeight={600} />,
    },
    {
      key: 'client',
      ...sorting.columnProps('client'),
      filters: clientOptions.map(option => ({ text: option.label, value: option.value })),
      filterSearch: true,
      filteredValue: organizationIds.length ? organizationIds : null,
      title: (
        <ColumnTitle
          label={t('list.columns.client', { defaultValue: 'Client' })}
          help={t('list.columnHelp.client', { defaultValue: 'The client organization this project belongs to.' })}
        />
      ),
      render: (_value, project) =>
        project.organization_name ? (
          <span style={{ fontSize: 12.5 }}>{project.organization_name}</span>
        ) : (
          <Typography.Text type="secondary">{t('list.noClient', { defaultValue: 'No client' })}</Typography.Text>
        ),
    },
    {
      key: 'status',
      ...sorting.columnProps('status'),
      filters: statusOptions.map(option => ({ text: option.label, value: option.value })),
      filteredValue: statuses.length ? statuses : null,
      title: (
        <ColumnTitle
          label={t('list.columns.status', { defaultValue: 'Client-facing status' })}
          help={t('list.columnHelp.status', { defaultValue: 'The status clients see in the portal.' })}
        />
      ),
      render: (_value, project) => (
        // The row opens the project on click, so the select must not bubble to it.
        <span onClick={event => event.stopPropagation()}>
          <Select<ClientProjectStatus>
            size="small"
            style={{ minWidth: 120 }}
            value={project.status}
            loading={savingCell === `${project.id}:status`}
            aria-label={t('list.statusLabel', { name: project.name, defaultValue: 'Client-facing status of {{name}}' })}
            onChange={value => void saveField(project, 'status', { status: value })}
            options={STATUS_FILTERS.map(item => ({
              value: item.value,
              label: t(`list.statusFilter.${item.value}`, { defaultValue: item.defaultValue }),
            }))}
          />
        </span>
      ),
    },
    {
      key: 'phase',
      ...sorting.columnProps('phase'),
      filters: phaseOptions.map(option => ({ text: option.label, value: option.value })),
      filteredValue: phases.length ? phases : null,
      title: (
        <ColumnTitle
          label={t('list.columns.phase', { defaultValue: 'Phase' })}
          help={t('list.columnHelp.phase', { defaultValue: 'The delivery phase shown to clients.' })}
        />
      ),
      render: (_value, project) => (
        <span onClick={event => event.stopPropagation()}>
          <Select<ProjectPhase>
            allowClear
            size="small"
            style={{ minWidth: 130 }}
            value={project.phase ?? undefined}
            loading={savingCell === `${project.id}:phase`}
            placeholder={t('list.phaseNone', { defaultValue: 'Not set' })}
            aria-label={t('list.phaseLabel', { name: project.name, defaultValue: 'Phase of {{name}}' })}
            onChange={value => void saveField(project, 'phase', { phase: value ?? null })}
            options={PROJECT_PHASES.map(value => ({ value, label: value }))}
          />
        </span>
      ),
    },
    {
      key: 'progress',
      ...sorting.columnProps('progress'),
      title: (
        <ColumnTitle
          label={t('list.columns.progress', { defaultValue: 'Progress' })}
          help={t('list.columnHelp.progress', { defaultValue: 'How much of the project is complete.' })}
        />
      ),
      width: 160,
      render: (_value, project) => (
        <Progress
          percent={project.progress}
          size="small"
          strokeColor={project.color || token.colorPrimary}
          aria-label={t('list.progressLabel', { name: project.name, defaultValue: 'Progress of {{name}}' })}
        />
      ),
    },
    {
      key: 'next_milestone',
      ...sorting.columnProps('next_milestone'),
      title: (
        <ColumnTitle
          label={t('list.columns.nextMilestone', { defaultValue: 'Next milestone' })}
          help={t('list.columnHelp.nextMilestone', { defaultValue: 'The next client-visible milestone that is not yet complete.' })}
        />
      ),
      render: (_value, project) =>
        project.next_milestone ? (
          <div style={{ fontSize: 12.5 }}>
            {project.next_milestone.name}
            <div style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
              {formatPortalDate(project.next_milestone.target_date, i18n.language)}
            </div>
          </div>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      key: 'users',
      ...sorting.columnProps('users'),
      title: (
        <ColumnTitle
          label={t('list.columns.users', { defaultValue: 'Client users' })}
          help={t('list.columnHelp.users', { defaultValue: 'Client users who have signed in and can open this project.' })}
        />
      ),
      render: (_value, project) =>
        t('list.activeUsers', { count: project.active_client_users, defaultValue: '{{count}} active' }),
    },
    {
      key: 'portal',
      ...sorting.columnProps('portal'),
      filters: portalOptions.map(option => ({ text: option.label, value: option.value })),
      filteredValue: portals.length ? portals : null,
      title: (
        <ColumnTitle
          label={t('list.columns.portal', { defaultValue: 'Portal' })}
          help={t('list.columnHelp.portal', { defaultValue: 'Whether this project is visible in the Client Portal.' })}
        />
      ),
      render: (_value, project) => (
        // The row opens the details on click, so the switch must not bubble to it.
        <span onClick={event => event.stopPropagation()}>
          <PortalSwitch project={project} />
        </span>
      ),
    },
    {
      key: 'actions',
      title: t('list.columns.actions', { defaultValue: 'Actions' }),
      align: 'right',
      render: (_value, project) => (
        // Same reason: the menu must not open the details behind it.
        <span onClick={event => event.stopPropagation()}>
          <Dropdown menu={{ items: menuFor(project) }} trigger={['click']}>
            <Button
              size="small"
              type="text"
              icon={<MoreOutlined />}
              aria-label={t('list.rowActions', { name: project.name, defaultValue: 'Actions for {{name}}' })}
            />
          </Dropdown>
        </span>
      ),
    },
  ];

  const hasFilters =
    debouncedSearch.trim() !== '' ||
    organizationIds.length > 0 ||
    portals.length > 0 ||
    statuses.length > 0 ||
    phases.length > 0;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0, fontSize: 22 }}>
          {t('list.title', { defaultValue: 'Portal Projects' })}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t('list.description', {
            defaultValue:
              'Choose which projects are visible in the Client Portal and what is shared inside each one. Everything starts as Internal Only.',
          })}
        </Typography.Text>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('list.stats.enabled', { defaultValue: 'Portal-enabled projects' })}
            value={stats ? `${stats.portal_enabled} / ${stats.total}` : '—'}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('list.stats.awaitingApproval', { defaultValue: 'Awaiting client approval' })}
            value={stats?.awaiting_client_approval ?? '—'}
            tone="warning"
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('list.stats.openChangeRequests', { defaultValue: 'Open change requests' })}
            value={stats?.open_change_requests ?? '—'}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('list.stats.delayedMilestones', { defaultValue: 'Delayed milestones' })}
            value={stats?.delayed_milestones ?? '—'}
            tone="warning"
            sub={t('list.stats.delayedSub', { defaultValue: 'On portal projects' })}
          />
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
        searchPlaceholder={t('list.search', { defaultValue: 'Search by project, client, phase or milestone…' })}
        searchLabel={t('list.searchLabel', { defaultValue: 'Search portal projects' })}
      />

      <PortalPagedTable<PortalProject>
        ariaLabel={t('list.tableLabel', { defaultValue: 'Portal projects' })}
        columns={columnVisibility.visibleColumns(columns)}
        onTableChange={handleTableChange}
        rows={list?.items ?? []}
        rowKey={project => project.id}
        total={list?.total ?? 0}
        paging={paging}
        loading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={openProject}
        emptyText={
          hasFilters
            ? t('list.emptyFiltered', { defaultValue: 'No projects match these filters.' })
            : t('list.empty', { defaultValue: 'No projects yet. Create a project in your workspace, then link it to a client.' })
        }
      />


      <Outlet />
    </div>
  );
};

export default PortalProjectsPage;
