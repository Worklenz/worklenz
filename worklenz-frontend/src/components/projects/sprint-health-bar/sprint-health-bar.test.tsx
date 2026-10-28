import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  goToProjectTab: vi.fn(),
  unwrap: vi.fn(),
}));

vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      phaseReducer: { phaseList: [] },
      projectReducer: {
        project: { id: 'project-1', name: 'Demo', project_type: 'software' },
      },
      taskManagement: { entities: {} },
      enhancedKanbanReducer: { taskGroups: [] },
    }),
}));

vi.mock('@/hooks/useProjectTabNavigation', () => ({
  useProjectTabNavigation: () => ({ goToProjectTab: mocks.goToProjectTab }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

vi.mock('@/features/project/project-drawer.slice', () => ({
  fetchProjectData: (projectId: string) => ({
    type: 'project/fetchProjectData',
    payload: projectId,
  }),
  setProjectData: (project: unknown) => ({ type: 'project/setProjectData', payload: project }),
  setProjectId: (projectId: string) => ({ type: 'project/setDrawerProjectId', payload: projectId }),
}));

vi.mock('@/features/project/project-settings-modal.slice', () => ({
  openProjectSettingsModal: () => ({ type: 'projectSettingsModal/open' }),
  setActiveSettingsSection: (section: string) => ({
    type: 'projectSettingsModal/setActiveSettingsSection',
    payload: section,
  }),
}));

vi.mock('@/features/projects/singleProject/phase/phases.slice', () => ({
  fetchPhasesByProjectId: (projectId: string) => ({
    type: 'phases/fetch',
    payload: projectId,
  }),
}));

import { SprintHealthBar } from './sprint-health-bar';

describe('SprintHealthBar', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(fn => fn.mockReset());
    mocks.dispatch.mockImplementation((action: unknown) => {
      if (
        typeof action === 'object' &&
        action &&
        'type' in action &&
        (action as { type: string }).type === 'project/fetchProjectData'
      ) {
        return { unwrap: mocks.unwrap };
      }
      return action;
    });
    mocks.unwrap.mockResolvedValue({});
  });

  it('opens the sprints settings section when Plan sprint is clicked', async () => {
    render(<SprintHealthBar projectId="project-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Plan sprint' }));

    expect(mocks.goToProjectTab).toHaveBeenCalledWith('backlog');
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'projectSettingsModal/setActiveSettingsSection',
      payload: 'sprints',
    });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'project/setDrawerProjectId',
      payload: 'project-1',
    });

    await waitFor(() =>
      expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'projectSettingsModal/open' })
    );
  });
});
