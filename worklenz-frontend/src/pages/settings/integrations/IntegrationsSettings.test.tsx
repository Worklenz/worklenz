import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IntegrationsSettings from './IntegrationsSettings';
import { getAddonSlotItems } from '@/addons/addon-slots';
import { slackApiService } from '@/api/slack/slack.api.service';
import { githubApiService } from '@/api/github/github.api.service';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));
vi.mock('@/addons/addon-slots', () => ({ getAddonSlotItems: vi.fn() }));
vi.mock('@/api/slack/slack.api.service', () => ({ slackApiService: { getProjectChannelConfigs: vi.fn() } }));
vi.mock('@/api/github/github.api.service', () => ({ githubApiService: { getProjectRepositories: vi.fn() } }));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/hooks/useAppSelector', () => ({ useAppSelector: () => true }));
vi.mock('@/lib/project/software-project', () => ({ isSoftwareProjectType: () => true }));
vi.mock('@/components/projects/integrations/SlackProjectQuickAddModal', () => ({
  SlackProjectQuickAddModal: ({ open, projectId }: { open: boolean; projectId: string }) => open ? <div>Slack setup: {projectId}</div> : null,
}));
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

  it('separates project connections from the explore catalog', async () => {
    vi.mocked(slackApiService.getProjectChannelConfigs).mockResolvedValue({ done: true, body: [{ isActive: true }] } as never);
    vi.mocked(githubApiService.getProjectRepositories).mockResolvedValue({ done: true, body: { connected: true, linked: [] } } as never);
    const Factory = ({ projectView }: { projectView: string }) => <div>Factory view: {projectView}</div>;
    vi.mocked(getAddonSlotItems).mockReturnValue([{ key: 'factory', component: Factory }]);
    render(<IntegrationsSettings projectId="project-1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Manage' }));
    expect(screen.getByText('Configured for this project')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add project channel' })).toHaveClass('ant-btn-primary');
    await userEvent.click(screen.getByRole('button', { name: 'Add project channel' }));
    expect(screen.getByText('Slack setup: project-1')).toBeInTheDocument();
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
    expect(screen.getByText('Factory view: connected')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Explore integrations'));
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Factory view: explore')).toBeInTheDocument();
  });

  it('opens explore card details by click and keyboard', async () => {
    vi.mocked(slackApiService.getProjectChannelConfigs).mockResolvedValue({ done: true, body: [] } as never);
    vi.mocked(githubApiService.getProjectRepositories).mockResolvedValue({ done: true, body: { connected: false, linked: [] } } as never);
    const user = userEvent.setup();
    render(<IntegrationsSettings projectId="project-1" />);
    await user.click(screen.getByText('Explore integrations'));
    expect(screen.queryByRole('button', { name: 'View details' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Slack' }));
    expect(screen.getByRole('button', { name: 'Add project channel' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    const github = screen.getByRole('button', { name: 'GitHub' });
    github.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Manage project repositories' })).toBeInTheDocument();
  });

  it('reports unknown project connection statuses without claiming there are none', async () => {
    vi.mocked(slackApiService.getProjectChannelConfigs).mockRejectedValue(new Error('unavailable'));
    vi.mocked(githubApiService.getProjectRepositories).mockRejectedValue(new Error('unavailable'));
    render(<IntegrationsSettings projectId="project-1" />);
    expect(await screen.findByText('Some project connection statuses could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText(/No integrations are configured/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
