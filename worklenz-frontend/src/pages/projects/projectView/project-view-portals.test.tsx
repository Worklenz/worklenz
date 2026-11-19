import { act, render, screen } from '@testing-library/react';
import { configureStore, type UnknownAction } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loaded: vi.fn(), controller: vi.fn() }));
vi.mock('@/components/task-drawer/task-drawer', () => ({
  default: () => {
    mocks.controller();
    return <span>URL controller</span>;
  },
}));
vi.mock('@/components/suspense-fallback/suspense-fallback', () => ({
  SuspenseFallback: () => <span>Loading dialog</span>,
}));
vi.mock('@/features/projects/singleProject/phase/PhaseDrawer', () => {
  mocks.loaded('phase');
  return { default: () => <span>Phase dialog</span> };
});
vi.mock('@/components/project-task-filters/create-status-drawer/create-status-drawer', () => {
  mocks.loaded('status');
  return { default: () => <span>Status dialog</span> };
});
vi.mock('@/components/project-task-filters/delete-status-drawer/delete-status-drawer', () => {
  mocks.loaded('delete');
  return { default: () => <span>Delete dialog</span> };
});
vi.mock('@/components/common/invite-project-members/InviteProjectMembers', () => {
  mocks.loaded('invite');
  return {
    default: ({ projectId, projectName }: { projectId: string; projectName: string }) => (
      <span>
        Invite {projectId}: {projectName}
      </span>
    ),
  };
});
vi.mock('@/components/task-templates/import-task-template', () => {
  mocks.loaded('import');
  return { default: () => <span>Import dialog</span> };
});
vi.mock('@/components/save-project-as-template/save-project-as-template', () => {
  mocks.loaded('save');
  return { default: () => <span>Save dialog</span> };
});
vi.mock('@/components/projects/project-settings-modal/ProjectSettingsModal', () => {
  mocks.loaded('settings');
  return { ProjectSettingsModal: () => <span>Settings dialog</span> };
});

import { ProjectViewPortals } from './project-view-portals';

const makeStore = () => {
  const initial = {
    projectReducer: { project: { id: 'a', name: 'Alpha' }, importTaskTemplateDrawerOpen: false },
    projectMemberReducer: { isDrawerOpen: false },
    phaseReducer: { isPhaseDrawerOpen: false },
    statusReducer: { isCreateStatusDrawerOpen: false },
    deleteStatusReducer: { isDeleteStatusDrawerOpen: false },
    projectSettingsModalReducer: { isOpen: false },
    projectsReducer: { isSaveAsTemplateDrawerOpen: false },
  };
  return configureStore({
    reducer: (state = initial, action: UnknownAction) => {
      if (action.type === 'invite')
        return { ...state, projectMemberReducer: { isDrawerOpen: true } };
      if (action.type === 'phase') return { ...state, phaseReducer: { isPhaseDrawerOpen: true } };
      if (action.type === 'project')
        return {
          ...state,
          projectReducer: { ...state.projectReducer, project: { id: 'b', name: 'Beta' } },
        };
      return state;
    },
  });
};

beforeEach(() => vi.clearAllMocks());

describe('project shell dialogs', () => {
  it('retains the URL controller and does not import closed dialogs on startup', () => {
    render(
      <Provider store={makeStore()}>
        <ProjectViewPortals />
      </Provider>
    );
    expect(screen.getByText('URL controller')).toBeInTheDocument();
    expect(mocks.loaded).not.toHaveBeenCalled();
  });

  it('opens immediately and keeps invitation props aligned with the current project', async () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <ProjectViewPortals />
      </Provider>
    );
    act(() => store.dispatch({ type: 'invite' }));
    expect(await screen.findByText('Invite a: Alpha')).toBeInTheDocument();
    act(() => store.dispatch({ type: 'project' }));
    expect(screen.getByText('Invite b: Beta')).toBeInTheDocument();
    act(() => store.dispatch({ type: 'phase' }));
    expect(await screen.findByText('Phase dialog')).toBeInTheDocument();
    expect(mocks.loaded).not.toHaveBeenCalledWith('settings');
    expect(mocks.loaded).not.toHaveBeenCalledWith('save');
  });
});
