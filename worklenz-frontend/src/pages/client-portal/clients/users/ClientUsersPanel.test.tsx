import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? '').replace(/{{(\w+)}}/g, (_match, name: string) =>
        String(options?.[name] ?? '')
      ),
    i18n: { language: 'en' },
  }),
}));

const state = vi.hoisted(() => ({
  usersQuery: vi.fn(),
  usersResult: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  resend: vi.fn(),
  deactivate: vi.fn(),
  reactivate: vi.fn(),
  remove: vi.fn(),
  restoreAccount: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  messageInfo: vi.fn(),
}));

/** An RTK Query mutation trigger whose promise has `.unwrap()`. */
const trigger =
  (fn: (...args: unknown[]) => unknown) =>
  (...args: unknown[]) => {
    const promise = Promise.resolve().then(() => fn(...args));
    return Object.assign(promise, { unwrap: () => promise });
  };

vi.mock('@/api/client-portal/portal-access-api', () => ({
  useGetPortalClientUsersQuery: (params: unknown) => {
    state.usersQuery(params);
    return state.usersResult;
  },
  useGetPortalOrganizationsQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useResendPortalInvitationMutation: () => [trigger(state.resend), { isLoading: false }],
  useDeactivatePortalUserMutation: () => [trigger(state.deactivate), { isLoading: false }],
  useReactivatePortalUserMutation: () => [trigger(state.reactivate), { isLoading: false }],
  useRemovePortalUserMutation: () => [trigger(state.remove), { isLoading: false }],
  useRestorePortalAccountMutation: () => [trigger(state.restoreAccount), { isLoading: false }],
  useUpdatePortalClientUserMutation: () => [trigger(vi.fn()), { isLoading: false }],
  useAssignPortalUserProjectsMutation: () => [trigger(vi.fn()), { isLoading: false }],
}));

vi.mock('@/api/client-portal/portal-projects-api', () => ({
  useGetPortalProjectsQuery: () => ({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() }),
}));

vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {
    ...actual,
    message: { success: state.messageSuccess, error: state.messageError, warning: vi.fn(), info: state.messageInfo },
  };
});

// ProseMirror needs a real layout engine; the message dialog is not under test here.
vi.mock('../../discussions/RichMessageEditor', async () => {
  const { RichMessageEditorStub } = await import('../../discussions/richMessageEditorStub');
  return { RichMessageEditor: RichMessageEditorStub };
});

import type { ClientUser } from '@/types/client-portal/v2';
import { ClientUsersPanel } from './ClientUsersPanel';

const makeUser = (overrides: Partial<ClientUser> = {}): ClientUser => ({
  id: 'u1',
  organization_id: 'org-1',
  organization_name: 'Brandbase',
  name: 'Alex Rivera',
  email: 'alex@brandbase.example',
  phone: null,
  job_title: null,
  role: 'admin',
  status: 'active',
  account_deleted_at: null,
  restorable_until: null,
  invite_expired: false,
  invite_not_sent: false,
  new_link_requested: false,
  email_verified: true,
  invited_at: null,
  last_access_at: null,
  projects: [{ id: 'p1', name: 'Website redesign' }],
  ...overrides,
});

const listOf = (items: ClientUser[]) => ({
  data: { body: { items, total: items.length, page: 1, limit: 10 } },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  state.usersResult = listOf([
    makeUser(),
    makeUser({
      id: 'u2',
      name: 'Jamie Chen',
      email: 'jamie@brandbase.example',
      role: 'viewer',
      status: 'invited',
      invite_expired: true,
      new_link_requested: true,
      email_verified: false,
      projects: [],
    }),
  ]);
  state.resend.mockResolvedValue({ body: { email: 'jamie@brandbase.example', link: null, emailSent: true } });
  state.deactivate.mockResolvedValue({ body: {} });
  state.remove.mockResolvedValue({ body: null });
  state.restoreAccount.mockResolvedValue({ body: {} });
});

describe('ClientUsersPanel', () => {
  it('lists each user with role, status flags and project count', () => {
    render(<ClientUsersPanel />);

    const alex = screen.getByText('Alex Rivera').closest('tr') as HTMLElement;
    expect(within(alex).getByText('Client Admin')).toBeInTheDocument();
    expect(within(alex).getByText('Active')).toBeInTheDocument();
    expect(within(alex).getByText('1 projects')).toBeInTheDocument();

    const jamie = screen.getByText('Jamie Chen').closest('tr') as HTMLElement;
    expect(within(jamie).getByText('Client Viewer')).toBeInTheDocument();
    expect(within(jamie).getByText('Invite expired')).toBeInTheDocument();
    expect(within(jamie).getByText('Asked for a new link')).toBeInTheDocument();
    expect(within(jamie).getByText('Email not verified')).toBeInTheDocument();
    expect(within(jamie).getByText('None assigned')).toBeInTheDocument();
  });

  it('shows the client column first, only when the list is not scoped to one client', () => {
    const { rerender } = render(<ClientUsersPanel />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveTextContent('Client');

    rerender(<ClientUsersPanel organizationId="org-1" />);
    expect(screen.queryByRole('columnheader', { name: 'Client' })).not.toBeInTheDocument();
    expect(state.usersQuery).toHaveBeenLastCalledWith(expect.objectContaining({ organization_id: 'org-1' }));
  });

  it('groups rows under a client header by default and can switch grouping off', async () => {
    localStorage.removeItem('worklenz.portal.clientUsers.groupByClient');
    state.usersResult = listOf([
      makeUser(),
      makeUser({ id: 'u3', organization_id: 'org-2', organization_name: 'Acme', name: 'Sam Lee', email: 'sam@acme.example' }),
    ]);
    const { rerender } = render(<ClientUsersPanel />);
    // One header per client, each counting its own rows.
    expect(screen.getAllByText('1 users')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Group client users' }));
    expect(screen.queryByText('1 users')).not.toBeInTheDocument();
    expect(localStorage.getItem('worklenz.portal.clientUsers.groupByClient')).toBe('off');

    localStorage.removeItem('worklenz.portal.clientUsers.groupByClient');
    rerender(<ClientUsersPanel organizationId="org-1" />);
    expect(screen.queryByRole('button', { name: 'Group client users' })).not.toBeInTheDocument();
  });

  it('offers Resend only for invited users and calls the API for that user', async () => {
    render(<ClientUsersPanel />);

    const alex = screen.getByText('Alex Rivera').closest('tr') as HTMLElement;
    expect(within(alex).queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument();

    const jamie = screen.getByText('Jamie Chen').closest('tr') as HTMLElement;
    await userEvent.click(within(jamie).getByRole('button', { name: 'Resend' }));

    await waitFor(() => expect(state.resend).toHaveBeenCalledWith({ userId: 'u2' }));
    await waitFor(() =>
      expect(state.messageSuccess).toHaveBeenCalledWith(
        'Invitation resent to jamie@brandbase.example. The link is valid for 7 days.'
      )
    );
  });

  it('creates a sign-in link on request and shows it without emailing anyone', async () => {
    state.resend.mockResolvedValue({
      body: { email: 'alex@brandbase.example', link: 'https://portal.test/invite?token=wli_abc', emailSent: false },
    });
    render(<ClientUsersPanel />);

    const alex = screen.getByText('Alex Rivera').closest('tr') as HTMLElement;
    await userEvent.click(within(alex).getByRole('button', { name: 'Actions for Alex Rivera' }));
    await userEvent.click(await screen.findByText('Create sign-in link'));

    await waitFor(() => expect(state.resend).toHaveBeenCalledWith({ userId: 'u1', delivery: 'link' }));
    expect(await screen.findByText('https://portal.test/invite?token=wli_abc')).toBeInTheDocument();
    expect(screen.getByText(/Opening this link emails a 6-digit code to/)).toBeInTheDocument();
  });

  it('does not offer a sign-in link for a deactivated user', async () => {
    state.usersResult = listOf([
      makeUser({ id: 'u3', name: 'Sam Lee', email: 'sam@brandbase.example', role: 'member', status: 'deactivated' }),
    ]);
    render(<ClientUsersPanel />);

    const sam = screen.getByText('Sam Lee').closest('tr') as HTMLElement;
    await userEvent.click(within(sam).getByRole('button', { name: 'Actions for Sam Lee' }));
    await screen.findByText('Reactivate user');
    expect(screen.queryByText('Create sign-in link')).not.toBeInTheDocument();
  });

  it('confirms a deactivation by naming its effect before calling the API', async () => {
    render(<ClientUsersPanel />);

    const alex = screen.getByText('Alex Rivera').closest('tr') as HTMLElement;
    await userEvent.click(within(alex).getByRole('button', { name: 'Actions for Alex Rivera' }));
    await userEvent.click(await screen.findByText('Deactivate user'));

    expect(await screen.findByText('Deactivate this client user?')).toBeInTheDocument();
    expect(screen.getByText(/Alex Rivera loses access right away/)).toBeInTheDocument();
    expect(state.deactivate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() =>
      expect(state.deactivate).toHaveBeenCalledWith({ userId: 'u1', confirmLastAdmin: false })
    );
  });

  it('asks again, with the server’s warning, when this is the last Client Admin', async () => {
    state.deactivate
      .mockRejectedValueOnce({
        data: {
          message: 'Alex Rivera is the last active Client Admin of Brandbase.',
          body: { code: 'LAST_CLIENT_ADMIN' },
        },
      })
      .mockResolvedValueOnce({ body: {} });
    render(<ClientUsersPanel />);

    const alex = screen.getByText('Alex Rivera').closest('tr') as HTMLElement;
    await userEvent.click(within(alex).getByRole('button', { name: 'Actions for Alex Rivera' }));
    await userEvent.click(await screen.findByText('Deactivate user'));
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('This is the last Client Admin')).toBeInTheDocument();
    expect(screen.getByText('Alex Rivera is the last active Client Admin of Brandbase.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue anyway' }));
    await waitFor(() =>
      expect(state.deactivate).toHaveBeenLastCalledWith({ userId: 'u1', confirmLastAdmin: true })
    );
  });

  describe('a person who deleted their own account', () => {
    const deletedUser = (overrides: Partial<ClientUser> = {}) =>
      makeUser({
        id: 'u9',
        name: 'Riley Park',
        email: 'riley@brandbase.example',
        status: 'deleted',
        account_deleted_at: '2026-10-01T10:00:00.000Z',
        restorable_until: '2026-10-31T10:00:00.000Z',
        ...overrides,
      });

    it('stays in the list with its own status, not as Deactivated', () => {
      state.usersResult = listOf([deletedUser()]);
      render(<ClientUsersPanel />);

      const riley = screen.getByText('Riley Park').closest('tr') as HTMLElement;
      expect(within(riley).getByText('Account deleted')).toBeInTheDocument();
      expect(within(riley).queryByText('Deactivated')).not.toBeInTheDocument();
      // The profile is still readable: staff see who it was and what they had.
      expect(within(riley).getByText('riley@brandbase.example')).toBeInTheDocument();
    });

    it('offers View, Restore and Remove only: Reactivate would not bring the account back', async () => {
      state.usersResult = listOf([deletedUser()]);
      render(<ClientUsersPanel />);

      const riley = screen.getByText('Riley Park').closest('tr') as HTMLElement;
      await userEvent.click(within(riley).getByRole('button', { name: 'Actions for Riley Park' }));

      expect(await screen.findByText('Restore account')).toBeInTheDocument();
      expect(screen.getByText('View profile')).toBeInTheDocument();
      expect(screen.getByText('Remove user')).toBeInTheDocument();
      expect(screen.queryByText('Reactivate user')).not.toBeInTheDocument();
      expect(screen.queryByText('Deactivate user')).not.toBeInTheDocument();
      expect(screen.queryByText('Create sign-in link')).not.toBeInTheDocument();
      expect(screen.queryByText('Message')).not.toBeInTheDocument();
    });

    it('does not offer a restore once the 30-day window has ended', async () => {
      state.usersResult = listOf([deletedUser({ restorable_until: null })]);
      render(<ClientUsersPanel />);

      const riley = screen.getByText('Riley Park').closest('tr') as HTMLElement;
      await userEvent.click(within(riley).getByRole('button', { name: 'Actions for Riley Park' }));
      await screen.findByText('Remove user');
      expect(screen.queryByText('Restore account')).not.toBeInTheDocument();
    });

    it('asks before restoring, and says it reverses their own decision', async () => {
      state.usersResult = listOf([deletedUser()]);
      render(<ClientUsersPanel />);

      const riley = screen.getByText('Riley Park').closest('tr') as HTMLElement;
      await userEvent.click(within(riley).getByRole('button', { name: 'Actions for Riley Park' }));
      await userEvent.click(await screen.findByText('Restore account'));

      expect(await screen.findByText('Restore this account?')).toBeInTheDocument();
      expect(screen.getByText(/Only restore it if they asked you to/)).toBeInTheDocument();
      expect(state.restoreAccount).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: 'Restore account' }));
      await waitFor(() => expect(state.restoreAccount).toHaveBeenCalledWith('u9'));
      await waitFor(() =>
        expect(state.messageSuccess).toHaveBeenCalledWith('Riley Park’s account was restored. They can sign in again.')
      );
    });

    it('shows the server’s reason when the restore is refused', async () => {
      state.restoreAccount.mockRejectedValueOnce({
        data: { message: 'The 30-day window to restore this account has ended.', body: { code: 'RETENTION_EXPIRED' } },
      });
      state.usersResult = listOf([deletedUser()]);
      render(<ClientUsersPanel />);

      const riley = screen.getByText('Riley Park').closest('tr') as HTMLElement;
      await userEvent.click(within(riley).getByRole('button', { name: 'Actions for Riley Park' }));
      await userEvent.click(await screen.findByText('Restore account'));
      await userEvent.click(await screen.findByRole('button', { name: 'Restore account' }));

      await waitFor(() =>
        expect(state.messageError).toHaveBeenCalledWith('The 30-day window to restore this account has ended.')
      );
    });
  });

  it('offers Message only for an active user', async () => {
    render(<ClientUsersPanel />);

    const alex = screen.getByText('Alex Rivera').closest('tr') as HTMLElement;
    await userEvent.click(within(alex).getByRole('button', { name: 'Actions for Alex Rivera' }));
    expect(await screen.findByText('Message')).toBeInTheDocument();
  });

  it('does not offer Message for an invited or deactivated user', async () => {
    render(<ClientUsersPanel />);

    const jamie = screen.getByText('Jamie Chen').closest('tr') as HTMLElement;
    await userEvent.click(within(jamie).getByRole('button', { name: 'Actions for Jamie Chen' }));
    await screen.findByText('Assign projects');
    expect(screen.queryByText('Message')).not.toBeInTheDocument();
  });

  it('asks for a project first when an active user has none, instead of opening an empty dialog', async () => {
    state.usersResult = listOf([makeUser({ projects: [] })]);
    render(<ClientUsersPanel />);

    const alex = screen.getByText('Alex Rivera').closest('tr') as HTMLElement;
    await userEvent.click(within(alex).getByRole('button', { name: 'Actions for Alex Rivera' }));
    await userEvent.click(await screen.findByText('Message'));

    expect(state.messageInfo).toHaveBeenCalledWith(
      'Alex Rivera has no projects yet. Assign a project first, then start a discussion.'
    );
    expect(screen.queryByText('New client-visible discussion')).not.toBeInTheDocument();
  });

  it('says what to do next when there are no users, and when filters hide them all', () => {
    state.usersResult = listOf([]);
    render(<ClientUsersPanel />);
    expect(screen.getByText('No client users yet. Use Add Client to invite the first one.')).toBeInTheDocument();
  });

  it('offers a retry when the list cannot be loaded', async () => {
    const refetch = vi.fn();
    state.usersResult = { data: undefined, isLoading: false, isError: true, refetch };
    render(<ClientUsersPanel />);

    expect(screen.getByText('This list could not be loaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });
});
