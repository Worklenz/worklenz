import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '@/shared/antd-imports';
import type { CompanyUser, CompanyUserPortalStatus } from '@/api/client-portal/company-users-api';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  setRole: vi.fn(),
  setDisabled: vi.fn(),
  invite: vi.fn(),
  remove: vi.fn(),
  queryArgs: [] as Array<Record<string, unknown>>,
  query: {
    data: undefined as unknown,
    isFetching: false,
    error: undefined as unknown,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => {
      const isSingular = options.count === 1;
      let value = String(
        (isSingular ? options.defaultValue_one : options.defaultValue_other) ??
          options.defaultValue ??
          key
      );
      Object.entries(options).forEach(([param, paramValue]) => {
        value = value.replace(`{{${param}}}`, String(paramValue));
      });
      return value;
    },
  }),
}));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ themeReducer: { mode: 'light' } }),
}));

// The real helper pulls in the i18n bootstrap, which is irrelevant here.
vi.mock('@/utils/dateUtils', () => ({ fromNow: () => '2 hours ago' }));

vi.mock('@/api/client-portal/company-users-api', () => ({
  useGetCompanyUsersQuery: (args: Record<string, unknown>) => {
    mocks.queryArgs.push(args);
    return { ...mocks.query, refetch: mocks.refetch };
  },
  useSetCompanyUserRoleMutation: () => [mocks.setRole],
  useSetCompanyUserDisabledMutation: () => [mocks.setDisabled],
  useInviteCompanyUserMutation: () => [mocks.invite],
  useRemoveCompanyUserMutation: () => [mocks.remove],
  useUpdateCompanyUserMutation: () => [vi.fn(), { isLoading: false }],
  useSetCompanyUserProjectsMutation: () => [vi.fn(), { isLoading: false }],
  useGetClientProjectsListQuery: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import { CompanyUsersTable } from './CompanyUsersTable';

const buildUser = (
  status: CompanyUserPortalStatus = 'active',
  overrides: Partial<CompanyUser> = {}
): CompanyUser => ({
  id: 'u1',
  client_id: 'c1',
  company_name: 'Brandbase',
  name: 'Alex Chen',
  email: 'alex@brandbase.com',
  phone: '+1 415 555 0142',
  job_title: 'CEO',
  role: 'poc',
  has_login: status === 'active',
  last_login_at: null,
  invited_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  portal_status: { status, label: status, color: 'default' },
  project_count: 0,
  projects: [],
  ...overrides,
});

const setUsers = (users: CompanyUser[], total = users.length) => {
  mocks.query.data = { done: true, body: { users, total, page: 1, limit: 10 } };
};

const lastArgs = () => mocks.queryArgs[mocks.queryArgs.length - 1];

const resolves = () => ({ unwrap: () => Promise.resolve({ body: {} }) });

const openMenu = async (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: `Actions for ${name}` }));
  await screen.findByRole('menuitem', { name: /View Profile/ });
};

describe('CompanyUsersTable', () => {
  beforeEach(() => {
    mocks.refetch.mockReset();
    mocks.queryArgs.length = 0;
    mocks.query.data = undefined;
    mocks.query.isFetching = false;
    mocks.query.error = undefined;
    mocks.setRole.mockReset().mockReturnValue(resolves());
    mocks.setDisabled.mockReset().mockReturnValue(resolves());
    mocks.invite.mockReset().mockReturnValue({
      unwrap: () => Promise.resolve({ body: { email_sent: true, link: null } }),
    });
    mocks.remove.mockReset().mockReturnValue(resolves());
  });

  afterEach(() => {
    vi.useRealTimers();
    // Modal.confirm renders outside the React tree, so close any left open by a test.
    Modal.destroyAll();
  });

  it('renders each user with role, status and project access', () => {
    setUsers([
      buildUser('active', {
        project_count: 2,
        projects: [
          { project_id: 'p1', name: 'Website', level: 'view' },
          { project_id: 'p2', name: 'Brand', level: 'contributor' },
        ],
      }),
      buildUser('invited', {
        id: 'u2',
        name: 'Jamie Wu',
        email: 'jamie@brandbase.com',
        role: 'member',
        phone: null,
        job_title: null,
      }),
    ]);

    render(<CompanyUsersTable />);

    const rows = screen.getAllByRole('row');
    const alex = within(rows.find(row => within(row).queryByText('Alex Chen'))!);
    expect(alex.getByText('AC')).toBeInTheDocument();
    expect(alex.getByText('alex@brandbase.com')).toBeInTheDocument();
    expect(alex.getByText('+1 415 555 0142')).toBeInTheDocument();
    expect(alex.getByText('POC')).toBeInTheDocument();
    expect(alex.getByText('CEO')).toBeInTheDocument();
    expect(alex.getByText('2 projects')).toBeInTheDocument();
    expect(alex.getByText('Active')).toBeInTheDocument();

    const jamie = within(rows.find(row => within(row).queryByText('Jamie Wu'))!);
    expect(jamie.getByText('Member')).toBeInTheDocument();
    expect(jamie.getByText('No projects assigned')).toBeInTheDocument();
    expect(jamie.getByText('Invited')).toBeInTheDocument();
  });

  it('shows the company as a link that opens that company', () => {
    setUsers([buildUser()]);
    const onOpenCompany = vi.fn();

    render(<CompanyUsersTable onOpenCompany={onOpenCompany} />);
    fireEvent.click(screen.getByText('Brandbase'));

    expect(onOpenCompany).toHaveBeenCalledWith('c1');
  });

  it('hides the Company column when scoped to one company', () => {
    setUsers([buildUser()]);

    render(<CompanyUsersTable clientId="c1" />);

    expect(screen.queryByRole('columnheader', { name: 'Company' })).not.toBeInTheDocument();
    expect(lastArgs().client_id).toBe('c1');
  });

  it('dims a disabled user', () => {
    setUsers([buildUser('disabled')]);

    render(<CompanyUsersTable />);

    const row = screen.getAllByRole('row').find(item => within(item).queryByText('Alex Chen'))!;
    expect(row).toHaveStyle({ opacity: '0.6' });
  });

  describe('row menu', () => {
    it('offers Send Invite for someone who was never invited', async () => {
      setUsers([buildUser('not_invited', { role: 'member' })]);
      render(<CompanyUsersTable />);

      await openMenu('Alex Chen');

      expect(screen.getByRole('menuitem', { name: /Send Invite/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Make POC/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Disable User/ })).toBeInTheDocument();
    });

    it('offers Resend Invite and Remove POC for an invited POC', async () => {
      setUsers([buildUser('invited')]);
      render(<CompanyUsersTable />);

      await openMenu('Alex Chen');

      expect(screen.getByRole('menuitem', { name: /Resend Invite/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Remove POC/ })).toBeInTheDocument();
    });

    it('has no invite item for an active user', async () => {
      setUsers([buildUser('active')]);
      render(<CompanyUsersTable />);

      await openMenu('Alex Chen');

      expect(screen.queryByRole('menuitem', { name: /Invite/ })).not.toBeInTheDocument();
    });

    it('hides Resend Invite once disabled and offers Enable instead of Disable', async () => {
      setUsers([buildUser('disabled')]);
      render(<CompanyUsersTable />);

      await openMenu('Alex Chen');

      expect(screen.queryByRole('menuitem', { name: /Invite/ })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Enable User/ })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /Disable User/ })).not.toBeInTheDocument();
    });

    it('makes a member a POC straight away', async () => {
      setUsers([buildUser('active', { role: 'member' })]);
      render(<CompanyUsersTable />);

      await openMenu('Alex Chen');
      fireEvent.click(screen.getByRole('menuitem', { name: /Make POC/ }));

      await waitFor(() => expect(mocks.setRole).toHaveBeenCalledWith({ id: 'u1', role: 'poc' }));
    });

    it('sends the invitation by email', async () => {
      setUsers([buildUser('invited')]);
      render(<CompanyUsersTable />);

      await openMenu('Alex Chen');
      fireEvent.click(screen.getByRole('menuitem', { name: /Resend Invite/ }));

      await waitFor(() =>
        expect(mocks.invite).toHaveBeenCalledWith({ id: 'u1', delivery: 'email' })
      );
    });

    it('offers the link when the email could not be sent', async () => {
      mocks.invite.mockReturnValue({
        unwrap: () =>
          Promise.resolve({
            body: { email_sent: false, link: 'https://portal.test/invite?token=wli_abc' },
          }),
      });
      setUsers([buildUser('not_invited')]);
      render(<CompanyUsersTable />);

      await openMenu('Alex Chen');
      fireEvent.click(screen.getByRole('menuitem', { name: /Send Invite/ }));

      expect(
        await screen.findByText('https://portal.test/invite?token=wli_abc')
      ).toBeInTheDocument();
    });

    it('asks before disabling, then disables', async () => {
      setUsers([buildUser('invited')]);
      render(<CompanyUsersTable />);

      await openMenu('Alex Chen');
      fireEvent.click(screen.getByRole('menuitem', { name: /Disable User/ }));

      // Ant Design renders the confirm title twice (once for assistive tech), hence "All".
      expect((await screen.findAllByText('Disable this user?')).length).toBeGreaterThan(0);
      expect(mocks.setDisabled).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Disable user' }));
      await waitFor(() =>
        expect(mocks.setDisabled).toHaveBeenCalledWith({ id: 'u1', disabled: true })
      );
    });

    it('enables a disabled user without asking', async () => {
      setUsers([buildUser('disabled')]);
      render(<CompanyUsersTable />);

      await openMenu('Alex Chen');
      fireEvent.click(screen.getByRole('menuitem', { name: /Enable User/ }));

      await waitFor(() =>
        expect(mocks.setDisabled).toHaveBeenCalledWith({ id: 'u1', disabled: false })
      );
    });

    it('asks before removing, then removes', async () => {
      setUsers([buildUser('active')]);
      render(<CompanyUsersTable />);

      await openMenu('Alex Chen');
      fireEvent.click(screen.getByRole('menuitem', { name: /Remove User/ }));

      expect((await screen.findAllByText('Remove this user?')).length).toBeGreaterThan(0);
      expect(mocks.remove).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Remove user' }));
      await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('u1'));
    });

    it('opens the profile with the person’s details', async () => {
      setUsers([buildUser('active', { job_title: 'CEO' })]);
      render(<CompanyUsersTable />);

      await openMenu('Alex Chen');
      fireEvent.click(screen.getByRole('menuitem', { name: /View Profile/ }));

      expect(await screen.findByText('Member profile')).toBeInTheDocument();
      expect(screen.getByText('Sign-in method')).toBeInTheDocument();
    });
  });

  describe('search, filter and paging', () => {
    it('starts on page 1 with the default size', () => {
      setUsers([buildUser()]);

      render(<CompanyUsersTable />);

      expect(lastArgs()).toMatchObject({
        page: 1,
        limit: 10,
        status: undefined,
        search: undefined,
      });
    });

    it('sends the status filter to the server and returns to page 1', async () => {
      setUsers([buildUser()], 30);
      render(<CompanyUsersTable />);

      fireEvent.click(screen.getByTitle('2'));
      await waitFor(() => expect(lastArgs().page).toBe(2));

      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter by status' }));
      fireEvent.click(document.querySelector('.ant-select-item-option[title="Disabled"]')!);

      await waitFor(() => expect(lastArgs()).toMatchObject({ page: 1, status: 'disabled' }));
    });

    it('waits for a pause in typing before searching, then returns to page 1', async () => {
      setUsers([buildUser()], 30);
      render(<CompanyUsersTable />);
      fireEvent.click(screen.getByTitle('2'));
      await waitFor(() => expect(lastArgs().page).toBe(2));

      vi.useFakeTimers();
      fireEvent.change(screen.getByRole('searchbox', { name: /Search users/ }), {
        target: { value: 'ale' },
      });
      expect(lastArgs().search).toBeUndefined();

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      expect(lastArgs()).toMatchObject({ search: 'ale', page: 1 });
    });

    it('returns to page 1 when the page size changes', async () => {
      setUsers([buildUser()], 60);
      render(<CompanyUsersTable />);
      fireEvent.click(screen.getByTitle('3'));
      await waitFor(() => expect(lastArgs().page).toBe(3));

      fireEvent.mouseDown(screen.getByRole('combobox', { name: /page/i }));
      fireEvent.click(document.querySelector('.ant-select-item-option[title="25 / page"]')!);

      await waitFor(() => expect(lastArgs()).toMatchObject({ page: 1, limit: 25 }));
    });

    it('sorts by a column on the server', async () => {
      setUsers([buildUser()]);
      render(<CompanyUsersTable />);

      fireEvent.click(screen.getByRole('columnheader', { name: 'Email' }));

      await waitFor(() => expect(lastArgs()).toMatchObject({ sortBy: 'email', sortOrder: 'asc' }));
    });
  });

  it('explains an empty list and offers to add', () => {
    setUsers([]);
    const onAdd = vi.fn();

    render(<CompanyUsersTable onAdd={onAdd} />);

    expect(screen.getByText('No client users found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add Client/ }));
    expect(onAdd).toHaveBeenCalled();
  });

  it('offers to clear filters when they hide everything', async () => {
    setUsers([]);
    render(<CompanyUsersTable />);

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter by status' }));
    fireEvent.click(document.querySelector('.ant-select-item-option[title="Expired"]')!);

    expect(await screen.findByText('No users match the current filters.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear Filters' })[0]);
    await waitFor(() => expect(lastArgs().status).toBeUndefined());
  });

  it('shows an error with a retry', () => {
    mocks.query.error = { status: 500 };

    render(<CompanyUsersTable />);

    expect(screen.getByText('Error loading client users')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
