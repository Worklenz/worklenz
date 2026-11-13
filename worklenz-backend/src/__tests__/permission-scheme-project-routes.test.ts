jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
import db from '../config/db';
import PermissionSchemesController from '../controllers/permission-schemes-controller';
import { createMockRequest, createMockResponse } from '../tests/utils/express-mock';
const query = db.query as jest.Mock;
describe('project scheme routes', () => {
  beforeEach(() => query.mockReset());
  it('uses the route id to look up a project scheme', async () => {
    query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 }).mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = createMockResponse();
    await PermissionSchemesController.getProjectScheme(createMockRequest({ params: { id: 'project-id' } }), res);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM projects'), ['project-id', 'team-123']);
    expect(res.statusCode).toBe(200);
    expect(res.body.body.project_id).toBe('project-id');
  });
  it('uses the route id to assign a project scheme', async () => {
    query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 }).mockResolvedValueOnce({ rows: [{ project_id: 'project-id', scheme_id: null }], rowCount: 1 });
    const res = createMockResponse();
    await PermissionSchemesController.assignProjectScheme(createMockRequest({ params: { id: 'project-id' }, body: { scheme_id: null } }), res);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO project_scheme_assignments'), ['project-id', null]);
    expect(res.statusCode).toBe(200);
  });
  it('uses the route id when adding a scheme member', async () => {
    query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 }).mockResolvedValueOnce({ rows: [{}], rowCount: 1 }).mockResolvedValueOnce({ rows: [{}], rowCount: 1 }).mockResolvedValueOnce({ rows: [{ id: 'assignment-id' }], rowCount: 1 });
    const res = createMockResponse();
    await PermissionSchemesController.addSchemeMember(createMockRequest({ params: { id: 'project-id' }, body: { scheme_id: 'scheme-id', role_name: 'Member', team_member_id: 'member-id' } }), res);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO scheme_role_members'), ['project-id', 'scheme-id', 'Member', 'member-id', null]);
    expect(res.statusCode).toBe(200);
  });
});
