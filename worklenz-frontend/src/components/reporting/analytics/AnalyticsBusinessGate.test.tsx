import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider, theme } from 'antd';
import type { ILocalSession } from '@/types/auth/local-session.types';
import { AnalyticsBusinessGate, AnalyticsFinanceGate } from './AnalyticsBusinessGate';
import { flatAnalyticsNavItems } from '@/lib/reporting/analytics-nav';
import reportingRoutes from '@/app/routes/reporting-routes';

const state = vi.hoisted(() => ({ session: null as ILocalSession | null, dispatch: vi.fn(), renderReport: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuthService: () => ({ getCurrentSession: () => state.session }) }));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => state.dispatch }));
vi.mock('@/features/admin-center/admin-center.slice', () => ({ openUpgradeModal: (payload: string) => ({ type: 'upgrade', payload }) }));
vi.mock('@/hooks/useDoumentTItle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }) }));
vi.mock('./ReportPageShell', () => ({ ReportPageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/shared/antd-imports', async () => {
  const antd = await import('antd');
  const icons = await import('@ant-design/icons');
  return { ...antd, ...icons };
});
vi.mock('@/layouts/ReportingLayout', () => ({ default: () => null }));
vi.mock('@/layouts/AnalyticsReportingLayout', () => ({ default: () => null }));
vi.mock('@/lib/reporting/reporting-constants', () => ({ reportingsItems: [] }));
vi.mock('@/components/suspense-fallback/suspense-fallback', () => ({ SuspenseFallback: () => null }));
vi.mock('@/features/navigation/NavSurfaceIndexRedirect', () => ({ default: () => null }));
vi.mock('@/guards/GuestRedirect', () => ({ default: () => null }));
vi.mock('@/hooks/useAuthStatus', () => ({ useAuthStatus: vi.fn() }));
vi.mock('@/pages/reporting/analytics/ProjectHealthPage', () => ({ default: () => { state.renderReport(); return <div>Report content</div>; } }));
vi.mock('@/pages/reporting/analytics/BudgetTrackingPage', () => ({ default: () => { state.renderReport(); return <div>Report content</div>; } }));

const setFeatures = (features: string[]) => {
  state.session = {
    entitlements: { tier: 'business', features, enforced: true, guest_limit: -1, seat_limit: -1, primary_source: 'test' },
  } as ILocalSession;
};
beforeEach(() => { vi.clearAllMocks(); state.session = null; });

for (const [mode, algorithm] of [['light', theme.defaultAlgorithm], ['dark', theme.darkAlgorithm]] as const) {
  describe(`finance gate in ${mode} theme`, () => {
    it('shows upgrade and keeps the report unmounted without finance access', () => {
      setFeatures(['advanced_reporting']);
      render(<ConfigProvider theme={{ algorithm }}>
        <AnalyticsFinanceGate titleKey="projectHealth" titleDefault="Project Health"><div>Report content</div></AnalyticsFinanceGate>
      </ConfigProvider>);
      expect(screen.queryByText('Report content')).not.toBeInTheDocument();
      expect(screen.getByText('Project Health and Budget Tracking are available on the Business plan.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Upgrade to Business/ }));
      expect(state.dispatch).toHaveBeenCalledWith({ type: 'upgrade', payload: 'default' });
    });

    it('allows finance access independently of advanced reporting', () => {
      setFeatures(['finance_module']);
      render(<ConfigProvider theme={{ algorithm }}>
        <AnalyticsFinanceGate titleKey="budgetTracking" titleDefault="Budget Tracking"><div>Report content</div></AnalyticsFinanceGate>
      </ConfigProvider>);
      expect(screen.getByText('Report content')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Upgrade to Business/ })).not.toBeInTheDocument();
    });
  });
}

it('preserves the advanced_reporting gate', () => {
  setFeatures(['finance_module']);
  render(<AnalyticsBusinessGate titleKey="velocity" titleDefault="Velocity"><div>Report content</div></AnalyticsBusinessGate>);
  expect(screen.queryByText('Report content')).not.toBeInTheDocument();
  expect(screen.getByText('Business plan required')).toBeInTheDocument();
});

it.each(['project-health', 'budget-tracking'])('gates the %s route before mounting the report', async path => {
  setFeatures(['advanced_reporting']);
  const route = reportingRoutes.find(route => route.path === 'worklenz/reporting/analytics')?.children?.find(route => route.path === path);
  const { unmount } = render(<>{route?.element}</>);
  expect(screen.getByText('Business plan required')).toBeInTheDocument();
  expect(state.renderReport).not.toHaveBeenCalled();
  unmount();
  setFeatures(['finance_module']);
  render(<>{route?.element}</>);
  expect(await screen.findByText('Report content')).toBeInTheDocument();
});

it('marks finance sidebar entries with their own feature requirement', () => {
  for (const key of ['project-health', 'budget-tracking']) {
    expect(flatAnalyticsNavItems().find(item => item.key === key)?.requiredFeature).toBe('finance_module');
  }
  expect(flatAnalyticsNavItems().find(item => item.key === 'velocity')?.requiredFeature).toBe('advanced_reporting');
  expect(flatAnalyticsNavItems().find(item => item.key === 'time-report')?.requiredFeature).toBeUndefined();
});
