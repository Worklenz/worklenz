jest.unmock('express-rate-limit');
jest.unmock('../middlewares/roadmap-export-rate-limiter');
import { roadmapExportRateLimiter } from '../middlewares/roadmap-export-rate-limiter';
import { createMockRequest, createMockResponse } from './utils/express-mock';

const call = (id: string) => new Promise<number>(resolve => {
  const req = createMockRequest({ user: { id }, method: 'POST' });
  Object.assign(req, { ip: '127.0.0.1', app: { get: () => undefined }, headers: {}, socket: {} });
  const res = createMockResponse();
  res.send = res.json = jest.fn().mockImplementation(() => { resolve(res.statusCode); return res; });
  res.set = res.setHeader = res.header = jest.fn().mockReturnValue(res);
  roadmapExportRateLimiter(req, res, () => resolve(200));
});

describe('roadmap export request limits', () => {
  it('limits repeated requests per user without blocking another user', async () => {
    for (let index = 0; index < 120; index += 1) expect(await call('roadmap-user-a')).toBe(200);
    expect(await call('roadmap-user-a')).toBe(429);
    expect(await call('roadmap-user-b')).toBe(200);
  });
});
