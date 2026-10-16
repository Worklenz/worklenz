import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Labels come from i18n; the tests assert the default text each tag falls back to.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string; item?: string }) =>
      (options?.defaultValue ?? '').replace('{{item}}', options?.item ?? ''),
  }),
}));

import {
  ApprovalStatusTag,
  ChangeRequestStatusTag,
  ClientProjectStatusTag,
  MilestoneStatusTag,
  PriorityTag,
  RoleTag,
  VisibilityTag,
} from './portal-tags';
import { UserStatusTag, OrganizationAccessTag } from './UserStatusTag';
import { VisibilitySwitch } from './VisibilitySwitch';

describe('v2 status tags', () => {
  it('labels every client role', () => {
    const { rerender } = render(<RoleTag role="admin" />);
    expect(screen.getByText('Client Admin')).toBeInTheDocument();
    rerender(<RoleTag role="member" />);
    expect(screen.getByText('Client Member')).toBeInTheDocument();
    rerender(<RoleTag role="viewer" />);
    expect(screen.getByText('Client Viewer')).toBeInTheDocument();
  });

  it('labels the approval, change request, milestone, project and priority vocabularies', () => {
    render(
      <>
        <ApprovalStatusTag status="changes_requested" />
        <ChangeRequestStatusTag status="more_info" />
        <MilestoneStatusTag status="delayed" />
        <ClientProjectStatusTag status="at_risk" />
        <PriorityTag priority="high" />
      </>
    );
    expect(screen.getByText('Changes Requested')).toBeInTheDocument();
    expect(screen.getByText('More Information Required')).toBeInTheDocument();
    expect(screen.getByText('Delayed')).toBeInTheDocument();
    expect(screen.getByText('At risk')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('shows Internal only for the default visibility and Client visible once shared', () => {
    const { rerender } = render(<VisibilityTag visibility="internal" />);
    expect(screen.getByText('Internal only')).toBeInTheDocument();
    rerender(<VisibilityTag visibility="client" />);
    expect(screen.getByText('Client visible')).toBeInTheDocument();
  });
});

describe('UserStatusTag', () => {
  const invited = {
    status: 'invited' as const,
    invite_expired: false,
    invite_not_sent: false,
    new_link_requested: false,
    email_verified: false,
  };

  it('shows an active user as Active only', () => {
    render(<UserStatusTag user={{ ...invited, status: 'active', email_verified: true }} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('Email not verified')).not.toBeInTheDocument();
  });

  it('treats "Invite expired" as a flag on an Invited user, not a separate status', () => {
    render(<UserStatusTag user={{ ...invited, invite_expired: true }} />);
    expect(screen.getByText('Invite expired')).toBeInTheDocument();
    expect(screen.queryByText('Invited')).not.toBeInTheDocument();
  });

  it('keeps showing that the client asked for a new link and has not verified their email', () => {
    render(<UserStatusTag user={{ ...invited, invite_expired: true, new_link_requested: true }} />);
    expect(screen.getByText('Asked for a new link')).toBeInTheDocument();
    expect(screen.getByText('Email not verified')).toBeInTheDocument();
  });

  it('flags an invitation that has not been sent yet', () => {
    render(<UserStatusTag user={{ ...invited, invite_not_sent: true }} />);
    expect(screen.getByText('Invited')).toBeInTheDocument();
    expect(screen.getByText('Invite not sent yet')).toBeInTheDocument();
  });

  it('shows a deactivated user as Deactivated', () => {
    render(<UserStatusTag user={{ ...invited, status: 'deactivated' }} />);
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
  });
});

describe('OrganizationAccessTag', () => {
  it('shows "No users" when an organization has no users', () => {
    render(<OrganizationAccessTag access="none" />);
    expect(screen.getByText('No users')).toBeInTheDocument();
  });
});

describe('VisibilitySwitch', () => {
  it('reports the new visibility when toggled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <VisibilitySwitch visibility="internal" itemLabel="Landing page copy" onChange={onChange} />
    );

    const toggle = screen.getByRole('switch', { name: 'Client visible: Landing page copy' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);

    expect(onChange).toHaveBeenCalledWith('client');
  });

  it('reports internal when a shared item is switched off', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <VisibilitySwitch visibility="client" itemLabel="Brand Guidelines.pdf" onChange={onChange} />
    );

    await user.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith('internal');
  });

  it('does not report a change while disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <VisibilitySwitch visibility="internal" itemLabel="Task" onChange={onChange} disabled />
    );

    await user.click(screen.getByRole('switch'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
