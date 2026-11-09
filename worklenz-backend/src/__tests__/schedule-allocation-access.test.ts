import db from '../config/db';
import ScheduleControllerV2 from '../controllers/schedule-v2/schedule-controller';
import { IWorkLenzRequest } from '../interfaces/worklenz-request';
import { IWorkLenzResponse } from '../interfaces/worklenz-response';

jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));

const query = db.query as jest.Mock;
const request = {
  user: { team_id: 'team-1' },
  body: { project_id: 'project-1', team_member_id: 'member-1', allocated_from: '2026-01-01', allocated_to: '2026-01-02', seconds_per_day: 1 },
} as unknown as IWorkLenzRequest;

function response() {
  return { status: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis() };
}

describe('schedule allocation ownership', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a project or member outside the active team before inserting', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = response();
    await ScheduleControllerV2.createSchedule(request, res as unknown as IWorkLenzResponse);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(['project-1', 'member-1', 'team-1']);
  });

  it('creates an allocation for a project and member in the active team', async () => {
    query.mockResolvedValueOnce({ rows: [{}] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const res = response();
    await ScheduleControllerV2.createSchedule(request, res as unknown as IWorkLenzResponse);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(query).toHaveBeenCalledTimes(3);
  });
});
