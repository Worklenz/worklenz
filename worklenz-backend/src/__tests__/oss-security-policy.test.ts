jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../shared/private-extensions', () => ({ signupEmailDomainPolicy: { isBlocked: jest.fn(async () => false) } }));
jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

import axios from 'axios';
import db from '../config/db';
import { initializeI18n } from '../config/i18n';
import { signupEmailDomainPolicy } from '../shared/private-extensions';
import { getBlockedSignupEmailMessage, isSignupEmailDomainBlocked } from '../shared/signup-email-domain-policy';
import { getSecurityRejection, handleSecurityPolicyError, recordSecurityEvent, reserveInvitationEmail } from '../services/security-policy.service';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const query = jest.mocked(db.query);
const post = jest.mocked(axios.post);
const result = (rows: unknown[]) => ({ rows, rowCount: rows.length } as Awaited<ReturnType<typeof db.query>>);
const originalWebhook = process.env.SECURITY_ALERT_WEBHOOK_URL;

beforeAll(async () => { await initializeI18n(); });
beforeEach(() => {
  jest.resetAllMocks();
  delete process.env.SECURITY_ALERT_WEBHOOK_URL;
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  query.mockResolvedValue(result([]));
  jest.mocked(signupEmailDomainPolicy.isBlocked).mockResolvedValue(false);
});
afterEach(() => { jest.restoreAllMocks(); });
afterAll(() => {
  if (originalWebhook === undefined) delete process.env.SECURITY_ALERT_WEBHOOK_URL;
  else process.env.SECURITY_ALERT_WEBHOOK_URL = originalWebhook;
});

describe('operator signup domain policy', () => {
  it('normalizes domains and applies the public policy without invoking private code', async () => {
    query.mockResolvedValue(result([{ domain: 'xn--bcher-kva.example' }]));
    expect(await isSignupEmailDomainBlocked('User@BÜCHER.example. ')).toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('blocked_signup_email_domains'), ['xn--bcher-kva.example']);
    expect(signupEmailDomainPolicy.isBlocked).not.toHaveBeenCalled();
  });
  it('preserves the private extension when no operator rule matches', async () => {
    jest.mocked(signupEmailDomainPolicy.isBlocked).mockResolvedValue(true);
    expect(await isSignupEmailDomainBlocked('user@example.com')).toBe(true);
    expect(signupEmailDomainPolicy.isBlocked).toHaveBeenCalledWith('user@example.com');
  });
  it.each(['missing-at', '@example.com', 'user@', 'user@%invalid'])('still applies the private policy for invalid domain input %s', async email => {
    jest.mocked(signupEmailDomainPolicy.isBlocked).mockResolvedValue(true);
    expect(await isSignupEmailDomainBlocked(email)).toBe(true);
    expect(query).not.toHaveBeenCalled();
    expect(signupEmailDomainPolicy.isBlocked).toHaveBeenCalledWith(email);
  });
  it('allows normal signup with an empty blocklist', async () => {
    expect(await isSignupEmailDomainBlocked('user@example.com')).toBe(false);
  });
  it('does not turn policy lookup failures into an allow decision', async () => {
    query.mockRejectedValue(new Error('database unavailable'));
    await expect(isSignupEmailDomainBlocked('user@example.com')).rejects.toThrow('database unavailable');
  });
});

describe('security alerts', () => {
  it.each([
    ['ERROR_BLOCKED_TASK_CONTENT_URL', 'blockedTaskHost', 400],
    ['ERROR_NEW_TRIAL_INVITATION_LIMIT_EXCEEDED', 'invitationLimit', 429],
  ])('recognizes the existing production trigger error %s', (error, code, status) => {
    expect(getSecurityRejection(new Error(String(error)))).toEqual({ code, status });
  });
  it('records a minimal local event without outbound requests by default', async () => {
    query.mockResolvedValue(result([{ id: 'event-id', attempt_count: 1 }]));
    await recordSecurityEvent('invitationLimit', 'team-id');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO security_events'), ['team-id', 'invitationLimit']);
    expect(post).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.not.stringMatching(/email|password|description/));
  });
  it('sends only event metadata to an explicitly configured HTTPS endpoint', async () => {
    process.env.SECURITY_ALERT_WEBHOOK_URL = 'https://alerts.example/events?secret=private';
    query.mockResolvedValueOnce(result([{ id: 'event-id', attempt_count: 1 }]));
    await recordSecurityEvent('blockedTaskHost', 'team-id');
    expect(post).toHaveBeenCalledWith(process.env.SECURITY_ALERT_WEBHOOK_URL,
      { id: 'event-id', code: 'blockedTaskHost', teamId: 'team-id' },
      expect.objectContaining({ maxRedirects: 0, timeout: 3000 }));
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('delivered_at'), ['event-id']);
  });
  it('does not redeliver duplicate alerts', async () => {
    process.env.SECURITY_ALERT_WEBHOOK_URL = 'https://alerts.example/events';
    query.mockResolvedValue(result([{ id: 'event-id', attempt_count: 2 }]));
    await recordSecurityEvent('invitationLimit', 'team-id');
    expect(post).not.toHaveBeenCalled();
  });
  it.each(['http://alerts.example', 'https://user:secret@alerts.example', 'invalid'])('rejects unsafe endpoint %s', async endpoint => {
    process.env.SECURITY_ALERT_WEBHOOK_URL = endpoint;
    query.mockResolvedValue(result([{ id: 'event-id', attempt_count: 1 }]));
    await recordSecurityEvent('invitationLimit', 'team-id');
    expect(post).not.toHaveBeenCalled();
  });
  it('does not leak webhook secrets or change the rejection when delivery fails', async () => {
    process.env.SECURITY_ALERT_WEBHOOK_URL = 'https://alerts.example/SECRET';
    query.mockResolvedValueOnce(result([{ id: 'event-id', attempt_count: 1 }])).mockResolvedValue(result([{ language: 'de' }]));
    post.mockRejectedValue(new Error('SECRET and recipient@example.com'));
    const rejection = await handleSecurityPolicyError(new Error('ERROR_SECURITY_INVITATION_LIMIT'), 'team-id', 'user-id');
    expect(rejection).toMatchObject({ status: 429, code: 'invitationLimit' });
    expect(rejection?.message).toContain('Arbeitsbereich');
    expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toMatch(/SECRET|recipient@/);
  });
  it('does not mistake arbitrary internal failures for security rejections', async () => {
    expect(getSecurityRejection(new Error('SQL syntax error'))).toBeNull();
    expect(await handleSecurityPolicyError(new Error('SQL syntax error'))).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });
  it('records sender-side quota failures and prevents the caller from proceeding', async () => {
    query.mockRejectedValueOnce(new Error('ERROR_SECURITY_INVITATION_LIMIT'))
      .mockResolvedValue(result([{ id: 'event-id', attempt_count: 1 }]));
    await expect(reserveInvitationEmail('team-id')).rejects.toThrow('ERROR_SECURITY_INVITATION_LIMIT');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO security_events'), ['team-id', 'invitationLimit']);
  });
});

describe('security localization', () => {
  const localeRoot = path.join(__dirname, '../public/locales');
  const keys = ['invitationLimit', 'invitationsPaused', 'blockedTaskHost', 'blockedSignupDomain'];
  it.each(readdirSync(localeRoot))('includes every security message in %s', locale => {
    const translations = JSON.parse(readFileSync(path.join(localeRoot, locale, 'notifications.json'), 'utf8'));
    for (const key of keys) expect(translations.security[key]).toEqual(expect.any(String));
  });
  it('uses the signup request language and falls back for unsupported languages', () => {
    expect(getBlockedSignupEmailMessage('de-DE,de;q=0.9')).toContain('E-Mail');
    expect(getBlockedSignupEmailMessage('sq-AL')).toContain('emailit');
    expect(getBlockedSignupEmailMessage('unsupported')).toContain('email provider');
  });
});
