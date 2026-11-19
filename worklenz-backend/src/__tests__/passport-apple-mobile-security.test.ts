jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../shared/utils', () => ({ log_error: jest.fn() }));
jest.mock('../shared/signup-email-domain-policy', () => ({ isSignupEmailDomainBlocked: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ __esModule: true, default: {
  decode: jest.fn(() => ({ header: { kid: 'key' } })),
  verify: jest.fn(() => ({ sub: 'apple-user', email: 'person@example.com', email_verified: true, aud: 'web-client' })),
} }));
jest.mock('jwks-rsa', () => ({ __esModule: true, default: () => ({ getSigningKey: async () => ({ getPublicKey: () => 'key' }) }) }));

import db from '../config/db';
import appleMobileStrategy from '../passport/passport-strategies/passport-apple-mobile';

const query = db.query as jest.Mock;

test('prefers the matching Apple subject when another account matches the email', async () => {
  process.env.APPLE_CLIENT_ID = 'web-client';
  query.mockReset();
  query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
  query.mockResolvedValueOnce({ rowCount: 2, rows: [
    { id: 'email-match', apple_id: 'other-apple', google_id: null },
    { id: 'subject-match', apple_id: 'apple-user', google_id: null, email: 'person@example.com' },
  ] });
  query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
  const done = jest.fn();
  await appleMobileStrategy._verify({ body: { idToken: 'token' } }, done);
  expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ id: 'subject-match' }), expect.anything());
});
