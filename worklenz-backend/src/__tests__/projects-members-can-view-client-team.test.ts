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

  describe('ProjectsController.update', () => {
    it('passes members_can_view_client_team in update_project payload when user has settings permission', async () => {
      mockedGetProjectAccess.mockResolvedValue({
        permissions: {
          settings: true,
          assignPm: true,
          move: true,
        },
      });

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

      const updateProjectCall = mockedDbQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('SELECT update_project')
      );

      expect(updateProjectCall).toBeDefined();
      const payload = JSON.parse(updateProjectCall[1][0]);
      expect(payload.members_can_view_client_team).toBe(true);
    });

    it('removes members_can_view_client_team from payload when canUpdateProjectPrivacy is false', async () => {
      mockedGetProjectAccess.mockResolvedValue({
        permissions: {
          settings: false,
          assignPm: false,
          move: false,
        },
      });

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

      const updateProjectCall = mockedDbQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('SELECT update_project')
      );

      expect(updateProjectCall).toBeDefined();
      const payload = JSON.parse(updateProjectCall[1][0]);
      expect(payload).not.toHaveProperty('members_can_view_client_team');
    });

    it('rejects non-boolean members_can_view_client_team input on update', async () => {
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

      const updateProjectCalls = mockedDbQuery.mock.calls.filter(([sql]: [string]) =>
        sql.includes('SELECT update_project')
      );
      expect(updateProjectCalls.length).toBe(0);
    });
  });

  describe('ProjectsController.create', () => {
    it('passes members_can_view_client_team set to false in create_project payload', async () => {
      mockedDbQuery.mockImplementation((sql: string) => {
        if (sql.includes('SELECT create_project')) {
          return Promise.resolve({
            rows: [{ project: { id: 'project-456', name: 'Beta Project' } }],
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
        body: {
          name: 'Beta Project',
          members_can_view_client_team: false,
        },
      });
      const res = createMockResponse();

      await ProjectsController.create(req, res);

      expect(res.statusCode).toBe(200);

      const createProjectCall = mockedDbQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('SELECT create_project')
      );

      expect(createProjectCall).toBeDefined();
      const payload = JSON.parse(createProjectCall[1][0]);
      expect(payload.members_can_view_client_team).toBe(false);
    });

    it('rejects non-boolean members_can_view_client_team input on create', async () => {
      const req = createMockRequest({
        user: {
          id: 'user-123',
          team_id: 'team-123',
        },
        body: {
          name: 'Beta Project',
          members_can_view_client_team: 12345,
        },
      });
      const res = createMockResponse();

      await ProjectsController.create(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body?.done).toBe(false);
      expect(res.body?.message).toContain('members_can_view_client_team must be a boolean');

      const createProjectCalls = mockedDbQuery.mock.calls.filter(([sql]: [string]) =>
        sql.includes('SELECT create_project')
      );
      expect(createProjectCalls.length).toBe(0);
    });
  });
});
