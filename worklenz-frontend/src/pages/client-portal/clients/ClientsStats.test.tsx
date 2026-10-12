import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  query: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? key),
  }),
}));

vi.mock('@/api/client-portal/client-portal-api', () => ({
  useGetClientsStatsQuery: () => ({ ...mocks.query, refetch: mocks.refetch }),
}));

import { ClientsStats } from './ClientsStats';

const setStats = (body: Record<string, number>) => {
  mocks.query.data = { done: true, body, title: null, message: null };
};

describe('ClientsStats', () => {
  beforeEach(() => {
    mocks.refetch.mockReset();
    mocks.query.data = undefined;
    mocks.query.isLoading = false;
    mocks.query.isError = false;
  });

  it('shows the total with its status breakdown and the unanswered messages', () => {
    setStats({
      total: 48,
      active: 4,
      invited: 1,
      expired: 3,
      not_invited: 40,
      unanswered_messages: 6,
    });

    render(<ClientsStats />);

    const totalCard = screen.getByText('Total Clients').closest('.ant-card') as HTMLElement;
    expect(within(totalCard).getByText('48')).toBeInTheDocument();
    expect(within(totalCard).getByText('Active').previousElementSibling).toHaveTextContent('4');
    // Expired invitations are still awaiting the client, so they are summed into "Invited".
    expect(within(totalCard).getByText('Invited').previousElementSibling).toHaveTextContent('4');
    expect(within(totalCard).getByText('Not Invited').previousElementSibling).toHaveTextContent(
      '40'
    );

    const messagesCard = screen.getByText('Unanswered messages').closest('.ant-card') as HTMLElement;
    expect(within(messagesCard).getByText('6')).toBeInTheDocument();
  });

  it('shows placeholders instead of numbers while loading', () => {
    mocks.query.isLoading = true;

    render(<ClientsStats />);

    expect(screen.queryByText('Total Clients')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.ant-skeleton').length).toBeGreaterThan(0);
  });

  it('shows zeros for a team without clients', () => {
    setStats({ total: 0, active: 0, invited: 0, expired: 0, not_invited: 0, unanswered_messages: 0 });

    render(<ClientsStats />);

    expect(screen.getAllByText('0')).toHaveLength(5);
  });

  it('offers a retry when the stats cannot be loaded', () => {
    mocks.query.isError = true;

    render(<ClientsStats />);

    expect(screen.getByText('Could not load client statistics.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
