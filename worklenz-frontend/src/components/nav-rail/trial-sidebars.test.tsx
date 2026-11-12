import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomeLeftSidebar from '@/pages/home/home-left-sidebar/HomeLeftSidebar';
import PlannerLeftSidebar from '@/features/schedule/PlannerLeftSidebar';
import en from '../../../public/locales/en/common.json';
import italian from '../../../public/locales/it/common.json';

const state = vi.hoisted(() => ({ days: 8, dispatch: vi.fn() }));

vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    getCurrentSession: () => ({
      subscription_type: 'TRIAL',
      valid_till_date: new Date(Date.now() + state.days * 86400000).toISOString(),
    }),
  }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => state.dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({ useAppSelector: () => 'light' }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/components/nav-rail/NavRail', () => ({ default: () => null }));
vi.mock('@/components/mobile-app/MobileAppModal', () => ({ default: () => null }));
vi.mock('@/features/navigation/useNavPreferences', () => ({
  useNavPreferences: () => ({
    resolved: { collapsed: true },
    pin: vi.fn(), unpin: vi.fn(), isPinned: vi.fn(), reorder: vi.fn(), toggleCollapsed: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  state.dispatch.mockClear();
});

describe.each([
  ['home', HomeLeftSidebar, 'overview'],
  ['planner', PlannerLeftSidebar, 'schedule'],
] as const)('%s trial sidebar', (_name, Sidebar, activeView) => {
  it.each([
    ['en', 1, '1 day', 'Trial', 'UPGRADE', 'Upgrade your plan'],
    ['it', 8, '8 giorni', 'Prova', 'PASSA A PRO', 'Passa a un piano superiore'],
  ])('shows translated labels in %s', async (language, days, daysText, trialText, upgradeText, upgradeLabel) => {
    state.days = days;
    const i18n = createInstance();
    await i18n.use(initReactI18next).init({
      lng: language,
      fallbackLng: 'en',
      resources: { en: { common: en }, it: { common: italian } },
      interpolation: { escapeValue: false },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <Sidebar activeView={activeView as never} onViewChange={vi.fn()} />
      </I18nextProvider>
    );

    expect(screen.getByText(daysText)).toBeInTheDocument();
    expect(screen.getByText(trialText)).toBeInTheDocument();
    expect(screen.getByText(upgradeText)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: upgradeLabel }));
    expect(state.dispatch).toHaveBeenCalledTimes(1);
  });
});
