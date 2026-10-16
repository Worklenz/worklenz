import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPortal } from '@/test/renderPortal';
import NotificationsPage from '../NotificationsPage';
import AccountPage from '../AccountPage';
import SettingsPage from '../SettingsPage';
import DiscussionsPage from '../DiscussionsPage';

describe('Notifications', () => {
  it('lists unread notifications with a Mark read button', async () => {
    renderPortal(<NotificationsPage />, { path: '/notifications', route: '/notifications' });
    await userEvent.click(await screen.findByRole('tab', { name: /Unread \(\d+\)/ }));
    const rows = await screen.findAllByRole('button', { name: 'Mark read' });
    expect(rows.length).toBeGreaterThan(0);
  });

  it('marks everything read', async () => {
    renderPortal(<NotificationsPage />, { path: '/notifications', route: '/notifications' });
    const markAll = await screen.findByRole('button', { name: 'Mark all as read' });
    await waitFor(() => expect(markAll).toBeEnabled());
    await userEvent.click(markAll);
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark all as read/ })).toBeDisabled(), { timeout: 4000 });
  });

  it('does not list a notification whose item staff hid', async () => {
    renderPortal(<NotificationsPage />, { path: '/notifications', route: '/notifications', scenario: { hiddenIds: ['t101'] } });
    await screen.findByRole('tab', { name: /All \(\d+\)/ });
    await waitFor(() => expect(screen.queryByText(/replied on Landing page copy/)).not.toBeInTheDocument());
  });
});

describe('Discussions', () => {
  it('locks the reply box for a Viewer', async () => {
    renderPortal(<DiscussionsPage />, { path: '/discussions', route: '/discussions', scenario: { userId: 'u-sam' } });
    expect(await screen.findByText("Client Viewers can read discussions but can't reply.")).toBeInTheDocument();
  });

  it('lets a Member start a project discussion', async () => {
    renderPortal(<DiscussionsPage />, { path: '/discussions', route: '/discussions', scenario: { userId: 'u-jamie' } });
    await userEvent.click(await screen.findByRole('button', { name: 'New discussion' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'Question about the launch plan');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start discussion' }));
    await waitFor(() => expect(screen.getAllByText(/Question about the launch plan/).length).toBeGreaterThan(0));
  });

  it('shows the conversation with its reference, the audience line and the composer', async () => {
    renderPortal(<DiscussionsPage />, { path: '/discussions', route: '/discussions?thread=th1', scenario: { userId: 'u-jamie' } });
    expect(await screen.findByText('DS-000001')).toBeInTheDocument();
    expect(screen.getByText('Visible to your team and everyone on this project')).toBeInTheDocument();
    expect(screen.getByText('Press Ctrl+Enter to send')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.queryByText('Internal comment')).not.toBeInTheDocument();
  });

  it('sends a reply and clears the box', async () => {
    renderPortal(<DiscussionsPage />, { path: '/discussions', route: '/discussions?thread=th1', scenario: { userId: 'u-jamie' } });
    const box = await screen.findByRole('textbox', { name: /Reply to the team/ });
    await userEvent.type(box, 'Thanks, see you Friday');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getAllByText(/Thanks, see you Friday/).length).toBeGreaterThan(0));
    await waitFor(() => expect(box).toHaveValue(''));
  });

  it('offers a Client users only option that hides the message from the team', async () => {
    renderPortal(<DiscussionsPage />, { path: '/discussions', route: '/discussions?thread=th1', scenario: { userId: 'u-jamie' } });
    await userEvent.click(await screen.findByRole('radio', { name: 'Client users only' }));
    expect(screen.getByText(/Your team cannot\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attach files' })).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: /Write to your colleagues/ }), 'Can we align before replying?');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('your team cannot see this', { exact: false })).toBeInTheDocument();
  });

  it('filters the list to unread discussions', async () => {
    renderPortal(<DiscussionsPage />, { path: '/discussions', route: '/discussions', scenario: { userId: 'u-jamie' } });
    await screen.findByRole('radio', { name: 'Unread' });
    await userEvent.click(screen.getByRole('radio', { name: 'Unread' }));
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /General/ }).length + screen.queryAllByText('No discussions match.').length).toBeGreaterThan(-1));
  });

  it('shows the banner for a thread that is no longer visible', async () => {
    renderPortal(<DiscussionsPage />, { path: '/discussions', route: '/discussions?thread=th2', scenario: { hiddenIds: ['t101'] } });
    expect(await screen.findByText(/The discussion you opened isn't available/)).toBeInTheDocument();
  });
});

describe('Account', () => {
  it('shows a Client Admin the role summary and a note when user management is off', async () => {
    renderPortal(<SettingsPage />, { path: '/settings/:section?', route: '/settings/profile' });
    expect(await screen.findByText('Your role: Client Admin')).toBeInTheDocument();
    renderPortal(<SettingsPage />, { path: '/settings/:section?', route: '/settings/members' });
    expect(await screen.findByText(/Inviting and removing colleagues isn't enabled/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Invite Member/ })).not.toBeInTheDocument();
  });

  it('offers invite and remove when the operator enabled them for an admin', async () => {
    renderPortal(<SettingsPage />, { path: '/settings/:section?', route: '/settings/members', scenario: { adminsCanInvite: true, adminsCanRemove: true } });
    expect(await screen.findByRole('button', { name: /Invite Member/ })).toBeInTheDocument();
    const [firstActions] = await screen.findAllByRole('button', { name: /^Actions for / });
    await userEvent.click(firstActions);
    expect(await screen.findByRole('menuitem', { name: /Remove/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Change role/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
  });

  it('lets a Client Admin assign projects to a Member', async () => {
    renderPortal(<SettingsPage />, { path: '/settings/:section?', route: '/settings/members' });
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Sam Okafor' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Assign project/ }));
    const dialog = await screen.findByRole('dialog');
    const second = await within(dialog).findByRole('checkbox', { name: 'Brandbase Q3 Content Refresh' });
    expect(second).not.toBeChecked();
    await userEvent.click(second);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Project access updated for Sam Okafor.', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('offers no project assignment for a Client Admin, who already opens every project', async () => {
    renderPortal(<SettingsPage />, { path: '/settings/:section?', route: '/settings/members' });
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Alex Chen' }));
    expect(await screen.findByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Assign project/ })).not.toBeInTheDocument();
  });

  it('invites several people by email only, and turns Copy invite link off for more than one address', async () => {
    renderPortal(<SettingsPage />, { path: '/settings/:section?', route: '/settings/members', scenario: { adminsCanInvite: true } });
    await userEvent.click(await screen.findByRole('button', { name: /Invite Member/ }));
    const dialog = await screen.findByRole('dialog');
    const box = within(dialog).getByRole('textbox', { name: 'Email addresses' });
    await userEvent.type(box, 'one@x.io');
    expect(within(dialog).getByRole('button', { name: /Copy invite link/ })).toBeEnabled();
    await userEvent.type(box, ', two@x.io');
    expect(within(dialog).getByRole('button', { name: /Copy invite link/ })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: /Send 2 email invites/ }));
    expect(await within(dialog).findByText(/We emailed invitations to 2 people/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(within(dialog).getByText('one@x.io, two@x.io')).toBeInTheDocument();
  });

  it('pages the members list with 10/20/50/100 rows per page', async () => {
    renderPortal(<SettingsPage />, { path: '/settings/:section?', route: '/settings/members' });
    const select = await screen.findByRole('combobox', { name: 'Rows per page:' });
    expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(['10', '20', '50', '100']);
  });

  it('never offers user management to a Member even when enabled', async () => {
    renderPortal(<SettingsPage />, {
      path: '/settings/:section?',
      route: '/settings/members',
      scenario: { userId: 'u-jamie', adminsCanInvite: true, adminsCanRemove: true },
    });
    await screen.findByText(/Members in/);
    expect(screen.queryByRole('button', { name: /Invite Member/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for / })).not.toBeInTheDocument();
  });

  it('offers email only for the events the operator enabled', async () => {
    renderPortal(<SettingsPage />, { path: '/settings/:section?', route: '/settings/notifications' });
    expect(await screen.findByText(/In-app notifications are always on/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Not offered').length).toBeGreaterThan(0));
  });

  it.each([
    ['/account', '/settings/organization'],
    ['/account/notifications', '/settings/notifications'],
    ['/account/profile', '/settings/profile'],
  ])('sends the old %s link to %s in Settings', async (from, to) => {
    renderPortal(<AccountPage />, { path: '/account/:tab?', route: from });
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(to));
  });
});

describe('Settings', () => {
  const open = (section: string, scenario = {}) =>
    renderPortal(<SettingsPage />, { path: '/settings/:section?', route: `/settings/${section}`, scenario });

  it('opens Profile by default', async () => {
    renderPortal(<SettingsPage />, { path: '/settings/:section?', route: '/settings' });
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/settings/profile'));
  });

  it('saves the name from Profile', async () => {
    open('profile');
    const name = await screen.findByLabelText('Full name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Alexandra Chen');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
  });

  it('keeps the email read-only', async () => {
    open('profile');
    expect(await screen.findByDisplayValue('alex@brandbase.com')).toBeDisabled();
  });

  it('toggles the theme from Appearance', async () => {
    const { store } = open('appearance');
    await userEvent.click(await screen.findByText('Dark'));
    expect(store.getState().ui.theme).toBe('dark');
  });

  it('shows "Save" when clean and "Save changes" once the language changes', async () => {
    const { store } = open('language-and-region');
    const save = await screen.findByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await userEvent.click(screen.getAllByRole('combobox')[0]);
    await userEvent.click(await screen.findByTitle('Français'));
    const dirty = await screen.findByRole('button', { name: 'Save changes' });
    expect(dirty).toBeEnabled();
    await userEvent.click(dirty);
    await waitFor(() => expect(store.getState().ui.language).toBe('fr'));
  });

  it('filters the sections with the search box', async () => {
    open('profile');
    await userEvent.type(await screen.findByLabelText('Search settings'), 'time zone');
    expect(screen.getByRole('link', { name: /Language and Region/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Appearance/ })).not.toBeInTheDocument();
  });
});
