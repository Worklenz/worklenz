import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyticsTemplatesApiService } from '@/api/reporting/analytics-templates.api.service';
import { getUserSession } from '@/utils/session-helper';
import { useAnalyticsReportTemplates } from './useAnalyticsReportTemplates';

vi.mock('@/api/reporting/analytics-templates.api.service', () => ({
  analyticsTemplatesApiService: { listTemplates: vi.fn() },
}));
vi.mock('@/utils/session-helper', () => ({ getUserSession: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuthService: vi.fn() }));
vi.mock('@/lib/reporting/analytics-nav', () => ({ flatAnalyticsNavItems: () => [] }));
vi.mock('@/shared/antd-imports', () => ({ message: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: vi.fn() }) }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams(), vi.fn()] }));

type TemplateResponse = Awaited<ReturnType<typeof analyticsTemplatesApiService.listTemplates>>;
const response = {
  done: true,
  body: [{ id: 'private', report_kind: 'velocity', name: 'Private', is_default: true }],
} as TemplateResponse;

describe('analytics template requests during team switches', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getUserSession).mockReturnValue({ team_id: 'old', id: 'user' } as ReturnType<typeof getUserSession>);
  });

  it('discards a late report-kind response before changing filters or state', async () => {
    let resolve!: (value: TemplateResponse) => void;
    vi.mocked(analyticsTemplatesApiService.listTemplates).mockReturnValue(new Promise(done => { resolve = done; }));
    const onApply = vi.fn();
    const { result } = renderHook(() => useAnalyticsReportTemplates({ reportKind: 'velocity', onApply, getFilters: () => ({}) }));
    vi.mocked(getUserSession).mockReturnValue({ team_id: 'new', id: 'user' } as ReturnType<typeof getUserSession>);
    await act(async () => { resolve(response); });
    expect(result.current.templates).toEqual([]);
    expect(onApply).not.toHaveBeenCalled();
    expect(analyticsTemplatesApiService.listTemplates).toHaveBeenCalledTimes(1);
  });

  it('does not apply a default or cache data after switching during the all-kinds request', async () => {
    let resolve!: (value: TemplateResponse) => void;
    vi.mocked(analyticsTemplatesApiService.listTemplates)
      .mockResolvedValueOnce(response)
      .mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const onApply = vi.fn();
    renderHook(() => useAnalyticsReportTemplates({ reportKind: 'velocity', onApply, getFilters: () => ({}) }));
    await waitFor(() => expect(analyticsTemplatesApiService.listTemplates).toHaveBeenCalledTimes(2));
    vi.mocked(getUserSession).mockReturnValue({ team_id: 'new', id: 'user' } as ReturnType<typeof getUserSession>);
    await act(async () => { resolve(response); });
    expect(onApply).not.toHaveBeenCalled();
    expect(localStorage.getItem('worklenz.analyticsCustomReports:old:user')).toBeNull();
    expect(localStorage.getItem('worklenz.analyticsCustomReports:new:user')).toBeNull();
  });
});
