import { buildOrganizationReportScope } from '../controllers/reporting/organization-report-scope';

describe('organization report scope', () => {
  it('always restricts explicitly selected projects to the caller organization', () => {
    const result = buildOrganizationReportScope('caller-team', ['foreign-team'], ['foreign-project'], 3);
    expect(result.clause).toContain('in_organization(p.team_id, $3)');
    expect(result.clause).toContain('p.id IN ($4)');
    expect(result.params).toEqual(['caller-team', 'foreign-project']);
  });
  it('intersects selected teams with the caller organization', () => {
    const result = buildOrganizationReportScope('caller-team', ['foreign-team', 'local-team'], [], 1);
    expect(result.clause).toContain('in_organization(p.team_id, $1)');
    expect(result.clause).toContain('p.team_id IN ($2, $3)');
    expect(result.params).toEqual(['caller-team', 'foreign-team', 'local-team']);
  });
  it('scopes company totals and ignores selected filters', () => {
    const result = buildOrganizationReportScope('caller-team', ['team'], ['project'], 1, true);
    expect(result.clause).toBe('AND in_organization(p.team_id, $1)');
    expect(result.params).toEqual(['caller-team']);
  });
});
