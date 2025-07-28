import React, { ReactNode, lazy } from 'react';
const OverviewReports = lazy(() => import('@/pages/reporting/overview-reports/overview-reports'));
const ProjectsReports = lazy(() => import('@/pages/reporting/projects-reports/projects-reports'));
const MembersReports = lazy(() => import('@/pages/reporting/members-reports/members-reports'));
const OverviewTimeReports = lazy(
  () => import('@/pages/reporting/timeReports/overview-time-reports')
);
const ProjectsTimeReports = lazy(
  () => import('@/pages/reporting/timeReports/projects-time-reports')
);
const MembersTimeReports = lazy(() => import('@/pages/reporting/timeReports/members-time-reports'));
const EstimatedVsActualTimeReports = lazy(
  () => import('@/pages/reporting/timeReports/estimated-vs-actual-time-reports')
);

// Type definition for a menu item
export type ReportingMenuItems = {
  key: string;
  name: string;
  endpoint: string;
  element: ReactNode;
  children?: ReportingMenuItems[];
};

// Reporting paths and related elements with nested structure
export const reportingsItems: ReportingMenuItems[] = [
  {
    key: 'overview',
    name: 'overview',
    endpoint: 'overview',
    element: React.createElement(OverviewReports),
  },
  {
    key: 'projects',
    name: 'projects',
    endpoint: 'projects',
    element: React.createElement(ProjectsReports),
  },
  {
    key: 'members',
    name: 'members',
    endpoint: 'members',
    element: React.createElement(MembersReports),
  },
  {
    key: 'time-sheet',
    name: 'timeReports',
    endpoint: 'time-sheets',
    element: null,
    children: [
      {
        key: 'time-sheet-overview',
        name: 'overview',
        endpoint: 'time-sheet-overview',
        element: React.createElement(OverviewTimeReports),
      },
      {
        key: 'time-sheet-projects',
        name: 'projects',
        endpoint: 'time-sheet-projects',
        element: React.createElement(ProjectsTimeReports),
      },
      {
        key: 'time-sheet-members',
        name: 'members',
        endpoint: 'time-sheet-members',
        element: React.createElement(MembersTimeReports),
      },
      {
        key: 'time-sheet-estimate-vs-actual',
        name: 'estimateVsActual',
        endpoint: 'time-sheet-estimate-vs-actual',
        element: React.createElement(EstimatedVsActualTimeReports),
      },
    ],
  },
];
