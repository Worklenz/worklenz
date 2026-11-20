jest.mock('../config/db', () => {
  const mockDb: any = {
    query: jest.fn(),
    pool: {
      connect: jest.fn(),
    },
  };
  mockDb.pool.connect = jest.fn(() => Promise.resolve({
    query: jest.fn((...args: any[]) => mockDb.query(...args)),
    release: jest.fn(),
  }));
  return {
    __esModule: true,
    default: mockDb,
  };
});

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
    logProjectArchived: jest.fn().mockResolvedValue(undefined),
    logProjectActivity: jest.fn().mockResolvedValue(undefined),
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
    it('normalizes a string false before applying project settings', async () => {
      const req = createMockRequest({ body: { phase_assignees_enabled: 'false' } });
      const res = createMockResponse();
      await ProjectsController.update(req, res);
      expect(req.body.phase_assignees_enabled).toBe(false);
    });

    it('rejects invalid phase assignee settings', async () => {
      const req = createMockRequest({ body: { phase_assignees_enabled: 'yes' } });
      const res = createMockResponse();
      await ProjectsController.update(req, res);
      expect(res.statusCode).toBe(400);
    });
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
    it('continues enforcing the Free project limit in cloud deployments', async () => {
      const previousMode = process.env.WORKLENZ_DEPLOYMENT_MODE;
      process.env.WORKLENZ_DEPLOYMENT_MODE = 'cloud';
      try {
        mockedDbQuery.mockImplementation((sql: string) => Promise.resolve({
          rows: sql.includes('licensing_settings') ? [{ projects_limit: '3' }] : [{ count: '3' }],
        }));
        const req = createMockRequest({
          user: { id: 'user-123', team_id: 'team-123', owner_id: 'owner-123', subscription_status: 'free' },
          body: { name: 'Beta Project' },
        });
        const res = createMockResponse();

        await ProjectsController.create(req, res);

        expect(res.body?.done).toBe(false);
        expect(mockedDbQuery.mock.calls.some(([sql]: [string]) => sql.includes('SELECT create_project'))).toBe(false);
      } finally {
        if (previousMode === undefined) delete process.env.WORKLENZ_DEPLOYMENT_MODE;
        else process.env.WORKLENZ_DEPLOYMENT_MODE = previousMode;
      }
    });
    it('does not apply the Free project limit on self-hosted installations', async () => {
      const previousMode = process.env.WORKLENZ_DEPLOYMENT_MODE;
      process.env.WORKLENZ_DEPLOYMENT_MODE = 'self_hosted';
      try {
        mockedDbQuery.mockImplementation((sql: string) => Promise.resolve({
          rows: sql.includes('SELECT create_project') ? [{ project: { id: 'project-456', name: 'Beta Project' } }] : [],
        }));
        const req = createMockRequest({
          user: { id: 'user-123', team_id: 'team-123', owner_id: 'owner-123', subscription_status: 'free' },
          body: { name: 'Beta Project' },
        });
        const res = createMockResponse();

        await ProjectsController.create(req, res);

        expect(mockedDbQuery.mock.calls.some(([sql]: [string]) => sql.includes('SELECT create_project'))).toBe(true);
        expect(mockedDbQuery.mock.calls.some(([sql]: [string]) => sql.includes('FROM licensing_settings'))).toBe(false);
      } finally {
        if (previousMode === undefined) delete process.env.WORKLENZ_DEPLOYMENT_MODE;
        else process.env.WORKLENZ_DEPLOYMENT_MODE = previousMode;
      }
    });
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

  describe('ProjectsController.toggleArchiveAll', () => {
    it('blocks restoring an archived project when Free plan project limit is reached in cloud', async () => {
      const previousMode = process.env.WORKLENZ_DEPLOYMENT_MODE;
      process.env.WORKLENZ_DEPLOYMENT_MODE = 'cloud';
      try {
        mockedDbQuery.mockImplementation((sql: string) => {
          if (sql.includes('archived_for_team') && sql.includes('WHERE p.id = $1')) {
            return Promise.resolve({
              rows: [{ name: 'Alpha Project', archived_for_team: true, is_archived: true }],
            });
          }
          if (sql.includes('licensing_settings')) {
            return Promise.resolve({ rows: [{ projects_limit: '3' }] });
          }
          if (sql.includes('COUNT(*)')) {
            return Promise.resolve({ rows: [{ count: '3' }] });
          }
          return Promise.resolve({ rows: [{ toggle_archive_all_projects: [] }] });
        });

        const req = createMockRequest({
          params: { id: 'project-123' },
          user: { id: 'user-123', team_id: 'team-123', owner_id: 'owner-123', subscription_status: 'free' },
        });
        const res = createMockResponse();

        await ProjectsController.toggleArchiveAll(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body?.done).toBe(false);
        expect(res.body?.message).toContain('free plan cannot have more than 3 projects');
        expect(mockedDbQuery.mock.calls.some(([sql]: [string]) => sql.includes('toggle_archive_all_projects'))).toBe(false);
      } finally {
        if (previousMode === undefined) delete process.env.WORKLENZ_DEPLOYMENT_MODE;
        else process.env.WORKLENZ_DEPLOYMENT_MODE = previousMode;
      }
    });

    it('allows restoring an archived project when under the Free project limit', async () => {
      const previousMode = process.env.WORKLENZ_DEPLOYMENT_MODE;
      process.env.WORKLENZ_DEPLOYMENT_MODE = 'cloud';
      try {
        mockedDbQuery.mockImplementation((sql: string) => {
          if (sql.includes('archived_for_team') && sql.includes('WHERE p.id = $1')) {
            return Promise.resolve({
              rows: [{ name: 'Alpha Project', archived_for_team: true, is_archived: true }],
            });
          }
          if (sql.includes('licensing_settings')) {
            return Promise.resolve({ rows: [{ projects_limit: '3' }] });
          }
          if (sql.includes('COUNT(*)')) {
            return Promise.resolve({ rows: [{ count: '2' }] });
          }
          return Promise.resolve({ rows: [{ toggle_archive_all_projects: [] }] });
        });

        const req = createMockRequest({
          params: { id: 'project-123' },
          user: { id: 'user-123', team_id: 'team-123', owner_id: 'owner-123', subscription_status: 'free' },
        });
        const res = createMockResponse();

        await ProjectsController.toggleArchiveAll(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body?.done).toBe(true);
        expect(mockedDbQuery.mock.calls.some(([sql]: [string]) => sql.includes('toggle_archive_all_projects'))).toBe(true);
      } finally {
        if (previousMode === undefined) delete process.env.WORKLENZ_DEPLOYMENT_MODE;
        else process.env.WORKLENZ_DEPLOYMENT_MODE = previousMode;
      }
    });

    it('allows restoring on self-hosted installations regardless of active count', async () => {
      const previousMode = process.env.WORKLENZ_DEPLOYMENT_MODE;
      process.env.WORKLENZ_DEPLOYMENT_MODE = 'self_hosted';
      try {
        mockedDbQuery.mockImplementation((sql: string) => {
          if (sql.includes('archived_for_team') && sql.includes('WHERE p.id = $1')) {
            return Promise.resolve({
              rows: [{ name: 'Alpha Project', archived_for_team: true, is_archived: true }],
            });
          }
          return Promise.resolve({ rows: [{ toggle_archive_all_projects: [] }] });
        });

        const req = createMockRequest({
          params: { id: 'project-123' },
          user: { id: 'user-123', team_id: 'team-123', owner_id: 'owner-123', subscription_status: 'free' },
        });
        const res = createMockResponse();

        await ProjectsController.toggleArchiveAll(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body?.done).toBe(true);
        expect(mockedDbQuery.mock.calls.some(([sql]: [string]) => sql.includes('toggle_archive_all_projects'))).toBe(true);
        expect(mockedDbQuery.mock.calls.some(([sql]: [string]) => sql.includes('FROM licensing_settings'))).toBe(false);
      } finally {
        if (previousMode === undefined) delete process.env.WORKLENZ_DEPLOYMENT_MODE;
        else process.env.WORKLENZ_DEPLOYMENT_MODE = previousMode;
      }
    });

    it('allows archiving an active project even when at the limit, even if user personally archived it', async () => {
      const previousMode = process.env.WORKLENZ_DEPLOYMENT_MODE;
      process.env.WORKLENZ_DEPLOYMENT_MODE = 'cloud';
      try {
        mockedDbQuery.mockImplementation((sql: string) => {
          if (sql.includes('archived_for_team') && sql.includes('WHERE p.id = $1')) {
            return Promise.resolve({
              rows: [{ name: 'Alpha Project', archived_for_team: false, is_archived: true }],
            });
          }
          return Promise.resolve({ rows: [{ toggle_archive_all_projects: [] }] });
        });

        const req = createMockRequest({
          params: { id: 'project-123' },
          user: { id: 'user-123', team_id: 'team-123', owner_id: 'owner-123', subscription_status: 'free' },
        });
        const res = createMockResponse();

        await ProjectsController.toggleArchiveAll(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body?.done).toBe(true);
        expect(mockedDbQuery.mock.calls.some(([sql]: [string]) => sql.includes('toggle_archive_all_projects'))).toBe(true);
        expect(mockedDbQuery.mock.calls.some(([sql]: [string]) => sql.includes('FROM licensing_settings'))).toBe(false);
      } finally {
        if (previousMode === undefined) delete process.env.WORKLENZ_DEPLOYMENT_MODE;
        else process.env.WORKLENZ_DEPLOYMENT_MODE = previousMode;
      }
    });

    it('uses pg_advisory_xact_lock to ensure atomic restore quota check', async () => {
      const previousMode = process.env.WORKLENZ_DEPLOYMENT_MODE;
      process.env.WORKLENZ_DEPLOYMENT_MODE = 'cloud';
      try {
        mockedDbQuery.mockImplementation((sql: string) => {
          if (sql.includes('archived_for_team') && sql.includes('WHERE p.id = $1')) {
            return Promise.resolve({
              rows: [{ name: 'Alpha Project', archived_for_team: true, is_archived: false }],
            });
          }
          if (sql.includes('licensing_settings')) {
            return Promise.resolve({ rows: [{ projects_limit: '3' }] });
          }
          if (sql.includes('COUNT(*)')) {
            return Promise.resolve({ rows: [{ count: '1' }] });
          }
          return Promise.resolve({ rows: [{ toggle_archive_all_projects: [] }] });
        });

        const req = createMockRequest({
          params: { id: 'project-123' },
          user: { id: 'user-123', team_id: 'team-123', owner_id: 'owner-123', subscription_status: 'free' },
        });
        const res = createMockResponse();

        await ProjectsController.toggleArchiveAll(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body?.done).toBe(true);
        expect(mockedDbQuery.mock.calls.some(([sql]: [string]) => sql.includes('pg_advisory_xact_lock'))).toBe(true);
      } finally {
        if (previousMode === undefined) delete process.env.WORKLENZ_DEPLOYMENT_MODE;
        else process.env.WORKLENZ_DEPLOYMENT_MODE = previousMode;
      }
    });
  });

  describe('ProjectsController.toggleArchive (personal archive/unarchive)', () => {
    it('blocks personal unarchive/modification when project is archived for team', async () => {
      mockedDbQuery.mockImplementation((sql: string) => {
        if (sql.includes('archived_for_team') && sql.includes('WHERE p.id = $2')) {
          return Promise.resolve({
            rows: [{ name: 'Alpha Project', archived_for_team: true, is_archived: true }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const req = createMockRequest({
        params: { id: 'project-123' },
        user: { id: 'user-123', team_id: 'team-123' },
      });
      const res = createMockResponse();

      await ProjectsController.toggleArchive(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body?.done).toBe(false);
      expect(res.body?.message).toContain('archived for the team and cannot be individually modified');
      expect(mockedDbQuery.mock.calls.some(([sql]: [string]) => sql.includes('toggle_archive_project'))).toBe(false);
    });

    it('allows personal archive toggle when project is NOT archived for team', async () => {
      mockedDbQuery.mockImplementation((sql: string) => {
        if (sql.includes('archived_for_team') && sql.includes('WHERE p.id = $2')) {
          return Promise.resolve({
            rows: [{ name: 'Alpha Project', archived_for_team: false, is_archived: false }],
          });
        }
        if (sql.includes('toggle_archive_project')) {
          return Promise.resolve({ rows: [{ toggle_archive_project: true }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const req = createMockRequest({
        params: { id: 'project-123' },
        user: { id: 'user-123', team_id: 'team-123' },
      });
      const res = createMockResponse();

      await ProjectsController.toggleArchive(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body?.done).toBe(true);
      expect(mockedDbQuery.mock.calls.some(([sql]: [string]) => sql.includes('toggle_archive_project'))).toBe(true);
    });
  });
});
