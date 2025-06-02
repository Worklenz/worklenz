import React, { ReactNode } from 'react';
import ProjectViewInsights from '@/pages/projects/projectView/insights/project-view-insights';
import ProjectViewFiles from '@/pages/projects/projectView/files/project-view-files';
import ProjectViewMembers from '@/pages/projects/projectView/members/project-view-members';
import ProjectViewUpdates from '@/pages/projects/projectView/updates/ProjectViewUpdates';
import ProjectViewTaskList from '@/pages/projects/projectView/taskList/project-view-task-list';
import ProjectViewBoard from '@/pages/projects/projectView/board/project-view-board';
import ProjectViewFinance from '@/pages/projects/projectView/finance/project-view-finance';

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
