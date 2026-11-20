import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskListEmptyState, TaskListEmptyStateProps } from './TaskListEmptyState';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      if (key === 'emptyStates.noTaskGroups') return 'No task groups found';
      return options?.defaultValue || key;
    },
  }),
}));

vi.mock('./TaskListColumnHeaders', () => ({
  TaskListColumnHeaders: () => <div data-testid="column-headers" />,
}));

vi.mock('../TaskGroupHeader', () => ({
  default: ({ group }: { group: { name: string } }) => (
    <div data-testid="group-header">{group.name}</div>
  ),
}));

vi.mock('./ExampleTaskRows', () => ({
  ExampleTaskRows: () => <div data-testid="example-task-rows" />,
}));

vi.mock('./AddTaskRow', () => ({
  default: () => <div data-testid="add-task-row" />,
}));

describe('TaskListEmptyState', () => {
  const baseProps: TaskListEmptyStateProps = {
    currentGrouping: 'status',
    sensors: [],
    onDragStart: vi.fn(),
    onDragOver: vi.fn(),
    onDragEnd: vi.fn(),
    attachScrollContainer: vi.fn(),
    outerScrollRef: { current: null },
    contentScrollRef: { current: null },
    visibleColumns: [{ id: 'title', label: 'Title', width: '300px' }],
    overColumnId: null,
    activeColumnId: null,
    columnSensors: [],
    handleColumnDragStart: vi.fn(),
    handleColumnDragOver: vi.fn(),
    handleColumnDragEnd: vi.fn(),
    handleCustomColumnSettings: vi.fn(),
    columnWidths: {},
    setColumnWidths: vi.fn(),
    isBacklogMode: false,
    isGuest: false,
    isDarkMode: false,
    projectId: 'p-1',
    hasNoTasks: true,
    canCreateTask: true,
    isWorkReadOnly: false,
    onTaskCreated: vi.fn(),
  };

  it('renders no task groups message when grouping is not phase', () => {
    render(<TaskListEmptyState {...baseProps} currentGrouping="status" />);
    expect(screen.getByText('No task groups found')).toBeInTheDocument();
  });

  it('renders unmapped phase view when grouping is phase', () => {
    render(<TaskListEmptyState {...baseProps} currentGrouping="phase" />);
    expect(screen.getByTestId('column-headers')).toBeInTheDocument();
    expect(screen.getByTestId('group-header')).toHaveTextContent('Unmapped');
    expect(screen.getByTestId('example-task-rows')).toBeInTheDocument();
    expect(screen.getByTestId('add-task-row')).toBeInTheDocument();
  });
});
