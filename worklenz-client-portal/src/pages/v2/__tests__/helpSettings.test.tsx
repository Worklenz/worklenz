import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPortal } from '@/test/renderPortal';
import SettingsPage from '../SettingsPage';

describe('Settings > Help', () => {
  it('lists help links, no release notes, and the configured version and date', async () => {
    vi.stubEnv('VITE_APP_VERSION', '2.3');
    vi.stubEnv('VITE_APP_LAST_UPDATED', '2026-10-08');
    renderPortal(<SettingsPage />, { path: '/settings/:section', route: '/settings/help' });

    expect(await screen.findByRole('link', { name: /Documentation/ })).toHaveAttribute('href', expect.stringContaining('docs.worklenz.com'));
    expect(screen.getByRole('link', { name: /Email support/ })).toHaveAttribute('href', expect.stringMatching(/^mailto:/));
    expect(screen.getByRole('link', { name: /Privacy policy/ })).toBeInTheDocument();
    expect(screen.queryByText('Release notes')).not.toBeInTheDocument();
    expect(screen.getByText('2.3')).toBeInTheDocument();
    expect(screen.getByText('October 8, 2026')).toBeInTheDocument();
    expect(screen.getByText('Help & Support')).toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
