import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openAddCompanyUserDrawer,
  toggleClientDetailsDrawer,
  toggleClientSettingsDrawer,
} from '@/features/clients-portal/clients/clients-slice';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  trackMixpanelEvent: vi.fn(),
  refetchProfile: vi.fn(),
  refetchStats: vi.fn(),
  profile: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
  },
  stats: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => {
      let value = String(options.defaultValue ?? key);
      Object.entries(options).forEach(([param, paramValue]) => {
        value = value.split(`{{${param}}}`).join(String(paramValue));
      });
      return value;
    },
  }),
}));

vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({ trackMixpanelEvent: mocks.trackMixpanelEvent }),
}));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ themeReducer: { mode: 'light' } }),
}));
vi.mock('@/utils/dateUtils', () => ({ fromNow: () => '3 days ago' }));

vi.mock('@/api/client-portal/client-workspace-api', () => ({
  useGetClientWorkspaceProfileQuery: () => ({ ...mocks.profile, refetch: mocks.refetchProfile }),
  useGetClientWorkspaceStatsQuery: () => ({ ...mocks.stats, refetch: mocks.refetchStats }),
}));

// Each tab has its own tests; here they only show which one is open and what it was given.
vi.mock('./OverviewTab', () => ({
  OverviewTab: ({ clientName }: { clientName: string }) => <div>overview tab for {clientName}</div>,
}));
vi.mock('./MessagesTab', () => ({ MessagesTab: () => <div>messages tab</div> }));
vi.mock('./MembersTab', () => ({
  MembersTab: ({ onAddUser }: { onAddUser: () => void }) => (
    <button onClick={onAddUser}>members tab add user</button>
  ),
}));
vi.mock('./ProjectsTab', () => ({
  ProjectsTab: ({ onAssignProject }: { onAssignProject: () => void }) => (
    <button onClick={onAssignProject}>projects tab assign</button>
  ),
}));
vi.mock('./BillingTab', () => ({
  BillingTab: ({ portalStatus }: { portalStatus?: string }) => (
    <div>billing tab {portalStatus}</div>
  ),
}));
vi.mock('@/components/client-portal/ClientDetailsDrawer', () => ({ default: () => null }));
vi.mock('@/components/client-portal/ClientSettingsDrawer', () => ({ default: () => null }));

import ClientWorkspacePage from './ClientWorkspacePage';

const PROFILE = {
  id: 'client-1',
  name: 'Dilshan',
  email: 'hello@beacon.io',
  company_name: 'Beacon Logistics',
  phone: null,
  contact_person: null,
  status: 'active',
  assigned_projects_count: 3,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const STATS = {
  totalProjects: 3,
  activeProjects: 2,
  completedProjects: 1,
  tasksOpen: 7,
  invoicesDue: 2,
  unansweredMessages: 4,
  outstanding: [{ currency: 'USD', amount: 1200 }],
  totalTeamMembers: 3,
  lastLoginAt: '2026-09-20T00:00:00.000Z',
  hasSignedIn: true,
  invitedAt: null,
  portalStatus: { status: 'active', label: 'Active', color: 'green' },
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderPage = (entry = '/worklenz/client-portal/clients/client-1') =>
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: entry.split('?')[0],
          search: entry.includes('?') ? `?${entry.split('?')[1]}` : '',
          key: 'default',
        },
      ]}
    >
      <Routes>
        <Route path="/worklenz/client-portal/clients/:id" element={<ClientWorkspacePage />} />
        <Route path="/worklenz/client-portal/clients" element={<div>clients list</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );

describe('ClientWorkspacePage', () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mocks.trackMixpanelEvent.mockReset();
    mocks.refetchProfile.mockReset();
    mocks.refetchStats.mockReset();
    mocks.profile.data = { done: true, body: PROFILE };
    mocks.profile.isLoading = false;
    mocks.profile.isError = false;
    mocks.profile.error = undefined;
    mocks.stats.data = { done: true, body: STATS };
    mocks.stats.isLoading = false;
    mocks.stats.isError = false;
  });

  describe('states', () => {
    it('shows a placeholder while the client loads', () => {
      mocks.profile.isLoading = true;
      mocks.profile.data = undefined;

      renderPage();

      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });

    it('says so when the client does not exist, with a way back', () => {
      mocks.profile.isError = true;
      mocks.profile.data = undefined;
      mocks.profile.error = { status: 404 };

      renderPage();

      expect(screen.getByText('Client not found')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Back to clients' }));
      expect(screen.getByText('clients list')).toBeInTheDocument();
    });

    it('offers a retry for any other failure', () => {
      mocks.profile.isError = true;
      mocks.profile.data = undefined;
      mocks.profile.error = { status: 500 };

      renderPage();

      expect(screen.getByText('Could not load this client')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(mocks.refetchProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('header', () => {
    it('shows the company, its portal status and when they last signed in', () => {
      renderPage();

      expect(screen.getByText('Beacon Logistics', { selector: 'h4' })).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Last signed in 3 days ago')).toBeInTheDocument();
    });

    it('shows when the invitation went out for a client that has not signed in', () => {
      mocks.stats.data = {
        done: true,
        body: {
          ...STATS,
          lastLoginAt: null,
          hasSignedIn: false,
          invitedAt: '2026-09-20T00:00:00.000Z',
          portalStatus: { status: 'invited', label: 'Invited', color: 'orange' },
        },
      };

      renderPage();

      expect(screen.getByText('Invited 3 days ago')).toBeInTheDocument();
    });

    it('says never signed in for a client who was never invited', () => {
      mocks.stats.data = {
        done: true,
        body: {
          ...STATS,
          lastLoginAt: null,
          hasSignedIn: false,
          portalStatus: { status: 'not_invited', label: 'Not Invited', color: 'default' },
        },
      };

      renderPage();

      expect(screen.getByText('Never signed in')).toBeInTheDocument();
    });

    it('opens the edit modal from the tab bar actions menu', async () => {
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: /Client actions/ }));
      fireEvent.click(await screen.findByRole('menuitem', { name: /Edit client/ }));

      expect(mocks.dispatch).toHaveBeenCalledWith(toggleClientDetailsDrawer('client-1'));
    });

    it('goes back to the list when the page was opened directly', () => {
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      expect(screen.getByText('clients list')).toBeInTheDocument();
    });

    it('records that the client was viewed, once', () => {
      renderPage();

      expect(mocks.trackMixpanelEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('rail', () => {
    it('shows who the client is', () => {
      renderPage();

      expect(screen.getByText('hello@beacon.io')).toBeInTheDocument();
      expect(screen.getByText('Password')).toBeInTheDocument();
    });

    it('says the client has not signed in when they have not', () => {
      mocks.stats.data = {
        done: true,
        body: { ...STATS, hasSignedIn: false, lastLoginAt: null },
      };

      renderPage();

      expect(screen.getByText('Not signed in yet')).toBeInTheDocument();
      expect(screen.getByText('Never')).toBeInTheDocument();
    });

    it('does not claim "Apps synced", which nothing tracks', () => {
      renderPage();

      expect(screen.queryByText(/Apps synced/i)).not.toBeInTheDocument();
    });
  });

  describe('tabs', () => {
    it('offers only the tabs that are built', () => {
      renderPage();

      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        'Overview',
        'Messages',
        'Company Members',
        'Projects',
        'Billing',
      ]);
    });

    it('opens on Overview and passes it the client name', () => {
      renderPage();

      expect(screen.getByText('overview tab for Beacon Logistics')).toBeInTheDocument();
    });

    it('opens on the tab named in the address', () => {
      renderPage('/worklenz/client-portal/clients/client-1?tab=billing');

      expect(screen.getByText('billing tab active')).toBeInTheDocument();
    });

    it('opens on Overview when the address names a tab that does not exist', () => {
      renderPage('/worklenz/client-portal/clients/client-1?tab=files');

      expect(screen.getByText('overview tab for Beacon Logistics')).toBeInTheDocument();
    });

    it('records the tab in the address, and leaves it out for Overview', () => {
      renderPage();

      fireEvent.click(screen.getByRole('tab', { name: 'Projects' }));
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/worklenz/client-portal/clients/client-1?tab=projects'
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/worklenz/client-portal/clients/client-1'
      );
      expect(screen.getByTestId('location')).not.toHaveTextContent('tab=');
    });

    it('jumps to a tab from the quick actions', () => {
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: /Send message/ }));
      expect(screen.getByText('messages tab')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Create invoice/ }));
      expect(screen.getByText(/billing tab/)).toBeInTheDocument();

      // "Assign task" opens Projects, where each project links to its task list.
      fireEvent.click(screen.getByRole('button', { name: /Assign task/ }));
      expect(screen.getByRole('button', { name: 'projects tab assign' })).toBeInTheDocument();
    });

    it('gives Billing the client’s portal status, so it can warn before anything is attempted', () => {
      mocks.stats.data = {
        done: true,
        body: {
          ...STATS,
          portalStatus: { status: 'not_invited', label: 'Not Invited', color: 'default' },
        },
      };

      renderPage('/worklenz/client-portal/clients/client-1?tab=billing');

      expect(screen.getByText('billing tab not_invited')).toBeInTheDocument();
    });

    it('starts the Add Client wizard on "Add a client user" for this company', () => {
      renderPage('/worklenz/client-portal/clients/client-1?tab=members');

      fireEvent.click(screen.getByRole('button', { name: 'members tab add user' }));

      expect(mocks.dispatch).toHaveBeenCalledWith(
        openAddCompanyUserDrawer({ id: 'client-1', name: 'Beacon Logistics' })
      );
    });

    it('opens the assign-project drawer from Projects', () => {
      renderPage('/worklenz/client-portal/clients/client-1?tab=projects');

      fireEvent.click(screen.getByRole('button', { name: 'projects tab assign' }));

      expect(mocks.dispatch).toHaveBeenCalledWith(toggleClientSettingsDrawer('client-1'));
    });
  });

  it('still shows the client while its numbers are loading', () => {
    mocks.stats.isLoading = true;
    mocks.stats.data = undefined;

    renderPage();

    expect(screen.getByText('Beacon Logistics', { selector: 'h4' })).toBeInTheDocument();
    expect(screen.queryByText('Last signed in 3 days ago')).not.toBeInTheDocument();
  });
});
