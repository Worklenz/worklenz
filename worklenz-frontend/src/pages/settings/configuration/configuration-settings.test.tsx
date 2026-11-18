import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfigurationSettings from './configuration-settings';

vi.mock('@/addons/addon-slots', () => ({
  getAddonSlotItems: (slot: string) => slot === 'configurationSettings'
    ? [{ key: 'scheduled-reports', component: () => <div>Scheduled reports add-on</div> }]
    : [],
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }) }));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/hooks/useAppSelector', () => ({ useAppSelector: () => ({ timelog_backdate_limit_days: 0, restrict_task_creation: false, enforce_daily_time_limit: false }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuthService: () => ({ getCurrentSession: () => ({}), isOwnerOrAdmin: () => true }) }));
vi.mock('@/features/org-config/org-config.slice', () => ({ fetchOrgConfig: () => ({ type: 'fetch' }), updateOrgConfig: vi.fn() }));
vi.mock('@/features/admin-center/admin-center.slice', () => ({ toggleUpgradeModal: vi.fn() }));
vi.mock('@/utils/subscription-utils', () => ({ canUseFeature: () => true, hasBusinessFeatureAccess: () => true }));

describe('Configuration settings', () => {
  it('renders add-ons registered in the configuration settings slot', () => {
    render(<ConfigurationSettings />);
    expect(screen.getByText('Scheduled reports add-on')).toBeInTheDocument();
  });
});
