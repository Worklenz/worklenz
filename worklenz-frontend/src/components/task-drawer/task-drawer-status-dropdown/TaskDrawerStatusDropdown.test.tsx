import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ITaskStatus } from '@/types/tasks/taskStatus.types';
import type { ITaskViewModel } from '@/types/tasks/task.types';

const mocks = vi.hoisted(() => ({
  themeMode: 'light' as 'light' | 'dark',
  dispatch: vi.fn(),
}));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: { themeReducer: { mode: 'light' | 'dark' } }) => unknown) =>
    selector({ themeReducer: { mode: mocks.themeMode } }),
}));

vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('@/hooks/useTabSearchParam', () => ({
  default: () => ({ tab: 'tasks-list' }),
}));

vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({ trackMixpanelEvent: vi.fn() }),
}));

vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({ socket: null }),
}));

vi.mock('@/features/board/board-slice', () => ({
  updateBoardTaskStatus: vi.fn(),
}));

vi.mock('@/features/task-drawer/task-drawer.slice', () => ({
  setTaskStatus: vi.fn(),
}));

vi.mock('@/features/tasks/tasks.slice', () => ({
  updateTaskStatus: vi.fn(),
}));

vi.mock('@/features/enhanced-kanban/enhanced-kanban.slice', () => ({
  updateEnhancedKanbanTaskStatus: vi.fn(),
}));

vi.mock('@/features/task-management/task-management.slice', () => ({
  updateTask: vi.fn(),
}));

vi.mock('@/app/store', () => ({
  store: {
    getState: () => ({
      taskManagement: {
        entities: {},
      },
    }),
  },
}));

vi.mock('@/utils/check-task-dependency-status', () => ({
  checkTaskDependencyStatus: vi.fn(),
}));

vi.mock('@/services/alerts/alertService', () => ({
  default: {
    error: vi.fn(),
  },
}));

import TaskDrawerStatusDropdown from './task-drawer-status-dropdown';

const statuses: ITaskStatus[] = [
  {
    id: 'todo-status',
    name: 'To Do',
    color_code: '#A9A9A9',
    color_code_dark: '#989898',
  },
  {
    id: 'blocked-status',
    name: 'Blocked',
    color_code: '#154C9B',
    color_code_dark: '#B22222',
  },
  {
    id: 'translucent-status',
    name: 'Review',
    color_code: '#00000080',
  },
];

const renderDropdown = (statusId: string) => {
  const task = { id: 'task-1', status_id: statusId } as ITaskViewModel;
  return render(<TaskDrawerStatusDropdown statuses={statuses} task={task} teamId="team-1" />);
};

describe('TaskDrawerStatusDropdown', () => {
  it('uses readable text on the selected status in light and dark themes', () => {
    mocks.themeMode = 'light';
    const { container, rerender } = renderDropdown('todo-status');

    expect(container.querySelector('.task-drawer-status-select')).toHaveStyle({
      '--task-drawer-status-bg': '#A9A9A9',
      '--task-drawer-status-fg': '#000000',
    });
    expect(screen.getByText('To Do')).toHaveStyle({ color: '#000000' });

    mocks.themeMode = 'dark';
    rerender(
      <TaskDrawerStatusDropdown
        statuses={statuses}
        task={{ id: 'task-1', status_id: 'todo-status' } as ITaskViewModel}
        teamId="team-1"
      />
    );

    expect(container.querySelector('.task-drawer-status-select')).toHaveStyle({
      '--task-drawer-status-bg': '#989898',
      '--task-drawer-status-fg': '#000000',
    });
    expect(screen.getByText('To Do')).toHaveStyle({ color: '#000000' });
  });

  it('uses white text for a dark selected status background', () => {
    mocks.themeMode = 'dark';
    const { container } = renderDropdown('blocked-status');

    expect(container.querySelector('.task-drawer-status-select')).toHaveStyle({
      '--task-drawer-status-bg': '#B22222',
      '--task-drawer-status-fg': '#FFFFFF',
    });
    expect(screen.getByText('Blocked')).toHaveStyle({ color: '#FFFFFF' });
  });

  it('composites translucent status colors over the drawer surface', () => {
    mocks.themeMode = 'light';
    const { container, rerender } = renderDropdown('translucent-status');

    expect(container.querySelector('.task-drawer-status-select')).toHaveStyle({
      '--task-drawer-status-bg': '#00000080',
      '--task-drawer-status-fg': '#000000',
    });

    mocks.themeMode = 'dark';
    rerender(
      <TaskDrawerStatusDropdown
        statuses={statuses}
        task={{ id: 'task-1', status_id: 'translucent-status' } as ITaskViewModel}
        teamId="team-1"
      />
    );

    expect(container.querySelector('.task-drawer-status-select')).toHaveStyle({
      '--task-drawer-status-bg': '#00000080',
      '--task-drawer-status-fg': '#FFFFFF',
    });
  });
});
