import db from '../config/db';
import { classifyUtilization, getUtilizationThresholds, updateUtilizationSettings } from '../controllers/admin-center/utilization-settings-controller';
import { IWorkLenzRequest } from '../interfaces/worklenz-request';
import { IWorkLenzResponse } from '../interfaces/worklenz-response';

jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
const query = db.query as jest.Mock;
const response = () => {
  const res = { status: jest.fn(), send: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('utilization settings', () => {
  beforeEach(() => query.mockReset());
  it.each([[79.9, 'under'], [80, 'optimal'], [120, 'optimal'], [120.1, 'over']] as const)('classifies %s at configured boundaries', (value, expected) => {
    expect(classifyUtilization(value, 80, 120)).toBe(expected);
  });
  it('defaults to 90–110 when no settings exist', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(getUtilizationThresholds('org')).resolves.toEqual({
      utilization_optimal_min_threshold_percent: 90, utilization_optimal_max_threshold_percent: 110,
    });
    expect(query).toHaveBeenCalledWith(expect.any(String), ['org']);
  });
  it.each([[0, 110], [90, 90], [90, 201], [90.5, 110]])('rejects invalid boundaries %s and %s', async (min, max) => {
    const res = response();
    const req = { body: { utilization_optimal_min_threshold_percent: min, utilization_optimal_max_threshold_percent: max }, user: { organization_id: 'org' } };
    await updateUtilizationSettings(req as IWorkLenzRequest, res as unknown as IWorkLenzResponse);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(query).not.toHaveBeenCalled();
  });
  it('saves valid thresholds for the current organization', async () => {
    query.mockResolvedValue({ rows: [{ utilization_optimal_min_threshold_percent: 80, utilization_optimal_max_threshold_percent: 120 }] });
    const res = response();
    const req = { body: { utilization_optimal_min_threshold_percent: 80, utilization_optimal_max_threshold_percent: 120 }, user: { organization_id: 'org' } };
    await updateUtilizationSettings(req as IWorkLenzRequest, res as unknown as IWorkLenzResponse);
    expect(query).toHaveBeenCalledWith(expect.any(String), ['org', 80, 120]);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
