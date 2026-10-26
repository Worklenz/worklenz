import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@/types/task-management.types';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  state: {
    taskStatusReducer: {
      status: [
        {
          id: 'todo-status',
          name: 'To Do',
          color_code: '#A9A9A9',
          color_code_dark: '#989898',
        },
        {
          id: 'blocked-status',
          name: 'Blocked',
          color_code: '#8B1A1A',
          color_code_dark: '#B22222',
        },
      ],
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));

vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({ socket: null, connected: false }),
}));

vi.mock('@/features/task-management/task-management.slice', () => ({
  updateTask: vi.fn(),
  selectCurrentGroupingV3: vi.fn(),
  selectGroups: vi.fn(),
  moveTaskBetweenGroups: vi.fn(),
}));

vi.mock('@/utils/check-task-dependency-status', () => ({
  checkTaskDependencyStatus: vi.fn(),
}));

vi.mock('@/services/alerts/alertService', () => ({
  default: {
    error: vi.fn(),
  },
}));

import TaskStatusDropdown from './task-status-dropdown';

describe('TaskStatusDropdown', () => {
  it('uses a readable label color on light status backgrounds in both themes', () => {
    const task = { id: 'task-1', status: 'todo-status' } as Task;
    const { rerender } = render(
      <TaskStatusDropdown task={task} projectId="project-1" isDarkMode={false} />
    );

    expect(screen.getByRole('button', { name: 'To Do' })).toHaveStyle({
      backgroundColor: '#A9A9A9',
      color: '#000000',
    });

    rerender(<TaskStatusDropdown task={task} projectId="project-1" isDarkMode />);

    expect(screen.getByRole('button', { name: 'To Do' })).toHaveStyle({
      backgroundColor: '#989898',
      color: '#000000',
    });
  });

  it('uses white text on a dark status background', () => {
    const task = { id: 'task-2', status: 'blocked-status' } as Task;
    render(<TaskStatusDropdown task={task} projectId="project-1" isDarkMode />);

    expect(screen.getByRole('button', { name: 'Blocked' })).toHaveStyle({
      backgroundColor: '#B22222',
      color: '#FFFFFF',
    });
  });

  it('keeps the inline status variant theme-driven instead of overriding its text color', () => {
    const task = { id: 'task-3', status: 'todo-status' } as Task;
    render(<TaskStatusDropdown task={task} projectId="project-1" isDarkMode variant="inline" />);

    expect(screen.getByRole('button', { name: 'To Do' }).style.color).toBe('');
  });
});
