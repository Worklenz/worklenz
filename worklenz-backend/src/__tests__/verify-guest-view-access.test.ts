/**
 * Tests for Guest View Access Control
 *
 * This test suite verifies that:
 * 1. Guests can access allowed views (kanban, list, roadmap, workload)
 * 2. Guests are rejected from restricted views (schedule, reporting)
 * 3. Non-guests can access all views
 * 4. Mutations are properly guarded by verifyNonGuestProjectAccess
 */

jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import db from '../config/db';
import verifyGuestViewAccess from '../middlewares/verify-guest-view-access';
import { verifyNonGuestProjectAccess } from '../middlewares/verify-project-access';

const mockedDb = db as jest.Mocked<typeof db>;

// Helper function to create mock request/response objects
function createMockReqRes(projectId: string, userId: string, location: 'params' | 'body' | 'query' = 'params') {
  const req: any = {
    user: { id: userId, team_id: 'team-123' },
    [location]: { id: projectId },
  };

  const res: any = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };

  return { req, res };
}

describe('verifyGuestViewAccess Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Guest Access to Allowed Views', () => {
    it('allows guests to access kanban view', async () => {
      const { req, res } = createMockReqRes('proj-123', 'user-456');
      const next = jest.fn();

      // Mock database to return no non-guest access (indicating guest)
      mockedDb.query.mockResolvedValueOnce({ rowCount: 0, rows: [], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyGuestViewAccess('params', 'id', 'kanban');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows guests to access list view', async () => {
      const { req, res } = createMockReqRes('proj-123', 'user-456');
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce({ rowCount: 0, rows: [], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyGuestViewAccess('params', 'id', 'list');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows guests to access roadmap view', async () => {
      const { req, res } = createMockReqRes('proj-123', 'user-456');
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce({ rowCount: 0, rows: [], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyGuestViewAccess('params', 'id', 'roadmap');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows guests to access workload view', async () => {
      const { req, res } = createMockReqRes('proj-123', 'user-456');
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce({ rowCount: 0, rows: [], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyGuestViewAccess('params', 'id', 'workload');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Guest Access to Restricted Views', () => {
    it('rejects guests from accessing schedule view with 403', async () => {
      const { req, res } = createMockReqRes('proj-123', 'user-456');
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce({ rowCount: 0, rows: [], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyGuestViewAccess('params', 'id', 'schedule');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects guests from accessing reporting view with 403', async () => {
      const { req, res } = createMockReqRes('proj-123', 'user-456');
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce({ rowCount: 0, rows: [], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyGuestViewAccess('params', 'id', 'reporting');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Non-Guest Access', () => {
    it('allows non-guests to access any view (including restricted ones)', async () => {
      const { req, res } = createMockReqRes('proj-123', 'user-456');
      const next = jest.fn();

      // Mock database to return non-guest access found
      mockedDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyGuestViewAccess('params', 'id', 'schedule');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows non-guests to access reporting view', async () => {
      const { req, res } = createMockReqRes('proj-123', 'user-456');
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyGuestViewAccess('params', 'id', 'reporting');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('continues without blocking when project ID is missing', async () => {
      const req: any = {
        user: { id: 'user-456', team_id: 'team-123' },
        params: {},
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      const middleware = verifyGuestViewAccess('params', 'id', 'roadmap');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('continues without blocking when user ID is missing', async () => {
      const req: any = {
        user: null,
        params: { id: 'proj-123' },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      const middleware = verifyGuestViewAccess('params', 'id', 'roadmap');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('continues on database error (fail-open)', async () => {
      const { req, res } = createMockReqRes('proj-123', 'user-456');
      const next = jest.fn();

      mockedDb.query.mockRejectedValueOnce(new Error('DB connection failed'));

      const middleware = verifyGuestViewAccess('params', 'id', 'schedule');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('supports body location for project ID', async () => {
      const req: any = {
        user: { id: 'user-456', team_id: 'team-123' },
        body: { project_id: 'proj-123' },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce({ rowCount: 0, rows: [], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyGuestViewAccess('body', 'project_id', 'kanban');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('supports query location for project ID', async () => {
      const req: any = {
        user: { id: 'user-456', team_id: 'team-123' },
        query: { project_id: 'proj-123' },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce({ rowCount: 0, rows: [], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyGuestViewAccess('query', 'project_id', 'roadmap');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Rejection Message', () => {
    it('provides helpful error message when guest access is denied', async () => {
      const { req, res } = createMockReqRes('proj-123', 'user-456');
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce({ rowCount: 0, rows: [], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyGuestViewAccess('params', 'id', 'schedule');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      const sendCall = res.send.mock.calls[0][0];
      expect(sendCall.message).toContain('schedule');
      expect(sendCall.message).toContain('guest');
    });
  });
});

describe('verifyNonGuestProjectAccess Middleware for Workload Mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Guest Rejection', () => {
    it('rejects guest users from allocation mutation (PUT /allocation)', async () => {
      const req: any = {
        user: { id: 'user-456', team_id: 'team-123' },
        body: { project_id: 'proj-123' },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      // Mock database to indicate user is a guest (no non-guest access)
      mockedDb.query.mockResolvedValueOnce({ rowCount: 0, rows: [], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyNonGuestProjectAccess('body', 'project_id');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects guest users from rebalance mutation (POST /rebalance)', async () => {
      const req: any = {
        user: { id: 'user-789', team_id: 'team-456' },
        body: { project_id: 'proj-789' },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce({ rowCount: 0, rows: [], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyNonGuestProjectAccess('body', 'project_id');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('Non-Guest Permission', () => {
    it('allows non-guests to perform allocation mutation', async () => {
      const req: any = {
        user: { id: 'user-456', team_id: 'team-123' },
        body: { project_id: 'proj-123' },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      // Mock database to indicate non-guest access
      mockedDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyNonGuestProjectAccess('body', 'project_id');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows non-guests to perform rebalance mutation', async () => {
      const req: any = {
        user: { id: 'user-456', team_id: 'team-123' },
        body: { project_id: 'proj-123' },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }], command: "", oid: 0, fields: [] } as any);

      const middleware = verifyNonGuestProjectAccess('body', 'project_id');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('returns 500 on database error', async () => {
      const req: any = {
        user: { id: 'user-456', team_id: 'team-123' },
        body: { project_id: 'proj-123' },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      mockedDb.query.mockRejectedValueOnce(new Error('DB error'));

      const middleware = verifyNonGuestProjectAccess('body', 'project_id');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalled();
    });
  });
});
