jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
import db from '../config/db';
import { checkProjectRolePermission, getVisibleProjectIds } from '../shared/project-role-permissions';
import { PROJECT_ROLE_PERMISSIONS } from '../shared/organization-permissions';

const query = db.query as jest.Mock;
const context = (overrides: Record<string, unknown> = {}) => ({
  team_id: 'team', project_id: 'project', role_name: 'Member', owner: false,
  is_team_guest: false, is_project_member: true, is_project_guest: false, assigned_roles: [],
  ...overrides,
});
beforeEach(() => query.mockReset());

describe('assigned project scheme roles', () => {
  it('uses the assigned role instead of the team role', async () => {
    query.mockResolvedValueOnce({ rows: [context({ assigned_roles: ['Team Lead'] })] })
      .mockResolvedValueOnce({ rows: [{ permission: PROJECT_ROLE_PERMISSIONS.MANAGE_MEMBERS, granted: true, is_default: false }] });
    const result = await checkProjectRolePermission('user', 'project', PROJECT_ROLE_PERMISSIONS.MANAGE_MEMBERS);
    expect(result.allowed).toBe(true);
    expect(query.mock.calls[1][1][2]).toBe('Team Lead');
    expect(query.mock.calls[0][0]).toContain('permission_group_members');
    expect(query.mock.calls[0][0]).toContain('srm.scheme_id = psa.scheme_id');
  });
  it('unions grants from multiple assigned roles', async () => {
    query.mockResolvedValueOnce({ rows: [context({ assigned_roles: ['Member', 'Team Lead'] })] })
      .mockResolvedValueOnce({ rows: [{ permission: PROJECT_ROLE_PERMISSIONS.DELETE_TASKS, granted: false, is_default: false }] })
      .mockResolvedValueOnce({ rows: [{ permission: PROJECT_ROLE_PERMISSIONS.DELETE_TASKS, granted: true, is_default: false }] });
    expect((await checkProjectRolePermission('user', 'project', PROJECT_ROLE_PERMISSIONS.DELETE_TASKS)).allowed).toBe(true);
  });
  it('falls back to the team role when no scheme role is assigned', async () => {
    query.mockResolvedValueOnce({ rows: [context()] }).mockResolvedValueOnce({ rows: [] });
    expect((await checkProjectRolePermission('user', 'project', PROJECT_ROLE_PERMISSIONS.EDIT_TASKS)).allowed).toBe(true);
    expect(query.mock.calls[1][1][2]).toBe('Member');
  });
  it('does not grant project mutations to an unassigned project member', async () => {
    query.mockResolvedValueOnce({ rows: [context({ is_project_member: false, assigned_roles: ['Admin'] })] })
      .mockResolvedValueOnce({ rows: [] });
    expect((await checkProjectRolePermission('user', 'project', PROJECT_ROLE_PERMISSIONS.EDIT_TASKS)).allowed).toBe(false);
    expect(query).toHaveBeenCalledTimes(2);
  });
  it('denies task mutations when project visibility is revoked', async () => {
    query.mockResolvedValueOnce({ rows: [context()] }).mockResolvedValueOnce({ rows: [
      { permission: PROJECT_ROLE_PERMISSIONS.VIEW_PROJECT, granted: false, is_default: false },
      { permission: PROJECT_ROLE_PERMISSIONS.EDIT_TASKS, granted: true, is_default: false },
    ] });
    expect((await checkProjectRolePermission('user', 'project', PROJECT_ROLE_PERMISSIONS.EDIT_TASKS)).allowed).toBe(false);
  });
  it('preserves the actual owner override', async () => {
    query.mockResolvedValueOnce({ rows: [context({ owner: true, assigned_roles: ['Guest'] })] });
    expect((await checkProjectRolePermission('user', 'project', PROJECT_ROLE_PERMISSIONS.DELETE_TASKS)).allowed).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('filters aggregate projects using assigned roles and project grants', async () => {
    query.mockResolvedValueOnce({ rows: [
      context({ project_id: 'visible', assigned_scheme_id: 'scheme', assigned_roles: ['Team Lead'] }),
      context({ project_id: 'hidden', assigned_scheme_id: 'scheme', assigned_roles: ['Guest'] }),
      context({ project_id: 'owner', owner: true, assigned_scheme_id: 'scheme', assigned_roles: ['Guest'] }),
    ] }).mockResolvedValueOnce({ rows: [
      { scheme_id: 'scheme', is_default: false, role_name: 'Team Lead', granted: true },
      { scheme_id: 'scheme', is_default: false, role_name: 'Guest', granted: false },
    ] });
    expect(await getVisibleProjectIds('user', 'team')).toEqual(['visible', 'owner']);
    expect(query).toHaveBeenCalledTimes(2);
  });
  it('applies default view grants when a project scheme does not override them', async () => {
    query.mockResolvedValueOnce({ rows: [context({ project_id: 'project', assigned_scheme_id: 'scheme' })] })
      .mockResolvedValueOnce({ rows: [{ scheme_id: 'default', is_default: true, role_name: 'Member', granted: false }] });
    expect(await getVisibleProjectIds('user', 'team')).toEqual([]);
  });
});
