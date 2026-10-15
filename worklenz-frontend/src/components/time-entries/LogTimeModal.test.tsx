import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { LogTimeModal } from './LogTimeModal';

const mocks = vi.hoisted(() => ({
  getMyProjectsToTasks: vi.fn(),
  getMyTasksInProject: vi.fn(),
  create: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> & { defaultValue?: string }) =>
      (options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(options?.[name] ?? '')
      ),
  }),
}));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      orgConfigReducer: { timelog_backdate_limit_days: 0 },
    }),
}));

vi.mock('@/api/projects/projects.api.service', () => ({
  projectsApiService: {
    getMyProjectsToTasks: (...args: unknown[]) => mocks.getMyProjectsToTasks(...args),
  },
}));

vi.mock('@/api/tasks/task-time-logs.api.service', () => ({
  taskTimeLogsApiService: {
    getMyTasksInProject: (...args: unknown[]) => mocks.getMyTasksInProject(...args),
    create: (...args: unknown[]) => mocks.create(...args),
  },
}));

describe('LogTimeModal', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays all accessible projects on open', async () => {
    mocks.getMyProjectsToTasks.mockResolvedValue({
      done: true,
      body: [
        { id: 'proj-1', name: 'Alpha Project', color_code: '#ff0000' },
        { id: 'proj-2', name: 'Beta Project', color_code: '#00ff00' },
        { id: 'proj-3', name: 'Gamma Project', color_code: '#0000ff' },
      ],
    });

    render(<LogTimeModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(mocks.getMyProjectsToTasks).toHaveBeenCalled();
    });

    fireEvent.mouseDown(screen.getByText('Select project...'));
    await waitFor(() => {
      expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      expect(screen.getByText('Beta Project')).toBeInTheDocument();
      expect(screen.getByText('Gamma Project')).toBeInTheDocument();
    });
  });

  it('fetches tasks when a project is selected', async () => {
    mocks.getMyProjectsToTasks.mockResolvedValue({
      done: true,
      body: [
        { id: 'proj-1', name: 'Alpha Project', color_code: '#ff0000' },
        { id: 'proj-2', name: 'Beta Project', color_code: '#00ff00' },
      ],
    });

    mocks.getMyTasksInProject.mockResolvedValue({
      done: true,
      body: [
        { id: 'task-1', name: 'Task One', due_date: null, task_no: 101 },
      ],
    });

    render(<LogTimeModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(mocks.getMyProjectsToTasks).toHaveBeenCalled();
    });

    // Open project dropdown and pick Alpha Project
    fireEvent.mouseDown(screen.getByText('Select project...'));
    fireEvent.click(await screen.findByText('Alpha Project'));

    await waitFor(() => {
      expect(mocks.getMyTasksInProject).toHaveBeenCalledWith('proj-1', undefined);
    });
  });

  it('automatically treats end time earlier than start time as overnight rollover (+1 day)', async () => {
    mocks.getMyProjectsToTasks.mockResolvedValue({
      done: true,
      body: [{ id: 'proj-1', name: 'Alpha Project', color_code: '#ff0000' }],
    });
    mocks.getMyTasksInProject.mockResolvedValue({
      done: true,
      body: [{ id: 'task-1', name: 'Task One' }],
    });
    mocks.create.mockResolvedValue({ done: true });

    render(<LogTimeModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await waitFor(() => expect(mocks.getMyProjectsToTasks).toHaveBeenCalled());

    // Select project
    fireEvent.mouseDown(screen.getByText('Select project...'));
    fireEvent.click(await screen.findByText('Alpha Project'));

    // Select task
    await waitFor(() => expect(mocks.getMyTasksInProject).toHaveBeenCalled());
    fireEvent.mouseDown(screen.getByText('Select task...'));
    fireEvent.click(await screen.findByText('Task One'));

    // Switch to Time Range
    fireEvent.click(screen.getByRole('radio', { name: /Time Range/i }));

    const inputs = screen.getAllByRole('textbox');
    // inputs[0] is DatePicker, inputs[1] is startTime, inputs[2] is endTime
    fireEvent.change(inputs[1], { target: { value: '22:00' } });
    fireEvent.keyDown(inputs[1], { key: 'Enter', code: 'Enter' });

    fireEvent.change(inputs[2], { target: { value: '02:00' } });
    fireEvent.keyDown(inputs[2], { key: 'Enter', code: 'Enter' });

    // Duration badge should show 4h 0m and breakdown hint should not be rendered
    expect(await screen.findByText(/4h 0m/)).toBeInTheDocument();
    expect(screen.queryByText(/2h 0m.*2h 0m/)).toBeNull();

    const submitBtn = screen.getByRole('button', { name: /Log Time/i });
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'task-1',
        project_id: 'proj-1',
        seconds_spent: 7200, // 2 hours on Day 1 (22:00 to 00:00)
      })
    );
    expect(mocks.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'task-1',
        project_id: 'proj-1',
        seconds_spent: 7200, // 2 hours on Day 2 (00:00 to 02:00)
      })
    );
  });
});
