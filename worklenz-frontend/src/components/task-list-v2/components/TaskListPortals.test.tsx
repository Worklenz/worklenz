import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskListPortals } from './TaskListPortals';

vi.mock('@/pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/CustomColumnModal', () => ({
  default: () => <div data-testid="custom-column-modal" />,
}));

vi.mock('@/components/task-list-common/convert-to-subtask-drawer/ConvertToSubtaskDrawer', () => ({
  default: () => <div data-testid="convert-to-subtask-drawer" />,
}));

vi.mock('./DuplicateTaskModal', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    open ? (
      <div data-testid="duplicate-task-modal">
        <button onClick={onClose}>Close Duplicate</button>
      </div>
    ) : null
  ),
}));

describe('TaskListPortals', () => {
  it('mounts portals and defers inactive dialogs', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <TaskListPortals
        isOpenConvertToSubtaskDrawer={false}
        isOpenDuplicateTaskModal={false}
        onCloseDuplicateTaskModal={onClose}
      />
    );

    expect(screen.getByTestId('custom-column-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('convert-to-subtask-drawer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('duplicate-task-modal')).not.toBeInTheDocument();

    rerender(
      <TaskListPortals
        isOpenConvertToSubtaskDrawer={true}
        isOpenDuplicateTaskModal={true}
        onCloseDuplicateTaskModal={onClose}
      />
    );

    expect(screen.getByTestId('convert-to-subtask-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('duplicate-task-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close Duplicate' }));
    expect(onClose).toHaveBeenCalled();
  });
});
