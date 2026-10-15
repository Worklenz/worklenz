import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPortal } from '@/test/renderPortal';
import DashboardPage from '@/pages/v2/DashboardPage';

const originalMatchMedia = window.matchMedia;

// The Customise button is a tablet/desktop feature: pretend the viewport is wide.
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('Dashboard customisation', () => {
  it('hides a widget, saves, and keeps it hidden', async () => {
    const user = userEvent.setup();
    renderPortal(<DashboardPage />);
    expect(await screen.findByText('Recent activity')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Customise/ }));
    await user.click(await screen.findByRole('button', { name: 'Hide Recent activity' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByText('Recent activity')).not.toBeInTheDocument());
    // Back out of edit mode with the arrangement saved
    expect(await screen.findByRole('button', { name: /Customise/ })).toBeInTheDocument();
  });

  it('discards changes on Cancel', async () => {
    const user = userEvent.setup();
    renderPortal(<DashboardPage />);
    expect(await screen.findByText('Recent activity')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Customise/ }));
    await user.click(await screen.findByRole('button', { name: 'Hide Recent activity' }));
    await waitFor(() => expect(screen.queryByText('Recent activity')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Recent activity')).toBeInTheDocument();
  });

  it('brings a hidden chart widget back through Add widget', async () => {
    const user = userEvent.setup();
    renderPortal(<DashboardPage />);
    expect(await screen.findByText('Your projects')).toBeInTheDocument();
    expect(screen.queryByText('Projects by status')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Customise/ }));
    await user.click(await screen.findByRole('button', { name: /Add widget/ }));
    await user.click(await screen.findByText('Projects by status'));

    expect(await screen.findByRole('button', { name: 'Hide Projects by status' })).toBeInTheDocument();
  });

  it('scrolls to and focuses a widget that was just added', async () => {
    const user = userEvent.setup();
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    renderPortal(<DashboardPage />);
    expect(await screen.findByText('Your projects')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Customise/ }));
    await user.click(await screen.findByRole('button', { name: /Add widget/ }));
    await user.click(await screen.findByText('Project progress'));

    await waitFor(() => expect(scrolled).toHaveBeenCalled(), { timeout: 2000 });
    expect(document.querySelector('[data-widget="chart-project-progress"]')).toHaveFocus();
  });
});
