import React from 'react';
import {
  AppstoreOutlined,
  BarsOutlined,
  CalendarOutlined,
  InboxOutlined,
  ClockCircleOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  TableOutlined,
  BarChartOutlined,
  DashboardOutlined,
  ProjectOutlined,
  FileOutlined,
  GroupOutlined,
  CommentOutlined,
  SettingOutlined,
  SyncOutlined,
} from '@/shared/antd-imports';
import {
  FileDoneOutlined,
  ControlOutlined,
  FolderOutlined,
  BlockOutlined,
  RiseOutlined,
  PieChartOutlined,
  FileTextOutlined,
  CompassOutlined,
  TagOutlined,
  EyeOutlined,
  AuditOutlined,
  SwapOutlined,
  MessageOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import type { NavSurface, SurfaceKey } from './nav-registry.types';
import type { RootState } from '@/app/store';
import { portalCountsApi } from '@/api/client-portal/portal-counts-api';
import type { PortalCounts } from '@/types/client-portal/v2';

// ─── Home ───────────────────────────────────────────────────────────────────
// Ported 1:1 from the NAV_ITEMS previously hardcoded in HomeLeftSidebar.tsx.
// Labels use the same i18n-descriptor shape as Reporting/Client Portal
// (own dedicated 'home-sidebar' namespace, public/locales/*/home-sidebar.json).
export const HOME_NAV_SURFACE: NavSurface = {
  key: 'home',
  defaultItemKey: 'overview',
  groups: [
    {
      key: '',
      items: [
        {
          key: 'overview',
          label: { i18nNs: 'home-sidebar', i18nKey: 'overview', defaultValue: 'Overview' },
          icon: <AppstoreOutlined />,
        },
        {
          key: 'my-tasks',
          label: { i18nNs: 'home-sidebar', i18nKey: 'myTasks', defaultValue: 'My Tasks' },
          icon: <BarsOutlined />,
        },
        {
          key: 'calendar',
          label: { i18nNs: 'home-sidebar', i18nKey: 'calendar', defaultValue: 'Calendar' },
          icon: <CalendarOutlined />,
        },
        {
          key: 'inbox',
          label: { i18nNs: 'home-sidebar', i18nKey: 'inbox', defaultValue: 'Inbox' },
          icon: <InboxOutlined />,
        },
        {
          key: 'log-time',
          label: { i18nNs: 'home-sidebar', i18nKey: 'logTime', defaultValue: 'Log Time' },
          icon: <ClockCircleOutlined />,
        },
        {
          key: 'todo',
          label: { i18nNs: 'home-sidebar', i18nKey: 'todo', defaultValue: 'Todo List' },
          icon: <UnorderedListOutlined />,
        },
        {
          key: 'my-team',
          label: { i18nNs: 'home-sidebar', i18nKey: 'myTeam', defaultValue: 'My Team' },
          icon: <TeamOutlined />,
        },
      ],
    },
  ],
};

// ─── Planner / Schedule ─────────────────────────────────────────────────────
// 'team' and 'calendar' stay excluded — they're commented out (not live) in
// the current PlannerLeftSidebar.tsx NAV_ITEMS. Labels use the dedicated
// 'planner-sidebar' namespace (public/locales/*/planner-sidebar.json).
export const PLANNER_NAV_SURFACE: NavSurface = {
  key: 'planner',
  defaultItemKey: 'schedule',
  groups: [
    {
      key: '',
      items: [
        {
          key: 'schedule',
          label: { i18nNs: 'planner-sidebar', i18nKey: 'schedule', defaultValue: 'Schedule' },
          icon: <TableOutlined />,
        },
        {
          key: 'timeline',
          label: { i18nNs: 'planner-sidebar', i18nKey: 'timeline', defaultValue: 'Timeline' },
          icon: <BarChartOutlined />,
        },
        {
          key: 'workload',
          label: { i18nNs: 'planner-sidebar', i18nKey: 'workload', defaultValue: 'Workload' },
          icon: <DashboardOutlined />,
        },
      ],
    },
  ],
};

// ─── Reporting ──────────────────────────────────────────────────────────────
// Mirrors reporting-constants.ts's reportingsItems. The parent 'time-sheet'
// entry renders as a group header + divider today (antd type:'group'), never
// a clickable target itself, so it becomes a NavGroup label, not a NavItem.
export const REPORTING_NAV_SURFACE: NavSurface = {
  key: 'reporting',
  defaultItemKey: 'overview',
  groups: [
    {
      key: '',
      items: [
        {
          key: 'overview',
          label: { i18nNs: 'reporting-sidebar', i18nKey: 'overview', defaultValue: 'Overview' },
          icon: <DashboardOutlined />,
        },
        {
          key: 'projects',
          label: { i18nNs: 'reporting-sidebar', i18nKey: 'projects', defaultValue: 'Projects' },
          icon: <AppstoreOutlined />,
        },
        {
          key: 'members',
          label: { i18nNs: 'reporting-sidebar', i18nKey: 'members', defaultValue: 'Members' },
          icon: <TeamOutlined />,
        },
        {
          key: 'all-tasks',
          label: { i18nNs: 'reporting-sidebar', i18nKey: 'allTasks', defaultValue: 'Tasks' },
          icon: <UnorderedListOutlined />,
        },
        {
          key: 'progress-tracking',
          label: {
            i18nNs: 'reporting-sidebar',
            i18nKey: 'progressTracking',
            defaultValue: 'Progress Tracking',
          },
          icon: <RiseOutlined />,
        },
      ],
    },
    {
      key: 'time-sheet',
      label: { i18nNs: 'reporting-sidebar', i18nKey: 'timeReports', defaultValue: 'Time Reports' },
      items: [
        {
          key: 'time-sheet-overview',
          label: { i18nNs: 'reporting-sidebar', i18nKey: 'timesheet', defaultValue: 'Timesheet' },
          icon: <CalendarOutlined />,
        },
        {
          key: 'time-sheet-projects',
          label: { i18nNs: 'reporting-sidebar', i18nKey: 'projects', defaultValue: 'Projects' },
          icon: <ProjectOutlined />,
        },
        {
          key: 'time-sheet-members',
          label: { i18nNs: 'reporting-sidebar', i18nKey: 'members', defaultValue: 'Members' },
          icon: <TeamOutlined />,
        },
        {
          key: 'time-sheet-estimate-vs-actual',
          label: { i18nNs: 'reporting-sidebar', i18nKey: 'estimateVsActual', defaultValue: 'Estimate vs Actual' },
          icon: <BarChartOutlined />,
        },
        {
          key: 'time-sheet-logs',
          label: { i18nNs: 'reporting-sidebar', i18nKey: 'logs', defaultValue: 'Logs' },
          icon: <FileOutlined />,
        },
      ],
    },
  ],
};

// ─── Client Portal (staff-side management view) ────────────────────────────
// Client Portal v2 order (#2509): Clients, Projects, Approvals, Change Req., Discussions,
// Quotes, Invoices, Audit Log, Portal Settings, Client Portal. Services, Requests, Ticketing and
// Chats are retired in v2 (#2499). Sidebar labels resolve against 'client-portal-common' (see
// client-portal-sidebar.tsx), so every key below lives in that file.
//
// Bump ORDER_VERSIONS['client-portal'] in navPreferences.slice.ts when this order changes.
const EMPTY_PORTAL_COUNTS: PortalCounts = {
  awaiting_approvals: 0,
  review_change_requests: 0,
  unread_threads: 0,
};

// Reads one sidebar badge from the cached counts query. ClientPortalSidebar keeps that query fresh.
const portalCount = (read: (counts: PortalCounts) => number) => (state: RootState) =>
  read(portalCountsApi.endpoints.getPortalCounts.select()(state)?.data?.body ?? EMPTY_PORTAL_COUNTS);

export const CLIENT_PORTAL_NAV_SURFACE: NavSurface = {
  key: 'client-portal',
  defaultItemKey: 'overview',
  groups: [
    {
      key: '',
      items: [
        {
          key: 'overview',
          label: { i18nNs: 'client-portal-common', i18nKey: 'overview', defaultValue: 'Overview' },
          icon: <DashboardOutlined />,
        },
        {
          key: 'clients',
          label: { i18nNs: 'client-portal-common', i18nKey: 'clients', defaultValue: 'Clients' },
          icon: <GroupOutlined />,
        },
        {
          key: 'projects',
          label: { i18nNs: 'client-portal-common', i18nKey: 'projects', defaultValue: 'Projects' },
          icon: <ProjectOutlined />,
        },
        {
          key: 'approvals',
          label: { i18nNs: 'client-portal-common', i18nKey: 'approvals', defaultValue: 'Approvals' },
          icon: <AuditOutlined />,
        },
        {
          key: 'change-requests',
          label: {
            i18nNs: 'client-portal-common',
            i18nKey: 'changeRequests',
            defaultValue: 'Change Req.',
          },
          icon: <SwapOutlined />,
          badgeSelector: portalCount(counts => counts.review_change_requests),
        },
        {
          key: 'discussions',
          label: {
            i18nNs: 'client-portal-common',
            i18nKey: 'discussions',
            defaultValue: 'Discussions',
          },
          icon: <MessageOutlined />,
          badgeSelector: portalCount(counts => counts.unread_threads),
        },
        {
          key: 'quotes',
          label: { i18nNs: 'client-portal-common', i18nKey: 'quotes', defaultValue: 'Quotes' },
          icon: <FileTextOutlined />,
        },
        {
          key: 'invoices',
          label: { i18nNs: 'client-portal-common', i18nKey: 'invoices', defaultValue: 'Invoices' },
          icon: <FileDoneOutlined />,
        },
        {
          key: 'audit-log',
          label: { i18nNs: 'client-portal-common', i18nKey: 'auditLog', defaultValue: 'Audit Log' },
          icon: <HistoryOutlined />,
        },
        {
          key: 'settings',
          label: {
            i18nNs: 'client-portal-common',
            i18nKey: 'settings',
            defaultValue: 'Portal\nSettings',
          },
          icon: <SettingOutlined />,
        },
        {
          key: 'preview',
          label: {
            i18nNs: 'client-portal-common',
            i18nKey: 'clientPortalPreview',
            defaultValue: 'Client Portal',
          },
          icon: <EyeOutlined />,
        },
      ],
    },
  ],
};

// ─── Projects ───────────────────────────────────────────────────────────────
// 'all-projects' and 'time-entries' have their real feature behind them; the
// rest route to a shared "Coming soon" placeholder (see ComingSoonPage) —
// they're still real, navigable routes, just not built out yet.
export const PROJECTS_NAV_SURFACE: NavSurface = {
  key: 'projects',
  defaultItemKey: 'all-projects',
  groups: [
    {
      key: '',
      items: [
        {
          key: 'all-projects',
          label: { i18nNs: 'projects-sidebar', i18nKey: 'overview', defaultValue: 'Overview' },
          icon: <AppstoreOutlined />,
        },
        {
          key: 'time-entries',
          label: { i18nNs: 'projects-sidebar', i18nKey: 'timeEntries', defaultValue: 'Time Entries' },
          icon: <ClockCircleOutlined />,
          guestExcluded: true, // Hide from guest users
        },
        {
          key: 'recurring-tasks',
          label: { i18nNs: 'projects-sidebar', i18nKey: 'recurringTasks', defaultValue: 'Recurring Tasks' },
          icon: <SyncOutlined />,
          guestExcluded: true, // Hide from guest users
        },
        // {
        //   key: 'workload',
        //   label: 'Workload',
        //   icon: <ControlOutlined />,
        // },
        // {
        //   key: 'roadmap',
        //   label: 'Roadmap',
        //   icon: <CalendarOutlined />,
        // },
        {
          key: 'files',
          label: { i18nNs: 'projects-sidebar', i18nKey: 'files', defaultValue: 'Files' },
          icon: <FolderOutlined />,
          guestExcluded: true, // Hide from guest users
        },
        {
          key: 'templates',
          label: { i18nNs: 'projects-sidebar', i18nKey: 'templates', defaultValue: 'Templates' },
          icon: <BlockOutlined />,
          guestExcluded: true, // Hide from guest users
          adminOnly: true, // Only Owner/Admin may create projects from templates
        },
        // {
        //   key: 'archived',
        //   label: 'Archived',
        //   icon: <InboxOutlined />,
        // },
      ],
    },
  ],
};

// Route segments nested under /worklenz/projects/ that the rail itself
// covers — derived from the surface definition above so MainLayout/AppShellLayout's
// width/background matching for these pages can't silently drift out of sync with
// the rail's actual routes the way a hardcoded path list already has once.
export const PROJECTS_RAIL_SUB_ROUTES: ReadonlySet<string> = new Set(
  PROJECTS_NAV_SURFACE.groups.flatMap(group => group.items.map(item => item.key))
);

// ─── Finance ────────────────────────────────────────────────────────────────
// Overview and Expenses already shipped; the remaining rail items are the
// portfolio report pages (Profitability, Budgets, Invoices, Billable Time,
// Utilization, Forecasts). Labels use a dedicated 'finance-sidebar' namespace
// (public/locales/*/finance-sidebar.json).
export const FINANCE_NAV_SURFACE: NavSurface = {
  key: 'finance',
  defaultItemKey: 'overview',
  groups: [
    {
      key: '',
      items: [
        {
          key: 'overview',
          label: { i18nNs: 'finance-sidebar', i18nKey: 'overview', defaultValue: 'Overview' },
          icon: <AppstoreOutlined />,
        },
        {
          key: 'profitability',
          label: { i18nNs: 'finance-sidebar', i18nKey: 'profitability', defaultValue: 'Profitability' },
          icon: <RiseOutlined />,
        },
        {
          key: 'budgets',
          label: { i18nNs: 'finance-sidebar', i18nKey: 'budgets', defaultValue: 'Budgets' },
          icon: <PieChartOutlined />,
        },
        {
          key: 'invoices',
          label: { i18nNs: 'finance-sidebar', i18nKey: 'invoices', defaultValue: 'Invoices' },
          icon: <FileTextOutlined />,
        },
        {
          key: 'expenses',
          label: { i18nNs: 'finance-sidebar', i18nKey: 'expenses', defaultValue: 'Expenses' },
          icon: <FileOutlined />,
        },
        {
          key: 'billable-time',
          label: { i18nNs: 'finance-sidebar', i18nKey: 'billableTime', defaultValue: 'Billable Time' },
          icon: <ClockCircleOutlined />,
        },
        {
          key: 'utilization',
          label: { i18nNs: 'finance-sidebar', i18nKey: 'utilization', defaultValue: 'Utilization' },
          icon: <DashboardOutlined />,
        },
        {
          key: 'forecasts',
          label: { i18nNs: 'finance-sidebar', i18nKey: 'forecasts', defaultValue: 'Forecasts' },
          icon: <CompassOutlined />,
        },
      ],
    },
  ],
};

// Mirrors PROJECTS_RAIL_SUB_ROUTES above — every Finance rail sub-route so
// MainLayout/AppShellLayout can detect Finance's own SimpleRailLayout
// sub-routes the same way.
export const FINANCE_RAIL_SUB_ROUTES: ReadonlySet<string> = new Set(
  FINANCE_NAV_SURFACE.groups.flatMap(group => group.items.map(item => item.key))
);

// ─── Team Lead Reports ──────────────────────────────────────────────────────
export const TEAM_LEAD_REPORTS_NAV_SURFACE: NavSurface = {
  key: 'team-lead-reports',
  defaultItemKey: 'overview',
  groups: [
    {
      key: '',
      items: [
        {
          key: 'overview',
          label: 'Overview',
          icon: <DashboardOutlined />,
        },
        {
          key: 'export',
          label: 'Export',
          icon: <FileOutlined />,
          soon: true,
        },
      ],
    },
  ],
};

export const NAV_REGISTRY: Record<SurfaceKey, NavSurface> = {
  home: HOME_NAV_SURFACE,
  planner: PLANNER_NAV_SURFACE,
  reporting: REPORTING_NAV_SURFACE,
  'client-portal': CLIENT_PORTAL_NAV_SURFACE,
  projects: PROJECTS_NAV_SURFACE,
  'team-lead-reports': TEAM_LEAD_REPORTS_NAV_SURFACE,
  finance: FINANCE_NAV_SURFACE,
};
