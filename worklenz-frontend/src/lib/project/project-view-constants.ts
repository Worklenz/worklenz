import React, { ReactNode } from 'react';
import ProjectViewInsights from '@/pages/projects/projectView/insights/project-view-insights';
import ProjectViewFiles from '@/pages/projects/projectView/files/project-view-files';
import ProjectViewMembers from '@/pages/projects/projectView/members/project-view-members';
import ProjectViewUpdates from '@/pages/projects/project-view-1/updates/project-view-updates';
import ProjectViewTaskList from '@/pages/projects/projectView/taskList/project-view-task-list';
import ProjectViewBoard from '@/pages/projects/projectView/board/project-view-board';
import ProjectViewEnhancedTasks from '@/pages/projects/projectView/enhancedTasks/project-view-enhanced-tasks';
import ProjectViewEnhancedBoard from '@/pages/projects/projectView/enhancedBoard/project-view-enhanced-board';

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
    key: 'task-list-v1',
    label: 'Task List v1',
    isPinned: true,
    element: React.createElement(ProjectViewTaskList),
  },
  {
    index: 2,
    key: 'board',
    label: 'Board',
    isPinned: true,
    element: React.createElement(ProjectViewEnhancedBoard),
  },
  {
    index: 3,
    key: 'board-v1',
    label: 'Board v1',
    isPinned: true,
    element: React.createElement(ProjectViewBoard),
  },
  // {
  //   index: 3,
  //   key: 'workload',
  //   label: 'Workload',
  //   element: React.createElement(ProjectViewWorkload),
  // },
  // {
  //   index: 4,
  //   key: 'roadmap',
  //   label: 'Roadmap',
  //   element: React.createElement(ProjectViewRoadmap),
  // },
  {
    index: 5,
    key: 'project-insights-member-overview',
    label: 'Insights',
    element: React.createElement(ProjectViewInsights),
  },
  {
    index: 6,
    key: 'all-attachments',
    label: 'Files',
    element: React.createElement(ProjectViewFiles),
  },
  {
    index: 7,
    key: 'members',
    label: 'Members',
    element: React.createElement(ProjectViewMembers),
  },
  {
    index: 8,
    key: 'updates',
    label: 'Updates',
    element: React.createElement(ProjectViewUpdates),
  },
];
