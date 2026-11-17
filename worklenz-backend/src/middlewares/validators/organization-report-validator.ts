import { NextFunction } from 'express';
import { IWorkLenzRequest } from '../../interfaces/worklenz-request';
import { IWorkLenzResponse } from '../../interfaces/worklenz-response';
import { ServerResponse } from '../../models/server-response';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateOrganizationReport(req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) {
  const body = req.body ?? {};
  for (const field of ['teams', 'projects'] as const) {
    if (body[field] !== undefined && (!Array.isArray(body[field]) || body[field].some((id: unknown) => typeof id !== 'string' || !UUID.test(id)))) {
      return res.status(400).send(new ServerResponse(false, null, `Invalid ${field}`));
    }
  }
  if (body.level !== undefined && !['member', 'team', 'project', 'company'].includes(body.level)) {
    return res.status(400).send(new ServerResponse(false, null, 'Invalid report level'));
  }
  if (body.month !== undefined && (typeof body.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month))) {
    return res.status(400).send(new ServerResponse(false, null, 'Invalid month'));
  }
  next();
}
