import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  getConfigs: vi.fn(),
  getRepositories: vi.fn(),
  panelLoaded: vi.fn(),
  dropdownRender: vi.fn(),
  dispatch: vi.fn(),
  hasBusiness: true,
}));
vi.mock('@/api/slack/slack.api.service', () => ({
  slackApiService: { getStatus: mocks.getStatus, getProjectChannelConfigs: mocks.getConfigs },
}));
vi.mock('@/api/github/github.api.service', () => ({
  githubApiService: { getProjectRepositories: mocks.getRepositories },
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (
    selector: (state: { projectReducer: { project: { project_type: string } } }) => unknown
  ) => selector({ projectReducer: { project: { project_type: 'default' } } }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({ getCurrentSession: () => ({ id: 'user' }) }),
}));
vi.mock('@/utils/subscription-utils', () => ({
  hasBusinessFeatureAccess: () => mocks.hasBusiness,
}));
vi.mock('@/lib/project/software-project', () => ({ isSoftwareProjectType: () => false }));
vi.mock('@/features/admin-center/admin-center.slice', () => ({
  showUpgradePrompt: (payload: unknown) => ({ type: 'upgrade', payload }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));
vi.mock('./IntegrationsDropdown', () => {
  mocks.panelLoaded();
  return {
    IntegrationsDropdown: ({ onClose }: { onClose: () => void }) => (
      <div>
        <span>Integration panel</span>
        <button onClick={onClose}>Close panel</button>
      </div>
    ),
  };
});
vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {
    ...actual,
    Dropdown: (props: ComponentProps<typeof actual.Dropdown>) => {
      mocks.dropdownRender(props.open);
      return <actual.Dropdown {...props} />;
    },
  };
});

import { ProjectIntegrationsButton } from './ProjectIntegrationsButton';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasBusiness = true;
  mocks.getStatus.mockResolvedValue({ connected: true });
  mocks.getConfigs.mockResolvedValue({
    body: [{ id: 'channel', slackChannelName: 'Project channel', isActive: true }],
  });
});

describe('deferred integration menu', () => {
  it('keeps the connection badge without mounting or importing the closed menu', async () => {
    render(<ProjectIntegrationsButton projectId="project" />);
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    expect(mocks.getConfigs).toHaveBeenCalledWith('project');
    expect(mocks.dropdownRender).not.toHaveBeenCalled();
    expect(mocks.panelLoaded).not.toHaveBeenCalled();
  });

  it.each(['click', 'Enter', 'Space'])(
    'opens on the first %s and can close and reopen',
    async activation => {
      const user = userEvent.setup();
      render(<ProjectIntegrationsButton projectId="project" />);
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
      const button = screen.getByRole('button', { name: 'Manage project integrations' });
      if (activation === 'click') await user.click(button);
      else {
        button.focus();
        await user.keyboard(activation === 'Enter' ? '{Enter}' : ' ');
      }
      expect(await screen.findByText('Integration panel')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Close panel' }));
      await waitFor(() => expect(mocks.dropdownRender).toHaveBeenLastCalledWith(false));
      await user.click(screen.getByRole('button', { name: 'Manage project integrations' }));
      await waitFor(() => expect(mocks.dropdownRender).toHaveBeenLastCalledWith(true));
    }
  );

  it('retains the upgrade action for teams without integration access', async () => {
    mocks.hasBusiness = false;
    const user = userEvent.setup();
    render(<ProjectIntegrationsButton projectId="project" />);
    await user.click(screen.getByRole('button'));
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'upgrade' }));
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(mocks.dropdownRender).not.toHaveBeenCalled();
  });
});
