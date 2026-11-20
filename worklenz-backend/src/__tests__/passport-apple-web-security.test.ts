jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../passport/passport-strategies/verify-apple-web-token', () => ({ verifyAppleWebToken: jest.fn() }));
jest.mock('../shared/utils', () => ({ log_error: jest.fn() }));
jest.mock('../shared/email-templates', () => ({ sendWelcomeEmail: jest.fn() }));
jest.mock('../shared/signup-email-domain-policy', () => ({ isSignupEmailDomainBlocked: jest.fn(), getBlockedSignupEmailMessage: jest.fn() }));

import db from '../config/db';
import { verifyAppleWebToken } from '../passport/passport-strategies/verify-apple-web-token';
import { handleAppleWebAuth } from '../passport/passport-strategies/passport-apple-web';

const query = db.query as jest.Mock;
const verify = verifyAppleWebToken as jest.Mock;
beforeEach(() => { query.mockReset(); verify.mockReset(); });

test('uses the verified token email rather than the callback body email', async () => {
  verify.mockResolvedValue({ sub: 'attacker', email: 'attacker@example.com', email_verified: true });
  query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
  query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'attacker-user', apple_id: 'attacker', google_id: null }] });
  const done = jest.fn();
  const req = { body: { user: JSON.stringify({ email: 'victim@example.com' }) }, query: {}, session: {} };
  await handleAppleWebAuth(req as never, '', '', 'token', {}, done);
  expect(query.mock.calls[1][1]).toEqual(['attacker', 'attacker@example.com']);
  expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ id: 'attacker-user' }), expect.anything());
});

test('rejects an email match linked to a different Apple subject', async () => {
  verify.mockResolvedValue({ sub: 'attacker', email: 'person@example.com', email_verified: true });
  query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
  query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'victim', apple_id: 'victim-apple', google_id: null }] });
  const done = jest.fn();
  await handleAppleWebAuth({ body: {}, query: {}, session: {} } as never, '', '', 'token', {}, done);
  expect(done).toHaveBeenCalledWith(null, false, expect.anything());
});

test('does not query accounts when token verification fails', async () => {
  verify.mockRejectedValue(new Error('invalid token'));
  const done = jest.fn();
  await handleAppleWebAuth({ body: {}, query: {}, session: {} } as never, '', '', 'bad-token', {}, done);
  expect(query).not.toHaveBeenCalled();
  expect(done).toHaveBeenCalledWith(expect.any(Error));
});

test('prefers the matching Apple subject when another account matches the email', async () => {
  verify.mockResolvedValue({ sub: 'apple-user', email: 'person@example.com', email_verified: true });
  query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
  query.mockResolvedValueOnce({ rowCount: 2, rows: [
    { id: 'email-match', apple_id: 'other-apple', google_id: null },
    { id: 'subject-match', apple_id: 'apple-user', google_id: null },
  ] });
  const done = jest.fn();
  await handleAppleWebAuth({ body: {}, query: {}, session: {} } as never, '', '', 'token', {}, done);
  expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ id: 'subject-match' }), expect.anything());
});
