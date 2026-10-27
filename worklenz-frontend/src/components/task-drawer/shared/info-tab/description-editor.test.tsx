import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DescriptionEditor from './description-editor';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';

const quillMock = vi.hoisted(() => ({
  formatText: vi.fn(),
  register: vi.fn(),
}));

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

vi.mock('@/api/projects/comments/project-comments.api.service', () => ({
  projectCommentsApiService: {
    getMentionMembers: vi.fn(),
  },
}));

vi.mock('react-quill-new', async () => {
  const React = await import('react');

  interface MockEditor {
    root: HTMLDivElement;
    getText: () => string;
    getSelection: () => { index: number; length: number };
    getBounds: () => { left: number; top: number; bottom: number };
    getFormat: () => Record<string, unknown>;
    formatText: (...args: unknown[]) => void;
    deleteText: (index: number, length: number) => void;
    insertText: (index: number, text: string) => void;
    setSelection: (index: number) => void;
    focus: () => void;
  }

  interface MockProps {
    value: string;
    onChange: (value: string) => void;
    onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  }

  const MockQuill = React.forwardRef<{ getEditor: () => MockEditor }, MockProps>(
    ({ value, onChange, onKeyDown }, ref) => {
      const [editorValue, setEditorValue] = React.useState(value);
      const valueRef = React.useRef(value);
      const cursorRef = React.useRef(value.length);
      const editorRoot = React.useMemo(() => document.createElement('div'), []);
      const onChangeRef = React.useRef(onChange);
      valueRef.current = editorValue;
      editorRoot.innerHTML = editorValue;
      onChangeRef.current = onChange;

      const commit = (nextValue: string, cursor: number) => {
        valueRef.current = nextValue;
        cursorRef.current = cursor;
        editorRoot.innerHTML = nextValue;
        setEditorValue(nextValue);
        onChangeRef.current(nextValue);
      };

      const editor = React.useMemo<MockEditor>(
        () => ({
          root: editorRoot,
          getText: () => valueRef.current,
          getSelection: () => ({ index: cursorRef.current, length: 0 }),
          getBounds: () => ({ left: 0, top: 0, bottom: 20 }),
          getFormat: () => ({}),
          formatText: (...args) => quillMock.formatText(...args),
          deleteText: (index, length) =>
            commit(
              valueRef.current.slice(0, index) + valueRef.current.slice(index + length),
              index
            ),
          insertText: (index, text) =>
            commit(
              valueRef.current.slice(0, index) + text + valueRef.current.slice(index),
              index + text.length
            ),
          setSelection: index => {
            cursorRef.current = index;
          },
          focus: () => undefined,
        }),
        []
      );

      React.useImperativeHandle(ref, () => ({ getEditor: () => editor }), [editor]);

      return (
        <div data-testid="mock-quill-editor">
          <textarea
            data-testid="mock-quill-textarea"
            value={editorValue}
            onChange={event => {
              const nextValue = event.target.value;
              commit(nextValue, nextValue.length);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
      );
    }
  );
  MockQuill.displayName = 'MockQuill';

  class InlineBlot {}

  return {
    default: MockQuill,
    Quill: {
      import: () => InlineBlot,
      register: quillMock.register,
    },
  };
});

describe('DescriptionEditor', () => {
  beforeEach(() => {
    vi.mocked(projectCommentsApiService.getMentionMembers).mockReset();
    quillMock.formatText.mockClear();
    quillMock.register.mockClear();
  });

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

  it('shows project members for @ queries and inserts the selected mention', async () => {
    vi.mocked(projectCommentsApiService.getMentionMembers).mockResolvedValue({
      done: true,
      body: [{ id: 'member-1', name: 'Alice Example', role: <span /> }],
    });

    render(
      <DescriptionEditor
        description={null}
        taskId="task-123"
        parentTaskId={null}
        projectId="project-123"
      />
    );

    fireEvent.click(screen.getByText('Click to add description'));
    const textarea = await screen.findByTestId('mock-quill-textarea');
    await waitFor(() =>
      expect(projectCommentsApiService.getMentionMembers).toHaveBeenCalledWith(
        'project-123',
        1,
        200,
        null,
        null,
        ''
      )
    );
    fireEvent.change(textarea, { target: { value: '@Ali' } });

    const suggestion = await screen.findByRole('option', { name: 'Alice Example' });
    expect(screen.getByTestId('description-mention-suggestions')).toBeInTheDocument();
    fireEvent.mouseDown(suggestion);

    expect(textarea).toHaveValue('@Alice Example ');
    expect(quillMock.formatText).toHaveBeenCalledWith(0, 14, 'mention', true, 'silent');
  });

  it('highlights a matching member mention while the description is still being edited', async () => {
    vi.mocked(projectCommentsApiService.getMentionMembers).mockResolvedValue({
      done: true,
      body: [{ id: 'member-1', name: 'Alice Example', role: <span /> }],
    });

    render(
      <DescriptionEditor
        description={null}
        taskId="task-123"
        parentTaskId={null}
        projectId="project-123"
      />
    );

    fireEvent.click(screen.getByText('Click to add description'));
    const textarea = await screen.findByTestId('mock-quill-textarea');
    await waitFor(() => expect(projectCommentsApiService.getMentionMembers).toHaveBeenCalled());
    fireEvent.change(textarea, { target: { value: '@Alice Example' } });

    expect(quillMock.formatText).toHaveBeenCalledWith(0, 14, 'mention', true, 'silent');
  });
});
