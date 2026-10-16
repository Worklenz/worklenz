import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface MockTaskDrawerState {
  lastDeletedTaskId: string | null;
  showTaskDrawer: boolean;
}

const mockState: { taskDrawerReducer: MockTaskDrawerState } = {
  taskDrawerReducer: { lastDeletedTaskId: null, showTaskDrawer: false },
};

const mockGetTasks = vi.fn();

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

vi.mock('@/api/reporting/reporting-projects.api.service', () => ({
  reportingProjectsApiService: {
    getTasks: (...args: unknown[]) => mockGetTasks(...args),
  },
}));

vi.mock('@/features/board/board-slice', () => ({
  GROUP_BY_STATUS_VALUE: 'status',
}));

vi.mock('@/utils/fetchData', () => ({ fetchData: vi.fn() }));

vi.mock('@/utils/errorLogger', () => ({ default: { error: vi.fn() } }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@components/CustomSearchbar', () => ({ default: () => null }));

vi.mock('./group-by-filter', () => ({ default: () => null }));

vi.mock('@components/task-drawer/task-drawer', () => ({ default: () => null }));

vi.mock('./ProjectReportsTaskTable', () => ({
  default: ({ title, tasksData }: { title: string; tasksData: Array<{ id: string; name: string }> }) => (
    <section data-testid={`group-${title}`}>
      <h3>{`${title} (${tasksData.length})`}</h3>
      {tasksData.map(task => (
        <div key={task.id} data-testid="task-row">
          {task.name}
        </div>
      ))}
    </section>
  ),
}));

import ProjectReportsTasksTab from './ProjectReportsTasksTab';

const PROJECT_ID = 'project-1';

const buildGroups = () => [
  {
    id: 'todo',
    name: 'To Do',
    color_code: '#cccccc',
    color_code_dark: '#cccccc',
    tasks: [
      { id: 'parent', name: 'Parent task' },
      { id: 'child-1', name: 'Child task', parent_task_id: 'parent' },
      { id: 'other', name: 'Other task' },
    ],
  },
  {
    id: 'doing',
    name: 'Doing',
    color_code: '#1890ff',
    color_code_dark: '#1890ff',
    tasks: [{ id: 'child-2', name: 'Second child', parent_task_id: 'parent' }],
  },
];

const renderTab = () => render(<ProjectReportsTasksTab projectId={PROJECT_ID} />);

const visibleTaskNames = () => screen.queryAllByTestId('task-row').map(row => row.textContent);

describe('ProjectReportsTasksTab', () => {
  beforeEach(() => {
    mockState.taskDrawerReducer = { lastDeletedTaskId: null, showTaskDrawer: false };
    mockGetTasks.mockReset();
    mockGetTasks.mockResolvedValue({ done: true, body: buildGroups() });
  });

  it('loads the grouped tasks for the project once on mount', async () => {
    renderTab();

    await waitFor(() =>
      expect(visibleTaskNames()).toEqual(['Parent task', 'Child task', 'Other task', 'Second child'])
    );
    expect(mockGetTasks).toHaveBeenCalledTimes(1);
    expect(mockGetTasks).toHaveBeenCalledWith(PROJECT_ID, 'status');
  });

  it('removes a deleted task and its subtasks from every group without refetching', async () => {
    const { rerender } = renderTab();
    await waitFor(() => expect(visibleTaskNames()).toHaveLength(4));

    mockState.taskDrawerReducer = { ...mockState.taskDrawerReducer, lastDeletedTaskId: 'parent' };
    rerender(<ProjectReportsTasksTab projectId={PROJECT_ID} />);

    expect(visibleTaskNames()).toEqual(['Other task']);
    expect(screen.getByText('To Do (1)')).toBeInTheDocument();
    expect(screen.queryByTestId('group-Doing')).not.toBeInTheDocument();
    expect(mockGetTasks).toHaveBeenCalledTimes(1);
  });

  it('refetches the task list after the task drawer closes', async () => {
    const { rerender } = renderTab();
    await waitFor(() => expect(visibleTaskNames()).toHaveLength(4));

    mockState.taskDrawerReducer = { ...mockState.taskDrawerReducer, showTaskDrawer: true };
    rerender(<ProjectReportsTasksTab projectId={PROJECT_ID} />);
    expect(mockGetTasks).toHaveBeenCalledTimes(1);

    mockGetTasks.mockResolvedValueOnce({
      done: true,
      body: [{ ...buildGroups()[0], tasks: [{ id: 'other', name: 'Other task' }] }],
    });
    mockState.taskDrawerReducer = { ...mockState.taskDrawerReducer, showTaskDrawer: false };
    rerender(<ProjectReportsTasksTab projectId={PROJECT_ID} />);

    await waitFor(() => expect(mockGetTasks).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(visibleTaskNames()).toEqual(['Other task']));
  });

  it('does not refetch when the drawer was never opened', async () => {
    const { rerender } = renderTab();
    await waitFor(() => expect(visibleTaskNames()).toHaveLength(4));

    rerender(<ProjectReportsTasksTab projectId={PROJECT_ID} />);

    expect(mockGetTasks).toHaveBeenCalledTimes(1);
  });
});
