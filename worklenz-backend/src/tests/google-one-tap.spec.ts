import { createHash } from 'crypto';

const mockVerifyIdToken = jest.fn();
const mockQuery = jest.fn();
jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args) })) }));
jest.mock('../config/db', () => ({ __esModule: true, default: { query: (...args: unknown[]) => mockQuery(...args) } }));

import { getGoogleOneTapConfig } from '../config/google-one-tap';
import { GoogleOneTapRejected, issueGoogleChallenge, resolveGoogleAccount, verifyGoogleCredential } from '../services/google-one-tap.service';

const env = {
  GOOGLE_ONE_TAP_ENABLED: 'true', GOOGLE_CLIENT_ID: '123.apps.googleusercontent.com',
  GOOGLE_ONE_TAP_ALLOWED_ORIGINS: 'https://app.example.com', SESSION_COOKIE_SECURE: 'true',
  SESSION_SECRET: 'a'.repeat(64),
};
const config = getGoogleOneTapConfig(env)!;
const nonce = 'a'.repeat(64);
const payload = { sub: 'google-sub', email: 'User@example.com', email_verified: true, nonce };

describe('Google One Tap configuration', () => {
  it('requires an explicit opt-in, exact safe origins, and a strong session secret', () => {
    expect(getGoogleOneTapConfig({ ...env, GOOGLE_ONE_TAP_ENABLED: 'false' })).toBeNull();
    expect(getGoogleOneTapConfig({ ...env, GOOGLE_ONE_TAP_ALLOWED_ORIGINS: 'https://app.example.com/' })).toBeNull();
    expect(getGoogleOneTapConfig({ ...env, GOOGLE_ONE_TAP_ALLOWED_ORIGINS: 'http://app.example.com' })).toBeNull();
    expect(getGoogleOneTapConfig({ ...env, SESSION_COOKIE_SECURE: 'false' })).toBeNull();
    expect(getGoogleOneTapConfig({ ...env, SESSION_SECRET: 'short' })).toBeNull();
    expect(config.clientId).toBe(env.GOOGLE_CLIENT_ID);
    expect(getGoogleOneTapConfig({ ...env, GOOGLE_ONE_TAP_ALLOWED_ORIGINS: 'http://localhost:5173', SESSION_COOKIE_SECURE: 'false' })).not.toBeNull();
  });
});

describe('Google One Tap verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 'challenge' }] });
  });

  it('generates a random challenge and stores hashes instead of the nonce or session ID', async () => {
    const issued = await issueGoogleChallenge('session-1');
    expect(issued).toMatch(/^[a-f0-9]{64}$/);
    const [, params] = mockQuery.mock.calls[1];
    expect(params).toEqual(['session-1', issued].map(value => createHash('sha256').update(value).digest('hex')));
  });

  it('verifies the configured audience and consumes the session-bound nonce', async () => {
    const identity = await verifyGoogleCredential('credential', 'session-1', config);
    expect(mockVerifyIdToken).toHaveBeenCalledWith({ idToken: 'credential', audience: env.GOOGLE_CLIENT_ID });
    expect(identity.subject).toBe('google-sub');
    expect(identity.email).toBe('user@example.com');
    expect(mockQuery.mock.calls[0][0]).toMatch(/DELETE FROM google_one_tap_challenges/);
    expect(mockQuery.mock.calls[0][1]).toEqual(['session-1', nonce].map(value => createHash('sha256').update(value).digest('hex')));
  });

  it('rejects expired, replayed, or other-session challenges', async () => {
    mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(verifyGoogleCredential('credential', 'other-session', config)).rejects.toBeInstanceOf(GoogleOneTapRejected);
  });

  it('rejects invalid Google tokens, unverified email, missing nonce and wrong hosted domain', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error('credential must not be exposed'));
    await expect(verifyGoogleCredential('credential', 'session-1', config)).rejects.toBeInstanceOf(GoogleOneTapRejected);
    for (const bad of [{ ...payload, email_verified: false }, { ...payload, nonce: undefined }]) {
      mockVerifyIdToken.mockResolvedValueOnce({ getPayload: () => bad });
      await expect(verifyGoogleCredential('credential', 'session-1', config)).rejects.toBeInstanceOf(GoogleOneTapRejected);
    }
    await expect(verifyGoogleCredential('credential', 'session-1', { ...config, hostedDomains: ['example.com'] })).rejects.toBeInstanceOf(GoogleOneTapRejected);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('only signs in one active account matched by subject', async () => {
    const identity = { subject: 'google-sub', email: 'user@example.com', name: 'User' };
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'user-id', is_deleted: false }] });
    expect((await resolveGoogleAccount(identity)).id).toBe('user-id');
    expect(mockQuery.mock.calls[0][1]).toEqual(['google-sub']);
    for (const rows of [[], [{ id: 'user', is_deleted: true }], [{ id: 'a' }, { id: 'b' }]]) {
      mockQuery.mockResolvedValueOnce({ rows });
      await expect(resolveGoogleAccount(identity)).rejects.toBeInstanceOf(GoogleOneTapRejected);
    }
  });
});
