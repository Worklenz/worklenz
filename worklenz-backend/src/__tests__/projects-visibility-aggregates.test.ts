jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../shared/project-role-permissions', () => ({
  getVisibleProjectIds: jest.fn().mockResolvedValue(['visible-project']),
  getProjectRolePermissionFlags: jest.fn(),
}));

import db from '../config/db';
import ProjectsController from '../controllers/projects-controller';
import { createMockRequest, createMockResponse } from '../tests/utils/express-mock';

const query = db.query as jest.Mock;
const request = () => createMockRequest({ query: {}, user: {
  id: 'user-123', team_id: 'team-123', role_name: 'Member',
} });

beforeEach(() => query.mockReset());

describe('project visibility in aggregate responses', () => {
  it('filters paginated project rows and totals', async () => {
    query.mockResolvedValue({ rows: [{ projects: { total: 0, data: [] } }] });
    await ProjectsController.getMyProjects(request(), createMockResponse());
    const [sql, params] = query.mock.calls[0];
    expect(sql.match(/projects\.id = ANY\(\$\d+::UUID\[\]\)/g)).toHaveLength(2);
    expect(params.at(-1)).toEqual(['visible-project']);
  });

  it('filters task rows and totals by visible project', async () => {
    query.mockResolvedValue({ rows: [{ projects: { total: 0, data: [] } }] });
    await ProjectsController.getAllTasks(request(), createMockResponse());
    const [sql, params] = query.mock.calls[0];
    expect(sql.match(/p\.id = ANY\(\$\d+::UUID\[\]\)/g)).toHaveLength(2);
    expect(params.at(-1)).toEqual(['visible-project']);
  });

  it('filters grouped project counts and nested rows', async () => {
    query.mockResolvedValue({ rows: [{ groups: { total_groups: 0, total_projects: 0, data: [] } }] });
    await ProjectsController.getGrouped(request(), createMockResponse());
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('p2.id = ANY(');
    expect(sql.match(/projects\.id = ANY\(\$\d+::UUID\[\]\)/g)).toHaveLength(2);
    expect(params.at(-1)).toEqual(['visible-project']);
  });

  it('limits the project selector to visible IDs', async () => {
    query.mockResolvedValue({ rows: [] });
    await ProjectsController.getAllProjects(request(), createMockResponse());
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('id = ANY($2::UUID[])');
    expect(params[1]).toEqual(['visible-project']);
  });
});
