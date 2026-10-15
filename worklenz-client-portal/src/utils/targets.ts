import type { ClientTarget } from '@/types/v2';

/**
 * The route a notification, activity row or approval link opens. Item-level deep links use query
 * params; the destination page re-checks access and shows an "unavailable" state if it fails.
 */
export const targetPath = (target: ClientTarget): string => {
  switch (target.page) {
    case 'approval':
      return `/approvals/${target.id}`;
    case 'change_request':
      return `/change-requests/${target.id}`;
    case 'project':
      return `/projects/${target.projectId}`;
    case 'milestone':
      return `/projects/${target.projectId}/milestones?ms=${encodeURIComponent(target.id)}`;
    case 'task':
      return `/projects/${target.projectId}/tasks?task=${encodeURIComponent(target.id)}`;
    case 'file':
      return `/projects/${target.projectId}/files?file=${encodeURIComponent(target.id)}`;
    case 'thread':
      return `/projects/${target.projectId}/discussions?thread=${encodeURIComponent(target.id)}`;
  }
};

export const PROJECT_TABS = ['overview', 'milestones', 'tasks', 'files', 'discussions'] as const;
export type ProjectTab = (typeof PROJECT_TABS)[number];

/** Unknown tab names fall back to Overview (spec #2532). */
export const toProjectTab = (value: string | undefined): ProjectTab =>
  (PROJECT_TABS as readonly string[]).includes(value ?? '') ? (value as ProjectTab) : 'overview';

/** The project dialog adds a Members tab to the page's tabs. */
export const MODAL_TABS = [...PROJECT_TABS, 'members'] as const;
export type ProjectModalTab = (typeof MODAL_TABS)[number];

/** Unknown tab names open Overview, the same rule the project page follows. */
export const toModalTab = (value: string | null | undefined): ProjectModalTab =>
  (MODAL_TABS as readonly string[]).includes(value ?? '') ? (value as ProjectModalTab) : 'overview';

/** What a row action wants the opened tab to do straight away. */
export type ProjectModalIntent = 'upload' | 'discussion';
