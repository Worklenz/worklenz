import React from 'react';
import {
  AppstoreOutlined,
  BarsOutlined,
  CalendarOutlined,
  InboxOutlined,
  ClockCircleOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  UserAddOutlined,
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
} from '@ant-design/icons';
import type { NavSurface, SurfaceKey } from './nav-registry.types';
import type { TempChatsType } from '@/ee/pages/client-portal/chats/chat-container/chat-box/chat-box-wrapper';

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
        {
          key: 'add-client',
          label: { i18nNs: 'home-sidebar', i18nKey: 'addClient', defaultValue: 'Add\nClient' },
          icon: <UserAddOutlined />,
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
// Mirrors client-portal-constants.ts's clientPortalItems.
export const CLIENT_PORTAL_NAV_SURFACE: NavSurface = {
  key: 'client-portal',
  defaultItemKey: 'clients',
  groups: [
    {
      key: '',
      items: [
        {
          key: 'clients',
          label: { i18nNs: 'client-portal-common', i18nKey: 'clients', defaultValue: 'Clients' },
          icon: <GroupOutlined />,
        },
        {
          key: 'requests',
          label: { i18nNs: 'client-portal-common', i18nKey: 'requests', defaultValue: 'Requests' },
          icon: <UnorderedListOutlined />,
        },
        {
          key: 'services',
          label: { i18nNs: 'client-portal-common', i18nKey: 'services', defaultValue: 'Services' },
          icon: <AppstoreOutlined />,
        },
        {
          key: 'chats',
          label: { i18nNs: 'client-portal-common', i18nKey: 'chats', defaultValue: 'Chats' },
          icon: <CommentOutlined />,
          badgeSelector: state =>
            (state.clientsPortalReducer?.chatsReducer?.chatList || []).filter(
              (chat: TempChatsType) => chat.status === 'unread'
            ).length,
        },
        {
          key: 'invoices',
          label: { i18nNs: 'client-portal-common', i18nKey: 'invoices', defaultValue: 'Invoices' },
          icon: <FileDoneOutlined />,
        },
        // No real feature behind this yet — visually tagged "Soon" (matches
        // the design reference) but, unlike other `soon` items, still
        // navigates to its Coming Soon route (see client-portal-routes.tsx)
        // via `soonClickable`, so it isn't a dead end.
        {
          key: 'ticketing',
          label: { i18nNs: 'client-portal-common', i18nKey: 'ticketing', defaultValue: 'Ticketing' },
          icon: <TagOutlined />,
          soon: true,
          soonClickable: true,
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
// covers (every item except the index 'all-projects') — derived from the
// surface definition above so MainLayout/AppShellLayout's width/background
// matching for these pages can't silently drift out of sync with the rail's
// actual routes the way a hardcoded path list already has once.
export const PROJECTS_RAIL_SUB_ROUTES: ReadonlySet<string> = new Set(
  PROJECTS_NAV_SURFACE.groups
    .flatMap(group => group.items.map(item => item.key))
    .filter(key => key !== PROJECTS_NAV_SURFACE.defaultItemKey)
);

// ─── Finance ────────────────────────────────────────────────────────────────
// All items route to the shared "Coming soon" placeholder for now (see
// FinancePage/ComingSoonPage) — same non-`soon` treatment as Projects: real,
// navigable routes, just not built out yet. Labels use a dedicated
// 'finance-sidebar' namespace (public/locales/*/finance-sidebar.json).
// Invoices intentionally has no badgeSelector yet — no real invoice-count
// data exists behind this placeholder, and per the sidebar personalization
// spec (docs/sidebar-personalization-build-spec.md §3.5) badges must resolve
// from a live selector, never a hardcoded number.
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

// Mirrors PROJECTS_RAIL_SUB_ROUTES above — every Finance item except the
// index ('overview') so MainLayout/AppShellLayout can detect Finance's own
// SimpleRailLayout sub-routes the same way.
export const FINANCE_RAIL_SUB_ROUTES: ReadonlySet<string> = new Set(
  FINANCE_NAV_SURFACE.groups
    .flatMap(group => group.items.map(item => item.key))
    .filter(key => key !== FINANCE_NAV_SURFACE.defaultItemKey)
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
