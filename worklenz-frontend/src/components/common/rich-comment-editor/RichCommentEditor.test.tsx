import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? _key),
    i18n: { language: 'en' },
  }),
}));

import { RichCommentEditor } from './RichCommentEditor';

const emptyRects = Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getClientRects = () => emptyRects;
Range.prototype.getBoundingClientRect = () => new DOMRect();

const sampleMembers = [
  { id: 'u-1', name: 'Alice Smith' },
  { id: 'u-2', name: 'Bob Jones' },
];

describe('RichCommentEditor', () => {
  it('renders all 10 requested formatting buttons and an accessible textbox', async () => {
    render(
      <RichCommentEditor
        value=""
        onChange={vi.fn()}
        mentionOptions={sampleMembers}
        placeholder="Add a comment..."
        ariaLabel="Task comment"
      />
    );

    expect(await screen.findByRole('textbox', { name: 'Task comment' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();

    const expectedButtons = [
      'Bold',
      'Italic',
      'Strikethrough',
      'Code block',
      'Quote block',
      'Link',
      'Text color',
      'Checklist',
      'Numbered list',
      'Bullet list',
    ];

    for (const name of expectedButtons) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('updates HTML when formatting buttons are clicked', async () => {
    const onChange = vi.fn();
    render(
      <RichCommentEditor
        value="<p>Test item</p>"
        onChange={onChange}
        mentionOptions={sampleMembers}
        placeholder="Add a comment..."
        ariaLabel="Task comment"
      />
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Bullet list' }));

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0];
      expect(lastCall?.html).toContain('<ul>');
      expect(lastCall?.html).toContain('Test item');
    });
  });

  it('formats checklists with taskList node', async () => {
    const onChange = vi.fn();
    render(
      <RichCommentEditor
        value="<p>My task</p>"
        onChange={onChange}
        mentionOptions={sampleMembers}
        placeholder="Add a comment..."
        ariaLabel="Task comment"
      />
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Checklist' }));

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0];
      expect(lastCall?.html).toContain('data-type="taskList"');
    });
  });

  it('fires onSubmit when Ctrl+Enter is pressed', async () => {
    const onSubmit = vi.fn();
    render(
      <RichCommentEditor
        value="<p>Hello world</p>"
        onChange={vi.fn()}
        onSubmit={onSubmit}
        ariaLabel="Task comment"
      />
    );

    const textbox = await screen.findByRole('textbox', { name: 'Task comment' });
    fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true });

    expect(onSubmit).toHaveBeenCalled();
  });
});
