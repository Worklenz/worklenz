import React, { ReactNode, lazy } from 'react';

// Lazy load all project view components for better code splitting
const ProjectViewTaskList = lazy(() => import('@/pages/projects/projectView/taskList/project-view-task-list'));
const ProjectViewBoard = lazy(() => import('@/pages/projects/projectView/board/project-view-board'));
const ProjectViewGantt = lazy(() => import('@/pages/projects/projectView/gantt/project-view-gantt'));
const ProjectViewInsights = lazy(() => import('@/pages/projects/projectView/insights/project-view-insights'));
const ProjectViewFiles = lazy(() => import('@/pages/projects/projectView/files/project-view-files'));
const ProjectViewMembers = lazy(() => import('@/pages/projects/projectView/members/project-view-members'));
const ProjectViewUpdates = lazy(() => import('@/pages/projects/projectView/updates/ProjectViewUpdates'));
const ProjectViewFinance = lazy(() => import('@/pages/projects/projectView/finance/project-view-finance'));

// type of a tab items
type TabItems = {
  index: number;
  key: string;
  label: string;
  isPinned?: boolean;
  element: ReactNode;
};

// settings all element items use for tabs
export const tabItems: TabItems[] = [
  {
    index: 0,
    key: 'tasks-list',
    label: 'Task List',
    isPinned: true,
    element: React.createElement(ProjectViewTaskList),
  },
  {
    index: 1,
    key: 'board',
    label: 'Board',
    isPinned: true,
    element: React.createElement(ProjectViewBoard),
  },
  // {
  //   index: 2,
  //   key: 'gantt',
  //   label: 'Gantt Chart',
  //   element: React.createElement(ProjectViewGantt),
  // },
  {
    index: 4,
    key: 'project-insights-member-overview',
    label: 'Insights',
    element: React.createElement(ProjectViewInsights),
  },
  {
    index: 5,
    key: 'all-attachments',
    label: 'Files',
    element: React.createElement(ProjectViewFiles),
  },
  {
    index: 6,
    key: 'members',
    label: 'Members',
    element: React.createElement(ProjectViewMembers),
  },
  {
    index: 7,
    key: 'updates',
    label: 'Updates',
    element: React.createElement(ProjectViewUpdates),
  },
  {
    index: 8,
    key: 'finance',
    label: 'Finance',
    element: React.createElement(ProjectViewFinance),
  },
];
