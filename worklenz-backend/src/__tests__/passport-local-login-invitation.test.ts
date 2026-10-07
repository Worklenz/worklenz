jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: { compareSync: jest.fn(() => true) },
}));

jest.mock('../shared/utils', () => ({
  log_error: jest.fn(),
}));

import db from '../config/db';
import localLoginStrategy from '../passport/passport-strategies/passport-local-login';

const mockedDb = db as jest.Mocked<typeof db>;

const USER_ID = 'user-1';
const TEAM_ID = 'team-2';
const EMAIL = 'user1@example.com';

const queryResult = (rows: unknown[]) => ({ rowCount: rows.length, rows } as any);

const runLogin = (body: Record<string, unknown>) =>
  new Promise<{ error: unknown; user: unknown }>(resolve => {
    const req: any = { body, session: {}, flash: jest.fn() };
    const verify = (localLoginStrategy as any)._verify;
    verify(req, EMAIL, 'password123', (error: unknown, user: unknown) => resolve({ error, user }));
  });

describe('Local login with invitation params', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDb.query
      .mockResolvedValueOnce(queryResult([{ id: USER_ID, email: EMAIL, password: 'hash' }]))
      .mockResolvedValueOnce(queryResult([{ '?column?': 1 }]));
  });

  it('accepts an invitation link whose user param is the registered user id', async () => {
    mockedDb.query
      .mockResolvedValueOnce(queryResult([{ '?column?': 1 }]))
      .mockResolvedValueOnce(queryResult([{}]));

    const { error, user } = await runLogin({ team_id: TEAM_ID, team_member_id: USER_ID });

    expect(error).toBeNull();
    expect(user).toEqual(expect.objectContaining({ id: USER_ID }));

    const [invitationSql, invitationParams] = mockedDb.query.mock.calls[2];
    expect(invitationSql).toContain('tm.id = $1 OR tm.user_id = $1');
    expect(invitationParams).toEqual([USER_ID, TEAM_ID, EMAIL]);
    expect(mockedDb.query.mock.calls[3]).toEqual(['SELECT set_active_team($1, $2)', [USER_ID, TEAM_ID]]);
  });

  it('rejects login when no matching invitation exists for the team', async () => {
    mockedDb.query.mockResolvedValueOnce(queryResult([]));

    const { error, user } = await runLogin({ team_id: TEAM_ID, team_member_id: USER_ID });

    expect(error).toBeNull();
    expect(user).toBe(false);
    // 3 calls for the login/invitation checks above, plus a 4th from the audit log
    // instrumentation (logFailedLogin -> resolveOrganizationIdForUserId) added in
    // passport-local-login.ts for this exact rejection branch. No 4th mock value is queued
    // here, so that call resolves to undefined and resolveOrganizationIdForUserId's own
    // try/catch swallows it and returns null - logFailedLogin then no-ops, matching the
    // "a failed audit write must never affect the user-facing login outcome" requirement
    // (error/user above are unaffected either way).
    expect(mockedDb.query).toHaveBeenCalledTimes(4);
  });
});
