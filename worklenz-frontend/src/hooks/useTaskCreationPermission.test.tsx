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

    expect(result).toEqual({ canCreateTask: false, canAddTask: false, isRestricted: false });
  });

  it('allows guests granted "Edit tasks" by the permission scheme', () => {
    const result = getTaskCreationPermission({
      session: makeSession('member'),
      project: { is_guest: true, role_permissions: { edit_tasks: true, delete_tasks: false, comment: true } },
      orgConfig: {},
    });

    expect(result).toEqual({ canCreateTask: true, canAddTask: true, isRestricted: false });
  });

  it('blocks members whose role lacks "Edit tasks"', () => {
    const result = getTaskCreationPermission({
      session: makeSession('member'),
      project: { role_permissions: { edit_tasks: false, delete_tasks: false, comment: true } },
      orgConfig: {},
    });

    expect(result).toEqual({ canCreateTask: false, canAddTask: false, isRestricted: false });
  });

  it('lets members add tasks with "Create tasks" even without "Edit tasks"', () => {
    const result = getTaskCreationPermission({
      session: makeSession('member'),
      project: {
        role_permissions: { create_tasks: true, edit_tasks: false, delete_tasks: false, comment: true },
      },
      orgConfig: {},
    });

    expect(result).toEqual({ canCreateTask: false, canAddTask: true, isRestricted: false });
  });

  it('blocks adding tasks when "Create tasks" is not granted', () => {
    const result = getTaskCreationPermission({
      session: makeSession('member'),
      project: {
        role_permissions: { create_tasks: false, edit_tasks: true, delete_tasks: true, comment: true },
      },
      orgConfig: {},
    });

    expect(result).toEqual({ canCreateTask: true, canAddTask: false, isRestricted: false });
  });

  it('keeps members view-only when the project restricts task creation', () => {
    const result = getTaskCreationPermission({
      session: makeSession('member', true),
      project: {
        restrict_task_creation: true,
        role_permissions: { create_tasks: true, edit_tasks: true, delete_tasks: true, comment: true },
      },
      orgConfig: {},
    });

    expect(result).toEqual({ canCreateTask: false, canAddTask: false, isRestricted: true });
  });

  it('allows privileged members to create tasks when restrictions are enabled', () => {
    const result = getTaskCreationPermission({
      session: makeSession('admin', true),
      project: { restrict_task_creation: true },
      orgConfig: {},
    });

    expect(result).toEqual({ canCreateTask: true, canAddTask: true, isRestricted: true });
  });

  it('blocks plain members from creating tasks when restrictions are enabled', () => {
    const result = getTaskCreationPermission({
      session: makeSession('member', true),
      project: { restrict_task_creation: true },
      orgConfig: {},
    });

    expect(result).toEqual({ canCreateTask: false, isRestricted: true });
  });

  it('allows project managers with member team role to create tasks when restrictions are enabled', () => {
    const result = getTaskCreationPermission({
      session: makeSession('member', true),
      project: { restrict_task_creation: true, is_project_manager: true },
      orgConfig: {},
    });

    expect(result).toEqual({ canCreateTask: true, isRestricted: true });
  });

  it('allows project managers via isProjectManager flag when project flag is absent', () => {
    const result = getTaskCreationPermission({
      session: makeSession('member', true),
      project: { restrict_task_creation: true },
      orgConfig: {},
      isProjectManager: true,
    });

    expect(result).toEqual({ canCreateTask: true, isRestricted: true });
  });
});
