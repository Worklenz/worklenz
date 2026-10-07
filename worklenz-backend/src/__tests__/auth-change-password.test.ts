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

import bcrypt from 'bcrypt';
import AuthController from '../controllers/auth-controller';

const db = require('../config/db').default;

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = (body: Record<string, string>) =>
  ({ user: { id: 'user-1' }, sessionID: 'sid-1', body }) as any;

const mockUserRow = (row: Record<string, unknown>) => {
  db.query.mockImplementation((sql: string) => {
    if (sql.startsWith('SELECT id, email, google_id, password FROM users'))
      return Promise.resolve({ rows: [row], rowCount: 1 });
    return Promise.resolve({ rows: [], rowCount: 1 });
  });
};

const wasPasswordUpdated = () =>
  db.query.mock.calls.some(([sql]: [string]) => sql.startsWith('UPDATE users SET password'));

describe('AuthController.changePassword', () => {
  const existingHash = bcrypt.hashSync('OldPass#123', 4);

  beforeEach(() => {
    jest.clearAllMocks();
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
});
