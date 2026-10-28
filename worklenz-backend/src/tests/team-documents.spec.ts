jest.unmock('../controllers/team-documents-controller');
jest.unmock('../decorators/handle-exceptions');
jest.unmock('../controllers/worklenz-controller-base');
jest.unmock('../models/server-response');
jest.unmock('../shared/team-permissions');
jest.unmock('express');
jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));

import db from '../config/db';
import TeamDocumentsController from '../controllers/team-documents-controller';
import teamDocumentsApiRouter from '../routes/apis/team-documents-api-router';
import { createMockRequest, createMockResponse } from './utils/express-mock';

const query = db.query as jest.Mock;

const summaryRow = {
  id: 'page-1',
  project_id: 'project-1',
  parent_id: null,
  title: 'Spec',
  position: 0,
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
  updated_by_name: 'Ada',
  project_name: 'Alpha',
  project_color: '#1890ff',
};

beforeEach(() => {
  query.mockReset().mockResolvedValue({ rows: [] });
});

const sqlOf = (): string => query.mock.calls[0][0] as string;
const paramsOf = (): unknown[] => query.mock.calls[0][1] as unknown[];

describe('team document reads', () => {
  it('exposes only read routes', () => {
    const routes = (teamDocumentsApiRouter as any).stack
      .filter((layer: { route?: { path: string; methods: Record<string, boolean> } }) => layer.route)
      .map((layer: { route: { path: string; methods: Record<string, boolean> } }) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    expect(routes).toEqual([
      { path: '/search', methods: ['get'] },
      { path: '/favorites', methods: ['get'] },
      { path: '/', methods: ['get'] },
    ]);
  });

  it('lets an owner read every project in the session team and ignores a caller-supplied team id', async () => {
    query.mockResolvedValue({ rows: [summaryRow] });
    const res = createMockResponse();
    await TeamDocumentsController.list(createMockRequest({
      user: { id: 'owner', team_id: 'team-1', owner: true },
      query: { team_id: 'other-team' },
    }), res);

    expect(sqlOf()).toContain('p.team_id = $1');
    expect(sqlOf()).toContain('is_member_of_project');
    expect(paramsOf()).toEqual(['team-1', true, 'owner']);
    expect(res.body.body).toEqual([{
      id: 'page-1',
      project_id: 'project-1',
      parent_id: null,
      title: 'Spec',
      position: 0,
      updated_at: '2026-01-02T00:00:00.000Z',
      updated_by_name: 'Ada',
      project_name: 'Alpha',
      project_color: '#1890ff',
    }]);
  });

  it('lets an admin and a team lead read every project in the team', async () => {
    for (const user of [
      { id: 'admin', team_id: 'team-1', is_admin: true },
      { id: 'lead', team_id: 'team-1', role_name: 'Team Lead' },
    ]) {
      query.mockClear();
      const res = createMockResponse();
      await TeamDocumentsController.list(createMockRequest({ user }), res);
      expect(paramsOf()).toEqual([user.team_id, true, user.id]);
    }
  });

  it('limits a member to projects they belong to', async () => {
    const res = createMockResponse();
    await TeamDocumentsController.list(createMockRequest({
      user: { id: 'member', team_id: 'team-1', role_name: 'Member' },
    }), res);
    expect(sqlOf()).toContain('is_member_of_project(p.id, $3::uuid, $1::uuid)');
    expect(paramsOf()).toEqual(['team-1', false, 'member']);
  });

  it('returns nothing for a guest, including a guest team lead, without querying', async () => {
    for (const user of [
      { id: 'guest', team_id: 'team-1', is_guest: true, role_name: 'Member' },
      { id: 'guest-lead', team_id: 'team-1', is_guest: true, role_name: 'Team Lead' },
    ]) {
      query.mockClear();
      const res = createMockResponse();
      await TeamDocumentsController.list(createMockRequest({ user }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.body).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    }
  });

  it('requires a session team', async () => {
    const res = createMockResponse();
    await TeamDocumentsController.list(createMockRequest({ user: { id: 'member' } }), res);
    expect(res.statusCode).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('searches only permitted documents in the session team', async () => {
    query.mockResolvedValue({
      rows: [{
        id: 'page-1',
        parent_id: null,
        title: 'Spec',
        content_text: 'launch plan',
        updated_at: new Date('2026-01-02T00:00:00.000Z'),
        project_id: 'project-1',
        project_name: 'Alpha',
      }],
    });
    const res = createMockResponse();
    await TeamDocumentsController.search(createMockRequest({
      user: { id: 'member', team_id: 'team-1', role_name: 'Member' },
      query: { q: '100%_ready', team_id: 'other-team' },
    }), res);

    expect(sqlOf()).toContain('d.content_text ILIKE $4');
    expect(sqlOf()).toContain('is_member_of_project');
    expect(sqlOf()).toContain('LIMIT 20');
    expect(paramsOf()).toEqual(['team-1', false, 'member', '%100\\%\\_ready%']);
    expect(res.body.body[0]).toMatchObject({
      id: 'page-1',
      project_id: 'project-1',
      project_name: 'Alpha',
      snippet: 'Spec',
    });
  });

  it('rejects a short search before querying', async () => {
    const res = createMockResponse();
    await TeamDocumentsController.search(createMockRequest({ query: { q: 'a' } }), res);
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns favorites inside the same permitted set', async () => {
    query.mockResolvedValue({ rows: [{ document_id: 'page-1' }] });
    const res = createMockResponse();
    await TeamDocumentsController.favorites(createMockRequest({
      user: { id: 'lead', team_id: 'team-1', role_name: 'Team Lead' },
      query: { team_id: 'other-team' },
    }), res);

    expect(sqlOf()).toContain('f.user_id = $3');
    expect(sqlOf()).toContain('d.deleted_at IS NULL');
    expect(sqlOf()).toContain('is_member_of_project');
    expect(paramsOf()).toEqual(['team-1', true, 'lead']);
    expect(res.body.body).toEqual(['page-1']);
  });

  it('returns no favorites for a guest', async () => {
    const res = createMockResponse();
    await TeamDocumentsController.favorites(createMockRequest({
      user: { id: 'guest', team_id: 'team-1', is_guest: true },
    }), res);
    expect(res.body.body).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
