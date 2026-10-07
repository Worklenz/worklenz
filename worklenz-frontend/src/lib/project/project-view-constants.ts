import React, { ReactNode, Suspense } from 'react';
import { InlineSuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import i18n from '@/i18n';
import { hasFinanceViewPermission } from '@/utils/finance-permissions';
import { isFreeUser } from '@/utils/subscription-utils';
import { isUserGuest } from './project-view-guest';
import { ILocalSession } from '@/types/auth/local-session.types';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import {
  getSoftwareProjectLabels,
  isSoftwareProjectType,
} from '@/lib/project/software-project';

// Import core components synchronously to avoid suspense in main tabs
import ProjectViewEnhancedBoard from '@/pages/projects/projectView/enhancedBoard/project-view-enhanced-board';
import TaskListV2 from '@/components/task-list-v2/TaskListV2';
import ProjectViewFinance from '@/pages/projects/projectView/finance/ProjectViewFinance';
import ProjectViewBacklog from '@/pages/projects/projectView/backlog/ProjectViewBacklog';

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
const ProjectViewReleases = React.lazy(
  () => import('@/pages/projects/projectView/releases/ProjectViewReleases')
);
const ProjectViewReports = React.lazy(
  () => import('@/pages/projects/projectView/reports/ProjectViewReports')
);
const ProjectViewSoftwareList = React.lazy(
  () => import('@/pages/projects/projectView/software-list/ProjectViewSoftwareList')
);

// type of a tab items
type TabItems = {
  index: number;
  key: string;
  label: string;
  defaultLabel: string;
  isPinned?: boolean;
  element: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
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
        backlog: 'Backlog',
        board: 'Board',
        releases: 'Releases',
        reports: 'Reports',
        insights: 'Insights',
        files: 'Files',
        members: 'Members',
        updates: 'Updates',
        roadmap: 'Roadmap',
        workload: 'Workload',
        finance: 'Finance',
      };
      return fallbacks[key] || key;
    }
    return translated;
  } catch (error) {
    // Fallback labels in case of any error
    const fallbacks: Record<string, string> = {
      taskList: 'Task List',
      backlog: 'Backlog',
      board: 'Board',
      releases: 'Releases',
      reports: 'Reports',
      insights: 'Insights',
      files: 'Files',
      members: 'Members',
      updates: 'Updates',
      finance: 'Finance',
    };
    return fallbacks[key] || key;
  }
};

// settings all element items use for tabs
export const tabItems: TabItems[] = [
  {
    index: 0,
    key: 'backlog',
    defaultLabel: 'Backlog',
    label: getTabLabel('backlog'),
    isPinned: true,
    element: React.createElement(ProjectViewBacklog),
  },
  {
    index: 1,
    key: 'tasks-list',
    defaultLabel: 'Task List',
    label: getTabLabel('taskList'),
    isPinned: true,
    element: React.createElement(TaskListV2),
  },
  {
    index: 2,
    key: 'board',
    defaultLabel: 'Board',
    label: getTabLabel('board'),
    isPinned: true,
    element: React.createElement(ProjectViewEnhancedBoard),
  },
  {
    index: 3,
    key: 'project-insights-member-overview',
    defaultLabel: 'Insights',
    label: getTabLabel('insights'),
    element: React.createElement('div'), // Placeholder, actual element set in getFilteredTabItems
  },
  {
    index: 4,
    key: 'all-attachments',
    defaultLabel: 'Files',
    label: getTabLabel('files'),
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewFiles)
    ),
  },
  {
    index: 5,
    key: 'members',
    defaultLabel: 'Members',
    label: getTabLabel('members'),
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewMembers)
    ),
  },
  {
    index: 6,
    key: 'updates',
    defaultLabel: 'Updates',
    label: getTabLabel('updates'),
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewUpdates)
    ),
  },
  {
    index: 7,
    key: 'roadmap',
    defaultLabel: 'Roadmap',
    label: getTabLabel('roadmap'),
    element: React.createElement('div'), // Placeholder, actual element set in getFilteredTabItems
  },
  {
    index: 8,
    key: 'workload',
    defaultLabel: 'Workload',
    label: getTabLabel('workload'),
    element: React.createElement('div'), // Placeholder, actual element set in getFilteredTabItems
  },
  {
    index: 9,
    key: 'finance',
    defaultLabel: 'Finance',
    label: getTabLabel('finance'),
    element: React.createElement('div'), // Placeholder, actual element set in getFilteredTabItems
  },
  {
    index: 10,
    key: 'releases',
    defaultLabel: 'Releases',
    label: getTabLabel('releases'),
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewReleases)
    ),
  },
  {
    index: 11,
    key: 'reports',
    defaultLabel: 'Reports',
    label: getTabLabel('reports'),
    element: React.createElement(
      Suspense,
      { fallback: React.createElement(InlineSuspenseFallback) },
      React.createElement(ProjectViewReports)
    ),
  },
];

// Function to update tab labels when language changes
export const updateTabLabels = () => {
  try {
    tabItems.forEach(item => {
      switch (item.key) {
        case 'backlog':
          item.label = getTabLabel('backlog');
          break;
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
        case 'finance':
          item.label = getTabLabel('finance');
          break;
        case 'releases':
          item.label = getTabLabel('releases');
          break;
        case 'reports':
          item.label = getTabLabel('reports');
          break;
      }
    });
  } catch (error) {
    console.error('Error updating tab labels:', error);
  }
};

/**
 * Get restricted views for guests
 * Guests cannot access editing-oriented project views
 */
const GUEST_RESTRICTED_VIEWS = [
  'project-insights-member-overview',
  'finance',
  'updates',
  'all-attachments',
  'reports',
];

/**
 * Tabs hidden for software projects. Links to a hidden tab (e.g. `tab=finance`)
 * fall back to the first available tab, which is the Backlog.
 */
const SOFTWARE_HIDDEN_VIEWS = ['finance', 'workload'];

const SOFTWARE_ONLY_VIEWS = ['backlog', 'releases', 'reports'];

/** Tabs shown in the software project tab bar; the rest are listed under "More". */
export const SOFTWARE_PRIMARY_TABS = ['backlog', 'board', 'releases', 'reports'];

const SOFTWARE_TAB_ORDER = [
  'backlog',
  'board',
  'releases',
  'reports',
  'tasks-list',
  'roadmap',
  'project-insights-member-overview',
  'all-attachments',
  'members',
  'updates',
];

// Function to get filtered tab items based on user permissions
export const getFilteredTabItems = (
  currentSession: ILocalSession | null,
  currentProject?: IProjectViewModel | null,
  canCreateTask?: boolean
): TabItems[] => {
  const hasFinancePermission = hasFinanceViewPermission(currentSession, currentProject);
  const isFree = isFreeUser(currentSession);
  const isGuest = isUserGuest(currentProject);
  const isSoftware = isSoftwareProjectType(currentProject?.project_type);
  const softwareLabels = getSoftwareProjectLabels(currentProject?.project_type);

  const filtered = tabItems
    .map(item => {
      if (SOFTWARE_ONLY_VIEWS.includes(item.key) && !isSoftware) {
        return null;
      }

      // If user is a guest, only show allowed views (Task List, Board, and Members)
      if (isGuest && GUEST_RESTRICTED_VIEWS.includes(item.key)) {
        return null; // Hide restricted views for guests
      }

      if (isSoftware && SOFTWARE_HIDDEN_VIEWS.includes(item.key)) {
        return null;
      }

      // Guests can view Roadmap but cannot edit tasks there.
      if (item.key === 'roadmap' && canCreateTask === false && !isGuest) {
        return null;
      }

      // Handle finance tab specially
      if (item.key === 'finance') {
        // If user has no finance permission, hide the tab entirely
        if (!hasFinancePermission) {
          return null;
        }
        // Business-plan gating is handled inside ProjectViewFinance itself
        // (blurred preview + upgrade prompt), so the tab is never disabled —
        // it always navigates normally, same as the top-nav Finance section.
        return {
          ...item,
          element: React.createElement(
            Suspense,
            { fallback: React.createElement(InlineSuspenseFallback) },
            React.createElement(ProjectViewFinance)
          ),
        };
      }

      // Disable insights, roadmap, and workload tabs for free users
      if (
        isFree &&
        ['project-insights-member-overview', 'roadmap', 'workload'].includes(item.key)
      ) {
        return {
          ...item,
          disabled: true,
          disabledReason: i18n.t('common:upgrade-plan'),
          // Keep placeholder element for disabled tabs to prevent loading
          element: React.createElement('div'),
        };
      }

      // For premium tabs, set the actual element if not disabled
      if (item.key === 'roadmap' && !item.disabled) {
        return {
          ...item,
          element: React.createElement(
            Suspense,
            { fallback: React.createElement(InlineSuspenseFallback) },
            React.createElement(ProjectViewRoadmap)
          ),
        };
      }

      if (item.key === 'workload' && !item.disabled) {
        return {
          ...item,
          element: React.createElement(
            Suspense,
            { fallback: React.createElement(InlineSuspenseFallback) },
            React.createElement(ProjectViewWorkload)
          ),
        };
      }

      if (item.key === 'project-insights-member-overview' && !item.disabled) {
        return {
          ...item,
          element: React.createElement(
            Suspense,
            { fallback: React.createElement(InlineSuspenseFallback) },
            React.createElement(ProjectViewInsights)
          ),
        };
      }

      if (item.key === 'backlog' && isSoftware) {
        return {
          ...item,
          label: softwareLabels.backlog,
          defaultLabel: softwareLabels.backlog,
        };
      }

      if (item.key === 'tasks-list' && isSoftware) {
        return {
          ...item,
          label: softwareLabels.taskList,
          defaultLabel: softwareLabels.taskList,
          element: React.createElement(
            Suspense,
            { fallback: React.createElement(InlineSuspenseFallback) },
            React.createElement(ProjectViewSoftwareList)
          ),
        };
      }

      // Return tab as is for all other cases
      return item;
    })
    .filter(item => item !== null) as TabItems[];

  if (!isSoftware) {
    return filtered;
  }

  return [...filtered].sort((a, b) => {
    const aIndex = SOFTWARE_TAB_ORDER.indexOf(a.key);
    const bIndex = SOFTWARE_TAB_ORDER.indexOf(b.key);
    const safeA = aIndex === -1 ? SOFTWARE_TAB_ORDER.length : aIndex;
    const safeB = bIndex === -1 ? SOFTWARE_TAB_ORDER.length : bIndex;
    return safeA - safeB;
  });
};
