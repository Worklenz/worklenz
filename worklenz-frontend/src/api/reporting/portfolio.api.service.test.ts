import { describe, expect, it, vi } from 'vitest';
import { buildPortfolioExportUrl } from './portfolio.api.service';

vi.mock('@/config/env', () => ({ default: { apiUrl: 'https://runtime-api.example.com' } }));
vi.mock('../api-client', () => ({ getCsrfToken: vi.fn(), ensureCsrfToken: vi.fn() }));

describe('portfolio export', () => {
  it('uses the configured API URL and selected period', () => {
    expect(buildPortfolioExportUrl({ period: 'quarterly', year: 2026, quarter: 2 }, 'detailed')).toBe(
      'https://runtime-api.example.com/api/v1/reporting-export/portfolio?period=quarterly&year=2026&quarter=2&type=detailed'
    );
  });
});
