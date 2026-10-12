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

vi.mock('@/api/client-portal/company-users-api', () => ({
  useGetCompanyUsersStatsQuery: () => ({ ...mocks.query, refetch: mocks.refetch }),
}));

import { CompanyUsersStats } from './CompanyUsersStats';

const setStats = (body: Record<string, number>) => {
  mocks.query.data = { done: true, body, title: null, message: null };
};

const cardOf = (label: string) => screen.getByText(label).closest('.ant-card') as HTMLElement;

describe('CompanyUsersStats', () => {
  beforeEach(() => {
    mocks.refetch.mockReset();
    mocks.query.data = undefined;
    mocks.query.isLoading = false;
    mocks.query.isError = false;
  });

  it('shows the four counts', () => {
    setStats({ total: 8, pocs: 5, companies_without_poc: 1, disabled: 2 });

    render(<CompanyUsersStats />);

    expect(within(cardOf('Total client users')).getByText('8')).toBeInTheDocument();
    expect(within(cardOf('POCs')).getByText('5')).toBeInTheDocument();
    expect(within(cardOf('Companies with no POC')).getByText('1')).toBeInTheDocument();
    expect(within(cardOf('Disabled')).getByText('2')).toBeInTheDocument();
  });

  it('presents a company with no POC as allowed, not as a problem', () => {
    setStats({ total: 1, pocs: 0, companies_without_poc: 1, disabled: 0 });

    render(<CompanyUsersStats />);

    expect(screen.getByText('Allowed. A company can have no POC.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows placeholders instead of numbers while loading', () => {
    mocks.query.isLoading = true;

    render(<CompanyUsersStats />);

    expect(screen.queryByText('Total client users')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.ant-skeleton').length).toBeGreaterThan(0);
  });

  it('shows zeros before any user exists', () => {
    setStats({ total: 0, pocs: 0, companies_without_poc: 0, disabled: 0 });

    render(<CompanyUsersStats />);

    expect(screen.getAllByText('0')).toHaveLength(4);
  });

  it('offers a retry when the stats cannot be loaded', () => {
    mocks.query.isError = true;

    render(<CompanyUsersStats />);

    expect(screen.getByText('Could not load client user statistics.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
