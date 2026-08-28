jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock('../shared/paddle-utils', () => ({
  checkTeamSubscriptionStatus: jest.fn(),
}));

jest.mock('../shared/guest-seat-limits', () => ({
  getGuestSeatLimit: jest.fn(),
}));

import ProjectMembersController from '../controllers/project-members-controller';
import { checkTeamSubscriptionStatus } from '../ee/shared/paddle-utils';
import { getGuestSeatLimit } from '../shared/guest-seat-limits';
import { getActiveGuestCount } from '../ee/shared/paddle-utils';

const mockedCheckTeamSubscriptionStatus = checkTeamSubscriptionStatus as jest.MockedFunction<typeof checkTeamSubscriptionStatus>;
const mockedGetGuestSeatLimit = getGuestSeatLimit as jest.MockedFunction<typeof getGuestSeatLimit>;

describe('projectMembersApiRouter', () => {
  it('registers guest member routes before the generic project id route', () => {
    const router = require('../routes/apis/project-members-api-router').default;
    const stack = router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route.path);

    expect(stack).toContain('/guests');
    expect(stack).toContain('/:id');
    expect(stack.indexOf('/guests')).toBeLessThan(stack.indexOf('/:id'));
  });
});

describe('ProjectMembersController.getGuestMembers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const db = require('../config/db').default;
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('builds a valid ORDER BY clause without parameterizing the sort direction', async () => {
    const db = require('../config/db').default;
    const req: any = {
      user: {
        id: 'admin-user',
        team_id: 'team-123',
      },
      query: {
        current: '1',
        page_size: '20',
        field: 'name',
        order: 'asc',
        search: '',
      },
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    jest.spyOn(ProjectMembersController as any, 'verifyAdminAccess').mockResolvedValue(true);

    await ProjectMembersController.getGuestMembers(req, res);

    expect(db.query).toHaveBeenCalled();
    const query = db.query.mock.calls[0][0];
    expect(query).toContain('ORDER BY g.name ASC');
    expect(query).not.toContain('END $4');
    expect(query).not.toContain('END $');
  });

  it('counts active guest project memberships rather than inactive team-member state', async () => {
    const db = require('../config/db').default;
    db.query.mockResolvedValue({ rows: [{ active_guests: '2' }], rowCount: 1 });

    const result = await getActiveGuestCount('team-123');

    expect(result).toBe(2);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('tm.active = true'),
      ['team-123']
    );
  });
});

describe('ProjectMembersController.create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks guest additions when the team guest limit is reached', async () => {
    mockedCheckTeamSubscriptionStatus.mockResolvedValue({
      subscription_status: 'active',
      subscription_type: 'PADDLE',
    } as any);

    mockedGetGuestSeatLimit.mockResolvedValue({
      plan_tier: 'PROFESSIONAL',
      guest_limit: 5,
      current_guest_count: 5,
      remaining_slots: 0,
      can_add_guest: false,
      error_message: 'Guest limit exceeded',
    });

    const req: any = {
      body: {
        project_id: 'project-123',
        access_level: 'GUEST',
      },
      user: {
        id: 'user-123',
        team_id: 'team-123',
        owner_id: 'owner-123',
      },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await ProjectMembersController.create(req, res);

    expect(mockedGetGuestSeatLimit).toHaveBeenCalledWith('team-123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Guest limit exceeded',
      })
    );
  });
});
