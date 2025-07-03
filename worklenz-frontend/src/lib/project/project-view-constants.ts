import React, { ReactNode, Suspense } from 'react';
import { InlineSuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

// Import core components synchronously to avoid suspense in main tabs
import ProjectViewEnhancedTasks from '@/pages/projects/projectView/enhancedTasks/project-view-enhanced-tasks';
import ProjectViewEnhancedBoard from '@/pages/projects/projectView/enhancedBoard/project-view-enhanced-board';
import TaskListV2 from '@/components/task-list-v2/TaskListV2';

// Lazy load less critical components
const ProjectViewInsights = React.lazy(
  () => import('@/pages/projects/projectView/insights/project-view-insights')
);
const ProjectViewFiles = React.lazy(
  () => import('@/pages/projects/projectView/files/project-view-files')
);
const ProjectViewMembers = React.lazy(
  () => import('@/pages/projects/projectView/members/project-view-members')
);
const ProjectViewUpdates = React.lazy(
  () => import('@/pages/projects/project-view-1/updates/project-view-updates')
);

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
    element: React.createElement(TaskListV2),
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
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewInsights)
    ),
  },
  {
    index: 3,
    key: 'all-attachments',
    label: 'Files',
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewFiles)
    ),
  },
  {
    index: 4,
    key: 'members',
    label: 'Members',
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewMembers)
    ),
  },
  {
    index: 5,
    key: 'updates',
    label: 'Updates',
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewUpdates)
    ),
  },
];
