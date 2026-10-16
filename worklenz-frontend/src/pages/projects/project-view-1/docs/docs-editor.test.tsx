import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConfigProvider, theme } from 'antd';
import { Editor as TiptapEditor } from '@tiptap/core';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { loadMentionItems } from './docs-inline-editor';
import { mentionStore } from './mention-store';
import { EMPTY_MENTIONS } from '@/types/project/project-documents.types';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ISectionDocument } from '@/types/project/project-documents.types';
import DocsEditor from './docs-editor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }),
}));
vi.mock('@/api/projects/comments/project-comments.api.service', () => ({ projectCommentsApiService: { getMentionMembers: vi.fn() } }));
vi.mock('@/api/tasks/tasks.api.service', () => ({ tasksApiService: { searchTask: vi.fn() } }));
// The v3 BubbleMenu runs a floating-ui positioning loop that never settles in jsdom; render its toolbar inline.
vi.mock('@tiptap/react/menus', () => ({ BubbleMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('./extensions/member-mention', async () => {
  const { Node } = await import('@tiptap/core');
  return { MemberMention: Node.create({ name: 'memberMention', group: 'inline', inline: true, atom: true, addAttributes: () => ({ id: { default: null } }), renderHTML: ({ HTMLAttributes }) => ['span', HTMLAttributes, '@member'] }) };
});
vi.mock('./extensions/task-mention', async () => {
  const { Node } = await import('@tiptap/core');
  return { TaskMention: Node.create({ name: 'taskMention', group: 'inline', inline: true, atom: true, addAttributes: () => ({ id: { default: null } }), renderHTML: ({ HTMLAttributes }) => ['span', HTMLAttributes, '#task'] }) };
});

const onContentChange = vi.fn();
const ExampleDocument = ({ dark }: { dark: boolean }) => {
  const [content, setContent] = useState<ISectionDocument>({
    version: 1,
    sections: [{ id: 'paragraph-1', type: 'paragraph', content: [{ type: 'text', text: 'Project goals' }] }],
  });
  return (
    <ConfigProvider theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <DocsEditor
        documentId="document-1"
        projectId="project-1"
        title="Project brief"
        content={content}
        saveState="saved"
        updatedByName={null}
        conflictByName={null}
        onTitleChange={vi.fn()}
        onContentChange={next => { onContentChange(next); setContent(next); }}
        onReload={vi.fn()}
        onRetry={vi.fn()}
      />
    </ConfigProvider>
  );
};

beforeEach(() => {
  onContentChange.mockReset();
  mentionStore.set(EMPTY_MENTIONS);
  vi.mocked(projectCommentsApiService.getMentionMembers).mockReset();
  vi.mocked(projectCommentsApiService.getMentionMembers).mockResolvedValue({ done: true, body: [{ id: 'member-1', name: 'Alice', role: <span /> }] });
  vi.mocked(tasksApiService.searchTask).mockReset();
  vi.mocked(tasksApiService.searchTask).mockResolvedValue({ done: true, body: [{ value: 'task-1', label: 'Fix login', task_key: 'PROJ-123' }] });
  vi.spyOn(window, 'getSelection').mockImplementation(() => document.getSelection());
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe.each([false, true])('docs formatting with dark theme = %s', dark => {
  it('formats text and converts between bullet lists, numbered lists, and paragraphs', async () => {
    render(<ExampleDocument dark={dark} />);
    const toolbar = within(screen.getAllByRole('toolbar', { name: 'Formatting' })[0]);
    expect(toolbar.getByRole('button', { name: 'Bold' })).toBeDisabled();

    const body = screen.getByLabelText('Page content');
    act(() => { body.focus(); });
    await waitFor(() => expect(toolbar.getByRole('button', { name: 'Bold' })).toBeEnabled());

    // Select the text using the browser selection, then apply inline formatting through the toolbar.
    act(() => {
      const range = document.createRange();
      range.selectNodeContents(body.querySelector('p')!);
      const selection = document.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await waitFor(() => expect(screen.getAllByRole('toolbar', { name: 'Formatting' }).length).toBeGreaterThan(1));
    fireEvent.mouseDown(toolbar.getByRole('button', { name: 'Bold' }));
    fireEvent.click(toolbar.getByRole('button', { name: 'Bold' }));
    await waitFor(() => expect(body.querySelector('strong')).toHaveTextContent('Project goals'));
    const floatingToolbar = within(screen.getAllByRole('toolbar', { name: 'Formatting' })[1]);
    fireEvent.mouseDown(floatingToolbar.getByRole('button', { name: 'Italic' }));
    fireEvent.click(floatingToolbar.getByRole('button', { name: 'Italic' }));
    await waitFor(() => expect(body.querySelector('em')).toHaveTextContent('Project goals'));

    expect(floatingToolbar.getByRole('button', { name: 'Numbered list' })).toBeEnabled();
    fireEvent.click(floatingToolbar.getByRole('button', { name: 'Bullet list' }));
    await waitFor(() => expect(screen.getByRole('listitem')).toHaveTextContent('Project goals'));
    await waitFor(() => expect(screen.getByLabelText('List item')).toHaveFocus());
    expect(toolbar.getByRole('button', { name: 'Bullet list' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('List item').querySelector('strong')).toHaveTextContent('Project goals');

    act(() => {
      const range = document.createRange();
      range.selectNodeContents(screen.getByLabelText('List item').querySelector('p')!);
      const selection = document.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await waitFor(() => expect(screen.getAllByRole('toolbar', { name: 'Formatting' }).length).toBeGreaterThan(1));
    const listToolbar = within(screen.getAllByRole('toolbar', { name: 'Formatting' })[1]);
    expect(listToolbar.getByRole('button', { name: 'Bullet list' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(listToolbar.getByRole('button', { name: 'Numbered list' }));
    await waitFor(() => expect(toolbar.getByRole('button', { name: 'Numbered list' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('listitem')).toHaveTextContent('1.');

    fireEvent.click(toolbar.getByRole('button', { name: 'Numbered list' }));
    await waitFor(() => expect(screen.queryByRole('listitem')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText('Page content')).toHaveFocus());
    expect(screen.getByLabelText('Page content').querySelector('strong')).toHaveTextContent('Project goals');
    expect(screen.getByLabelText('Page content').querySelector('em')).toHaveTextContent('Project goals');
  });
});


describe('member and task suggestions', () => {
  it('shows only members for @ and only matching tasks for #, and inserts the selected task', async () => {
    render(<ExampleDocument dark={false} />);
    const body = screen.getByLabelText('Page content');
    const editor = (body as HTMLElement & { editor: TiptapEditor }).editor;
    act(() => {
      body.focus();
      editor.commands.setContent('<p>@Ali</p>');
      editor.commands.focus('end');
    });
    await screen.findByRole('option', { name: 'Alice' });
    expect(tasksApiService.searchTask).not.toHaveBeenCalled();
    onContentChange.mockImplementation(() => {
      expect(mentionStore.get().members['member-1']).toMatchObject({ name: 'Alice', unavailable: false });
    });
    fireEvent.keyDown(body, { key: 'Enter' });
    await waitFor(() => expect(onContentChange).toHaveBeenLastCalledWith({
      version: 1,
      sections: [{ id: 'paragraph-1', type: 'paragraph', content: [
        { type: 'memberMention', attrs: { id: 'member-1' } },
        { type: 'text', text: ' ' },
      ] }],
    }));

    act(() => {
      editor.commands.setContent('<p>#PROJ-123</p>');
      editor.commands.focus('end');
    });
    const task = await screen.findByRole('option', { name: 'Fix login PROJ-123' });
    expect(screen.queryByRole('option', { name: 'Alice' })).not.toBeInTheDocument();
    expect(tasksApiService.searchTask).toHaveBeenLastCalledWith(expect.any(String), 'project-1', 'PROJ-123');
    onContentChange.mockImplementation(() => {
      expect(mentionStore.get().tasks['task-1']).toMatchObject({ name: 'Fix login', task_key: 'PROJ-123', unavailable: false });
    });
    fireEvent.mouseDown(task);
    await waitFor(() => expect(onContentChange).toHaveBeenLastCalledWith({
      version: 1,
      sections: [{ id: 'paragraph-1', type: 'paragraph', content: [
        { type: 'taskMention', attrs: { id: 'task-1' } },
        { type: 'text', text: ' ' },
      ] }],
    }));
  });

  it.each(['PROJ-123', '123', 'Fix login'])('searches tasks by %s without loading members', async query => {
    const members = { current: [] };
    const items = await loadMentionItems('project-1', query, members, 'Members', 'Tasks', 'task');
    expect(projectCommentsApiService.getMentionMembers).not.toHaveBeenCalled();
    expect(tasksApiService.searchTask).toHaveBeenCalledWith(expect.any(String), 'project-1', query);
    expect(items).toEqual([{ id: 'task:task-1', entityId: 'task-1', kind: 'task', label: 'Fix login', detail: 'PROJ-123', group: 'Tasks' }]);
  });

  it('handles failed member and task searches without an unhandled rejection', async () => {
    vi.mocked(projectCommentsApiService.getMentionMembers).mockRejectedValue(new Error('offline'));
    vi.mocked(tasksApiService.searchTask).mockRejectedValue(new Error('offline'));
    await expect(loadMentionItems('project-1', '', { current: [] }, 'Members', 'Tasks', 'member')).resolves.toEqual([]);
    await expect(loadMentionItems('project-1', '', { current: [] }, 'Members', 'Tasks', 'task')).resolves.toEqual([]);
  });
});
