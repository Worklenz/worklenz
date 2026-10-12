import { describe, expect, it } from 'vitest';
import type { CompanyUser, CompanyUserPortalStatus } from '@/api/client-portal/company-users-api';
import {
  getApiErrorMessage,
  getCompanyUserActivity,
  getCompanyUserMenuState,
  isValidEmailAddress,
} from './company-users-helpers';

const buildUser = (
  status: CompanyUserPortalStatus,
  overrides: Partial<CompanyUser> = {}
): CompanyUser => ({
  id: 'u1',
  client_id: 'c1',
  company_name: 'Brandbase',
  name: 'Alex Chen',
  email: 'alex@brandbase.com',
  phone: null,
  job_title: null,
  role: 'member',
  has_login: status === 'active',
  last_login_at: null,
  invited_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  portal_status: { status, label: status, color: 'default' },
  project_count: 0,
  projects: [],
  ...overrides,
});

describe('getCompanyUserMenuState', () => {
  it('offers "send" before anything was sent and "resend" afterwards', () => {
    expect(getCompanyUserMenuState(buildUser('not_invited'))).toMatchObject({
      canInvite: true,
      inviteAction: 'send',
    });
    expect(getCompanyUserMenuState(buildUser('invited'))).toMatchObject({
      canInvite: true,
      inviteAction: 'resend',
    });
    expect(getCompanyUserMenuState(buildUser('expired'))).toMatchObject({
      canInvite: true,
      inviteAction: 'resend',
    });
  });

  it('hides the invite item once disabled, and for someone who already has access', () => {
    expect(getCompanyUserMenuState(buildUser('disabled')).canInvite).toBe(false);
    expect(getCompanyUserMenuState(buildUser('active')).canInvite).toBe(false);
  });

  it('shows Enable only for a disabled user', () => {
    expect(getCompanyUserMenuState(buildUser('disabled')).isDisabled).toBe(true);
    expect(getCompanyUserMenuState(buildUser('invited')).isDisabled).toBe(false);
  });

  it('flips the POC action with the current role', () => {
    expect(getCompanyUserMenuState(buildUser('active', { role: 'member' })).pocAction).toBe('make');
    expect(getCompanyUserMenuState(buildUser('active', { role: 'poc' })).pocAction).toBe('remove');
  });
});

describe('getCompanyUserActivity', () => {
  it('prefers the last sign-in', () => {
    expect(
      getCompanyUserActivity(buildUser('active', { last_login_at: '2026-02-01T00:00:00.000Z' }))
    ).toEqual({ kind: 'signedIn', at: '2026-02-01T00:00:00.000Z' });
  });

  it('falls back to when the invite was sent, for invited and expired users only', () => {
    const invitedAt = '2026-02-01T00:00:00.000Z';

    expect(getCompanyUserActivity(buildUser('invited', { invited_at: invitedAt }))).toEqual({
      kind: 'invited',
      at: invitedAt,
    });
    expect(getCompanyUserActivity(buildUser('expired', { invited_at: invitedAt }))).toEqual({
      kind: 'invited',
      at: invitedAt,
    });
    expect(getCompanyUserActivity(buildUser('disabled', { invited_at: invitedAt }))).toEqual({
      kind: 'never',
    });
  });

  it('says never when nothing happened', () => {
    expect(getCompanyUserActivity(buildUser('not_invited'))).toEqual({ kind: 'never' });
  });
});

describe('isValidEmailAddress', () => {
  it('accepts a normal address and ignores surrounding spaces', () => {
    expect(isValidEmailAddress('  jane@company.com ')).toBe(true);
  });

  it.each(['', 'jane', 'jane@', '@company.com', 'jane@company', 'ja ne@company.com'])(
    'rejects %j',
    value => expect(isValidEmailAddress(value)).toBe(false)
  );
});

describe('getApiErrorMessage', () => {
  it('reads the server message from an RTK Query error', () => {
    expect(getApiErrorMessage({ status: 409, data: { message: 'Already a contact' } })).toBe(
      'Already a contact'
    );
  });

  it('returns undefined for anything else', () => {
    expect(getApiErrorMessage(undefined)).toBeUndefined();
    expect(getApiErrorMessage({ data: { message: '   ' } })).toBeUndefined();
    expect(getApiErrorMessage(new Error('boom'))).toBeUndefined();
  });
});
