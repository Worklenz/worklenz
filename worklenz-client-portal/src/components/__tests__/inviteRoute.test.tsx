import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderPortal } from '@/test/renderPortal';
import InviteRoute from '../InviteRoute';

const open = (token: string) => renderPortal(<InviteRoute />, { path: '/invite', route: `/invite?token=${token}` });

describe('Invitation link while signed in', () => {
  it('joins the invited portal with no code and lands on the dashboard in that portal', async () => {
    const { store } = open('mock-invite');
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/dashboard'));
    expect(store.getState().auth.currentOrganizationId).toBe('org-northwind');
    expect(screen.queryByText(/one-time code/i)).not.toBeInTheDocument();
  });

  it('offers to sign out when the invitation is for a different email address', async () => {
    open('mock-other-address');
    expect(await screen.findByText('This invitation is for a different email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out and use this invitation' })).toBeInTheDocument();
  });

  it('says so when the link is no longer valid', async () => {
    open('expired');
    expect(await screen.findByText('This invitation link is no longer valid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to the overview' })).toBeInTheDocument();
  });
});
