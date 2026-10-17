import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPortal } from '@/test/renderPortal';
import SettingsPage from '../SettingsPage';

const open = (userId?: string) =>
  renderPortal(<SettingsPage />, { path: '/settings/:section', route: '/settings/delete-account', scenario: userId ? { userId } : undefined });

const startDeletion = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /Delete My Account/ }, { timeout: 10000 }));
  const dialog = await screen.findByRole('dialog', { name: 'Confirm account deletion' });
  return dialog;
};

describe('Settings > Delete Account', () => {
  it('lists the section under a Danger Zone group', async () => {
    open();
    expect(await screen.findByText('Danger Zone', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(await screen.findByText(/permanently deleted within 30 days of your request/)).toBeInTheDocument();
  });

  it('keeps the confirm button disabled until DELETE is typed exactly', async () => {
    open();
    await startDeletion();
    const confirm = screen.getByRole('button', { name: 'Yes, delete my account' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Type DELETE to confirm'), 'delete');
    expect(confirm).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Type DELETE to confirm'));
    await userEvent.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    expect(confirm).toBeEnabled();
  });

  it('gives a Client Member a request instead of a delete button', async () => {
    open('u-jamie');
    expect(await screen.findByText('Only a Client Admin can delete an account here.', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete My Account/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Request account deletion' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Request account deletion' })).toBeDisabled());
  });

  it('shows why a deletion is refused when the person is the only Client Admin', async () => {
    open();
    await startDeletion();
    await userEvent.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete my account' }));
    expect(await screen.findByText(/only Client Admin of your organization/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Request submitted')).not.toBeInTheDocument());
  });
});
