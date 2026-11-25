import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectIntegrationsButton } from './ProjectIntegrationsButton';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue }),
}));
vi.mock('./ProjectIntegrationCenterModal', () => ({
  ProjectIntegrationCenterModal: ({ open, projectId, projectName, onClose }: { open: boolean; projectId: string; projectName?: string; onClose: () => void }) =>
    open ? <div role="dialog"><span>{projectName}: {projectId}</span><button onClick={onClose}>Close</button></div> : null,
}));

describe('project integrations button', () => {
  it.each(['click', 'Enter', 'Space'])('opens the project center directly with %s and can reopen', async activation => {
    const user = userEvent.setup();
    render(<ProjectIntegrationsButton projectId="project-1" projectName="Planning" />);
    const button = screen.getByRole('button', { name: 'Manage project integrations' });
    if (activation === 'click') await user.click(button);
    else { button.focus(); await user.keyboard(activation === 'Enter' ? '{Enter}' : ' '); }
    expect(screen.getByRole('dialog')).toHaveTextContent('Planning: project-1');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(button);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
