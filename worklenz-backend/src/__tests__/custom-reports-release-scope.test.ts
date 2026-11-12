jest.mock('../config/db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

import db from '../config/db';
import CustomReportsController from '../controllers/custom-reports-controller';
import type { IWorkLenzRequest } from '../interfaces/worklenz-request';
import type { IWorkLenzResponse } from '../interfaces/worklenz-response';

const projectId = '33333333-3333-4333-8333-333333333333';

describe('release report project scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);
  });

  it.each([
    ['items', 'rl.project_id = t.project_id'],
    ['releases', 't.project_id = r.project_id'],
  ])('restricts %s report release associations to the task project', async (source, projectJoin) => {
    const req = { body: { project_id: projectId, source, metric: 'count', group_by: 'release' } } as IWorkLenzRequest;
    const response = { status: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis() };
    await CustomReportsController.preview(req, response as unknown as IWorkLenzResponse);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(jest.mocked(db.query).mock.calls.some(([sql, params]) =>
      typeof sql === 'string' && sql.includes(projectJoin) && Array.isArray(params) && params[0] === projectId
    )).toBe(true);
  });
});
