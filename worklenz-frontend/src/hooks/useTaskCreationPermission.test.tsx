import { describe, expect, it } from 'vitest';
import { getTaskCreationPermission } from './useTaskCreationPermission';
import { ILocalSession } from '@/types/auth/local-session.types';

const makeSession = (roleName = 'member', businessPlan = false): ILocalSession => ({
  role_name: roleName,
  owner: false,
  subscription_type: businessPlan ? 'ANNUAL_BUSINESS' : 'FREE',
});

describe('getTaskCreationPermission', () => {
  it('blocks guest users from creating tasks even without task creation restrictions', () => {
    const result = getTaskCreationPermission({
      session: makeSession('member'),
      project: { is_guest: true },
      orgConfig: {},
    });

    expect(result).toEqual({ canCreateTask: false, isRestricted: false });
  });

  it('allows privileged members to create tasks when restrictions are enabled', () => {
    const result = getTaskCreationPermission({
      session: makeSession('admin', true),
      project: { restrict_task_creation: true },
      orgConfig: {},
    });

    expect(result).toEqual({ canCreateTask: true, isRestricted: true });
  });
});
