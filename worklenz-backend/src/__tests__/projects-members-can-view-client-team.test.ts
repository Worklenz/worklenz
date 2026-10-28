jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock('../shared/project-access', () => ({
  getProjectAccessForRequest: jest.fn(),
}));

jest.mock('../services/project-settings-audit.service', () => ({
  captureProjectSettings: jest.fn().mockResolvedValue({}),
  logProjectSettingChanges: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/activity-logging.service', () => ({
  ActivityLoggingService: {
    logProjectUpdated: jest.fn().mockResolvedValue(undefined),
    logProjectCreated: jest.fn().mockResolvedValue(undefined),
  },
}));

import db from '../config/db';
import { getProjectAccessForRequest } from '../shared/project-access';
import { createMockRequest, createMockResponse } from '../tests/utils/express-mock';
import ProjectsController from '../controllers/projects-controller';

const mockedDbQuery = db.query as jest.Mock;
const mockedGetProjectAccess = getProjectAccessForRequest as jest.Mock;

describe('ProjectsController - members_can_view_client_team toggle persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists members_can_view_client_team to the database when updating project settings', async () => {
    mockedGetProjectAccess.mockResolvedValue({
      permissions: {
        settings: true,
        assignPm: true,
        move: true,
      },
    });

    // Provide query responses for:
    // 1. SELECT previousManagers
    // 2. SELECT update_project($1) AS project
    // 3. UPDATE projects SET members_can_view_client_team = $1 ...
    // 4. setProjectPriority query
    mockedDbQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT update_project')) {
        return Promise.resolve({
          rows: [{ project: { id: 'project-123', name: 'Alpha Project' } }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const req = createMockRequest({
      user: {
        id: 'user-123',
        team_id: 'team-123',
        organization_id: 'org-123',
      },
      params: {
        id: 'project-123',
      },
      body: {
        name: 'Alpha Project',
        key: 'ALP',
        members_can_view_client_team: true,
      },
    });
    const res = createMockResponse();

    await ProjectsController.update(req, res);

    expect(res.statusCode).toBe(200);

    const updateCalls = mockedDbQuery.mock.calls.filter(([sql]: [string]) =>
      sql.includes('UPDATE projects') && sql.includes('members_can_view_client_team = $1')
    );

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0][1]).toEqual([true, 'project-123', 'team-123']);
  });

  it('rejects non-boolean members_can_view_client_team input', async () => {
    mockedGetProjectAccess.mockResolvedValue({
      permissions: {
        settings: true,
        assignPm: true,
        move: true,
      },
    });

    const req = createMockRequest({
      user: {
        id: 'user-123',
        team_id: 'team-123',
      },
      params: {
        id: 'project-123',
      },
      body: {
        name: 'Alpha Project',
        key: 'ALP',
        members_can_view_client_team: 'invalid-string',
      },
    });
    const res = createMockResponse();

    await ProjectsController.update(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.done).toBe(false);
    expect(res.body?.message).toContain('members_can_view_client_team must be a boolean');

    const updateCalls = mockedDbQuery.mock.calls.filter(([sql]: [string]) =>
      sql.includes('members_can_view_client_team')
    );
    expect(updateCalls.length).toBe(0);
  });
});
