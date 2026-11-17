import db from '../../config/db';
import { IWorkLenzRequest } from '../../interfaces/worklenz-request';
import { IWorkLenzResponse } from '../../interfaces/worklenz-response';
import { ServerResponse } from '../../models/server-response';

export function classifyUtilization(percent: number, min: number, max: number): 'under' | 'optimal' | 'over' {
  if (percent < min) return 'under';
  return percent <= max ? 'optimal' : 'over';
}

export async function getUtilizationThresholds(organizationId: string | undefined) {
  const result = await db.query(
    'SELECT utilization_optimal_min_threshold_percent, utilization_optimal_max_threshold_percent FROM organization_utilization_thresholds WHERE organization_id = $1',
    [organizationId]
  );
  return result.rows[0] ?? { utilization_optimal_min_threshold_percent: 90, utilization_optimal_max_threshold_percent: 110 };
}

export async function getUtilizationSettings(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  return res.status(200).send(new ServerResponse(true, await getUtilizationThresholds(req.user?.organization_id)));
}

export async function updateUtilizationSettings(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const min = req.body?.utilization_optimal_min_threshold_percent;
  const max = req.body?.utilization_optimal_max_threshold_percent;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 200 || min >= max) {
    return res.status(400).send(new ServerResponse(false, null, 'Invalid utilization thresholds'));
  }
  const result = await db.query(`INSERT INTO organization_utilization_thresholds
    (organization_id, utilization_optimal_min_threshold_percent, utilization_optimal_max_threshold_percent)
    VALUES ($1, $2, $3) ON CONFLICT (organization_id) DO UPDATE SET
    utilization_optimal_min_threshold_percent = EXCLUDED.utilization_optimal_min_threshold_percent,
    utilization_optimal_max_threshold_percent = EXCLUDED.utilization_optimal_max_threshold_percent,
    updated_at = CURRENT_TIMESTAMP
    RETURNING utilization_optimal_min_threshold_percent, utilization_optimal_max_threshold_percent`,
    [req.user?.organization_id, min, max]);
  return res.status(200).send(new ServerResponse(true, result.rows[0]));
}
