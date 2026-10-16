jest.unmock('express');
jest.unmock('express-rate-limit');
jest.unmock('../models/server-response');
jest.unmock('../shared/validation-helpers');
jest.unmock('../middlewares/project-document-favorite-rate-limiter');
jest.unmock('../routes/apis/project-documents-api-router');
jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));

import projectDocumentsApiRouter from '../routes/apis/project-documents-api-router';
import { documentFavoriteRateLimiter } from '../middlewares/project-document-favorite-rate-limiter';
import { createMockRequest, createMockResponse } from './utils/express-mock';

const handlersFor = (method: 'get' | 'put', path: string): Function[] => {
  const layer = (projectDocumentsApiRouter as any).stack.find(
    (item: any) => item.route?.path === path && item.route.methods[method]
  );
  expect(layer).toBeDefined();
  return layer.route.stack.map((item: any) => item.handle);
};

describe('GET /favorites project id validation', () => {
  const [validate] = handlersFor('get', '/favorites');

  it.each([undefined, '', 'project', ['a'], '1234'])('rejects %p before the access check', projectId => {
    const res = createMockResponse();
    const next = jest.fn();
    validate(createMockRequest({ query: { project_id: projectId } }), res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes a valid UUID on to the access check', () => {
    const res = createMockResponse();
    const next = jest.fn();
    validate(createMockRequest({ query: { project_id: '550e8400-e29b-41d4-a716-446655440000' } }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('PUT /:id/favorite', () => {
  it('runs the rate limiter before any other handler', () => {
    expect(handlersFor('put', '/:id/favorite')[0]).toBe(documentFavoriteRateLimiter);
  });

  it('limits each user to 120 writes per minute without affecting other users', async () => {
    const call = (id: string) =>
      new Promise<number>(resolve => {
        const req = createMockRequest({ user: { id }, method: 'PUT' });
        Object.assign(req, { ip: '127.0.0.1', app: { get: () => undefined }, headers: {}, socket: {} });
        const res = createMockResponse();
        res.status = jest.fn().mockImplementation((code: number) => { res.statusCode = code; return res; });
        res.send = jest.fn().mockImplementation(() => { resolve(res.statusCode); return res; });
        res.json = res.send;
        res.set = res.setHeader = res.header = jest.fn().mockReturnValue(res);
        documentFavoriteRateLimiter(req, res, () => resolve(200));
      });
    for (let i = 0; i < 120; i++) expect(await call('limited-user')).toBe(200);
    expect(await call('limited-user')).toBe(429);
    expect(await call('another-user')).toBe(200);
  });
});
