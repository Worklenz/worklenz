import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderPortal } from '@/test/renderPortal';
import ClientLayout from '../ClientLayout';
import { InvoicesGate } from '@/components/v2';

const inLayout = (route = '/dashboard', scenario = {}) =>
  renderPortal(
    <Routes>
      <Route element={<ClientLayout />}>
        <Route path="/dashboard" element={<div>dashboard page</div>} />
        <Route path="/projects/:projectId/:tab?" element={<div>project page</div>} />
        <Route
          path="/invoices"
          element={
            <InvoicesGate>
              <div>invoices page</div>
            </InvoicesGate>
          }
        />
      </Route>
    </Routes>,
    { path: '/*', route, scenario }
  );

describe('Shell', () => {
  it('shows the navigation items (notifications live in the bell, not the sidebar), without Invoices by default', async () => {
    inLayout();
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    ['Overview', 'Projects', 'Discussions', 'Approvals', 'Change Req.'].forEach(label =>
      expect(within(nav).getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
    );
    expect(within(nav).queryByRole('link', { name: /Notifications/ })).not.toBeInTheDocument();
    // Account moved into Settings, so it is not in the sidebar either.
    expect(within(nav).queryByRole('link', { name: /Account/ })).not.toBeInTheDocument();
    await waitFor(() => expect(within(nav).queryByRole('link', { name: /Invoices/ })).not.toBeInTheDocument());
  });

  it('adds Invoices when the operator turned them on', async () => {
    inLayout('/dashboard', { invoicesVisible: true });
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(await within(nav).findByRole('link', { name: /Invoices/ })).toBeInTheDocument();
  });

  it('badges only what this person can act on: an admin sees pending approvals, a member does not', async () => {
    const { unmount } = inLayout();
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(await within(nav).findByRole('link', { name: 'Approvals (1)' })).toBeInTheDocument();
    unmount();

    inLayout('/dashboard', { userId: 'u-jamie' });
    const memberNav = await screen.findByRole('navigation', { name: 'Main navigation' });
    await within(memberNav).findByRole('link', { name: /Change Req\./ });
    expect(within(memberNav).queryByRole('link', { name: /Approvals \(/ })).not.toBeInTheDocument();
    // Jamie's change request is waiting for a reply
    expect(await within(memberNav).findByRole('link', { name: 'Change Req. (1)' })).toBeInTheDocument();
  });

  it('shows the name, role and Settings in the account menu, without a language picker', async () => {
    inLayout();
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    expect(await screen.findByText('Alex Chen')).toBeInTheDocument();
    expect(screen.getByText('Client Admin')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Settings/ })).toBeInTheDocument();
    // Account moved into Settings (Notifications, Organization), so the menu no longer has its own item.
    expect(screen.queryByRole('menuitem', { name: /Account$/ })).not.toBeInTheDocument();
    expect(screen.getByText('Dark mode')).toBeInTheDocument();
    expect(screen.queryByText('Language')).not.toBeInTheDocument();
  });

  it('offers a team switcher to a login that belongs to several teams, marking the current one', async () => {
    inLayout();
    const trigger = await screen.findByRole('button', { name: 'Switch portal' });
    expect(within(trigger).getByText('Ceydigital Project Hub')).toBeInTheDocument();
    await userEvent.click(trigger);
    const options = await screen.findAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Northwind Client Portal'), expect.stringContaining('Lumen Agency')])
    );
    expect(options.filter(o => o.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('switches team in place: the pill and the page content follow, with no reload', async () => {
    inLayout();
    await userEvent.click(await screen.findByRole('button', { name: 'Switch portal' }));
    await userEvent.click(await screen.findByRole('option', { name: /Northwind Client Portal/ }));
    await waitFor(() =>
      expect(within(screen.getByRole('button', { name: 'Switch portal' })).getByText('Northwind Client Portal')).toBeInTheDocument()
    );
    // the app stayed mounted and re-read the new team's account
    expect(await screen.findByText('dashboard page')).toBeInTheDocument();
  });

  it('shows the Worklenz logo and the common portal name until the operator sets branding', async () => {
    inLayout('/dashboard', { brandingSet: false });
    expect(await screen.findByRole('img', { name: 'Worklenz' })).toBeInTheDocument();
    expect(screen.getByText('Client Portal')).toBeInTheDocument();
  });

  it('keeps the fixed Client Portal title beside the logo, and the Portal Title in the switcher pill only', async () => {
    inLayout();
    expect(await screen.findByRole('img', { name: 'Worklenz' })).toBeInTheDocument();
    expect(screen.getByText('Client Portal')).toBeInTheDocument();
    expect(await screen.findAllByText('Ceydigital Project Hub')).toHaveLength(1);
  });

  it('shows the portal as a plain pill, with no dropdown and no disabled control, for a login in a single portal', async () => {
    inLayout('/dashboard', { multiTeam: false });
    await screen.findByRole('button', { name: 'Account menu' });
    // the same pill as the switcher, carrying the portal's name
    const pill = await screen.findByTitle('Ceydigital Project Hub');
    expect(pill.tagName).toBe('SPAN');
    expect(screen.queryByRole('button', { name: 'Switch portal' })).not.toBeInTheDocument();
  });

  it('searches tasks by key and approvals by title from the top bar', async () => {
    inLayout();
    const search = await screen.findByRole('textbox', { name: 'Search the portal' });
    await userEvent.type(search, 'WL-224');
    expect(await screen.findByText('Landing page copy')).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'wireframe v3');
    expect(await screen.findByText('Approve homepage wireframe v3')).toBeInTheDocument();
  });

  it('offers New member and New change request from the plus menu', async () => {
    inLayout();
    await userEvent.click(await screen.findByRole('button', { name: 'Add new' }));
    expect(await screen.findByRole('menuitem', { name: /New member/ })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('menuitem', { name: /New change request/ }));
    expect(await screen.findByText('Submit request')).toBeInTheDocument();
  });

  it('switches the theme from the account menu and keeps the menu open with an On pill', async () => {
    inLayout();
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Dark mode/ }));
    const item = await screen.findByRole('menuitem', { name: /Light mode/ });
    expect(within(item).getByText('On')).toBeInTheDocument();
    await userEvent.click(item);
    expect(await screen.findByRole('menuitem', { name: /Dark mode/ })).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('shows the project selector only inside a project with more than one project', async () => {
    const { unmount } = inLayout('/projects/p1/overview');
    expect(await screen.findByRole('combobox', { name: 'Current project' })).toBeInTheDocument();
    unmount();

    inLayout('/projects/p1/overview', { userId: 'u-sam' });
    await screen.findByText('project page');
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Current project' })).not.toBeInTheDocument());
  });

  it('opens the bell popover with filters, mark-all and per-row mark read', async () => {
    inLayout();
    await userEvent.click(await screen.findByRole('button', { name: 'Open notifications' }));
    expect(await screen.findByText('Mark all as read')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^New \(/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Read \(/ })).toBeInTheDocument();
    expect((await screen.findAllByRole('button', { name: /Mark (read|unread)/ })).length).toBeGreaterThan(0);
  });
});

describe('Invoices gate', () => {
  it('shows the unavailable page when invoices are off', async () => {
    inLayout('/invoices');
    expect(await screen.findByText("This item isn't available")).toBeInTheDocument();
    expect(screen.queryByText('invoices page')).not.toBeInTheDocument();
  });

  it('shows invoices when the operator turned them on', async () => {
    inLayout('/invoices', { invoicesVisible: true });
    expect(await screen.findByText('invoices page')).toBeInTheDocument();
  });
});
