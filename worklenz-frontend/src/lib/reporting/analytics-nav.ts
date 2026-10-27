import React, { type ReactNode } from 'react';
import {
  AppstoreOutlined,
  HeartOutlined,
  CheckSquareOutlined,
  FlagOutlined,
  DashboardOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  RiseOutlined,
  FundOutlined,
  FieldTimeOutlined,
  SafetyCertificateOutlined,
  EditOutlined,
  PartitionOutlined,
} from '@/shared/antd-imports';

export const ANALYTICS_BASE_PATH = '/worklenz/reporting/analytics';

export interface AnalyticsNavItem {
  key: string;
  /** Path segment under ANALYTICS_BASE_PATH; empty = gallery index */
  path: string;
  labelKey: string;
  defaultLabel: string;
  /** When true, route is a Phase 1 shell; otherwise Coming Soon placeholder */
  enabled?: boolean;
}

export interface AnalyticsNavGroup {
  key: string;
  labelKey: string;
  defaultLabel: string;
  items: AnalyticsNavItem[];
}

/** Prototype-matching sidebar structure (not NavRail). */
export const ANALYTICS_NAV: {
  allReports: AnalyticsNavItem;
  groups: AnalyticsNavGroup[];
} = {
  allReports: {
    key: 'all-reports',
    path: '',
    labelKey: 'allReports',
    defaultLabel: 'All reports',
    enabled: true,
  },
  groups: [
    {
      key: 'projects',
      labelKey: 'navGroupProjects',
      defaultLabel: 'Projects',
      items: [
        {
          key: 'project-health',
          path: 'project-health',
          labelKey: 'projectHealth',
          defaultLabel: 'Project Health',
          enabled: false,
        },
        {
          key: 'planned-vs-actual-tasks',
          path: 'planned-vs-actual-tasks',
          labelKey: 'plannedVsActualTasks',
          defaultLabel: 'Planned vs Actual: Tasks',
          enabled: false,
        },
        {
          key: 'planned-vs-actual-milestones',
          path: 'planned-vs-actual-milestones',
          labelKey: 'plannedVsActualMilestones',
          defaultLabel: 'Planned vs Actual: Milestones',
          enabled: false,
        },
      ],
    },
    {
      key: 'team',
      labelKey: 'navGroupTeam',
      defaultLabel: 'Team',
      items: [
        {
          key: 'utilization',
          path: 'utilization',
          labelKey: 'utilization',
          defaultLabel: 'Utilization',
          enabled: false,
        },
      ],
    },
    {
      key: 'time-billing',
      labelKey: 'navGroupTimeBilling',
      defaultLabel: 'Time and billing',
      items: [
        {
          key: 'time-report',
          path: 'time-report',
          labelKey: 'timeReport',
          defaultLabel: 'Time Report',
          enabled: false,
        },
        {
          key: 'budget-tracking',
          path: 'budget-tracking',
          labelKey: 'budgetTracking',
          defaultLabel: 'Budget Tracking',
          enabled: false,
        },
      ],
    },
    {
      key: 'flow-analytics',
      labelKey: 'navGroupFlowAnalytics',
      defaultLabel: 'Flow analytics',
      items: [
        {
          key: 'velocity',
          path: 'velocity',
          labelKey: 'velocity',
          defaultLabel: 'Velocity',
          enabled: true,
        },
        {
          key: 'cumulative-flow',
          path: 'cumulative-flow',
          labelKey: 'cumulativeFlow',
          defaultLabel: 'Cumulative Flow',
          enabled: true,
        },
        {
          key: 'time-in-status',
          path: 'time-in-status',
          labelKey: 'timeInStatus',
          defaultLabel: 'Time in Status',
          enabled: true,
        },
        {
          key: 'sla',
          path: 'sla',
          labelKey: 'sla',
          defaultLabel: 'SLA Tracking',
          enabled: true,
        },
      ],
    },
    {
      key: 'custom-reports',
      labelKey: 'navGroupCustomReports',
      defaultLabel: 'Custom reports',
      items: [
        {
          key: 'weekly-overdue',
          path: 'weekly-overdue',
          labelKey: 'weeklyOverdue',
          defaultLabel: 'Weekly overdue tasks',
          enabled: false,
        },
        {
          key: 'billable-hours-client',
          path: 'billable-hours-client',
          labelKey: 'billableHoursClient',
          defaultLabel: 'Billable hours by client',
          enabled: false,
        },
        {
          key: 'dashboards',
          path: 'dashboards',
          labelKey: 'dashboards',
          defaultLabel: 'Dashboards',
          enabled: true,
        },
      ],
    },
    {
      key: 'share',
      labelKey: 'navGroupShare',
      defaultLabel: 'Share',
      items: [
        {
          key: 'client-dashboard',
          path: 'client-dashboard',
          labelKey: 'clientDashboard',
          defaultLabel: 'Client dashboard',
          enabled: false,
        },
      ],
    },
  ],
};

export const getAnalyticsNavIcon = (key: string): ReactNode => {
  const map: Record<string, ReactNode> = {
    'all-reports': React.createElement(AppstoreOutlined),
    'project-health': React.createElement(HeartOutlined),
    'planned-vs-actual-tasks': React.createElement(CheckSquareOutlined),
    'planned-vs-actual-milestones': React.createElement(FlagOutlined),
    utilization: React.createElement(DashboardOutlined),
    'time-report': React.createElement(ClockCircleOutlined),
    'budget-tracking': React.createElement(DollarOutlined),
    velocity: React.createElement(RiseOutlined),
    'cumulative-flow': React.createElement(FundOutlined),
    'time-in-status': React.createElement(FieldTimeOutlined),
    sla: React.createElement(SafetyCertificateOutlined),
    'weekly-overdue': React.createElement(EditOutlined),
    'billable-hours-client': React.createElement(DollarOutlined),
    dashboards: React.createElement(PartitionOutlined),
    'client-dashboard': React.createElement(AppstoreOutlined),
  };
  return map[key] ?? React.createElement(AppstoreOutlined);
};

export const analyticsPath = (segment = ''): string =>
  segment ? `${ANALYTICS_BASE_PATH}/${segment}` : ANALYTICS_BASE_PATH;

export const flatAnalyticsNavItems = (): AnalyticsNavItem[] => [
  ANALYTICS_NAV.allReports,
  ...ANALYTICS_NAV.groups.flatMap(g => g.items),
];
