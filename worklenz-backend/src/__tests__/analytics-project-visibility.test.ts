jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../shared/reporting-analytics-permissions', () => ({ canViewAnalyticsReports: jest.fn().mockResolvedValue(true) }));
jest.mock('../shared/organization-permissions', () => ({ canViewAllProjects: jest.fn().mockResolvedValue(false) }));
jest.mock('../shared/analytics-expand-projects', () => ({
  parseAccessibleTeamIdsFromInput: jest.fn().mockResolvedValue([]),
  expandAccessibleProjects: jest.fn(async (_user, _team, ids) => ids),
}));
jest.mock('../shared/project-role-permissions', () => ({
  getVisibleProjectIds: jest.fn().mockResolvedValue(['visible-project']),
}));

import db from '../config/db';
import analyticsProjectAccessMiddleware from '../middlewares/analytics-project-access';
import { createMockRequest, createMockResponse } from '../tests/utils/express-mock';

const query = db.query as jest.Mock;
beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [{ id: 'visible-project' }, { id: 'hidden-project' }] });
});

it('excludes revoked projects from analytics selection', async () => {
  const req = createMockRequest({ user: { id: 'user', team_id: 'team', role_name: 'Member' } });
  const next = jest.fn();
  await analyticsProjectAccessMiddleware(req, createMockResponse(), next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(req.analyticsAccessibleProjectIds).toEqual(['visible-project']);
});

it('rejects a request containing only a revoked project', async () => {
  const req = createMockRequest({ query: { project_ids: 'hidden-project' },
    user: { id: 'user', team_id: 'team', role_name: 'Member' } });
  const res = createMockResponse(); const next = jest.fn();
  await analyticsProjectAccessMiddleware(req, res, next);
  expect(res.statusCode).toBe(403);
  expect(next).not.toHaveBeenCalled();
});
