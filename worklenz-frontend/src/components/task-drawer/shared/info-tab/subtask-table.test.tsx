import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAvatars = vi.fn();

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: any) => any) =>
    selector({
      themeReducer: { mode: 'light' },
      projectReducer: { projectId: 'project-1' },
      taskDrawerReducer: { taskFormViewModel: { task: { sub_tasks_count: 1 } }, selectedTaskId: 'task-1' },
    }),
}));

vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/hooks/useTabSearchParam', () => ({
  default: () => ({ projectView: 'list' }),
}));

vi.mock('@/utils/session-helper', () => ({
  getUserSession: () => ({ id: 'user-1', team_id: 'team-1' }),
}));

vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({ socket: null, connected: true }),
}));

vi.mock('@/components/avatars/avatars', () => ({
  default: (props: any) => {
    mockAvatars(props);
    return <div data-testid="avatars">avatars</div>;
  },
}));

vi.mock('@/features/tasks/tasks.slice', () => ({
  getCurrentGroup: () => ({ value: 'status' }),
  GROUP_BY_STATUS_VALUE: 'status',
  GROUP_BY_PRIORITY_VALUE: 'priority',
  GROUP_BY_PHASE_VALUE: 'phase',
  removeSubTask: vi.fn(),
}));

vi.mock('@/features/task-drawer/task-drawer.slice', () => ({
  setShowTaskDrawer: vi.fn(),
  setSelectedTaskId: vi.fn(),
  fetchTask: vi.fn(),
}));

vi.mock('@/features/board/board-slice', () => ({
  updateSubtask: vi.fn(),
}));

vi.mock('@/features/enhanced-kanban/enhanced-kanban.slice', () => ({
  updateEnhancedKanbanSubtask: vi.fn(),
}));

vi.mock('@/features/task-management/task-management.slice', () => ({
  deleteTask: vi.fn(),
  reorderSubtasks: vi.fn(),
}));

import SubTaskTable from './subtask-table';

describe('SubTaskTable', () => {
  beforeEach(() => {
    mockAvatars.mockClear();
  });

  it('caps multiple assignees in the subtask row to keep the action column clear', () => {
    const subTasks = [
      {
        id: 'subtask-1',
        name: 'Write release notes',
        priority_name: 'High',
        priority_color: '#ff7875',
        status_name: 'In Progress',
        status_color: '#1890ff',
        names: [
          { name: 'Alice', team_member_id: 'm1' },
          { name: 'Bob', team_member_id: 'm2' },
          { name: 'Carol', team_member_id: 'm3' },
        ],
      },
    ];

    render(
      <SubTaskTable
        subTasks={subTasks as any}
        loadingSubTasks={false}
        refreshSubTasks={vi.fn()}
        t={(key: string, opts?: any) => opts?.defaultValue ?? key}
      />
    );

    expect(screen.getByTestId('avatars')).toBeInTheDocument();
    expect(mockAvatars).toHaveBeenCalledWith(
      expect.objectContaining({
        members: expect.arrayContaining([
          expect.objectContaining({ name: 'Alice' }),
          expect.objectContaining({ name: 'Bob' }),
          expect.objectContaining({ name: 'Carol' }),
        ]),
        maxCount: 2,
      })
    );
  });
});
