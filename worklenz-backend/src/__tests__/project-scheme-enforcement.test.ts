jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../shared/project-role-permissions', () => ({
  checkProjectRolePermission: jest.fn(), checkTaskRolePermission: jest.fn(),
}));
jest.mock('../shared/assignee-task-scope', () => ({
  canUserAccessTaskDetail: jest.fn().mockResolvedValue(true),
  canUserEditTask: jest.fn().mockResolvedValue(true),
}));
import db from '../config/db';
import { checkProjectRolePermission, checkTaskRolePermission } from '../shared/project-role-permissions';
import { PROJECT_ROLE_PERMISSIONS } from '../shared/organization-permissions';
import { verifyNonGuestProjectAccess } from '../middlewares/verify-project-access';
import { verifyNonGuestTaskAccess, verifyBulkTaskAccessMiddleware } from '../middlewares/verify-task-access';
import { verifyNonGuestTaskAccessSocket } from '../socket.io/authorization';
import { createMockRequest, createMockResponse } from '../tests/utils/express-mock';

const query = db.query as jest.Mock;
const projectCheck = checkProjectRolePermission as jest.Mock;
const taskCheck = checkTaskRolePermission as jest.Mock;
beforeEach(() => { query.mockReset(); projectCheck.mockReset(); taskCheck.mockReset(); });

describe('project scheme enforcement', () => {
  it.each([true, false])('applies create permission to project requests (allowed=%s)', async allowed => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    projectCheck.mockResolvedValueOnce({ allowed });
    const req = createMockRequest({ body: { project_id: 'project' } });
    const res = createMockResponse(); const next = jest.fn();
    await verifyNonGuestProjectAccess('body', 'project_id', PROJECT_ROLE_PERMISSIONS.CREATE_TASKS)(req, res, next);
    expect(projectCheck).toHaveBeenCalledWith('user-123', 'project', PROJECT_ROLE_PERMISSIONS.CREATE_TASKS);
    expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
    if (!allowed) expect(res.statusCode).toBe(403);
  });
  it.each([true, false])('applies task grants to HTTP mutations (allowed=%s)', async allowed => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    taskCheck.mockResolvedValueOnce({ allowed });
    const res = createMockResponse(); const next = jest.fn();
    await verifyNonGuestTaskAccess('params', 'id', PROJECT_ROLE_PERMISSIONS.DELETE_TASKS)(createMockRequest({ params: { id: 'task' } }), res, next);
    expect(taskCheck).toHaveBeenCalledWith('user-123', 'task', PROJECT_ROLE_PERMISSIONS.DELETE_TASKS);
    expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
    if (!allowed) expect(res.statusCode).toBe(403);
  });
  it('denies a bulk mutation if any project denies its grant', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'task' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ project_id: 'project' }] });
    projectCheck.mockResolvedValueOnce({ allowed: false });
    const res = createMockResponse(); const next = jest.fn();
    await verifyBulkTaskAccessMiddleware()(createMockRequest({ body: { tasks: ['task'] } }), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
  it('denies socket task updates when the scheme denies edit', async () => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    taskCheck.mockResolvedValueOnce({ allowed: false });
    const socket = { request: { session: { passport: { user: { id: 'user-123' } } } } };
    expect(await verifyNonGuestTaskAccessSocket(socket as never, 'task')).toBe(false);
    expect(taskCheck).toHaveBeenCalledWith('user-123', 'task', PROJECT_ROLE_PERMISSIONS.EDIT_TASKS);
  });
});
