import { describe, expect, it } from 'vitest';
import { getIsAssigneeTaskScopeActive } from '@/utils/assignee-task-scope';
import { ROLE_NAMES } from '@/types/roles/role.types';

/**
 * TVR-19 — frontend role matrix for the “Showing your tasks only” indicator.
 */
describe('getIsAssigneeTaskScopeActive (TVR-19 role matrix)', () => {
  const restrictedBase = {
    restrictTasksToAssignee: true,
    isOwnerOrAdmin: false,
    roleName: ROLE_NAMES.MEMBER,
    isProjectManager: false,
    isProjectGuest: false,
    isSessionGuest: false,
  };

  it('is inactive when the project setting is OFF', () => {
    expect(
      getIsAssigneeTaskScopeActive({
        ...restrictedBase,
        restrictTasksToAssignee: false,
      })
    ).toBe(false);
  });

  it.each([
    ['Owner/Admin', { isOwnerOrAdmin: true }],
    ['Team Lead', { roleName: ROLE_NAMES.TEAM_LEAD }],
    ['Guest (project)', { isProjectGuest: true }],
    ['Guest (session)', { isSessionGuest: true }],
    ['Project Manager', { isProjectManager: true }],
  ] as const)('%s is exempt (indicator off)', (_label, overrides) => {
    expect(
      getIsAssigneeTaskScopeActive({
        ...restrictedBase,
        ...overrides,
      })
    ).toBe(false);
  });

  it('Member with setting ON sees the indicator', () => {
    expect(getIsAssigneeTaskScopeActive(restrictedBase)).toBe(true);
  });
});
