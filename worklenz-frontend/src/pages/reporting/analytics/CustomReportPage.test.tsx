import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { analyticsTemplatesApiService } from '@/api/reporting/analytics-templates.api.service';
import CustomReportPage from './CustomReportPage';

vi.mock('@/api/reporting/analytics-templates.api.service', () => ({ analyticsTemplatesApiService: { listTemplates: vi.fn() } }));
vi.mock('@/utils/session-helper', () => ({ getUserSession: () => ({ team_id: 'team', id: 'user' }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuthService: () => ({ getCurrentSession: () => ({ team_id: 'team', id: 'user' }) }) }));
vi.mock('@/hooks/useDoumentTItle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }) }));
vi.mock('@/lib/reporting/analytics-nav', () => ({ ANALYTICS_BASE_PATH: '/reports', isBusinessAnalyticsReport: () => false, flatAnalyticsNavItems: () => [] }));
vi.mock('@/components/reporting/analytics', () => ({ ReportPageShell: () => null }));
vi.mock('@/components/reporting/analytics/AnalyticsBusinessGate', () => ({ AnalyticsBusinessGate: () => null }));
vi.mock('@/components/reporting/analytics/states/ReportStateViews', () => ({ ReportErrorState: () => <div>Load failed</div> }));
vi.mock('@/components/suspense-fallback/suspense-fallback', () => ({ SuspenseFallback: () => <div>Loading</div> }));
vi.mock('@/pages/reporting/analytics/VelocityPage', () => ({ default: ({ customTemplateName }: { customTemplateName: string }) => <div>{customTemplateName}</div> }));
vi.mock('@/shared/antd-imports', () => ({ Button: () => null, Empty: () => null, Typography: { Text: () => null } }));

type TemplateResponse = Awaited<ReturnType<typeof analyticsTemplatesApiService.listTemplates>>;
const openReport = () => render(
  <MemoryRouter initialEntries={['/custom/template']}>
    <Routes>
      <Route path="/custom/:id" element={<CustomReportPage />} />
      <Route path="/reports" element={<div>Reports hub</div>} />
    </Routes>
  </MemoryRouter>
);

describe('custom report deep links', () => {
  beforeEach(() => localStorage.clear());

  it('waits for API templates on an empty cache before opening a shared report', async () => {
    let resolve!: (value: TemplateResponse) => void;
    vi.mocked(analyticsTemplatesApiService.listTemplates).mockReturnValue(new Promise(done => { resolve = done; }));
    openReport();
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.queryByText('Reports hub')).not.toBeInTheDocument();
    await act(async () => { resolve({ done: true, body: [{ id: 'template', name: 'Shared velocity', report_kind: 'velocity' }] } as TemplateResponse); });
    expect(await screen.findByText('Shared velocity')).toBeInTheDocument();
  });

  it('redirects only after a successful lookup confirms the template is missing', async () => {
    vi.mocked(analyticsTemplatesApiService.listTemplates).mockResolvedValue({ done: true, body: [] } as TemplateResponse);
    openReport();
    expect(await screen.findByText('Reports hub')).toBeInTheDocument();
  });

  it('shows a recovery state when the API fails instead of treating the report as missing', async () => {
    vi.mocked(analyticsTemplatesApiService.listTemplates).mockRejectedValue(new Error('offline'));
    openReport();
    expect(await screen.findByText('Load failed')).toBeInTheDocument();
    expect(screen.queryByText('Reports hub')).not.toBeInTheDocument();
  });
});
