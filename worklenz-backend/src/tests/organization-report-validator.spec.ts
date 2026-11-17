import { validateOrganizationReport } from '../middlewares/validators/organization-report-validator';
import { IWorkLenzRequest } from '../interfaces/worklenz-request';
import { IWorkLenzResponse } from '../interfaces/worklenz-response';

const check = (body: object) => {
  const req = { body } as IWorkLenzRequest;
  const res = { status: jest.fn(), send: jest.fn() };
  res.status.mockReturnValue(res);
  const next = jest.fn();
  validateOrganizationReport(req, res as unknown as IWorkLenzResponse, next);
  return { res, next };
};

describe('organization report validation', () => {
  it.each([
    { teams: 'not-an-array' }, { projects: ['not-a-uuid'] },
    { level: 'invalid' }, { month: '2026-13' },
  ])('rejects malformed filters: %o', body => {
    const { res, next } = check(body);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
  it('accepts valid scoped filters', () => {
    const { next } = check({ teams: ['00000000-0000-0000-0000-000000000001'], month: '2026-11', level: 'team' });
    expect(next).toHaveBeenCalled();
  });
});
