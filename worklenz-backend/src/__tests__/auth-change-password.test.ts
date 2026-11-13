jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock('../shared/email-templates', () => ({
  sendResetEmail: jest.fn(),
  sendResetSuccessEmail: jest.fn(),
}));

jest.mock('../shared/utils', () => ({
  log_error: jest.fn(),
}));

jest.mock('../shared/io', () => ({
  IO: {
    emitToRoom: jest.fn(),
  },
}));

import bcrypt from 'bcrypt';
import AuthController from '../controllers/auth-controller';
import { IO } from '../shared/io';
import { SocketEvents } from '../socket.io/events';

const db = require('../config/db').default;
const sessionClient = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
  release: jest.fn(),
};
db.connect = jest.fn().mockResolvedValue(sessionClient);

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = (body: Record<string, string | boolean>) =>
  ({ user: { id: 'user-1' }, sessionID: 'sid-1', body }) as any;

const mockUserRow = (row: Record<string, unknown>) => {
  db.query.mockImplementation((sql: string) => {
    if (sql.startsWith('SELECT id, email, google_id, password FROM users'))
      return Promise.resolve({ rows: [row], rowCount: 1 });
    return Promise.resolve({ rows: [], rowCount: 1 });
  });
};

const wasPasswordUpdated = () =>
  db.query.mock.calls.some(([sql]: [string]) => sql.startsWith('UPDATE users SET password')) ||
  sessionClient.query.mock.calls.some(([sql]: [string]) => sql.startsWith('UPDATE users SET password'));

describe('AuthController.changePassword', () => {
  const existingHash = bcrypt.hashSync('OldPass#123', 4);

  beforeEach(() => {
    jest.clearAllMocks();
    sessionClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('rejects a Google-linked account with an existing password when current password is empty', async () => {
    mockUserRow({ id: 'user-1', email: 'a@b.com', google_id: 'g-1', password: existingHash });
    const res = createRes();

    await AuthController.changePassword(createReq({ password: '', new_password: 'NewPass#123' }), res);

    expect(wasPasswordUpdated()).toBe(false);
    expect(res.send.mock.calls[0][0].done).toBe(false);
  });

  it('allows a Google-linked account with an existing password when current password matches', async () => {
    mockUserRow({ id: 'user-1', email: 'a@b.com', google_id: 'g-1', password: existingHash });
    const res = createRes();

    await AuthController.changePassword(
      createReq({ password: 'OldPass#123', new_password: 'NewPass#123' }),
      res
    );

    expect(wasPasswordUpdated()).toBe(true);
    expect(res.send.mock.calls[0][0].done).toBe(true);
  });

  it('allows an account without a password to set one without a current password', async () => {
    mockUserRow({ id: 'user-1', email: 'a@b.com', google_id: 'g-1', password: null });
    const res = createRes();

    await AuthController.changePassword(createReq({ password: '', new_password: 'NewPass#123' }), res);

    expect(wasPasswordUpdated()).toBe(true);
    expect(res.send.mock.calls[0][0].done).toBe(true);
  });

  it('invalidates all sessions including the current session when requested', async () => {
    mockUserRow({ id: 'user-1', email: 'a@b.com', google_id: null, password: existingHash });
    const res = createRes();

    await AuthController.changePassword(
      createReq({
        password: 'OldPass#123',
        new_password: 'NewPass#123',
        logout_other_sessions: true,
      }),
      res
    );

    expect(sessionClient.query).toHaveBeenCalledWith('BEGIN');
    expect(sessionClient.query).toHaveBeenCalledWith(
      expect.stringContaining("sess::jsonb @> jsonb_build_object("),
      ['user-1']
    );
    expect(sessionClient.query).toHaveBeenCalledWith(
      expect.stringContaining("OR sess::jsonb #>> '{passport,user}' = $1"),
      ['user-1']
    );
    expect(sessionClient.query).toHaveBeenCalledWith('COMMIT');
    expect(sessionClient.release).toHaveBeenCalled();
    expect(IO.emitToRoom).toHaveBeenCalledWith(
      'user:user-1',
      SocketEvents.SESSION_REVOKED,
      {}
    );
    expect(res.send.mock.calls[0][0].done).toBe(true);
  });

  it('rolls back the password update when session invalidation fails', async () => {
    mockUserRow({ id: 'user-1', email: 'a@b.com', google_id: null, password: existingHash });
    const invalidationError = new Error('Session store unavailable');
    sessionClient.query.mockImplementation((sql: string) => {
      if (sql.startsWith('DELETE FROM pg_sessions')) return Promise.reject(invalidationError);
      return Promise.resolve({ rows: [], rowCount: 1 });
    });
    const res = createRes();

    await AuthController.changePassword(
      createReq({
        password: 'OldPass#123',
        new_password: 'NewPass#123',
        logout_other_sessions: true,
      }),
      res
    );

    expect(sessionClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(sessionClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(IO.emitToRoom).not.toHaveBeenCalled();
    expect(sessionClient.release).toHaveBeenCalled();
    expect(res.send.mock.calls[0][0].done).toBe(false);
  });

  it('does not report success when no matching sessions were deleted', async () => {
    mockUserRow({ id: 'user-1', email: 'a@b.com', google_id: null, password: existingHash });
    sessionClient.query.mockImplementation((sql: string) => {
      if (sql.startsWith('DELETE FROM pg_sessions')) return Promise.resolve({ rows: [], rowCount: 0 });
      return Promise.resolve({ rows: [], rowCount: 1 });
    });
    const res = createRes();

    await AuthController.changePassword(
      createReq({
        password: 'OldPass#123',
        new_password: 'NewPass#123',
        logout_other_sessions: true,
      }),
      res
    );

    expect(sessionClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(sessionClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(res.send.mock.calls[0][0].done).toBe(false);
  });

  it('keeps other sessions active when logout is not requested', async () => {
    mockUserRow({ id: 'user-1', email: 'a@b.com', google_id: null, password: existingHash });
    const res = createRes();

    await AuthController.changePassword(
      createReq({ password: 'OldPass#123', new_password: 'NewPass#123', logout_other_sessions: false }),
      res
    );

    expect(db.query.mock.calls.some(([sql]: [string]) => sql.startsWith('DELETE FROM pg_sessions'))).toBe(
      false
    );
    expect(res.send.mock.calls[0][0].done).toBe(true);
  });
});
