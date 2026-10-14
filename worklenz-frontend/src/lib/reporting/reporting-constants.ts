import React, { ReactNode, lazy } from 'react';
import {
  DashboardOutlined,
  AppstoreOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  ProjectOutlined,
  BarChartOutlined,
  FileOutlined,
  RiseOutlined,
} from '@/shared/antd-imports';
import { AreaChartOutlined, FieldTimeOutlined, LineChartOutlined, PieChartOutlined, BarChartOutlined as AnalyticsBarChartOutlined } from '@ant-design/icons';

const OverviewReports = lazy(() => import('@/pages/reporting/overview-reports/overview-reports'));
const ProjectsReports = lazy(() => import('@/pages/reporting/projects-reports/projects-reports'));
const MembersReports = lazy(() => import('@/pages/reporting/members-reports/members-reports'));
const AllTasksReports = lazy(() => import('@/pages/reporting/all-tasks-reports/all-tasks-reports'));
const OverviewTimeReports = lazy(
  () => import('@/pages/reporting/time-sheets/overview-time-reports')
);
const ProjectsTimeReports = lazy(
  () => import('@/pages/reporting/time-sheets/projects-time-reports')
);
const MembersTimeReports = lazy(() => import('@/pages/reporting/time-sheets/members-time-reports'));
const EstimatedVsActualTimeReports = lazy(
  () => import('@/pages/reporting/time-sheets/estimated-vs-actual-time-reports')
);
const TimeLogsReports = lazy(() => import('@/pages/reporting/time-sheets/time-logs'));
const ProgressTrackingPage = lazy(
  () => import('@/pages/reporting/progress-tracking/progress-tracking-page')
);
const VelocityReportPage = lazy(() => import('@/pages/reporting/flow-analytics/velocity-report-page'));
const CumulativeFlowReportPage = lazy(() => import('@/pages/reporting/flow-analytics/cumulative-flow-report-page'));
const TimeInStatusReportPage = lazy(() => import('@/pages/reporting/flow-analytics/time-in-status-report-page'));
const PortfolioDashboard = lazy(
  () => import('@/pages/reporting/portfolio/portfolio-dashboard')
);

// Type definition for a menu item
export type ReportingMenuItems = {
  key: string;
  name: string;
  defaultValue: string;
  endpoint: string;
  element: ReactNode;
  icon?: ReactNode;
  children?: ReportingMenuItems[];
};

// Reporting paths and related elements with nested structure
export const reportingsItems: ReportingMenuItems[] = [
  {
    key: 'overview',
    name: 'overview',
    defaultValue: 'Overview',
    endpoint: 'overview',
    element: React.createElement(OverviewReports),
    icon: React.createElement(DashboardOutlined),
  },
  {
    key: 'projects',
    name: 'projects',
    defaultValue: 'Projects',
    endpoint: 'projects',
    element: React.createElement(ProjectsReports),
    icon: React.createElement(AppstoreOutlined),
  },
  {
    key: 'members',
    name: 'members',
    defaultValue: 'Members',
    endpoint: 'members',
    element: React.createElement(MembersReports),
    icon: React.createElement(TeamOutlined),
  },
  {
    key: 'all-tasks',
    name: 'allTasks',
    defaultValue: 'Tasks',
    endpoint: 'all-tasks',
    element: React.createElement(AllTasksReports),
    icon: React.createElement(UnorderedListOutlined),
  },
  {
    key: 'progress-tracking',
    name: 'progressTracking',
    defaultValue: 'Progress Tracking',
    endpoint: 'progress-tracking',
    element: React.createElement(ProgressTrackingPage),
    icon: React.createElement(RiseOutlined),
  },
  {
    key: 'project-portfolio',
    name: 'portfolio',
    defaultValue: 'Portfolio',
    endpoint: 'project-portfolio',
    element: React.createElement(PortfolioDashboard),
    icon: React.createElement(PieChartOutlined),
  },
  {
    key: 'reporting-analytics',
    name: 'reportingAnalytics',
    defaultValue: 'Reporting & Analytics',
    endpoint: 'reporting-analytics',
    element: null,
    icon: React.createElement(LineChartOutlined),
    children: [
      {
        key: 'velocity-charts',
        name: 'velocityCharts',
        defaultValue: 'Velocity Charts',
        endpoint: 'velocity-charts',
        element: React.createElement(VelocityReportPage),
        icon: React.createElement(AnalyticsBarChartOutlined),
      },
      {
        key: 'cumulative-flow',
        name: 'cumulativeFlow',
        defaultValue: 'Cumulative Flow Diagram',
        endpoint: 'cumulative-flow',
        element: React.createElement(CumulativeFlowReportPage),
        icon: React.createElement(AreaChartOutlined),
      },
      {
        key: 'time-in-status',
        name: 'timeInStatus',
        defaultValue: 'Time in Status',
        endpoint: 'time-in-status',
        element: React.createElement(TimeInStatusReportPage),
        icon: React.createElement(FieldTimeOutlined),
      },
    ],
  },
  {
    key: 'time-sheet',
    name: 'timeReports',
    defaultValue: 'Time Reports',
    endpoint: 'time-sheets',
    element: null,
    icon: React.createElement(ClockCircleOutlined),
    children: [
      {
        key: 'time-sheet-overview',
        name: 'timesheet',
        defaultValue: 'Timesheet',
        endpoint: 'time-sheet-overview',
        element: React.createElement(OverviewTimeReports),
        icon: React.createElement(CalendarOutlined),
      },
      {
        key: 'time-sheet-projects',
        name: 'projects',
        defaultValue: 'Projects',
        endpoint: 'time-sheet-projects',
        element: React.createElement(ProjectsTimeReports),
        icon: React.createElement(ProjectOutlined),
      },
      {
        key: 'time-sheet-members',
        name: 'members',
        defaultValue: 'Members',
        endpoint: 'time-sheet-members',
        element: React.createElement(MembersTimeReports),
        icon: React.createElement(TeamOutlined),
      },
      {
        key: 'time-sheet-estimate-vs-actual',
        name: 'estimateVsActual',
        defaultValue: 'Estimate vs Actual',
        endpoint: 'time-sheet-estimate-vs-actual',
        element: React.createElement(EstimatedVsActualTimeReports),
        icon: React.createElement(BarChartOutlined),
      },
      {
        key: 'time-sheet-logs',
        name: 'logs',
        defaultValue: 'Logs',
        endpoint: 'time-sheet-logs',
        element: React.createElement(TimeLogsReports),
        icon: React.createElement(FileOutlined),
      },
    ],
  },
];
