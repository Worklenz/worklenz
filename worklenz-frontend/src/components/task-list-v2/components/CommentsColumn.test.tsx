import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@/types/task-management.types';
import { CommentsColumn } from './CommentsColumn';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

describe('CommentsColumn', () => {
  it('opens the targeted comment with an accessible action without activating the task row', async () => {
    const user = userEvent.setup();
    const onOpenComment = vi.fn();
    const onRowClick = vi.fn();
    const task = {
      id: 'task-1',
      latest_comment_id: 'comment-1',
      latest_comment: '<p>Latest update</p>',
    } as Task;
    render(
      <div onClick={onRowClick}>
        <CommentsColumn width="240px" task={task} onOpenComment={onOpenComment} />
      </div>
    );

    const button = screen.getByRole('button', { name: 'Open latest comment' });
    await user.click(button);
    expect(onOpenComment).toHaveBeenCalledWith('comment-1');
    expect(onRowClick).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onOpenComment).toHaveBeenCalledTimes(2);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('does not make a synthetic archived parent comment navigable', () => {
    const onOpenComment = vi.fn();
    const task = {
      id: 'archived-parent-container-parent-1',
      is_parent_container: true,
      latest_comment_id: 'comment-from-archived-child',
      latest_comment: '<p>Copied child comment</p>',
    } as Task;
    render(<CommentsColumn width="240px" task={task} onOpenComment={onOpenComment} />);

    expect(screen.getByText('Copied child comment')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open latest comment' })).not.toBeInTheDocument();
    expect(onOpenComment).not.toHaveBeenCalled();
  });
});