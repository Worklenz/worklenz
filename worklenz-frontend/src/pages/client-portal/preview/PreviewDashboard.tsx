import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AuditOutlined, FlagOutlined, SwapOutlined } from '@ant-design/icons';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip as ChartTooltip } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Card, Empty, Flex, Progress, Tag, Typography, theme } from '@/shared/antd-imports';
import {
  ClientProjectStatusTag,
  MilestoneStatusTag,
  ApprovalStatusTag,
  formatPortalDate,
  formatPortalDateTime,
} from '@/components/client-portal/v2';
import type {
  ClientDashboardView,
  ClientProjectView,
  DashboardLayoutView,
  DashboardWidgetInstance,
  DashboardWidgetType,
} from '@/types/client-portal/v2';
import { ActionRow, DueTag, PageHeader, StatTile, useContainerWidth } from './PreviewShared';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, ChartTooltip, Legend);

const GRID_COLS = 12;
const ROW_HEIGHT = 40;
const GRID_GAP = 16;
/** Below this width the real portal stacks the widgets instead of using the grid. */
const STACK_BELOW_WIDTH = 760;

const DEFAULT_CARD_FIELDS = ['status', 'progress', 'phase', 'nextMilestone', 'expectedCompletion'];

const CARD_FILL: CSSProperties = { height: '100%', display: 'flex', flexDirection: 'column' };
const CARD_BODY_SCROLL = { body: { flex: 1, minHeight: 0, overflow: 'auto' } } as const;

const defaultLayout = (hasUnpaid: boolean): DashboardWidgetInstance[] => {
  const tiles: DashboardWidgetType[] = ['tile-active-projects', 'tile-pending-actions', 'tile-upcoming-milestones'];
  if (hasUnpaid) tiles.push('tile-unpaid');
  const tileWidth = GRID_COLS / tiles.length;
  const widgets: DashboardWidgetInstance[] = [
    ...tiles.map((type, index) => ({ type, x: index * tileWidth, y: 0, w: tileWidth, h: 3, hidden: false })),
    { type: 'needs-action', x: 0, y: 3, w: 6, h: 9, hidden: false },
    { type: 'upcoming-milestones', x: 6, y: 3, w: 6, h: 9, hidden: false },
    {
      type: 'projects',
      x: 0,
      y: 12,
      w: 12,
      h: 11,
      hidden: false,
      settings: { projectIds: 'all', cardFields: DEFAULT_CARD_FIELDS, view: 'cards' },
    },
    { type: 'recent-activity', x: 0, y: 23, w: 12, h: 8, hidden: false },
  ];
  const charts: DashboardWidgetType[] = ['chart-projects-by-status', 'chart-project-progress', 'chart-open-items'];
  charts.forEach((type, index) => widgets.push({ type, x: index * 4, y: 31, w: 4, h: 8, hidden: true }));
  return widgets;
};

interface DashboardViewProps {
  dashboard: ClientDashboardView;
  layout: DashboardLayoutView | null;
  canApprove: boolean;
  firstName: string;
}

/** The overview page: the user's own widget arrangement (or the default one), rendered read-only. */
export const PreviewDashboard = ({ dashboard, layout, canApprove, firstName }: DashboardViewProps) => {
  const { t } = useTranslation('client-portal-v2-preview');
  const { ref, width } = useContainerWidth<HTMLDivElement>();

  const hasUnpaid = dashboard.unpaid_amount !== undefined;
  const widgets = (layout?.widgets ?? defaultLayout(hasUnpaid))
    .filter(widget => widget.type !== 'tile-unpaid' || hasUnpaid)
    .filter(widget => !widget.hidden);
  const isStacked = width > 0 && width < STACK_BELOW_WIDTH;
  const ordered = [...widgets].sort((a, b) => a.y - b.y || a.x - b.x);

  const body = (widget: DashboardWidgetInstance) => (
    <WidgetBody widget={widget} dashboard={dashboard} canApprove={canApprove} />
  );

  return (
    <div ref={ref}>
      <PageHeader
        title={t('dashboard.title', { defaultValue: 'Overview' })}
        subtitle={t('dashboard.welcomeBack', {
          name: firstName,
          defaultValue: 'Welcome back, {{name}}. Here is where your projects stand.',
        })}
      />
      {ordered.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('dashboard.noWidgets', { defaultValue: 'This user’s overview has no widgets.' })}
        />
      ) : isStacked ? (
        <Flex vertical gap={GRID_GAP}>
          {ordered.map(widget => (
            <div key={widget.type} style={{ height: widget.h * ROW_HEIGHT + (widget.h - 1) * GRID_GAP }}>
              {body(widget)}
            </div>
          ))}
        </Flex>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
            gridAutoRows: ROW_HEIGHT,
            gap: GRID_GAP,
          }}
        >
          {ordered.map(widget => (
            <div
              key={widget.type}
              style={{ gridColumn: `${widget.x + 1} / span ${widget.w}`, gridRow: `${widget.y + 1} / span ${widget.h}`, minWidth: 0 }}
            >
              {body(widget)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface WidgetBodyProps {
  widget: DashboardWidgetInstance;
  dashboard: ClientDashboardView;
  canApprove: boolean;
}

const WidgetBody = ({ widget, dashboard, canApprove }: WidgetBodyProps) => {
  switch (widget.type) {
    case 'tile-active-projects':
      return <ActiveProjectsTile dashboard={dashboard} />;
    case 'tile-pending-actions':
      return <PendingActionsTile dashboard={dashboard} />;
    case 'tile-upcoming-milestones':
      return <UpcomingMilestonesTile dashboard={dashboard} />;
    case 'tile-unpaid':
      return <UnpaidTile dashboard={dashboard} />;
    case 'needs-action':
      return <NeedsActionCard dashboard={dashboard} canApprove={canApprove} />;
    case 'upcoming-milestones':
      return <UpcomingMilestonesCard dashboard={dashboard} />;
    case 'projects':
      return <ProjectsWidget dashboard={dashboard} settings={widget.settings} />;
    case 'recent-activity':
      return <RecentActivityCard dashboard={dashboard} />;
    case 'chart-projects-by-status':
      return <ProjectsByStatusChart projects={dashboard.projects} />;
    case 'chart-project-progress':
      return <ProjectProgressChart projects={dashboard.projects} />;
    case 'chart-open-items':
      return <OpenItemsChart projects={dashboard.projects} />;
    default:
      return null;
  }
};

const ActiveProjectsTile = ({ dashboard }: { dashboard: ClientDashboardView }) => {
  const { t } = useTranslation('client-portal-v2-preview');
  return <StatTile label={t('dashboard.activeProjects', { defaultValue: 'Active projects' })} value={dashboard.active_projects} />;
};

const PendingActionsTile = ({ dashboard }: { dashboard: ClientDashboardView }) => {
  const { t } = useTranslation('client-portal-v2-preview');
  return (
    <StatTile
      label={t('dashboard.pendingActions', { defaultValue: 'Pending actions' })}
      value={dashboard.pending_actions}
      tone={dashboard.pending_actions > 0 ? 'warning' : undefined}
      sub={
        dashboard.pending_actions > 0
          ? t('dashboard.waitingOnYou', { defaultValue: 'Waiting on you' })
          : t('dashboard.nothingWaiting', { defaultValue: 'Nothing waiting' })
      }
    />
  );
};

const UpcomingMilestonesTile = ({ dashboard }: { dashboard: ClientDashboardView }) => {
  const { t, i18n } = useTranslation('client-portal-v2-preview');
  const next = dashboard.upcoming_milestones[0];
  return (
    <StatTile
      label={t('dashboard.upcomingMilestones', { defaultValue: 'Upcoming milestones' })}
      value={dashboard.upcoming_milestones.length}
      tone="success"
      sub={
        next
          ? t('dashboard.nextMilestone', {
              date: formatPortalDate(next.target_date, i18n.language) ?? '',
              defaultValue: 'Next: {{date}}',
            })
          : undefined
      }
    />
  );
};

const UnpaidTile = ({ dashboard }: { dashboard: ClientDashboardView }) => {
  const { t } = useTranslation('client-portal-v2-preview');
  return (
    <StatTile
      label={t('dashboard.unpaid', { defaultValue: 'Unpaid amount' })}
      value={`$${(dashboard.unpaid_amount ?? 0).toLocaleString()}`}
    />
  );
};

const NeedsActionCard = ({ dashboard, canApprove }: { dashboard: ClientDashboardView; canApprove: boolean }) => {
  const { t } = useTranslation('client-portal-v2-preview');
  const { token } = theme.useToken();
  return (
    <Card
      title={
        <Flex gap={8} align="center">
          {t('dashboard.needsAction', { defaultValue: 'Needs your action' })}
          {dashboard.needs_action.length > 0 && <Tag color="orange">{dashboard.needs_action.length}</Tag>}
        </Flex>
      }
      style={CARD_FILL}
      styles={CARD_BODY_SCROLL}
    >
      {dashboard.needs_action.map(item => (
        <ActionRow
          key={`${item.kind}-${item.id}`}
          icon={item.kind === 'approval' ? <AuditOutlined /> : <SwapOutlined />}
          title={item.title}
          subtitle={`${item.ref_no} · ${item.project_name}`}
          right={
            <>
              {item.due_date && <DueTag date={item.due_date} />}
              <Tag color={item.kind === 'approval' ? 'orange' : 'red'}>
                {item.kind === 'approval'
                  ? t('dashboard.approve', { defaultValue: 'Approve' })
                  : t('dashboard.reply', { defaultValue: 'Reply' })}
              </Tag>
            </>
          }
        />
      ))}
      {dashboard.needs_action.length === 0 && (
        <Typography.Text type="secondary">
          {canApprove
            ? t('dashboard.allCaughtUp', { defaultValue: 'You are all caught up.' })
            : t('dashboard.nothingForYou', { defaultValue: 'Nothing needs your action. Only a Client Admin can approve items.' })}
        </Typography.Text>
      )}
      {(dashboard.waiting_on_others?.length ?? 0) > 0 && (
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Typography.Text type="secondary" strong style={{ fontSize: token.fontSizeSM, letterSpacing: 0.4 }}>
            {t('dashboard.waitingOnOthers', { defaultValue: 'WAITING ON SOMEONE ELSE' })}
          </Typography.Text>
          {dashboard.waiting_on_others.map(item => (
            <ActionRow
              key={item.id}
              icon={<AuditOutlined />}
              title={item.title}
              subtitle={t('dashboard.waitingFor', { name: item.waiting_for, defaultValue: 'Waiting for {{name}}' })}
              right={<ApprovalStatusTag status="awaiting" />}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

const UpcomingMilestonesCard = ({ dashboard }: { dashboard: ClientDashboardView }) => {
  const { t, i18n } = useTranslation('client-portal-v2-preview');
  const { token } = theme.useToken();
  return (
    <Card
      title={t('dashboard.upcomingMilestones', { defaultValue: 'Upcoming milestones' })}
      style={CARD_FILL}
      styles={CARD_BODY_SCROLL}
    >
      {dashboard.upcoming_milestones.map(milestone => (
        <ActionRow
          key={milestone.id}
          icon={<FlagOutlined />}
          title={milestone.name}
          subtitle={milestone.project_name}
          right={
            <Flex vertical align="flex-end" gap={2}>
              <Typography.Text style={{ fontSize: token.fontSizeSM }}>
                {formatPortalDate(milestone.target_date, i18n.language)}
              </Typography.Text>
              <MilestoneStatusTag status={milestone.status as Parameters<typeof MilestoneStatusTag>[0]['status']} />
            </Flex>
          }
        />
      ))}
      {dashboard.upcoming_milestones.length === 0 && (
        <Typography.Text type="secondary">
          {t('dashboard.noUpcoming', { defaultValue: 'No upcoming milestones are shared with you.' })}
        </Typography.Text>
      )}
    </Card>
  );
};

const RecentActivityCard = ({ dashboard }: { dashboard: ClientDashboardView }) => {
  const { t, i18n } = useTranslation('client-portal-v2-preview');
  const activity = dashboard.recent_activity ?? [];
  return (
    <Card title={t('dashboard.recentActivity', { defaultValue: 'Recent activity' })} style={CARD_FILL} styles={CARD_BODY_SCROLL}>
      {activity.map(item => (
        <ActionRow
          key={item.id}
          title={<span style={{ fontWeight: 400 }}>{item.text}</span>}
          right={
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatPortalDateTime(item.at, i18n.language)}
            </Typography.Text>
          }
        />
      ))}
      {activity.length === 0 && (
        <Typography.Text type="secondary">{t('dashboard.noActivity', { defaultValue: 'No recent activity.' })}</Typography.Text>
      )}
    </Card>
  );
};

// ─── Your projects ────────────────────────────────────────────────────────────────────────────

interface ProjectsWidgetProps {
  dashboard: ClientDashboardView;
  settings?: DashboardWidgetInstance['settings'];
}

const ProjectsWidget = ({ dashboard, settings }: ProjectsWidgetProps) => {
  const { t } = useTranslation('client-portal-v2-preview');
  const ids = settings?.projectIds ?? 'all';
  const projects = ids === 'all' ? dashboard.projects : dashboard.projects.filter(project => ids.includes(project.id));
  const fields = settings?.cardFields ?? DEFAULT_CARD_FIELDS;
  const isCompact = settings?.view === 'compact';

  return (
    <Card title={t('dashboard.yourProjects', { defaultValue: 'Your projects' })} style={CARD_FILL} styles={CARD_BODY_SCROLL}>
      {projects.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('dashboard.noProjects', { defaultValue: 'No projects are assigned to this user.' })}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
          }}
        >
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              fields={fields}
              isCompact={isCompact}
              nextMilestone={dashboard.upcoming_milestones.find(milestone => milestone.project_id === project.id)?.name}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

interface ProjectCardProps {
  project: ClientProjectView;
  fields: string[];
  isCompact: boolean;
  nextMilestone?: string;
}

const ProjectCard = ({ project, fields, isCompact, nextMilestone }: ProjectCardProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-preview');
  const { token } = theme.useToken();
  const has = (field: string) => fields.includes(field);
  const dash = '—';

  const rows: Array<[string, ReactNode]> = [];
  if (has('phase')) rows.push([t('dashboard.currentPhase', { defaultValue: 'Current phase' }), project.phase ?? dash]);
  if (has('nextMilestone')) rows.push([t('dashboard.nextMilestoneLabel', { defaultValue: 'Next milestone' }), nextMilestone ?? dash]);
  if (has('expectedCompletion')) {
    rows.push([
      t('dashboard.expectedCompletion', { defaultValue: 'Expected completion' }),
      formatPortalDate(project.expected_completion, i18n.language) ?? dash,
    ]);
  }
  if (has('openItems')) {
    rows.push([
      t('dashboard.openItemsLabel', { defaultValue: 'Open approvals / change requests' }),
      `${project.open_approvals ?? 0} / ${project.open_change_requests ?? 0}`,
    ]);
  }
  if (has('sharedCounts')) {
    rows.push([
      t('dashboard.sharedLabel', { defaultValue: 'Shared milestones / tasks / files' }),
      `${project.shared_counts.milestones} / ${project.shared_counts.tasks} / ${project.shared_counts.files}`,
    ]);
  }

  return (
    <Card size={isCompact ? 'small' : 'default'} style={{ height: '100%' }}>
      <Flex justify="space-between" align="flex-start" gap={8}>
        <Typography.Text strong>{project.name}</Typography.Text>
        {has('status') && <ClientProjectStatusTag status={project.status} />}
      </Flex>
      {has('progress') && (
        <Progress percent={project.progress} strokeColor={project.color ?? undefined} style={{ margin: isCompact ? '4px 0' : '12px 0' }} />
      )}
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

const ChartCard = ({ title, isEmpty, children }: { title: string; isEmpty: boolean; children: ReactNode }) => {
  const { t } = useTranslation('client-portal-v2-preview');
  return (
    <Card title={title} style={CARD_FILL} styles={{ body: { flex: 1, minHeight: 0, padding: 12, position: 'relative' } }}>
      {isEmpty ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dashboard.noChartData', { defaultValue: 'Nothing to chart yet.' })} />
      ) : (
        children
      )}
    </Card>
  );
};

const ProjectsByStatusChart = ({ projects }: { projects: ClientProjectView[] }) => {
  const { t } = useTranslation('client-portal-v2-preview');
  const { token } = theme.useToken();
  const statuses = [
    { key: 'on_track', label: t('status.onTrack', { defaultValue: 'On track' }), color: token.colorSuccess },
    { key: 'at_risk', label: t('status.atRisk', { defaultValue: 'At risk' }), color: token.colorWarning },
    { key: 'on_hold', label: t('status.onHold', { defaultValue: 'On hold' }), color: token.colorTextQuaternary },
    { key: 'completed', label: t('status.completed', { defaultValue: 'Completed' }), color: token.colorPrimary },
  ]
    .map(status => ({ ...status, value: projects.filter(project => project.status === status.key).length }))
    .filter(status => status.value > 0);

  return (
    <ChartCard title={t('dashboard.projectsByStatus', { defaultValue: 'Projects by status' })} isEmpty={statuses.length === 0}>
      <Doughnut
        data={{
          labels: statuses.map(status => status.label),
          datasets: [
            { data: statuses.map(status => status.value), backgroundColor: statuses.map(status => status.color), borderColor: token.colorBgContainer },
          ],
        }}
        options={{
          maintainAspectRatio: false,
          cutout: '55%',
          plugins: { legend: { position: 'bottom', labels: { color: token.colorText } } },
        }}
      />
    </ChartCard>
  );
};

const ProjectProgressChart = ({ projects }: { projects: ClientProjectView[] }) => {
  const { t } = useTranslation('client-portal-v2-preview');
  const { token } = theme.useToken();
  return (
    <ChartCard title={t('dashboard.projectProgress', { defaultValue: 'Project progress' })} isEmpty={projects.length === 0}>
      <Bar
        data={{
          labels: projects.map(project => project.name),
          datasets: [
            {
              data: projects.map(project => project.progress),
              backgroundColor: projects.map(project => project.color ?? token.colorPrimary),
              borderRadius: 4,
            },
          ],
        }}
        options={{
          indexAxis: 'y',
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { min: 0, max: 100, grid: { color: token.colorBorderSecondary }, ticks: { color: token.colorTextTertiary, callback: value => `${value}%` } },
            y: { grid: { display: false }, ticks: { color: token.colorTextTertiary } },
          },
        }}
      />
    </ChartCard>
  );
};

const OpenItemsChart = ({ projects }: { projects: ClientProjectView[] }) => {
  const { t } = useTranslation('client-portal-v2-preview');
  const { token } = theme.useToken();
  const rows = projects.filter(project => (project.open_approvals ?? 0) + (project.open_change_requests ?? 0) > 0);
  return (
    <ChartCard title={t('dashboard.openItems', { defaultValue: 'Open items by project' })} isEmpty={rows.length === 0}>
      <Bar
        data={{
          labels: rows.map(project => project.name),
          datasets: [
            { label: t('dashboard.approvals', { defaultValue: 'Approvals' }), data: rows.map(project => project.open_approvals ?? 0), backgroundColor: token.colorWarning },
            {
              label: t('dashboard.changeRequests', { defaultValue: 'Change requests' }),
              data: rows.map(project => project.open_change_requests ?? 0),
              backgroundColor: token.colorPrimary,
            },
          ],
        }}
        options={{
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: token.colorText } } },
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { color: token.colorTextTertiary } },
            y: { stacked: true, beginAtZero: true, grid: { color: token.colorBorderSecondary }, ticks: { color: token.colorTextTertiary, precision: 0 } },
          },
        }}
      />
    </ChartCard>
  );
};
