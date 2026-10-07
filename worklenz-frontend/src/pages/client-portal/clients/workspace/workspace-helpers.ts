import type {
  ClientActivityCategory,
  ClientWorkspaceProfile,
  ClientWorkspaceStats,
  OutstandingAmount,
} from '@/api/client-portal/client-workspace-api';

/** The tabs of a client workspace. Files, Contracts & Forms and Access are not built yet. */
export const WORKSPACE_TABS = ['overview', 'messages', 'members', 'projects', 'billing'] as const;

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

export const DEFAULT_WORKSPACE_TAB: WorkspaceTab = 'overview';

/** Reads `?tab=`. Anything unknown (or a tab that does not exist yet) opens Overview. */
export const parseWorkspaceTab = (value: string | null | undefined): WorkspaceTab =>
  (WORKSPACE_TABS as readonly string[]).includes(value ?? '')
    ? (value as WorkspaceTab)
    : DEFAULT_WORKSPACE_TAB;

export const CLIENTS_PATH = '/worklenz/client-portal/clients';

/** The one URL every entry point uses to open a client, so they all land in the same workspace. */
export const clientWorkspacePath = (clientId: string, tab?: WorkspaceTab): string =>
  `${CLIENTS_PATH}/${clientId}${tab && tab !== DEFAULT_WORKSPACE_TAB ? `?tab=${tab}` : ''}`;

export const getClientDisplayName = (
  profile: Pick<ClientWorkspaceProfile, 'name' | 'company_name'>
) => profile.company_name?.trim() || profile.name;

/** Whole-number completion of a project from its task counts. A project without tasks is 0%. */
export const getProjectProgress = (project: {
  total_tasks: number;
  completed_tasks: number;
}): number =>
  project.total_tasks > 0
    ? Math.min(100, Math.round((project.completed_tasks / project.total_tasks) * 100))
    : 0;

/** "$1,200.00" style amounts, one per currency. Currencies are never summed. */
export const formatOutstanding = (outstanding: OutstandingAmount[], locale?: string): string[] =>
  outstanding
    .filter(item => item.amount > 0)
    .map(item => {
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: item.currency }).format(
          item.amount
        );
      } catch {
        // An unknown currency code should still show the number.
        return `${item.currency} ${item.amount.toFixed(2)}`;
      }
    });

export type WorkspaceActivity =
  | { kind: 'signedIn'; at: string }
  | { kind: 'invited'; at: string }
  | { kind: 'never' };

export const getWorkspaceActivity = (
  stats: Pick<ClientWorkspaceStats, 'lastLoginAt' | 'invitedAt' | 'portalStatus'>
): WorkspaceActivity => {
  if (stats.lastLoginAt) return { kind: 'signedIn', at: stats.lastLoginAt };

  const status = stats.portalStatus.status;
  if ((status === 'invited' || status === 'expired') && stats.invitedAt) {
    return { kind: 'invited', at: stats.invitedAt };
  }

  return { kind: 'never' };
};

/**
 * Whether the Billing tab warns that the client cannot use the portal yet. The condition is the one
 * the spec gives (portal status is not Active); there is no bank-connection feature to key off.
 */
export const shouldWarnAboutPortalAccess = (status: string | undefined): boolean =>
  status !== undefined && status !== 'active';

/** The single letter in an activity's dot. */
export const getActivityLetter = (category: ClientActivityCategory): string => {
  switch (category) {
    case 'project':
      return 'P';
    case 'request':
      return 'R';
    case 'invoice':
      return 'I';
    case 'chat':
      return 'M';
    default:
      return '✓';
  }
};

/** Whether the invite item makes sense: not for a client that already has portal access. */
export const canInviteClient = (status: string | undefined): boolean =>
  status !== undefined && status !== 'active';
