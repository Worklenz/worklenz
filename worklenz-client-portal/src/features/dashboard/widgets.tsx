import React from 'react';
import { Card, Empty, Flex, Progress, Tag, Typography, AuditOutlined, FlagOutlined, SwapOutlined, theme } from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useFormatters } from '@/hooks/useFormatters';
import { ActionRow, DueTag, StatTile, StatusTag } from '@/components/v2';
import { targetPath } from '@/utils/targets';
import type { ClientActivityV2, ClientDashboardV2, ClientProjectV2, DashboardWidgetType, ProjectCardField, ProjectsWidgetSettings } from '@/types/v2';

export interface WidgetProps {
  data: ClientDashboardV2;
  settings?: ProjectsWidgetSettings;
}

/** The body of every dashboard widget, keyed by widget type. Each fills the cell it is given. */
export const WIDGET_COMPONENTS: Record<DashboardWidgetType, React.ComponentType<WidgetProps>> = {
  'tile-active-projects': ({ data }) => <ActiveProjectsTile data={data} />,
  'tile-pending-actions': ({ data }) => <PendingActionsTile data={data} />,
  'tile-upcoming-milestones': ({ data }) => <UpcomingMilestonesTile data={data} />,
  'tile-unpaid': ({ data }) => <UnpaidTile data={data} />,
  'needs-action': ({ data }) => <NeedsActionCard data={data} />,
  'upcoming-milestones': ({ data }) => <UpcomingMilestonesCard data={data} />,
  projects: ({ data, settings }) => <ProjectsWidget data={data} settings={settings} />,
  'recent-activity': ({ data }) => <RecentActivityCard data={data} />,
  'chart-projects-by-status': ({ data }) => <ProjectsByStatusChart projects={data.projects} />,
  'chart-project-progress': ({ data }) => <ProjectProgressChart projects={data.projects} />,
  'chart-open-items': ({ data }) => <OpenItemsChart projects={data.projects} />,
};

const ActiveProjectsTile = ({ data }: { data: ClientDashboardV2 }) => {
  const { t } = useTranslation();
  return <StatTile label={t('dashboard.activeProjectsTile', { defaultValue: 'Active projects' })} value={data.active_projects} />;
};

const PendingActionsTile = ({ data }: { data: ClientDashboardV2 }) => {
  const { t } = useTranslation();
  return (
    <StatTile
      label={t('dashboard.pendingActions', { defaultValue: 'Pending actions' })}
      value={data.pending_actions}
      tone={data.pending_actions > 0 ? 'warning' : undefined}
      sub={
        data.pending_actions > 0
          ? t('dashboard.waitingOnYou', { defaultValue: 'Waiting on you' })
          : t('dashboard.nothingWaiting', { defaultValue: 'Nothing waiting' })
      }
    />
  );
};

const UpcomingMilestonesTile = ({ data }: { data: ClientDashboardV2 }) => {
  const { t } = useTranslation();
  const { date } = useFormatters();
  const next = data.upcoming_milestones[0];
  return (
    <StatTile
      label={t('dashboard.upcomingMilestones', { defaultValue: 'Upcoming milestones' })}
      value={data.upcoming_milestones.length}
      tone="success"
      sub={next ? t('dashboard.nextMilestone', { date: date(next.target_date), defaultValue: 'Next: {{date}}' }) : undefined}
    />
  );
};

const UnpaidTile = ({ data }: { data: ClientDashboardV2 }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <StatTile
      label={t('dashboard.unpaidTile', { defaultValue: 'Unpaid amount' })}
      value={`$${(data.unpaid_amount ?? 0).toLocaleString()}`}
      onClick={() => navigate('/invoices')}
    />
  );
};

const NeedsActionCard = ({ data }: { data: ClientDashboardV2 }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { can } = useClientAccess();
  return (
    <Card
      title={
        <Flex gap={8} align="center">
          {t('dashboard.needsAction', { defaultValue: 'Needs your action' })}
          {data.needs_action.length > 0 && <Tag color="orange">{data.needs_action.length}</Tag>}
        </Flex>
      }
      style={CARD_FILL}
      styles={CARD_BODY_SCROLL}
    >
      {data.needs_action.map(item => (
        <ActionRow
          key={`${item.kind}-${item.id}`}
          icon={item.kind === 'approval' ? <AuditOutlined /> : <SwapOutlined />}
          title={item.title}
          subtitle={`${item.ref_no} · ${item.project_name}`}
          onClick={() => navigate(item.kind === 'approval' ? `/approvals/${item.id}` : `/change-requests/${item.id}`)}
          right={
            <>
              {item.due_date && <DueTag date={item.due_date} />}
              <Tag color={item.kind === 'approval' ? 'orange' : 'red'}>
                {item.kind === 'approval' ? t('dashboard.approve', { defaultValue: 'Approve' }) : t('dashboard.reply', { defaultValue: 'Reply' })}
              </Tag>
            </>
          }
        />
      ))}
      {data.needs_action.length === 0 && (
        <Typography.Text type="secondary">
          {can.approve
            ? t('dashboard.allCaughtUp', { defaultValue: 'You are all caught up.' })
            : t('dashboard.nothingForYou', { defaultValue: 'Nothing needs your action. Only a Client Admin can approve items.' })}
        </Typography.Text>
      )}
      {(data.waiting_on_others?.length ?? 0) > 0 && (
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Typography.Text type="secondary" strong style={{ fontSize: token.fontSizeSM, letterSpacing: 0.4 }}>
            {t('dashboard.waitingOnOthers', { defaultValue: 'WAITING ON SOMEONE ELSE' })}
          </Typography.Text>
          {data.waiting_on_others?.map(item => (
            <ActionRow
              key={item.id}
              icon={<AuditOutlined />}
              title={item.title}
              subtitle={t('dashboard.waitingFor', { name: item.waiting_for, defaultValue: 'Waiting for {{name}}' })}
              onClick={() => navigate(`/approvals/${item.id}`)}
              right={<StatusTag kind="approval" status="awaiting" />}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

const UpcomingMilestonesCard = ({ data }: { data: ClientDashboardV2 }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { date } = useFormatters();
  return (
    <Card title={t('dashboard.upcomingMilestones', { defaultValue: 'Upcoming milestones' })} style={CARD_FILL} styles={CARD_BODY_SCROLL}>
      {data.upcoming_milestones.map(milestone => (
        <ActionRow
          key={milestone.id}
          icon={<FlagOutlined />}
          title={milestone.name}
          subtitle={milestone.project_name}
          onClick={() => navigate(targetPath({ page: 'milestone', projectId: milestone.project_id, id: milestone.id }))}
          right={
            <Flex vertical align="flex-end" gap={2}>
              <Typography.Text style={{ fontSize: token.fontSizeSM }}>{date(milestone.target_date)}</Typography.Text>
              <StatusTag kind="milestone" status={milestone.status} />
            </Flex>
          }
        />
      ))}
      {data.upcoming_milestones.length === 0 && (
        <Typography.Text type="secondary">{t('dashboard.noUpcoming', { defaultValue: 'No upcoming milestones are shared with you.' })}</Typography.Text>
      )}
    </Card>
  );
};

const RecentActivityCard = ({ data }: { data: ClientDashboardV2 }) => {
  const { t } = useTranslation();
  return (
    <Card title={t('dashboard.recentActivity', { defaultValue: 'Recent activity' })} style={CARD_FILL} styles={CARD_BODY_SCROLL}>
      {(data.recent_activity ?? []).map(activity => (
        <ActivityRow key={activity.id} activity={activity} />
      ))}
      {(data.recent_activity?.length ?? 0) === 0 && (
        <Typography.Text type="secondary">{t('dashboard.noActivity', { defaultValue: 'No recent activity.' })}</Typography.Text>
      )}
    </Card>
  );
};

const ActivityRow = ({ activity }: { activity: ClientActivityV2 }) => {
  const navigate = useNavigate();
  const { dateTime } = useFormatters();
  return (
    <ActionRow
      title={<span style={{ fontWeight: 400 }}>{activity.text}</span>}
      onClick={() => navigate(targetPath(activity.target))}
      right={<Typography.Text type="secondary" style={{ fontSize: 12 }}>{dateTime(activity.at)}</Typography.Text>}
    />
  );
};

// ─── Your projects ────────────────────────────────────────────────────────────────────────────

const DEFAULT_FIELDS: ProjectCardField[] = ['status', 'progress', 'phase', 'nextMilestone', 'expectedCompletion'];

/** The projects the widget is set to show. Ids that are no longer shared with the user are ignored. */
export const selectProjects = (projects: ClientProjectV2[], settings?: ProjectsWidgetSettings): ClientProjectV2[] => {
  const ids = settings?.projectIds ?? 'all';
  return ids === 'all' ? projects : projects.filter(project => ids.includes(project.id));
};

const ProjectsWidget = ({ data, settings }: WidgetProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projects = selectProjects(data.projects, settings);
  const fields = settings?.cardFields ?? DEFAULT_FIELDS;
  const compact = settings?.view === 'compact';
  return (
    <Card title={t('dashboard.yourProjects', { defaultValue: 'Your projects' })} style={CARD_FILL} styles={CARD_BODY_SCROLL}>
      {projects.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('dashboard.widgets.noProjectsSelected', { defaultValue: 'No projects selected. Use the widget settings to choose projects.' })}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 16,
            // Columns follow the widget's own width (not the screen's), so a half-width widget on a
            // desktop and a full-width one on a phone both get cards that are wide enough to read.
            gridTemplateColumns: compact ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
          }}
        >
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              fields={fields}
              compact={compact}
              nextMilestone={data.upcoming_milestones.find(m => m.project_id === project.id)?.name}
              onOpen={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

interface ProjectCardProps {
  project: ClientProjectV2;
  fields: ProjectCardField[];
  compact?: boolean;
  nextMilestone?: string;
  onOpen: () => void;
}

export const ProjectCard = ({ project, fields, compact = false, nextMilestone, onOpen }: ProjectCardProps) => {
  const { t } = useTranslation();
  const { date } = useFormatters();
  const { token } = theme.useToken();
  const has = (field: ProjectCardField) => fields.includes(field);

  const rows: Array<[string, React.ReactNode]> = [];
  if (has('phase')) rows.push([t('dashboard.currentPhase', { defaultValue: 'Current phase' }), project.phase ?? '—']);
  if (has('nextMilestone')) rows.push([t('dashboard.nextMilestoneLabel', { defaultValue: 'Next milestone' }), nextMilestone ?? '—']);
  if (has('expectedCompletion')) rows.push([t('dashboard.expectedCompletion', { defaultValue: 'Expected completion' }), date(project.expected_completion)]);
  if (has('openItems')) {
    rows.push([
      t('dashboard.widgets.openItemsLabel', { defaultValue: 'Open approvals / change requests' }),
      `${project.open_approvals ?? 0} / ${project.open_change_requests ?? 0}`,
    ]);
  }
  if (has('sharedCounts')) {
    rows.push([
      t('dashboard.widgets.sharedLabel', { defaultValue: 'Shared milestones / tasks / files' }),
      `${project.shared_counts.milestones} / ${project.shared_counts.tasks} / ${project.shared_counts.files}`,
    ]);
  }

  return (
    <Card
      hoverable
      size={compact ? 'small' : 'default'}
      onClick={onOpen}
      role="link"
      tabIndex={0}
      aria-label={project.name}
      onKeyDown={event => event.key === 'Enter' && onOpen()}
      style={{ height: '100%' }}
    >
      <Flex justify="space-between" align="flex-start" gap={8}>
        <Typography.Text strong>{project.name}</Typography.Text>
        {has('status') && <StatusTag kind="project" status={project.status} />}
      </Flex>
      {has('progress') && <Progress percent={project.progress} strokeColor={project.color ?? undefined} style={{ margin: compact ? '4px 0' : '12px 0' }} />}
      {rows.map(([label, value]) => (
        <Flex key={label} justify="space-between" gap={12} style={{ padding: '3px 0', fontSize: token.fontSizeSM }}>
          <Typography.Text type="secondary">{label}</Typography.Text>
          <Typography.Text style={{ textAlign: 'right' }}>{value}</Typography.Text>
        </Flex>
      ))}
    </Card>
  );
};

// ─── Charts (colours come from the theme tokens so both themes read well) ─────────────────────

const ChartCard = ({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) => {
  const { t } = useTranslation();
  return (
    <Card title={title} style={CARD_FILL} styles={{ body: { flex: 1, minHeight: 0, padding: 12 } }}>
      {empty ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dashboard.widgets.noChartData', { defaultValue: 'Nothing to chart yet.' })} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      )}
    </Card>
  );
};

const ProjectsByStatusChart = ({ projects }: { projects: ClientProjectV2[] }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const statuses = [
    { key: 'on_track', label: t('status.project.on_track', { defaultValue: 'On track' }), color: token.colorSuccess },
    { key: 'at_risk', label: t('status.project.at_risk', { defaultValue: 'At risk' }), color: token.colorWarning },
    { key: 'on_hold', label: t('status.project.on_hold', { defaultValue: 'On hold' }), color: token.colorTextQuaternary },
    { key: 'completed', label: t('status.project.completed', { defaultValue: 'Completed' }), color: token.colorPrimary },
  ];
  const rows = statuses
    .map(status => ({ ...status, value: projects.filter(project => project.status === status.key).length }))
    .filter(row => row.value > 0);
  return (
    <ChartCard title={t('dashboard.widgets.projectsByStatus', { defaultValue: 'Projects by status' })} empty={rows.length === 0}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="80%" stroke={token.colorBgContainer}>
          {rows.map(row => (
            <Cell key={row.key} fill={row.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ChartCard>
  );
};

const ProjectProgressChart = ({ projects }: { projects: ClientProjectV2[] }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const rows = projects.map(project => ({ name: project.name, progress: project.progress, color: project.color ?? token.colorPrimary }));
  return (
    <ChartCard title={t('dashboard.widgets.projectProgress', { defaultValue: 'Project progress' })} empty={rows.length === 0}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke={token.colorBorderSecondary} />
        <XAxis type="number" domain={[0, 100]} unit="%" stroke={token.colorTextTertiary} />
        <YAxis type="category" dataKey="name" width={96} stroke={token.colorTextTertiary} />
        <Tooltip formatter={value => `${value}%`} />
        <Bar dataKey="progress" radius={4}>
          {rows.map(row => (
            <Cell key={row.name} fill={row.color} />
          ))}
        </Bar>
      </BarChart>
    </ChartCard>
  );
};

const OpenItemsChart = ({ projects }: { projects: ClientProjectV2[] }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const rows = projects
    .map(project => ({ name: project.name, approvals: project.open_approvals ?? 0, changeRequests: project.open_change_requests ?? 0 }))
    .filter(row => row.approvals + row.changeRequests > 0);
  return (
    <ChartCard title={t('dashboard.widgets.openItems', { defaultValue: 'Open items by project' })} empty={rows.length === 0}>
      <BarChart data={rows} margin={{ left: -16, right: 8 }}>
        <CartesianGrid vertical={false} stroke={token.colorBorderSecondary} />
        <XAxis dataKey="name" stroke={token.colorTextTertiary} />
        <YAxis allowDecimals={false} stroke={token.colorTextTertiary} />
        <Tooltip />
        <Legend />
        <Bar dataKey="approvals" stackId="open" name={t('dashboard.widgets.approvals', { defaultValue: 'Approvals' })} fill={token.colorWarning} />
        <Bar dataKey="changeRequests" stackId="open" name={t('dashboard.widgets.changeRequests', { defaultValue: 'Change requests' })} fill={token.colorPrimary} />
      </BarChart>
    </ChartCard>
  );
};

const CARD_FILL: React.CSSProperties = { height: '100%', display: 'flex', flexDirection: 'column' };
const CARD_BODY_SCROLL = { body: { flex: 1, minHeight: 0, overflow: 'auto' } } as const;
