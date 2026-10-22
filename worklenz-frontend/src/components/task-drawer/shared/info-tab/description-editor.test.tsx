import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DescriptionEditor from './description-editor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      themeReducer: { mode: 'light' },
    }),
}));

vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({
    socket: null,
    connected: false,
  }),
}));

vi.mock('@/utils/errorLogger', () => ({
  default: {
    error: vi.fn(),
  },
}));

// Mock react-quill-new lazy component
vi.mock('react-quill-new', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="mock-quill-editor">
      <textarea
        data-testid="mock-quill-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  ),
}));

describe('DescriptionEditor', () => {
  it('renders heading and normal text formatting in preview mode', () => {
    const formattedHtml = '<h2>Heading 2 Title</h2><h3>Heading 3 Subtitle</h3><p>Normal text description</p>';

    const { container } = render(
      <DescriptionEditor
        description={formattedHtml}
        taskId="task-123"
        parentTaskId={null}
      />
    );

    const heading2 = container.querySelector('h2');
    const heading3 = container.querySelector('h3');
    const paragraph = container.querySelector('p');

    expect(heading2).toBeInTheDocument();
    expect(heading2?.textContent).toBe('Heading 2 Title');

    expect(heading3).toBeInTheDocument();
    expect(heading3?.textContent).toBe('Heading 3 Subtitle');

    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.textContent).toBe('Normal text description');
  });

  it('renders placeholder when description is empty or <p><br></p>', () => {
    render(
      <DescriptionEditor
        description="<p><br></p>"
        taskId="task-123"
        parentTaskId={null}
      />
    );

    expect(screen.getByText('Click to add description')).toBeInTheDocument();
  });

  it('switches to editor mode when clicked', async () => {
    render(
      <DescriptionEditor
        description="<h2>My Heading</h2>"
        taskId="task-123"
        parentTaskId={null}
      />
    );

    const preview = screen.getByText('My Heading');
    fireEvent.click(preview);

    expect(await screen.findByTestId('mock-quill-editor')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Discard')).toBeInTheDocument();
  });
});
