import React, { ReactNode } from 'react';

// Lazy load all project view components to reduce initial bundle size
const ProjectViewInsights = React.lazy(() => import('@/pages/projects/projectView/insights/project-view-insights'));
const ProjectViewFiles = React.lazy(() => import('@/pages/projects/projectView/files/project-view-files'));
const ProjectViewMembers = React.lazy(() => import('@/pages/projects/projectView/members/project-view-members'));
const ProjectViewUpdates = React.lazy(() => import('@/pages/projects/project-view-1/updates/project-view-updates'));
const ProjectViewEnhancedTasks = React.lazy(() => import('@/pages/projects/projectView/enhancedTasks/project-view-enhanced-tasks'));
const ProjectViewEnhancedBoard = React.lazy(() => import('@/pages/projects/projectView/enhancedBoard/project-view-enhanced-board'));

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
    element: React.createElement(ProjectViewEnhancedTasks),
  },
  {
    index: 1,
    key: 'board',
    label: 'Board',
    isPinned: true,
    element: React.createElement(ProjectViewEnhancedBoard),
  },
  {
    index: 2,
    key: 'project-insights-member-overview',
    label: 'Insights',
    element: React.createElement(ProjectViewInsights),
  },
  {
    index: 3,
    key: 'all-attachments',
    label: 'Files',
    element: React.createElement(ProjectViewFiles),
  },
  {
    index: 4,
    key: 'members',
    label: 'Members',
    element: React.createElement(ProjectViewMembers),
  },
  {
    index: 5,
    key: 'updates',
    label: 'Updates',
    element: React.createElement(ProjectViewUpdates),
  },
];
