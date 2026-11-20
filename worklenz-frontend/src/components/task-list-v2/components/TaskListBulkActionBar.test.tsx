import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskListBulkActionBar } from './TaskListBulkActionBar';

vi.mock('@/components/task-management/OptimizedBulkActionBar', () => ({
  default: ({
    totalSelected,
    onClearSelection,
    onBulkArchive,
  }: {
    totalSelected: number;
    onClearSelection: () => void;
    onBulkArchive: () => void;
  }) => (
    <div data-testid="mock-bulk-action-bar">
      <span>Selected: {totalSelected}</span>
      <button onClick={onClearSelection}>Clear</button>
      <button onClick={onBulkArchive}>Archive</button>
    </div>
  ),
}));

describe('TaskListBulkActionBar', () => {
  const defaultBulkActions = {
    handleClearSelection: vi.fn(),
    handleBulkStatusChange: vi.fn(),
    handleBulkPriorityChange: vi.fn(),
    handleBulkPhaseChange: vi.fn(),
    handleBulkAssignToMe: vi.fn(),
    handleBulkAssignMembers: vi.fn(),
    handleBulkAddLabels: vi.fn(),
    handleBulkArchive: vi.fn(),
    handleBulkDelete: vi.fn(),
    handleBulkDuplicate: vi.fn(),
    handleBulkExport: vi.fn(),
    handleBulkSetDueDate: vi.fn(),
    handleBulkSetStartDate: vi.fn(),
  } as any;

  it('renders nothing when selectedTaskIds is empty', () => {
    const { container } = render(
      <TaskListBulkActionBar
        selectedTaskIds={[]}
        projectId="p-1"
        canCreateTask={true}
        bulkActions={defaultBulkActions}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when projectId is empty', () => {
    const { container } = render(
      <TaskListBulkActionBar
        selectedTaskIds={['task-1']}
        projectId=""
        canCreateTask={true}
        bulkActions={defaultBulkActions}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders bulk action bar and triggers actions', () => {
    render(
      <TaskListBulkActionBar
        selectedTaskIds={['task-1', 'task-2']}
        projectId="p-1"
        canCreateTask={true}
        bulkActions={defaultBulkActions}
      />
    );

    expect(screen.getByTestId('mock-bulk-action-bar')).toBeInTheDocument();
    expect(screen.getByText('Selected: 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(defaultBulkActions.handleClearSelection).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(defaultBulkActions.handleBulkArchive).toHaveBeenCalledWith(['task-1', 'task-2']);
  });
});
