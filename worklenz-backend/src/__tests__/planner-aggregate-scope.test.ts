jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
import db from '../config/db';
import WorkloadController from '../controllers/schedule-v2/workload-controller';
import CapacityController from '../controllers/schedule-v2/capacity-controller';
import { createMockRequest, createMockResponse } from '../tests/utils/express-mock';
const query = db.query as jest.Mock;
const visible = ['11111111-1111-4111-8111-111111111111'];
describe('planner aggregate visibility', () => {
  beforeEach(() => query.mockReset());
  it('scopes capacity aggregation before calculating totals', async () => {
    query.mockResolvedValueOnce({ rows: [{ organization_id: 'org', active_team: 'team' }] })
      .mockResolvedValueOnce({ rows: [{}] });
    const req = createMockRequest({ query: { startDate: '2026-01-01', endDate: '2026-01-02' } });
    req.plannerVisibleProjectIds = visible;
    await CapacityController.getCapacitySummary(req, createMockResponse());
    expect(query.mock.calls[1][0]).toContain('calculate_member_capacity_scoped');
    expect(query.mock.calls[1][1]).toEqual(['team', '2026-01-01', '2026-01-02', visible]);
  });
  it('scopes workload allocations before computing derived values', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'org', hours_per_day: 8 }] })
      .mockResolvedValueOnce({ rows: [{ workload_data: [] }] });
    const req = createMockRequest({ query: { startDate: '2026-01-01', endDate: '2026-01-02' } });
    req.plannerVisibleProjectIds = visible;
    await WorkloadController.getMemberWorkload(req, createMockResponse());
    expect(query.mock.calls[1][0]).toContain('pma.project_id = ANY($5::UUID[])');
    expect(query.mock.calls[1][1]).toEqual(['2026-01-01', '2026-01-02', 'org', 8, visible]);
  });
});
