import React, { ReactNode, Suspense } from 'react';
import { InlineSuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import i18n from '@/i18n';
import { hasFinanceViewPermission } from '@/utils/finance-permissions';
import { ILocalSession } from '@/types/auth/local-session.types';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';

// Import core components synchronously to avoid suspense in main tabs
import ProjectViewEnhancedBoard from '@/pages/projects/projectView/enhancedBoard/project-view-enhanced-board';
import TaskListV2 from '@/components/task-list-v2/TaskListV2';
import ProjectViewFinance from '@/pages/projects/projectView/finance/ProjectViewFinance';

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
        board: 'Board',
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
      board: 'Board',
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
    key: 'tasks-list',
    defaultLabel: 'Task List',
    label: getTabLabel('taskList'),
    isPinned: true,
    element: React.createElement(TaskListV2),
  },
  {
    index: 1,
    key: 'board',
    defaultLabel: 'Board',
    label: getTabLabel('board'),
    isPinned: true,
    element: React.createElement(ProjectViewEnhancedBoard),
  },
  {
    index: 2,
    key: 'project-insights-member-overview',
    defaultLabel: 'Insights',
    label: getTabLabel('insights'),
    element: React.createElement('div'), // Placeholder, actual element set in getFilteredTabItems
  },
  {
    index: 3,
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
    index: 4,
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
    index: 5,
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
    index: 6,
    key: 'roadmap',
    defaultLabel: 'Roadmap',
    label: getTabLabel('roadmap'),
    element: React.createElement('div'), // Placeholder, actual element set in getFilteredTabItems
  },
  {
    index: 7,
    key: 'workload',
    defaultLabel: 'Workload',
    label: getTabLabel('workload'),
    element: React.createElement('div'), // Placeholder, actual element set in getFilteredTabItems
  },
  {
    index: 8,
    key: 'finance',
    defaultLabel: 'Finance',
    label: getTabLabel('finance'),
    element: React.createElement('div'), // Placeholder, actual element set in getFilteredTabItems
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
        case 'finance':
          item.label = getTabLabel('finance');
          break;
      }
    });
  } catch (error) {
    console.error('Error updating tab labels:', error);
  }
};

// Function to get filtered tab items based on user permissions
/**
 * Business-plan flags, injected by the caller (which reads them from the edition-aware
 * `useBusinessFeatures()` hook). Kept as params so this plain module never imports edition code.
 */
export interface ITabBusinessFlags {
  hasBusinessAccess: boolean;
  isFree: boolean;
}

export const getFilteredTabItems = (
  currentSession: ILocalSession | null,
  currentProject?: IProjectViewModel | null,
  flags: ITabBusinessFlags = { hasBusinessAccess: false, isFree: true }
): TabItems[] => {
  const hasFinancePermission = hasFinanceViewPermission(currentSession, currentProject);
  const { hasBusinessAccess, isFree } = flags;

  return tabItems
    .map(item => {
      // Handle finance tab specially
      if (item.key === 'finance') {
        // If user has finance permission but no business access, show tab as disabled
        if (hasFinancePermission && !hasBusinessAccess) {
          return {
            ...item,
            disabled: true,
            disabledReason: i18n.t('common:business-plan-upgrade'),
            // Keep placeholder element for disabled finance tab to prevent loading
            element: React.createElement('div'),
          };
        }
        // If user has no finance permission, hide the tab
        if (!hasFinancePermission) {
          return null;
        }
        // User has finance permission and business access - set actual element
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

      // Return tab as is for all other cases
      return item;
    })
    .filter(item => item !== null) as TabItems[];
};
