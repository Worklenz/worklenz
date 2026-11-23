import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IntegrationsSettings from './IntegrationsSettings';
import { getAddonSlotItems } from '@/addons/addon-slots';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));
vi.mock('@/addons/addon-slots', () => ({ getAddonSlotItems: vi.fn() }));
vi.mock('@/components/settings/integrations/SlackIntegration', () => ({
  SlackIntegration: () => <div>Slack integration</div>,
}));
vi.mock('@/components/github/GithubIntegrationCard', () => ({
  GithubIntegrationCard: () => <div>GitHub integration</div>,
}));

describe('IntegrationsSettings', () => {
  beforeEach(() => vi.mocked(getAddonSlotItems).mockReturnValue([]));

  it('keeps built-in integrations usable without the factory and supports search', async () => {
    render(<IntegrationsSettings />);
    expect(screen.getByText('Slack integration')).toBeInTheDocument();
    expect(screen.getByText('GitHub integration')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search integrations' }), 'unknown');
    expect(screen.getByText('No integrations found.')).toBeInTheDocument();
    expect(screen.queryByText('Slack integration')).not.toBeInTheDocument();
  });

  it('filters the built-in cards through category navigation', async () => {
    render(<IntegrationsSettings />);
    await userEvent.click(screen.getByRole('button', { name: 'Communication' }));
    expect(screen.getByText('Slack integration')).toBeInTheDocument();
    expect(screen.queryByText('GitHub integration')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Communication' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('passes search to the factory in the same catalog', async () => {
    const Factory = ({ searchQuery }: { searchQuery: string }) => (
      <div>
        Factory: {searchQuery}
      </div>
    );
    vi.mocked(getAddonSlotItems).mockReturnValue([{ key: 'factory', component: Factory }]);
    render(<IntegrationsSettings />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search integrations' }), 'jira');
    expect(screen.getByText('Factory: jira')).toBeInTheDocument();
  });
});
