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
});
