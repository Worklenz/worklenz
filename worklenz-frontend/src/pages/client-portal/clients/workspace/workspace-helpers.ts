/** The tabs of a client workspace, in display order. */
export const WORKSPACE_TABS = [
  'overview',
  'users',
  'projects',
  'approvals',
  'change-requests',
  'billing',
  'activity',
] as const;

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

export const DEFAULT_WORKSPACE_TAB: WorkspaceTab = 'overview';

/** Reads `?tab=`. Anything unknown opens Overview. */
export const parseWorkspaceTab = (value: string | null | undefined): WorkspaceTab =>
  (WORKSPACE_TABS as readonly string[]).includes(value ?? '')
    ? (value as WorkspaceTab)
    : DEFAULT_WORKSPACE_TAB;

export const CLIENTS_PATH = '/worklenz/client-portal/clients';

/** The one URL every entry point uses to open a client, so they all land in the same workspace. */
export const clientWorkspacePath = (clientId: string, tab?: WorkspaceTab): string =>
  `${CLIENTS_PATH}/${clientId}${tab && tab !== DEFAULT_WORKSPACE_TAB ? `?tab=${tab}` : ''}`;
