import type { CompanyUser, CompanyUserPortalStatus } from '@/api/client-portal/company-users-api';

export const COMPANY_USER_STATUS_FILTER_VALUES: Array<'all' | CompanyUserPortalStatus> = [
  'all',
  'active',
  'invited',
  'not_invited',
  'expired',
  'disabled',
];

export type CompanyUserInviteAction = 'send' | 'resend';

export interface CompanyUserMenuState {
  /** The invite item is hidden for Active (already in) and Disabled (enable them first). */
  canInvite: boolean;
  /** "Send invite" before anything was sent, "Resend invite" afterwards. */
  inviteAction: CompanyUserInviteAction;
  isDisabled: boolean;
  pocAction: 'make' | 'remove';
}

/** Which row-menu items apply to a company user. Kept pure so the rules can be tested. */
export const getCompanyUserMenuState = (user: CompanyUser): CompanyUserMenuState => {
  const status = user.portal_status.status;

  return {
    canInvite: status !== 'active' && status !== 'disabled',
    inviteAction: status === 'not_invited' ? 'send' : 'resend',
    isDisabled: status === 'disabled',
    pocAction: user.role === 'poc' ? 'remove' : 'make',
  };
};

export type CompanyUserActivity =
  | { kind: 'signedIn'; at: string }
  | { kind: 'invited'; at: string }
  | { kind: 'never' };

export const getCompanyUserActivity = (user: CompanyUser): CompanyUserActivity => {
  if (user.last_login_at) return { kind: 'signedIn', at: user.last_login_at };

  const status = user.portal_status.status;
  if ((status === 'invited' || status === 'expired') && user.invited_at) {
    return { kind: 'invited', at: user.invited_at };
  }

  return { kind: 'never' };
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmailAddress = (value: string): boolean => EMAIL_PATTERN.test(value.trim());

/** Server messages come back as `{ data: { message } }` from RTK Query; anything else is unknown. */
export const getApiErrorMessage = (error: unknown): string | undefined => {
  const message = (error as { data?: { message?: unknown } } | undefined)?.data?.message;
  return typeof message === 'string' && message.trim() ? message : undefined;
};
