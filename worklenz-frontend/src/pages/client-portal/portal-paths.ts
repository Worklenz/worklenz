/**
 * Every Client Portal admin URL in one place, so lists, workspace tabs, notifications and the
 * "Needs attention" rows all open an item at exactly the same address.
 */
export const PORTAL_ROOT = '/worklenz/client-portal';

export const PROJECT_TABS = [
  'overview',
  'milestones',
  'tasks',
  'files',
  'discussions',
  'access',
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number];

export const DEFAULT_PROJECT_TAB: ProjectTab = 'overview';

export const parseProjectTab = (value: string | null | undefined): ProjectTab =>
  (PROJECT_TABS as readonly string[]).includes(value ?? '') ? (value as ProjectTab) : DEFAULT_PROJECT_TAB;

export type ChangeRequestTab = 'request' | 'conversation' | 'assessment' | 'work' | 'history';

export const portalPaths = {
  overview: `${PORTAL_ROOT}/overview`,
  invoices: `${PORTAL_ROOT}/invoices`,
  clients: `${PORTAL_ROOT}/clients`,
  projects: `${PORTAL_ROOT}/projects`,
  project: (projectId: string, tab: ProjectTab = DEFAULT_PROJECT_TAB) =>
    `${PORTAL_ROOT}/projects/${projectId}${tab === DEFAULT_PROJECT_TAB ? '' : `/${tab}`}`,
  approvals: `${PORTAL_ROOT}/approvals`,
  approval: (approvalId: string) => `${PORTAL_ROOT}/approvals/${approvalId}`,
  newApproval: (params?: { organizationId?: string; projectId?: string }) => {
    const query = new URLSearchParams();
    if (params?.organizationId) query.set('organization_id', params.organizationId);
    if (params?.projectId) query.set('project_id', params.projectId);
    const suffix = query.toString();
    return `${PORTAL_ROOT}/approvals/new${suffix ? `?${suffix}` : ''}`;
  },
  changeRequests: `${PORTAL_ROOT}/change-requests`,
  /** `tab` opens the detail modal on that tab; `action: 'convert'` also opens the Convert to work dialog. */
  changeRequest: (changeRequestId: string, options?: { tab?: ChangeRequestTab; action?: 'convert' }) => {
    const suffix = new URLSearchParams(options as Record<string, string> | undefined).toString();
    return `${PORTAL_ROOT}/change-requests/${changeRequestId}${suffix ? `?${suffix}` : ''}`;
  },
  discussions: `${PORTAL_ROOT}/discussions`,
  discussion: (threadId: string) => `${PORTAL_ROOT}/discussions/${threadId}`,
  audit: (organizationId?: string) =>
    `${PORTAL_ROOT}/audit-log${organizationId ? `?organization_id=${organizationId}` : ''}`,
  newQuote: (changeRequestId?: string) =>
    `${PORTAL_ROOT}/quotes/create${changeRequestId ? `?changeRequestId=${changeRequestId}` : ''}`,
  newInvoice: (changeRequestId?: string) =>
    `${PORTAL_ROOT}/invoices/create${changeRequestId ? `?changeRequestId=${changeRequestId}` : ''}`,
  preview: `${PORTAL_ROOT}/preview`,
  settings: `${PORTAL_ROOT}/settings`,
};
