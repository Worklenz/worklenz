import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@/types/task-management.types';

interface RowTestState {
  taskManagement: { entities: Record<string, Task> };
  taskDrawerReducer: { selectedTaskId: string | null };
  themeReducer: { mode: string };
}
const { state } = vi.hoisted(() => ({
  state: {
    taskManagement: { entities: {} },
    taskDrawerReducer: { selectedTaskId: null },
    themeReducer: { mode: 'light' },
  } as RowTestState,
}));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (value: RowTestState) => unknown) => selector(state),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/features/task-management/task-management.slice', () => ({
  selectTaskById: (value: RowTestState, id: string) => value.taskManagement.entities[id],
}));
vi.mock('@/features/task-management/selection.slice', () => ({
  selectIsTaskSelected: () => false,
}));
vi.mock('@/features/task-management/grouping.slice', () => ({
  selectCurrentGrouping: () => 'status',
}));
vi.mock('@dnd-kit/sortable', () => ({ useSortable: () => ({ attributes: {}, listeners: {} }) }));
vi.mock('./hooks/useTaskRowState', () => ({ useTaskRowState: () => ({}) }));
vi.mock('./hooks/useTaskRowActions', () => ({ useTaskRowActions: () => ({}) }));
vi.mock('./hooks/useTaskRowColumns', () => ({
  useTaskRowColumns: () => ({ renderColumn: () => <span>Task name</span> }),
}));

import TaskRow from './TaskRow';

describe('task row deletion', () => {
  it('handles removal and restoration without changing hook order', () => {
    const task: Task = {
      id: 'task',
      status: 'todo',
      priority: 'medium',
      created_at: '',
      updated_at: '',
    };
    state.taskManagement.entities = { task };
    const row = () => (
      <TaskRow
        taskId="task"
        projectId="project"
        visibleColumns={[{ id: 'title', width: '200px' }]}
      />
    );
    const { container, rerender } = render(row());
    expect(container.querySelector('[data-task-id="task"]')).not.toBeNull();
    state.taskManagement.entities = {};
    rerender(row());
    expect(container.querySelector('[data-task-id="task"]')).toBeNull();
    state.taskManagement.entities = { task };
    rerender(row());
    expect(container.querySelector('[data-task-id="task"]')).not.toBeNull();
  });
});
