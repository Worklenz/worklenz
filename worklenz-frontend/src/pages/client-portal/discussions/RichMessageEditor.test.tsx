import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? ''),
    i18n: { language: 'en' },
  }),
}));

import { RichMessageEditor } from './RichMessageEditor';

// jsdom has no layout; ProseMirror asks ranges for their rectangles when it scrolls the caret into view.
const emptyRects = Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getClientRects = () => emptyRects;
Range.prototype.getBoundingClientRect = () => new DOMRect();

const mentionOptions = [{ id: 'u-1', name: 'Alex Rivera' }];

describe('RichMessageEditor', () => {
  it('offers the formatting controls and an accessible text box', async () => {
    render(
      <RichMessageEditor
        value=""
        onChange={vi.fn()}
        mentionOptions={mentionOptions}
        placeholder="Write a reply"
        ariaLabel="Reply"
      />
    );

    expect(await screen.findByRole('textbox', { name: 'Reply' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
    for (const name of ['Heading 1', 'Heading 2', 'Bold', 'Italic', 'Underline', 'Bulleted list', 'Numbered list', 'Link']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('formats existing text and reports its HTML, plain text and mentions', async () => {
    const onChange = vi.fn();
    render(
      <RichMessageEditor
        value="<p>first item</p>"
        onChange={onChange}
        mentionOptions={mentionOptions}
        placeholder="Write a reply"
        ariaLabel="Reply"
      />
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Bulleted list' }));

    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0];
      expect(last?.html).toContain('<ul>');
      expect(last?.html).toContain('first item');
      expect(last?.text).toBe('first item');
      expect(last?.mentionIds).toEqual([]);
    });
  });

  it('reports the people whose @mention chip is in the message', async () => {
    const onChange = vi.fn();
    render(
      <RichMessageEditor
        value={'<p><span data-type="mention" data-id="u-1" data-label="Alex Rivera">@Alex Rivera</span> hi</p>'}
        onChange={onChange}
        mentionOptions={mentionOptions}
        placeholder="Write a reply"
        ariaLabel="Reply"
      />
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Bold' }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0].mentionIds).toEqual(['u-1']);
  });
});
