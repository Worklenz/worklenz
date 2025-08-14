import React, { ReactNode, Suspense } from 'react';
import { InlineSuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import i18n from '@/i18n';

// Import core components synchronously to avoid suspense in main tabs
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
const ProjectViewRoadmap = React.lazy(
  () => import('@/pages/projects/projectView/gantt/ProjectViewGantt')
);
const ProjectViewWorkload = React.lazy(
  () => import('@/pages/projects/projectView/workload/ProjectViewWorkload')
);

// type of a tab items
type TabItems = {
  index: number;
  key: string;
  label: string;
  isPinned?: boolean;
  element: ReactNode;
};

// Function to get translated labels with fallback
const getTabLabel = (key: string): string => {
  try {
    const translated = i18n.t(`project-view:${key}`);
    // If translation is not loaded, it returns the key back, so we provide fallbacks
    if (translated === `project-view:${key}` || translated === key) {
      // Provide fallback labels
      const fallbacks: Record<string, string> = {
        taskList: 'Task List',
        board: 'Board',
        insights: 'Insights',
        files: 'Files',
        members: 'Members',
        updates: 'Updates',
        roadmap: 'Roadmap',
        workload: 'Workload',
      };
      return fallbacks[key] || key;
    }
    return translated;
  } catch (error) {
    // Fallback labels in case of any error
    const fallbacks: Record<string, string> = {
      taskList: 'Task List',
      board: 'Board',
      insights: 'Insights',
      files: 'Files',
      members: 'Members',
      updates: 'Updates',
    };
    return fallbacks[key] || key;
  }
};

// settings all element items use for tabs
export const tabItems: TabItems[] = [
  {
    index: 0,
    key: 'tasks-list',
    label: getTabLabel('taskList'),
    isPinned: true,
    element: React.createElement(TaskListV2),
  },
  {
    index: 1,
    key: 'board',
    label: getTabLabel('board'),
    isPinned: true,
    element: React.createElement(ProjectViewEnhancedBoard),
  },
  {
    index: 2,
    key: 'project-insights-member-overview',
    label: getTabLabel('insights'),
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewInsights)
    ),
  },
  {
    index: 3,
    key: 'all-attachments',
    label: getTabLabel('files'),
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewFiles)
    ),
  },
  {
    index: 4,
    key: 'members',
    label: getTabLabel('members'),
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewMembers)
    ),
  },
  {
    index: 5,
    key: 'updates',
    label: getTabLabel('updates'),
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewUpdates)
    ),
  },
  {
    index: 6,
    key: 'roadmap',
    label: getTabLabel('roadmap'),
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewRoadmap)
    ),
  },
  {
    index: 7,
    key: 'workload',
    label: getTabLabel('workload'),
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewWorkload)
    ),
  },
];

// Function to update tab labels when language changes
export const updateTabLabels = () => {
  try {
    tabItems.forEach(item => {
      switch (item.key) {
        case 'tasks-list':
          item.label = getTabLabel('taskList');
          break;
        case 'board':
          item.label = getTabLabel('board');
          break;
        case 'project-insights-member-overview':
          item.label = getTabLabel('insights');
          break;
        case 'all-attachments':
          item.label = getTabLabel('files');
          break;
        case 'members':
          item.label = getTabLabel('members');
          break;
        case 'updates':
          item.label = getTabLabel('updates');
          break;
        case 'roadmap':
          item.label = getTabLabel('roadmap');
          break;
        case 'workload':
          item.label = getTabLabel('workload');
          break;
      }
    });
  } catch (error) {
    console.error('Error updating tab labels:', error);
  }
};
