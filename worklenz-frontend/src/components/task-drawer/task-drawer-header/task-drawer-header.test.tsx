import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  deleteTask: vi.fn(),
  clearTaskFromUrl: vi.fn(),
  loggerError: vi.fn(),
  socketEmit: vi.fn(),
}));

const { action } = vi.hoisted(() => ({
  action: (type: string) => (payload?: unknown) => ({ type, payload }),
}));

vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      taskDrawerReducer: {
        selectedTaskId: 'task-1',
        navigationContext: null,
        taskFormViewModel: {
          task: { id: 'task-1', name: 'Report task', project_id: 'project-1', is_sub_task: false },
          statuses: [],
        },
      },
      taskStatusReducer: { status: [] },
    }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({ getCurrentSession: () => ({ team_id: 'team-1' }) }),
}));

vi.mock('@/api/tasks/tasks.api.service', () => ({
  tasksApiService: { deleteTask: (...args: unknown[]) => mocks.deleteTask(...args) },
}));

vi.mock('@/hooks/useTaskDrawerUrlSync', () => ({
  default: () => ({ clearTaskFromUrl: mocks.clearTaskFromUrl }),
}));

vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({ socket: { emit: mocks.socketEmit } }),
}));

vi.mock('@/utils/errorLogger', () => ({ default: { error: mocks.loggerError } }));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

vi.mock('../task-drawer-status-dropdown/task-drawer-status-dropdown', () => ({ default: () => null }));
vi.mock('../task-drawer-navigation/task-drawer-navigation', () => ({ default: () => null }));
vi.mock('@/components/task-list-v2/components/CopyTaskToProjectModal', () => ({ default: () => null }));
vi.mock('@/api/tasks/task-duplicate.api.service', () => ({ default: { compare: vi.fn() } }));

vi.mock('@/api/home-page/home-page.api.service', () => ({
  default: { util: { invalidateTags: action('homePageApi/invalidateTags') } },
}));

vi.mock('@/features/task-drawer/task-drawer.slice', () => ({
  setSelectedTaskId: action('taskDrawer/setSelectedTaskId'),
  setShowTaskDrawer: action('taskDrawer/setShowTaskDrawer'),
  setLastDeletedTaskId: action('taskDrawer/setLastDeletedTaskId'),
  navigateToNextTask: action('taskDrawer/navigateToNextTask'),
  navigateToPreviousTask: action('taskDrawer/navigateToPreviousTask'),
  fetchTask: action('tasks/fetchTask'),
  syncNavigationIndex: action('taskDrawer/syncNavigationIndex'),
}));

vi.mock('@/features/tasks/tasks.slice', () => ({ deleteTask: action('tasks/deleteTask') }));

vi.mock('@/features/task-management/task-management.slice', () => ({
  deleteTask: action('taskManagement/deleteTask'),
  fetchTasksV3: action('taskManagement/fetchTasksV3'),
  duplicateTask: action('taskManagement/duplicateTask'),
}));

vi.mock('@/features/task-management/selection.slice', () => ({
  deselectTask: action('selection/deselectTask'),
}));

vi.mock('@/features/board/board-slice', () => ({ deleteBoardTask: action('board/deleteBoardTask') }));

vi.mock('@/features/enhanced-kanban/enhanced-kanban.slice', () => ({
  deleteTask: action('enhancedKanban/deleteTask'),
  updateEnhancedKanbanSubtask: action('enhancedKanban/updateEnhancedKanbanSubtask'),
}));

import TaskDrawerHeader from './task-drawer-header';

const t = ((key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key) as never;

const renderHeader = () => render(<TaskDrawerHeader t={t} canCreateTask />);

const confirmDelete = async () => {
  fireEvent.click(screen.getByRole('button', { name: /ellipsis/i }));
  fireEvent.click(await screen.findByText('taskHeader.deleteTask'));
  fireEvent.click(await screen.findByRole('button', { name: 'Yes' }));
};

const dispatchedTypes = () => mocks.dispatch.mock.calls.map(([dispatched]) => dispatched?.type);

describe('TaskDrawerHeader task deletion', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(fn => fn.mockReset());
  });

  it('logs the error, keeps the drawer open and allows retrying after a network failure', async () => {
    mocks.deleteTask.mockRejectedValueOnce(new Error('Network Error'));
    renderHeader();

    await confirmDelete();

    await waitFor(() => expect(mocks.loggerError).toHaveBeenCalledWith('Error deleting task:', expect.any(Error)));
    expect(mocks.dispatch).not.toHaveBeenCalledWith({ type: 'taskDrawer/setShowTaskDrawer', payload: false });
    expect(dispatchedTypes()).not.toContain('taskDrawer/setLastDeletedTaskId');

    mocks.deleteTask.mockResolvedValueOnce({ done: true });
    await confirmDelete();

    await waitFor(() => expect(mocks.deleteTask).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'taskDrawer/setLastDeletedTaskId', payload: 'task-1' })
    );
  });

  it('keeps the drawer open and allows retrying when the server rejects the deletion', async () => {
    mocks.deleteTask.mockResolvedValueOnce({ done: false, message: 'Not allowed' });
    renderHeader();

    await confirmDelete();
    await waitFor(() => expect(mocks.deleteTask).toHaveBeenCalledTimes(1));

    expect(dispatchedTypes()).not.toContain('taskDrawer/setShowTaskDrawer');
    expect(dispatchedTypes()).not.toContain('taskDrawer/setLastDeletedTaskId');

    mocks.deleteTask.mockResolvedValueOnce({ done: false, message: 'Not allowed' });
    await confirmDelete();

    await waitFor(() => expect(mocks.deleteTask).toHaveBeenCalledTimes(2));
  });

  it('ignores a second confirmation while a deletion is still in flight', async () => {
    let resolveDelete: (value: { done: boolean }) => void = () => undefined;
    mocks.deleteTask.mockReturnValueOnce(
      new Promise(resolve => {
        resolveDelete = resolve;
      })
    );
    renderHeader();

    await confirmDelete();
    await confirmDelete();

    expect(mocks.deleteTask).toHaveBeenCalledTimes(1);

    resolveDelete({ done: false });
    await waitFor(() => expect(mocks.deleteTask).toHaveBeenCalledTimes(1));
  });

  it('broadcasts the deleted task id, closes the drawer and clears the URL on success', async () => {
    mocks.deleteTask.mockResolvedValueOnce({ done: true });
    renderHeader();

    await confirmDelete();

    await waitFor(() =>
      expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'taskDrawer/setShowTaskDrawer', payload: false })
    );
    expect(mocks.deleteTask).toHaveBeenCalledWith('task-1');

    const types = dispatchedTypes();
    expect(types.indexOf('taskDrawer/setLastDeletedTaskId')).toBeLessThan(types.indexOf('tasks/deleteTask'));
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'taskDrawer/setLastDeletedTaskId', payload: 'task-1' });
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'taskDrawer/setSelectedTaskId', payload: null });

    await waitFor(() => expect(mocks.clearTaskFromUrl).toHaveBeenCalledTimes(1));
  });
});
