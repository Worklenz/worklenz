import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Labels come from i18n; the tests assert the default text each row falls back to.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? '').replace(/{{(\w+)}}/g, (_match, name: string) =>
        String(options?.[name] ?? '')
      ),
  }),
}));

const rolesState = vi.hoisted(() => ({
  value: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
}));

vi.mock('@/api/client-portal/portal-counts-api', () => ({
  useGetClientRolesQuery: () => rolesState.value,
}));

import type { PortalSettingsV2 } from '@/types/client-portal/v2';
import { SharingVisibilitySection } from './SharingVisibilitySection';
import { ClientRolesSection } from './ClientRolesSection';
import { NotificationsSection } from './NotificationsSection';

const makeSettings = (overrides: Partial<PortalSettingsV2> = {}): PortalSettingsV2 => ({
  show_invoices: false,
  allow_client_uploads_default: true,
  admins_can_invite_users: false,
  admins_can_remove_users: false,
  client_email_events: {
    approval_request: true,
    comment_or_reply: true,
    file_shared: false,
    milestone_change: false,
    project_update: false,
    change_request_update: true,
    access_changes: true,
  },
  team_email_events: {
    client_comment: true,
    approval_decision: true,
    change_request: true,
    client_file_upload: false,
  },
  ...overrides,
});

beforeEach(() => {
  rolesState.value = {
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  };
});

describe('SharingVisibilitySection', () => {
  it('shows how much is shared and writes the two switches', async () => {
    const onChange = vi.fn();
    render(
      <SharingVisibilitySection
        settings={makeSettings()}
        shared={{
          tasks: { shared: 3, total: 12 },
          files: { shared: 0, total: 0 },
          milestones: { shared: 2, total: 2 },
        }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('3 of 12 client visible')).toBeInTheDocument();
    expect(screen.getByText('0 of 0 client visible')).toBeInTheDocument();
    expect(screen.getByText('2 of 2 client visible')).toBeInTheDocument();
    expect(screen.getByText('Fixed rules')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('switch', { name: 'Show Invoices in the client portal' }));
    expect(onChange).toHaveBeenCalledWith({ show_invoices: true });

    await userEvent.click(
      screen.getByRole('switch', { name: 'Allow client uploads on new portal projects' })
    );
    expect(onChange).toHaveBeenCalledWith({ allow_client_uploads_default: false });
  });

  it('does not render counts while they are still loading', () => {
    render(<SharingVisibilitySection settings={makeSettings()} shared={undefined} onChange={vi.fn()} />);
    expect(screen.queryByText(/client visible$/)).not.toBeInTheDocument();
  });
});

describe('ClientRolesSection', () => {
  const roles = [
    {
      role: 'admin',
      label: 'Client Admin',
      description: 'Admin',
      can: { view: true, comment: true, upload: true, submit_change_request: true, approve: true, manage_users: true },
    },
    {
      role: 'viewer',
      label: 'Client Viewer',
      description: 'Viewer',
      can: { view: true, comment: false, upload: false, submit_change_request: false, approve: false, manage_users: false },
    },
  ];

  it('renders the matrix the server returns, one column per role', () => {
    rolesState.value = { ...rolesState.value, data: { body: roles } };
    render(<ClientRolesSection settings={makeSettings()} onChange={vi.fn()} />);

    expect(screen.getByRole('columnheader', { name: 'Client Admin' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Client Viewer' })).toBeInTheDocument();

    const approveRow = screen.getByText('Approve items or request changes').closest('tr') as HTMLElement;
    expect(within(approveRow).getAllByLabelText('Allowed')).toHaveLength(1);
    expect(within(approveRow).getAllByLabelText('Not allowed')).toHaveLength(1);
  });

  it('offers a retry when the roles cannot be loaded', async () => {
    const refetch = vi.fn();
    rolesState.value = { ...rolesState.value, isError: true, refetch };
    render(<ClientRolesSection settings={makeSettings()} onChange={vi.fn()} />);

    expect(screen.getByText('The role permissions could not be loaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('writes the two Client Admin switches', async () => {
    rolesState.value = { ...rolesState.value, data: { body: roles } };
    const onChange = vi.fn();
    render(<ClientRolesSection settings={makeSettings()} onChange={onChange} />);

    await userEvent.click(screen.getByRole('switch', { name: 'Let Client Admins invite users' }));
    expect(onChange).toHaveBeenCalledWith({ admins_can_invite_users: true });
    await userEvent.click(screen.getByRole('switch', { name: 'Let Client Admins remove users' }));
    expect(onChange).toHaveBeenCalledWith({ admins_can_remove_users: true });
  });
});

describe('NotificationsSection', () => {
  it('keeps in-app alerts locked on and merges an email toggle into the existing events', async () => {
    const onChange = vi.fn();
    const settings = makeSettings();
    render(<NotificationsSection settings={settings} onChange={onChange} />);

    for (const name of ['In-app: New approval request (always on)', 'In-app: Client file upload (always on)']) {
      const lockedSwitch = screen.getByRole('switch', { name });
      expect(lockedSwitch).toBeDisabled();
      expect(lockedSwitch).toBeChecked();
    }

    await userEvent.click(screen.getByRole('switch', { name: 'Email: File shared' }));
    expect(onChange).toHaveBeenCalledWith({
      client_email_events: { ...settings.client_email_events, file_shared: true },
    });

    await userEvent.click(screen.getByRole('switch', { name: 'Email: Client file upload' }));
    expect(onChange).toHaveBeenCalledWith({
      team_email_events: { ...settings.team_email_events, client_file_upload: true },
    });
  });

  it('lists all seven client events and four team events', () => {
    render(<NotificationsSection settings={makeSettings()} onChange={vi.fn()} />);
    expect(screen.getAllByRole('switch', { name: /^Email: / })).toHaveLength(11);
  });
});
