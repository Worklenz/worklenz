import express from 'express';
import session from 'express-session';
import { csrfSync } from 'csrf-sync';
import axios from 'axios';
import { AddressInfo } from 'net';
import { Server } from 'http';
import { Passport } from 'passport';

jest.mock('../services/google-one-tap.service', () => ({
  GoogleOneTapRejected: class GoogleOneTapRejected extends Error {},
  issueGoogleChallenge: jest.fn(), verifyGoogleCredential: jest.fn(), resolveGoogleAccount: jest.fn(),
}));
jest.mock('../services/audit-log.service', () => ({
  resolveOrganizationIdForUserId: jest.fn().mockResolvedValue(null), logAuditEvent: jest.fn(),
}));
import router from '../routes/auth/google-one-tap';
import { issueGoogleChallenge, verifyGoogleCredential, resolveGoogleAccount } from '../services/google-one-tap.service';

const origin = 'http://localhost:5173';
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  Object.assign(process.env, {
    GOOGLE_ONE_TAP_ENABLED: 'true', GOOGLE_CLIENT_ID: '123.apps.googleusercontent.com',
    GOOGLE_ONE_TAP_ALLOWED_ORIGINS: origin, SESSION_SECRET: 's'.repeat(64),
  });
  const app = express();
  const passport = new Passport();
  passport.serializeUser((user: { id: string }, done) => done(null, user.id));
  passport.deserializeUser((id: string, done) => done(null, { id }));
  app.use(express.json());
  app.use(session({ secret: 's'.repeat(64), resave: false, saveUninitialized: true }));
  app.use(passport.initialize());
  app.use(passport.session());
  const csrf = csrfSync({ getTokenFromRequest: req => req.headers['x-csrf-token'] as string });
  app.get('/csrf-token', (req, res) => res.json({ token: csrf.generateToken(req) }));
  app.use('/secure/google/one-tap', (req, res, next) => {
    if (req.method === 'POST') return csrf.csrfSynchronisedProtection(req, res, next);
    return next();
  }, router);
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(403).json({ error: error.message });
  });
  server = await new Promise<Server>(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

it('requires CSRF and an allowed browser origin before issuing a challenge or logging in', async () => {
  const client = axios.create({ baseURL: baseUrl, validateStatus: () => true });
  const csrf = await client.get('/csrf-token');
  const cookie = csrf.headers['set-cookie']![0].split(';')[0];
  const headers = { Cookie: cookie, Origin: origin, 'X-CSRF-Token': csrf.data.token };
  expect((await client.post('/secure/google/one-tap/challenge', {}, { headers: { Cookie: cookie, Origin: origin } })).status).toBe(403);
  expect((await client.post('/secure/google/one-tap/challenge', {}, { headers: { ...headers, Origin: 'http://evil.example' } })).status).toBe(403);
  expect((await client.post('/secure/google/one-tap/challenge', {}, { headers: { Cookie: cookie, 'X-CSRF-Token': csrf.data.token } })).status).toBe(403);
  expect((await client.post('/secure/google/one-tap/challenge', {}, { headers: { ...headers, 'X-Session-ID': 'attacker' } })).status).toBe(403);
  expect(issueGoogleChallenge).not.toHaveBeenCalled();

  (issueGoogleChallenge as jest.Mock).mockResolvedValue('nonce');
  const challenge = await client.post('/secure/google/one-tap/challenge', {}, { headers });
  expect(challenge.status).toBe(200);
  expect(challenge.data.body.nonce).toBe('nonce');
  const sessionId = (issueGoogleChallenge as jest.Mock).mock.calls[0][0];
  (verifyGoogleCredential as jest.Mock).mockResolvedValue({ subject: 'sub', email: 'test@example.com', name: 'User' });
  (resolveGoogleAccount as jest.Mock).mockResolvedValue({ id: 'user-id', email: 'test@example.com' });
  const login = await client.post('/secure/google/one-tap/login', { credential: 'credential' }, { headers });
  expect(login.status).toBe(200);
  expect(login.headers['set-cookie']?.[0].split(';')[0]).not.toBe(cookie);
  expect(verifyGoogleCredential).toHaveBeenCalledWith('credential', sessionId, expect.objectContaining({ clientId: '123.apps.googleusercontent.com' }));
});
