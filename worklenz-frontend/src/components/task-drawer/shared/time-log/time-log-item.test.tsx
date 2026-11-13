import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TimeLogItem from './time-log-item';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';

const mocks = vi.hoisted(() => ({
  deleteLog: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('react-i18next', async importOriginal => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown> & { defaultValue?: string }) =>
        (options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
          String(options?.[name] ?? '')
        ),
    }),
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    getCurrentSession: () => ({ id: 'user-1', timezone_name: 'UTC' }),
    isOwnerOrAdmin: () => false,
  }),
}));

vi.mock('@/hooks/useIsProjectManager', () => ({
  default: () => false,
}));

vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      taskDrawerReducer: {
        selectedTaskId: 'task-123',
        taskFormViewModel: { task: { id: 'task-123', project_id: 'project-1' } },
      },
    }),
}));

vi.mock('@/api/tasks/task-time-logs.api.service', () => ({
  taskTimeLogsApiService: {
    delete: (...args: unknown[]) => mocks.deleteLog(...args),
  },
}));

describe('TimeLogItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteLog.mockResolvedValue({ done: true });
  });

  it('renders a normal single-day time log with same-day timeline range', () => {
    const normalLog: ITaskLogViewModel = {
      id: 'log-1',
      user_id: 'user-1',
      user_name: 'John Doe',
      time_spent_text: '2h 0m',
      created_at: '2026-10-15T10:00:00.000Z',
      start_time: '2026-10-15T10:00:00.000Z',
      end_time: '2026-10-15T12:00:00.000Z',
      description: 'Worked on feature',
    };

    render(<TimeLogItem log={normalLog} />);

    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.getByText('2h 0m')).toBeDefined();
    expect(screen.getByText('Worked on feature')).toBeDefined();
    expect(screen.getByText(/Oct 15, 2026, 10:00 AM – 12:00 PM/)).toBeDefined();
    expect(screen.queryByText('Daily Breakdown:')).toBeNull();
  });

  it('renders an overnight split time log with combined time and cross-day timeline range without breakdown box', () => {
    const splitLog: ITaskLogViewModel = {
      id: 'log-part-1',
      part_log_ids: ['log-part-1', 'log-part-2'],
      is_overnight_split: true,
      user_id: 'user-1',
      user_name: 'John Doe',
      time_spent_text: '4h 0m',
      created_at: '2026-10-15T22:00:00.000Z',
      start_time: '2026-10-15T22:00:00.000Z',
      end_time: '2026-10-16T02:00:00.000Z',
      description: 'Overnight maintenance work',
    };

    render(<TimeLogItem log={splitLog} />);

    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.getByText('4h 0m')).toBeDefined();
    expect(screen.getByText('Overnight maintenance work')).toBeDefined();
    expect(screen.getByText(/Oct 15, 2026, 10:00 PM – Oct 16, 2026, 2:00 AM/)).toBeDefined();
    expect(screen.queryByText('Daily Breakdown:')).toBeNull();
  });

  it('deletes both underlying log IDs when deleting an overnight split entry', async () => {
    const onDelete = vi.fn();
    const splitLog: ITaskLogViewModel = {
      id: 'log-part-1',
      part_log_ids: ['log-part-1', 'log-part-2'],
      is_overnight_split: true,
      user_id: 'user-1',
      user_name: 'John Doe',
      time_spent_text: '4h 0m',
    };

    render(<TimeLogItem log={splitLog} onDelete={onDelete} />);

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);

    // Popconfirm shows 'Yes' button
    const confirmButton = screen.getByRole('button', { name: 'Yes' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mocks.deleteLog).toHaveBeenCalledTimes(2);
      expect(mocks.deleteLog).toHaveBeenCalledWith('log-part-1', 'task-123');
      expect(mocks.deleteLog).toHaveBeenCalledWith('log-part-2', 'task-123');
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });
});
