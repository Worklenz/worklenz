jest.mock('../config/db', () => ({
  __esModule: true,
  default: { pool: {} },
}));
jest.mock('connect-pg-simple', () => (sessionModule: any) => {
  const { EventEmitter } = require('events');
  return class MockStore extends (sessionModule?.Store || EventEmitter) {
    get = jest.fn((_sid, cb) => cb(null, null));
    set = jest.fn((_sid, _sess, cb) => cb(null));
    destroy = jest.fn((_sid, cb) => cb(null));
  };
});

describe('session-middleware', () => {
  const originalEnv = process.env.SESSION_COOKIE_SECURE;

  afterEach(() => {
    process.env.SESSION_COOKIE_SECURE = originalEnv;
    jest.resetModules();
  });

  it('updates restored session cookie.secure to match SESSION_COOKIE_SECURE=true', async () => {
    process.env.SESSION_COOKIE_SECURE = 'true';
    const sessionMiddleware = (await import('../middlewares/session-middleware')).default;

    const req: any = {
      headers: {},
      session: {
        cookie: {
          secure: false, // Old restored session
          maxAge: 1000,
        },
      },
    };
    const res: any = {
      on: jest.fn(),
      end: jest.fn(),
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      writeHead: jest.fn(),
    };
    const next = jest.fn();

    sessionMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.session.cookie.secure).toBe(true);
  });

  it('updates restored session cookie.secure to match SESSION_COOKIE_SECURE=false', async () => {
    process.env.SESSION_COOKIE_SECURE = 'false';
    const sessionMiddleware = (await import('../middlewares/session-middleware')).default;

    const req: any = {
      headers: {},
      session: {
        cookie: {
          secure: true,
          maxAge: 1000,
        },
      },
    };
    const res: any = {
      on: jest.fn(),
      end: jest.fn(),
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      writeHead: jest.fn(),
    };
    const next = jest.fn();

    sessionMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.session.cookie.secure).toBe(false);
  });
});
