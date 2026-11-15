import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskListDragOverlay } from './TaskListDragOverlay';
import { Task } from '@/types/task-management.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue || 'Dragging Task',
  }),
}));

vi.mock('@dnd-kit/core', () => ({
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dnd-drag-overlay">{children}</div>
  ),
}));

describe('TaskListDragOverlay', () => {
  const visibleColumns = [
    { id: 'dragHandle', label: '', width: '20px' },
    { id: 'title', label: 'Title', width: '350px' },
  ];

  const tasks: Task[] = [
    { id: 'task-1', name: 'Develop Feature A' } as Task,
    { id: 'task-2', title: 'Fix Bug B' } as Task,
    { id: 'task-3' } as Task,
  ];

  it('renders nothing inside overlay when activeId is null', () => {
    render(
      <TaskListDragOverlay
        activeId={null}
        allTasks={tasks}
        visibleColumns={visibleColumns}
      />
    );

    expect(screen.queryByText('Develop Feature A')).not.toBeInTheDocument();
  });

  it('renders task name with title column width when activeId is present', () => {
    const { container } = render(
      <TaskListDragOverlay
        activeId="task-1"
        allTasks={tasks}
        visibleColumns={visibleColumns}
      />
    );

    expect(screen.getByText('Develop Feature A')).toBeInTheDocument();
    const overlayCard = container.querySelector('[style*="width: 350px"]');
    expect(overlayCard).toBeInTheDocument();
  });

  it('renders fallback title when task has no name or title', () => {
    render(
      <TaskListDragOverlay
        activeId="task-3"
        allTasks={tasks}
        visibleColumns={visibleColumns}
      />
    );

    expect(screen.getByText('Dragging Task')).toBeInTheDocument();
  });
});
