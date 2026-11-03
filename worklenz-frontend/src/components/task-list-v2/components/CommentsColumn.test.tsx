import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@/types/task-management.types';
import { CommentsColumn, extractFirstLinePreview } from './CommentsColumn';

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

  it('renders rich formatting tags in the comment preview', () => {
    const task = {
      id: 'task-rich',
      latest_comment_id: 'comment-rich-1',
      latest_comment: '<p><strong>Urgent:</strong> please review <code>const foo = 1</code> and <a href="https://example.com">docs</a></p>',
      latest_comment_author: 'Ada Lovelace',
      latest_comment_at: '2026-10-23T10:00:00.000Z',
    } as Task;

    const { container } = render(<CommentsColumn width="300px" task={task} onOpenComment={vi.fn()} />);

    const preview = container.querySelector('.comments-column-preview');
    expect(preview).toBeInTheDocument();
    expect(preview?.querySelector('strong')).toHaveTextContent('Urgent:');
    expect(preview?.querySelector('code')).toHaveTextContent('const foo = 1');
    expect(preview?.querySelector('a')).toHaveAttribute('href', 'https://example.com');
  });

  it('shows only the first line in preview with ellipsis when comment is multi-line', () => {
    const task = {
      id: 'task-multiline',
      latest_comment_id: 'comment-multi-1',
      latest_comment: '<p>tyyttd</p><p>vjhvjl</p><p>khvhvk</p>',
      latest_comment_author: 'Chirath',
      latest_comment_at: '2026-10-23T10:00:00.000Z',
    } as Task;

    const { container } = render(<CommentsColumn width="300px" task={task} onOpenComment={vi.fn()} />);

    const preview = container.querySelector('.comments-column-preview');
    expect(preview).toBeInTheDocument();
    // Previews first line only
    expect(preview).toHaveTextContent('tyyttd...');
    // Subsequent lines are NOT concatenated directly into the single cell preview
    expect(preview).not.toHaveTextContent('tyyttdvjhvjlkhvhvk');
  });

  describe('extractFirstLinePreview helper', () => {
    it('extracts first paragraph from multi-paragraph comments', () => {
      const html = '<p><strong>Bold title</strong></p><p>Second paragraph</p>';
      const result = extractFirstLinePreview(html);
      expect(result.previewHtml).toBe('<strong>Bold title</strong>');
      expect(result.hasMore).toBe(true);
    });

    it('extracts first line from <br> separated text', () => {
      const html = '<p>Line 1<br/>Line 2</p>';
      const result = extractFirstLinePreview(html);
      expect(result.previewHtml).toBe('Line 1');
      expect(result.hasMore).toBe(true);
    });

    it('extracts first list item from lists', () => {
      const html = '<ul><li>First item</li><li>Second item</li></ul>';
      const result = extractFirstLinePreview(html);
      expect(result.previewHtml).toBe('First item');
      expect(result.hasMore).toBe(true);
    });

    it('returns hasMore=false for single line comments', () => {
      const html = '<p>Just one line</p>';
      const result = extractFirstLinePreview(html);
      expect(result.previewHtml).toBe('Just one line');
      expect(result.hasMore).toBe(false);
    });
  });
});
