jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock('../shared/paddle-utils', () => {
  const actual = jest.requireActual('../shared/paddle-utils');
  return {
    ...actual,
    checkTeamSubscriptionStatus: jest.fn(),
  };
});

jest.mock('../shared/guest-seat-limits', () => ({
  getGuestSeatLimit: jest.fn(),
}));

import db from '../config/db';
import * as projectAccess from '../shared/project-access';
import * as emailTemplates from '../shared/email-templates';
import { createMockRequest, createMockResponse } from '../tests/utils/express-mock';
import ProjectMembersController from '../controllers/project-members-controller';
import TeamMembersController from '../controllers/team-members-controller';
import { checkTeamSubscriptionStatus, getActiveGuestCount } from '../shared/paddle-utils';
import { getGuestSeatLimit } from '../shared/guest-seat-limits';

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
        is_admin: true,
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
        done: false,
        message: 'Guest limit exceeded',
      })
    );
  });
});

describe('ProjectMembersController.createByEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const db = require('../config/db').default;
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('blocks a project invitation when a trial team has reached its member limit', async () => {
    mockedCheckTeamSubscriptionStatus.mockResolvedValue({
      subscription_status: 'trialing',
      current_count: 10,
      team_member_limit_override: false,
    } as any);

    const createOrInviteMembersSpy = jest.spyOn(TeamMembersController, 'createOrInviteMembers');
    const req: any = {
      body: { project_id: 'project-123', email: 'invitee@example.com' },
      query: {},
      user: { id: 'user-123', team_id: 'team-123', owner_id: 'owner-123' },
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await ProjectMembersController.createByEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        done: false,
        body: expect.objectContaining({ error_code: 'SEAT_LIMIT_EXCEEDED' }),
      }),
    );
    expect(createOrInviteMembersSpy).not.toHaveBeenCalled();
  });
});


describe('ProjectMembersController.checkIfUserAlreadyExistsInTeam', () => {
  it.each([true, false])('returns %s for the target team without querying other workspaces', async exists => {
    const query = jest.mocked(db.query);
    query.mockReset().mockResolvedValue({ rows: [{ exists }], rowCount: 1 } as Awaited<ReturnType<typeof db.query>>);
    expect(await ProjectMembersController.checkIfUserAlreadyExistsInTeam('target-team', ' user@example.com ')).toBe(exists);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('team_id = $2::UUID'), ['user@example.com', 'target-team']);
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('t.user_id'), expect.anything());
  });
});

describe('ProjectMembersController.createByEmail review regressions', () => {
  const query = jest.mocked(db.query);
  const request = (email = 'invitee@example.com') => createMockRequest({
    body: { project_id: 'project-123', email, access_level: 'MEMBER' },
    user: { id: 'user-123', team_id: 'team-123', owner_id: 'owner-123' },
  });
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    query.mockReset().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });
    jest.spyOn(projectAccess, 'getProjectAccessForRequest').mockResolvedValue(projectAccess.buildProjectAccess({
      teamRole: 'Owner', isGuest: false, isActive: true, accessLevel: null,
      financeAccess: true, canCreateProjectsFromTemplates: true, isProjectMember: true,
    }));
    jest.spyOn(emailTemplates, 'sendInvitationEmail').mockResolvedValue(undefined);
    mockedCheckTeamSubscriptionStatus.mockResolvedValue({ subscription_status: 'active', subscription_type: 'PADDLE' });
    jest.spyOn(ProjectMembersController, 'checkIfUserAlreadyExistsInTeam').mockResolvedValue(false);
    jest.spyOn(ProjectMembersController, 'checkIfUserAlreadyExists').mockResolvedValue(true);
    jest.spyOn(TeamMembersController, 'createOrInviteMembers').mockResolvedValue([{ team_member_id: 'member-123' }]);
    jest.spyOn(ProjectMembersController, 'createOrInviteMembers').mockResolvedValue({ member: { id: 'member-123' } });
  });
  afterEach(() => { jest.restoreAllMocks(); });

  it('finds an existing team member with a padded, mixed-case email', async () => {
    jest.mocked(ProjectMembersController.checkIfUserAlreadyExistsInTeam).mockResolvedValue(true);
    jest.spyOn(ProjectMembersController, 'checkIfMemberExists').mockResolvedValue(false);
    query.mockImplementation(async (sql, params) => ({
      rows: sql.includes('LOWER(email) = LOWER($1::TEXT)') && params?.[0] === 'Invitee@Example.com' && params?.[1] === 'team-123'
        ? [{ team_member_id: 'existing-member', email: 'invitee@example.com', name: 'Invitee', user_id: 'invitee-user' }] : [],
      rowCount: 1,
    } as Awaited<ReturnType<typeof db.query>>));
    const res = createMockResponse();
    await ProjectMembersController.createByEmail(request(' Invitee@Example.com '), res);
    expect(ProjectMembersController.createOrInviteMembers).toHaveBeenCalledWith(
      expect.objectContaining({ team_member_id: 'existing-member', team_id: 'team-123' }), expect.anything());
    expect(TeamMembersController.createOrInviteMembers).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ done: true }));
  });

  it.each([
    ['subscription seats', false, true], ['subscription seats', false, false],
    ['lifetime seats', true, true], ['lifetime seats', true, false],
  ])('uses owner membership for %s (isLtd=%s, ownerExists=%s)', async (_label, isLtd, ownerExists) => {
    jest.mocked(ProjectMembersController.checkIfUserAlreadyExists).mockResolvedValue(ownerExists);
    mockedCheckTeamSubscriptionStatus.mockResolvedValue({
      subscription_status: 'active', subscription_type: 'PADDLE', current_count: '25',
      quantity: 25, is_ltd: isLtd, ltd_users: '25', is_credit: isLtd,
    });
    const res = createMockResponse();
    await ProjectMembersController.createByEmail(request(), res);
    expect(ProjectMembersController.checkIfUserAlreadyExists).toHaveBeenCalledWith('owner-123', 'invitee@example.com');
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ done: ownerExists }));
    if (ownerExists) {
      expect(TeamMembersController.createOrInviteMembers).toHaveBeenCalled();
    } else {
      expect(TeamMembersController.createOrInviteMembers).not.toHaveBeenCalled();
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ error_code: 'SEAT_LIMIT_EXCEEDED' }) }));
    }
  });
});
