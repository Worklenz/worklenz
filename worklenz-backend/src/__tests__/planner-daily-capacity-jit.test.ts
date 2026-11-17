jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn(), connect: jest.fn() } }));
jest.mock('../decorators/handle-exceptions', () => ({ __esModule: true, default: () => () => undefined }));

import db from '../config/db';
import CapacityController from '../controllers/schedule-v2/capacity-controller';
import { createMockRequest, createMockResponse } from '../tests/utils/express-mock';

describe('daily capacity transaction', () => {
  const query = db.query as jest.Mock;
  const connect = db.connect as jest.Mock;
  const clientQuery = jest.fn();
  const release = jest.fn();
  const req = createMockRequest({ query: { startDate: '2026-11-16', endDate: '2026-11-20' } });

  beforeEach(() => {
    jest.resetAllMocks();
    query.mockResolvedValueOnce({ rows: [{ organization_id: 'org', active_team: 'team' }] })
      .mockResolvedValueOnce({ rows: [{ team_member_id: 'member', member_name: 'Name', member_email: 'email' }] });
    clientQuery.mockResolvedValue({ rows: [] });
    connect.mockResolvedValue({ query: clientQuery, release });
  });

  it('returns capacity with JIT disabled only within a read-only transaction', async () => {
    clientQuery.mockImplementation(async (sql: string) => sql.startsWith('SELECT *') ? {
      rows: [{ date: '2026-11-18', working_hours: '0', is_time_off: true, is_full_day_time_off: true }],
    } : { rows: [] });
    const res = createMockResponse();
    await CapacityController.getDailyCapacity(req, res);
    expect(res.body.done).toBe(true);
    expect(res.body.body[0].daily_capacity[0]).toMatchObject({ date: '2026-11-18', is_time_off: true, working_hours: 0 });
    expect(clientQuery.mock.calls.map(call => call[0])).toEqual([
      'BEGIN READ ONLY', 'SET LOCAL jit = off',
      expect.stringContaining('calculate_member_capacity_scoped'), 'COMMIT',
    ]);
    expect(release).toHaveBeenCalledWith(false);
  });

  it('rolls back on failure and discards the connection if rollback fails', async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT *') || sql === 'ROLLBACK') throw new Error(sql);
      return { rows: [] };
    });
    await expect(CapacityController.getDailyCapacity(req, createMockResponse())).rejects.toThrow('SELECT *');
    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledWith(true);
  });
});
