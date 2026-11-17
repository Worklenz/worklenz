import db from '../config/db';
import TaskPhasesController from '../controllers/task-phases-controller';
import { IWorkLenzRequest } from '../interfaces/worklenz-request';
import { IWorkLenzResponse } from '../interfaces/worklenz-response';

jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));

const query = db.query as jest.Mock;
const assigneeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const phaseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const projectId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const makeRequest = (assignee: string | null): IWorkLenzRequest => ({
  params: { id: phaseId }, query: { id: projectId }, body: { default_assignee_id: assignee },
} as unknown as IWorkLenzRequest);
const makeResponse = () => ({ status: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis() });

describe('phase default assignee updates', () => {
  beforeEach(() => jest.resetAllMocks());

  it('rejects an update when the saved project setting is disabled', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = makeResponse();
    await TaskPhasesController.updateDefaultAssignee(makeRequest(assigneeId), res as unknown as IWorkLenzResponse);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('p.phase_assignees_enabled IS TRUE'), [phaseId, projectId, assigneeId]);
  });

  it.each([assigneeId, null])('updates or clears the assignee when the project setting is enabled (%s)', async value => {
    query.mockResolvedValueOnce({ rows: [{ id: phaseId, default_assignee_id: value }] });
    const res = makeResponse();
    await TaskPhasesController.updateDefaultAssignee(makeRequest(value), res as unknown as IWorkLenzResponse);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('p.phase_assignees_enabled IS TRUE'), [phaseId, projectId, value]);
  });
});
