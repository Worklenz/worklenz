jest.unmock('../controllers/project-documents-controller');
jest.unmock('../decorators/handle-exceptions');
jest.unmock('../controllers/worklenz-controller-base');
jest.unmock('../models/server-response');
jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));

import db from '../config/db';
import ProjectDocumentsController from '../controllers/project-documents-controller';
import { createMockRequest, createMockResponse } from './utils/express-mock';

const query = db.query as jest.Mock;
beforeEach(() => { query.mockReset().mockResolvedValue({ rows: [] }); });

it('lists only the authenticated user’s non-deleted favorites within the requested project', async () => {
  query.mockResolvedValue({ rows: [{ document_id: 'page' }] });
  const res = createMockResponse();
  await ProjectDocumentsController.favorites(createMockRequest({ user: { id: 'owner' }, query: { project_id: 'project' }, body: { user_id: 'another-user' } }), res);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('d.deleted_at IS NULL'), ['owner', 'project']);
  expect(res.body.body).toEqual(['page']);
});

it.each([true, false])('sets favorite = %s idempotently using the session user, without changing shared document timestamps', async favorite => {
  const res = createMockResponse();
  await ProjectDocumentsController.setFavorite(createMockRequest({ user: { id: 'owner' }, params: { id: 'page' }, body: { favorite, user_id: 'victim' } }), res);
  const [sql, params] = query.mock.calls[0] as [string, string[]];
  expect(params).toEqual(['owner', 'page']);
  expect(sql).toContain(favorite ? 'ON CONFLICT (user_id, document_id) DO NOTHING' : 'DELETE FROM project_document_favorites WHERE user_id = $1 AND document_id = $2');
  expect(sql).not.toContain('UPDATE project_documents');
  expect(res.body.body).toEqual({ favorite });
});

it.each(['true', null, 1, undefined])('rejects invalid favorite values (%s) before querying the database', async favorite => {
  const res = createMockResponse();
  await ProjectDocumentsController.setFavorite(createMockRequest({ body: { favorite } }), res);
  expect(res.statusCode).toBe(400);
  expect(query).not.toHaveBeenCalled();
});

it('requires a session for both endpoints', async () => {
  for (const action of [ProjectDocumentsController.favorites, ProjectDocumentsController.setFavorite]) {
    const res = createMockResponse();
    await action(createMockRequest({ user: undefined }), res);
    expect(res.statusCode).toBe(401);
  }
  expect(query).not.toHaveBeenCalled();
});
