import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskListGroupRow, TaskListGroupRowProps } from './TaskListGroupRow';
import type { VirtuosoGroupItem } from '../hooks/useVirtuosoGroups';

vi.mock('../TaskGroupHeader', () => ({
  default: ({
    group,
    onToggle,
  }: {
    group: { name: string; count: number };
    onToggle: () => void;
  }) => (
    <div data-testid="task-group-header">
      <span>
        {group.name} ({group.count})
      </span>
      <button onClick={onToggle}>Toggle</button>
    </div>
  ),
}));

vi.mock('./BacklogSectionColumnHeader', () => ({
  BacklogSectionColumnHeader: ({ isActiveSprint }: { isActiveSprint: boolean }) => (
    <div data-testid="backlog-header">Active Sprint: {String(isActiveSprint)}</div>
  ),
}));

vi.mock('./ExampleTaskRows', () => ({
  ExampleTaskRows: () => <div data-testid="example-task-rows" />,
}));

vi.mock('./TaskListDropIndicators', () => ({
  GroupDropZone: ({ children, isActive }: { children: React.ReactNode; isActive: boolean }) => (
    <div data-testid="group-drop-zone" data-active={isActive}>
      {children}
    </div>
  ),
}));

describe('TaskListGroupRow', () => {
  const sampleGroup: VirtuosoGroupItem = {
    id: 'group-1',
    title: 'In Progress',
    color: '#0052cc',
    color_code_dark: '#2684ff',
    count: 2,
    actualCount: 2,
    startIndex: 0,
    taskIds: [],
    groupValue: 'group-1',
    tasks: [],
  };

  const baseProps: TaskListGroupRowProps = {
    groupIndex: 0,
    group: sampleGroup,
    isCollapsed: false,
    onToggleCollapse: vi.fn(),
    isDropActive: false,
    isBacklogMode: false,
    isActiveSprint: false,
    visibleColumns: [{ id: 'title', label: 'Title', width: '300px' }],
    isDarkMode: false,
    hasNoTasks: false,
    isGuest: false,
    isWorkReadOnly: false,
    isSoftwareProject: false,
    currentGrouping: 'status',
    projectId: 'p-1',
    canCreateTask: true,
    onTaskCreated: vi.fn(),
  };

  it('renders task group header and handles collapse toggle', () => {
    const onToggle = vi.fn();
    render(<TaskListGroupRow {...baseProps} onToggleCollapse={onToggle} />);

    expect(screen.getByText('In Progress (2)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(onToggle).toHaveBeenCalledWith('group-1');
  });

  it('leaves Backlog column labels to the pinned list-level header', () => {
    render(
      <TaskListGroupRow
        {...baseProps}
        isBacklogMode={true}
        isActiveSprint={true}
        isCollapsed={false}
      />
    );

    expect(screen.queryByTestId('backlog-header')).not.toBeInTheDocument();
  });

  it('renders example task rows when empty and project has no tasks', () => {
    const emptyGroup: VirtuosoGroupItem = {
      ...sampleGroup,
      count: 0,
      actualCount: 0,
    };

    render(
      <TaskListGroupRow {...baseProps} group={emptyGroup} hasNoTasks={true} isCollapsed={false} />
    );

    expect(screen.getByTestId('example-task-rows')).toBeInTheDocument();
  });
});
