import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refetchActivity: vi.fn(),
  onRetryStats: vi.fn(),
  activity: {
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

vi.mock('@/utils/dateUtils', () => ({ fromNow: () => '2 hours ago' }));

vi.mock('@/api/client-portal/client-workspace-api', () => ({
  useGetClientActivityFeedQuery: () => ({ ...mocks.activity, refetch: mocks.refetchActivity }),
}));

import { OverviewTab } from './OverviewTab';

const STATS = {
  totalProjects: 3,
  activeProjects: 2,
  completedProjects: 1,
  tasksOpen: 7,
  invoicesDue: 2,
  unansweredMessages: 4,
  outstanding: [],
  totalTeamMembers: 3,
  lastLoginAt: null,
  hasSignedIn: false,
  invitedAt: null,
  portalStatus: { status: 'active' as const, label: 'Active', color: 'green' },
};

const setActivities = (activities: Array<Record<string, unknown>>) => {
  mocks.activity.data = {
    done: true,
    body: { activities, total: activities.length, page: 1, limit: 10 },
  };
};

const renderTab = (overrides: Partial<Parameters<typeof OverviewTab>[0]> = {}) =>
  render(
    <OverviewTab
      clientId="client-1"
      clientName="Beacon Logistics"
      stats={STATS}
      isStatsLoading={false}
      isStatsError={false}
      onRetryStats={mocks.onRetryStats}
      {...overrides}
    />
  );

const cardOf = (label: string) => screen.getByText(label).closest('.ant-card') as HTMLElement;

describe('OverviewTab', () => {
  beforeEach(() => {
    mocks.refetchActivity.mockReset();
    mocks.onRetryStats.mockReset();
    mocks.activity.data = undefined;
    mocks.activity.isLoading = false;
    mocks.activity.isError = false;
    setActivities([]);
  });

  it('shows the three numbers that need attention', () => {
    renderTab();

    expect(within(cardOf('Tasks open')).getByText('7')).toBeInTheDocument();
    expect(within(cardOf('Invoices due')).getByText('2')).toBeInTheDocument();
    expect(within(cardOf('Unanswered messages')).getByText('4')).toBeInTheDocument();
  });

  it('shows placeholders instead of numbers while they load', () => {
    renderTab({ stats: undefined, isStatsLoading: true });

    expect(screen.queryByText('Tasks open')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.ant-skeleton').length).toBeGreaterThan(0);
  });

  it('offers a retry when the numbers cannot be loaded, without hiding the activity', () => {
    setActivities([
      {
        id: 'a1',
        category: 'invoice',
        description: 'Invoice INV-1 sent',
        activityDate: '2026-09-20T00:00:00.000Z',
      },
    ]);
    renderTab({ stats: undefined, isStatsError: true });

    expect(screen.getByText('Could not load this client’s numbers.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.onRetryStats).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Invoice INV-1 sent')).toBeInTheDocument();
  });

  it('lists recent activity with a letter for its kind and how long ago it was', () => {
    setActivities([
      {
        id: 'a1',
        category: 'invoice',
        description: 'Invoice INV-1 sent',
        activityDate: '2026-09-20T00:00:00.000Z',
      },
      {
        id: 'a2',
        category: 'chat',
        description: 'Client sent a message',
        activityDate: '2026-09-19T00:00:00.000Z',
      },
      {
        id: 'a3',
        category: 'project',
        description: 'Project updated: Website',
        activityDate: '2026-09-18T00:00:00.000Z',
      },
      {
        id: 'a4',
        category: 'request',
        description: 'Request REQ-4 status changed to accepted',
        activityDate: '2026-09-17T00:00:00.000Z',
      },
    ]);

    renderTab();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(within(items[0]).getByText('I')).toBeInTheDocument();
    expect(within(items[0]).getByText('Invoice INV-1 sent')).toBeInTheDocument();
    expect(within(items[0]).getByText('2 hours ago')).toBeInTheDocument();
    expect(within(items[1]).getByText('M')).toBeInTheDocument();
    expect(within(items[2]).getByText('P')).toBeInTheDocument();
    expect(within(items[3]).getByText('R')).toBeInTheDocument();
  });

  it('says so when nothing has happened for this client yet', () => {
    renderTab();

    expect(screen.getByText('Nothing logged for Beacon Logistics yet.')).toBeInTheDocument();
  });

  it('offers a retry when the activity cannot be loaded', () => {
    mocks.activity.isError = true;
    mocks.activity.data = undefined;

    renderTab();

    expect(screen.getByText('Could not load recent activity.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetchActivity).toHaveBeenCalledTimes(1);
  });

  it('shows placeholders while the activity loads', () => {
    mocks.activity.isLoading = true;
    mocks.activity.data = undefined;

    renderTab();

    expect(screen.queryByText('Nothing logged for Beacon Logistics yet.')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.ant-skeleton').length).toBeGreaterThan(0);
  });
});
