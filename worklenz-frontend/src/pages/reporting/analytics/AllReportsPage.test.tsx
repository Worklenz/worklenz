import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ILocalSession } from '@/types/auth/local-session.types';
import AllReportsPage from './AllReportsPage';

const state = vi.hoisted(() => ({ session: null as ILocalSession | null, health: vi.fn(), budget: vi.fn(), dispatch: vi.fn(), navigate: vi.fn() }));
const translate = (_key: string, options: { defaultValue: string; name?: string }) => options.defaultValue.replace('{{name}}', options.name ?? '');
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => state.navigate }));
vi.mock('@/hooks/useAuth', () => ({ useAuthService: () => ({ getCurrentSession: () => state.session }) }));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => state.dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({ useAppSelector: () => 'light' }));
vi.mock('@/hooks/useDoumentTItle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('@/features/admin-center/admin-center.slice', () => ({ openUpgradeModal: (payload: string) => ({ type: 'upgrade', payload }) }));
vi.mock('@/features/reporting/analytics-custom-reports', () => ({ useAnalyticsCustomReports: () => ({ customReports: [], hasCustomReports: false, refreshCustomReports: vi.fn(), storageKey: 'test' }), syncTemplatesToCustomReports: vi.fn() }));
vi.mock('@/components/reporting/analytics/ReportCardPreview', () => ({ ReportCardPreview: () => null }));
vi.mock('@/api/reporting/analytics-templates.api.service', () => ({ analyticsTemplatesApiService: { listTemplates: vi.fn().mockResolvedValue({ done: false }) } }));
vi.mock('@/api/reporting/analytics-project-health.api.service', () => ({ analyticsProjectHealthApiService: { getSeries: state.health } }));
vi.mock('@/api/reporting/analytics-budget-tracking.api.service', () => ({ analyticsBudgetTrackingApiService: { getSeries: state.budget } }));
vi.mock('@/api/reporting/analytics-time-report.api.service', () => ({ analyticsTimeReportApiService: { getSeries: vi.fn().mockResolvedValue(null) } }));
vi.mock('@/api/reporting/analytics-utilization.api.service', () => ({ analyticsUtilizationApiService: { getSeries: vi.fn().mockResolvedValue(null) } }));
vi.mock('@/api/reporting/analytics-velocity.api.service', () => ({ analyticsVelocityApiService: { getSeries: vi.fn().mockResolvedValue(null) } }));
vi.mock('@/api/reporting/analytics-planned-vs-actual-tasks.api.service', () => ({ analyticsPlannedVsActualTasksApiService: { getSeries: vi.fn().mockResolvedValue(null) } }));
vi.mock('@/api/reporting/analytics-planned-vs-actual-milestones.api.service', () => ({ analyticsPlannedVsActualMilestonesApiService: { getSeries: vi.fn().mockResolvedValue(null) } }));
vi.mock('@/api/reporting/analytics-cfd.api.service', () => ({ analyticsCfdApiService: { getSeries: vi.fn().mockResolvedValue(null) } }));
vi.mock('@/api/reporting/analytics-time-in-status.api.service', () => ({ analyticsTimeInStatusApiService: { getSeries: vi.fn().mockResolvedValue(null) } }));

beforeEach(() => {
  vi.clearAllMocks();
  state.health.mockResolvedValue(null);
  state.budget.mockResolvedValue(null);
});

it.each([false, true])('respects finance entitlement in the gallery (access: %s)', async canAccess => {
  state.session = { entitlements: { tier: 'business', features: canAccess ? ['finance_module'] : ['advanced_reporting'], enforced: true, guest_limit: -1, seat_limit: -1, primary_source: 'test' } } as ILocalSession;
  render(<AllReportsPage />);
  await act(async () => {});
  const health = screen.getByRole('button', { name: canAccess ? 'Open Project Health' : 'Project Health — Business plan required' });
  fireEvent.click(health);
  if (canAccess) {
    await waitFor(() => expect(state.health).toHaveBeenCalled());
    expect(state.budget).toHaveBeenCalled();
    expect(state.navigate).toHaveBeenCalled();
  } else {
    expect(state.health).not.toHaveBeenCalled();
    expect(state.budget).not.toHaveBeenCalled();
    expect(state.dispatch).toHaveBeenCalledWith({ type: 'upgrade', payload: 'default' });
  }
});
