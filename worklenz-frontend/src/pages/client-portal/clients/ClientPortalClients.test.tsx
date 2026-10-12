import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  usersTotal: 8,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? key),
  }),
}));

vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ isMobile: false }) }));
vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({ trackMixpanelEvent: vi.fn() }),
}));

vi.mock('@/api/client-portal/client-portal-api', () => ({
  useGetClientsStatsQuery: () => ({ data: { body: { total: 3 } }, isLoading: false }),
}));

vi.mock('@/api/client-portal/company-users-api', () => ({
  useGetCompanyUsersStatsQuery: () => ({ data: { body: { total: mocks.usersTotal } } }),
}));

// The two views and the drawers are covered by their own tests.
vi.mock('./ClientsTable', () => ({ default: () => <div>company table</div> }));
vi.mock('./ClientsStats', () => ({ ClientsStats: () => <div>company stats</div> }));
vi.mock('./company-users/CompanyUsersTab', () => ({
  CompanyUsersTab: ({ onOpenCompany }: { onOpenCompany: (id: string) => void }) => (
    <button onClick={() => onOpenCompany('client-9')}>company users view</button>
  ),
}));
vi.mock('@/components/client-portal/ClientDetailsDrawer', () => ({ default: () => null }));
vi.mock('@/components/client-portal/InviteLinkModal', () => ({ default: () => null }));

import ClientPortalClients from './ClientPortalClients';

const LocationProbe = () => {
  const location = useLocation();
  return (
    <>
      <div data-testid="search">{location.search}</div>
      <div data-testid="pathname">{location.pathname}</div>
    </>
  );
};

const renderPage = (initialEntry = '/worklenz/client-portal/clients') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ClientPortalClients />
      <LocationProbe />
    </MemoryRouter>
  );

describe('ClientPortalClients tabs', () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mocks.usersTotal = 8;
  });

  it('opens on the Company view', () => {
    renderPage();

    expect(screen.getByText('company table')).toBeInTheDocument();
    expect(screen.queryByText('company users view')).not.toBeInTheDocument();
  });

  it('shows the total number of company users on the tab', () => {
    renderPage();

    expect(screen.getByRole('radio', { name: /Client Users/ })).toHaveTextContent('8');
  });

  it('opens on Company Users when the URL asks for it, so returning from a client keeps the tab', () => {
    renderPage('/worklenz/client-portal/clients?view=users');

    expect(screen.getByText('company users view')).toBeInTheDocument();
    expect(screen.queryByText('company table')).not.toBeInTheDocument();
  });

  it('switches view and records it in the URL', () => {
    renderPage();

    fireEvent.click(screen.getByRole('radio', { name: /Client Users/ }));
    expect(screen.getByText('company users view')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('?view=users');

    fireEvent.click(screen.getByRole('radio', { name: 'Clients' }));
    expect(screen.getByText('company table')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toBeEmptyDOMElement();
  });

  it('keeps other query parameters when switching view', () => {
    renderPage('/worklenz/client-portal/clients?foo=bar');

    fireEvent.click(screen.getByRole('radio', { name: /Client Users/ }));

    expect(screen.getByTestId('search')).toHaveTextContent('?foo=bar&view=users');
  });

  it('opens a company from the users view in its workspace', () => {
    renderPage('/worklenz/client-portal/clients?view=users');

    fireEvent.click(screen.getByText('company users view'));

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/worklenz/client-portal/clients/client-9'
    );
  });
});
