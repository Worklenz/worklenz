import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskListRowItem, TaskListRowItemProps } from './TaskListRowItem';
import type { VirtuosoGroupItem } from '../hooks/useVirtuosoGroups';
import { Task } from '@/types/task-management.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue || 'Insert Task',
  }),
}));

vi.mock('@/shared/antd-imports', () => ({
  theme: {
    useToken: () => ({
      token: {
        colorBgContainer: '#fff',
        colorPrimary: '#1890ff',
        colorBorderSecondary: '#f0f0f0',
      },
    }),
  },
}));

vi.mock('../TaskRowWithSubtasks', () => ({
  default: ({ taskId }: { taskId: string }) => (
    <div data-testid="task-row-with-subtasks">Task {taskId}</div>
  ),
}));

vi.mock('./AddTaskRow', () => ({
  default: ({ rowId }: { rowId: string }) => (
    <div data-testid="add-task-row">Add Task {rowId}</div>
  ),
}));

vi.mock('./TaskListDropIndicators', () => ({
  DropSpacer: () => <div data-testid="drop-spacer" />,
  InsertTaskDivider: ({ title }: { title: string }) => (
    <div data-testid="insert-task-divider">{title}</div>
  ),
}));

describe('TaskListRowItem', () => {
  const sampleGroup: VirtuosoGroupItem = {
    id: 'group-1',
    title: 'To Do',
    color: '#ff0000',
    color_code_dark: '#ff5555',
    count: 2,
    actualCount: 2,
    startIndex: 0,
    taskIds: [],
    groupValue: 'group-1',
    tasks: [],
  };

  const sampleTask: Task & { originalIndex: number } = {
    id: 'task-1',
    name: 'Task 1',
    originalIndex: 0,
  } as Task & { originalIndex: number };

  const baseProps: TaskListRowItemProps = {
    item: sampleTask,
    index: 0,
    group: sampleGroup,
    projectId: 'p-1',
    visibleColumns: [{ id: 'title', label: 'Title', width: '300px' }],
    isDarkMode: false,
    isBacklogMode: false,
    activeSprintGroupIds: new Set(),
    activeId: null,
    overId: null,
    dropPosition: null,
    canCreateTask: true,
    isWorkReadOnly: false,
    isActiveAddRow: false,
    onActivateAddRow: vi.fn(),
    onDeactivateAddRow: vi.fn(),
    onTaskCreated: vi.fn(),
    onSetInsertAnchor: vi.fn(),
    updateTaskCustomColumnValue: vi.fn(),
  };

  it('renders standard task row with subtasks', () => {
    render(<TaskListRowItem {...baseProps} />);
    expect(screen.getByTestId('task-row-with-subtasks')).toHaveTextContent('Task task-1');
  });

  it('renders add-task row when item is AddTaskRowItem and user has permissions', () => {
    const addRowItem = {
      id: 'add-task-group-1-0',
      isAddTaskRow: true as const,
      groupId: 'group-1',
      groupType: 'status',
      groupValue: 'To Do',
      rowId: 'row-add-1',
    };

    render(<TaskListRowItem {...baseProps} item={addRowItem} />);
    expect(screen.getByTestId('add-task-row')).toBeInTheDocument();
  });

  it('hides add-task row when task creation is restricted or readonly', () => {
    const addRowItem = {
      id: 'add-task-group-1-0',
      isAddTaskRow: true as const,
      groupId: 'group-1',
      groupType: 'status',
      groupValue: 'To Do',
      rowId: 'row-add-1',
    };

    const { rerender } = render(
      <TaskListRowItem {...baseProps} item={addRowItem} canCreateTask={false} />
    );
    expect(screen.queryByTestId('add-task-row')).not.toBeInTheDocument();

    rerender(
      <TaskListRowItem {...baseProps} item={addRowItem} isWorkReadOnly={true} />
    );
    expect(screen.queryByTestId('add-task-row')).not.toBeInTheDocument();
  });

  it('shows drop spacer when dragging over this task', () => {
    render(
      <TaskListRowItem
        {...baseProps}
        activeId="dragged-task"
        overId="task-1"
        dropPosition="before"
      />
    );
    expect(screen.getByTestId('drop-spacer')).toBeInTheDocument();
  });
});
