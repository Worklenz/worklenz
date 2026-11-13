import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportingExportApiService } from './reporting-export.api.service';

vi.mock('@/config/env', () => ({ default: { apiUrl: 'https://api.ncinga.example.com' } }));

afterEach(() => vi.unstubAllGlobals());

describe('reporting exports', () => {
  it('downloads the projects report from the configured API with the team name', () => {
    const location = { href: '' };
    vi.stubGlobal('window', { location });

    reportingExportApiService.exportProjects('Design & Creative');

    expect(location.href).toBe(
      'https://api.ncinga.example.com/api/v1/reporting-export/projects/export?team_name=Design%20%26%20Creative'
    );
  });
});
