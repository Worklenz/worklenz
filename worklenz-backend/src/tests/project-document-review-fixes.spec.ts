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

it('searches with a one-character LIKE escape that PostgreSQL accepts', async () => {
  await ProjectDocumentsController.search(createMockRequest({ query: { project_id: 'project', q: '50%_off' } }), createMockResponse());
  const [sql, params] = query.mock.calls[0] as [string, string[]];
  expect(sql).toContain("ESCAPE '\\'");
  expect(sql).not.toContain("ESCAPE '\\\\'");
  expect(params[1]).toBe('%50\\%\\_off%');
});

describe('mention targets for newly added mentions', () => {
  const check = (mentions: Array<{ type: 'member' | 'task'; id: string }>, rows: Array<Array<Record<string, string>>>) => {
    const client = { query: jest.fn() };
    rows.forEach(result => client.query.mockResolvedValueOnce({ rows: result }));
    client.query.mockResolvedValue({ rows: [] });
    return (ProjectDocumentsController as any).assertMentionTargets(client, 'project', mentions);
  };

  it('accepts targets that are on the project', async () => {
    const result = await check([{ type: 'task', id: 't1' }], [[{ id: 't1' }]]);
    expect(result).toEqual({ error: null, gone: new Set() });
  });

  it('rejects a task that exists in another project', async () => {
    const result = await check([{ type: 'task', id: 't1' }], [[], [{ id: 't1' }]]);
    expect(result.error).toBe('A mentioned task is not in this project');
  });

  it('rejects a member who exists but is not on the project', async () => {
    const result = await check([{ type: 'member', id: 'u1' }], [[], [{ id: 'u1' }]]);
    expect(result.error).toBe('A mentioned member is not on this project');
  });

  it('drops deleted tasks and users instead of failing the save', async () => {
    const result = await check(
      [{ type: 'task', id: 't1' }, { type: 'member', id: 'u1' }],
      [[], [], [], []]
    );
    expect(result.error).toBeNull();
    expect([...result.gone].sort()).toEqual(['member:u1', 'task:t1']);
  });
});
