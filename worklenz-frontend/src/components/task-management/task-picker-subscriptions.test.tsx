import { Profiler, type ComponentProps } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore, type UnknownAction } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import type { Task } from '@/types/task-management.types';

const mocks = vi.hoisted(() => ({
  socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  getMembers: vi.fn(),
}));
vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({ socket: mocks.socket, connected: true }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({ getCurrentSession: () => ({ id: 'user' }) }),
}));
vi.mock('@/hooks/useProjectPermissions', () => ({
  default: () => ({ permissions: { members: { add: false } } }),
}));
vi.mock('@/api/projects/projects.api.service', () => ({
  projectsApiService: { getMembers: mocks.getMembers },
}));
vi.mock('@/features/enhanced-kanban/enhanced-kanban.slice', () => ({
  updateEnhancedKanbanTaskAssignees: vi.fn(),
}));
vi.mock('@/features/projects/singleProject/members/projectMembersSlice', () => ({
  setIsFromAssigner: vi.fn(),
  toggleProjectMemberDrawer: vi.fn(),
}));
vi.mock('@/components', () => ({
  Avatar: () => null,
  Button: ({ children }: ComponentProps<'button'>) => <button>{children}</button>,
  Checkbox: ({ checked, disabled, onChange }: ComponentProps<'input'>) => (
    <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
  ),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));
vi.mock('@/i18n', () => ({ default: { language: 'en', t: (key: string) => key } }));

import AssigneeSelector from '@/components/AssigneeSelector';
import TaskPhaseDropdown from './task-phase-dropdown';

const makeStore = () => {
  const initialState = {
    projectReducer: { projectId: 'project', project: { project_type: 'default' } },
    phaseReducer: {
      phaseList: [{ id: 'phase', name: 'Design', color_code: '#70A6F3', sort_index: 0 }],
      loading: false,
    },
    teamMembersReducer: { teamMembers: { data: [] as ITeamMemberViewModel[], total: 0 } },
  };
  return configureStore({
    reducer: (state = initialState, action: UnknownAction) => {
      if (action.type === 'roster/loaded')
        return {
          ...state,
          phaseReducer: { ...state.phaseReducer, loading: true },
          teamMembersReducer: {
            teamMembers: {
              data: [{ id: 'member', name: 'Alice', email: 'alice@example.com' }],
              total: 1,
            },
          },
        };
      return state;
    },
  });
};

beforeEach(() => vi.clearAllMocks());

describe('closed row pickers', () => {
  it('ignores roster/loading updates and reads the latest roster on the first click', async () => {
    const store = makeStore();
    const onRender = vi.fn();
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <Profiler id="pickers" onRender={onRender}>
          <AssigneeSelector
            task={{ id: 'task', assignees: [] }}
            groupId={null}
            hideInviteFooter
            triggerElement={<button>Assign</button>}
          />
          <TaskPhaseDropdown task={{ id: 'task', phase: 'phase' } as Task} projectId="project" />
        </Profiler>
      </Provider>
    );
    const initialCommits = onRender.mock.calls.length;
    act(() => store.dispatch({ type: 'roster/loaded' }));
    expect(onRender).toHaveBeenCalledTimes(initialCommits);
    await user.click(screen.getByRole('button', { name: 'Assign' }));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    await user.click(document.body);
    await user.click(screen.getByRole('button', { name: 'Design' }));
    await user.click(screen.getByRole('button', { name: /No Phase$/ }));
    expect(mocks.socket.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ task_id: 'task', phase_id: null })
    );
  });

  it('retains project-scoped member fetching for cross-project callers', async () => {
    mocks.getMembers.mockResolvedValue({
      body: { data: [{ team_member_id: 'member', name: 'Scoped member' }], total: 1 },
    });
    const user = userEvent.setup();
    render(
      <Provider store={makeStore()}>
        <AssigneeSelector
          task={{ id: 'task', assignees: [] }}
          groupId={null}
          projectIdOverride="other-project"
          hideInviteFooter
          triggerElement={<button>Assign</button>}
        />
      </Provider>
    );
    expect(mocks.getMembers).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(screen.getByText('Scoped member')).toBeInTheDocument());
    expect(mocks.getMembers).toHaveBeenCalledWith('other-project', 1, 200, null, null, null);
  });
});
