import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConfigProvider, theme } from 'antd';
import { Editor as TiptapEditor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { loadMentionItems } from './docs-mentions';
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
vi.mock('./extensions/member-mention', async () => {
  const { Node } = await import('@tiptap/core');
  return { MemberMention: Node.create({ name: 'memberMention', group: 'inline', inline: true, atom: true, addAttributes: () => ({ id: { default: null } }), renderHTML: ({ HTMLAttributes }) => ['span', HTMLAttributes, '@member'] }) };
});
vi.mock('./extensions/task-mention', async () => {
  const { Node } = await import('@tiptap/core');
  return { TaskMention: Node.create({ name: 'taskMention', group: 'inline', inline: true, atom: true, addAttributes: () => ({ id: { default: null } }), renderHTML: ({ HTMLAttributes }) => ['span', HTMLAttributes, '#task'] }) };
});

const onContentChange = vi.fn();
const ExampleDocument = ({ dark, initialContent }: { dark: boolean; initialContent?: ISectionDocument }) => {
  const [content, setContent] = useState<ISectionDocument>(initialContent || {
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

it('retains all existing block content, IDs, formatting, and mentions when editing a loaded page', () => {
  const initialContent: ISectionDocument = { version: 1, sections: [
    { id: crypto.randomUUID(), type: 'paragraph', content: [{ type: 'text', text: 'Original' }] },
    { id: crypto.randomUUID(), type: 'heading', level: 2, content: [{ type: 'text', text: 'Heading' }] },
    { id: crypto.randomUUID(), type: 'quote', content: [{ type: 'text', text: 'Quoted', marks: [{ type: 'italic' }] }] },
    { id: crypto.randomUUID(), type: 'bulletList', items: [{ id: crypto.randomUUID(), content: [{ type: 'memberMention', attrs: { id: crypto.randomUUID() } }] }] },
    { id: crypto.randomUUID(), type: 'numberedList', items: [{ id: crypto.randomUUID(), content: [{ type: 'taskMention', attrs: { id: crypto.randomUUID() } }] }] },
    { id: crypto.randomUUID(), type: 'checklist', items: [{ id: crypto.randomUUID(), checked: true, content: [{ type: 'text', text: 'Done', marks: [{ type: 'bold' }] }] }] },
    { id: crypto.randomUUID(), type: 'code', text: 'const a = 1;\n\nconst b = 2;' },
    { id: crypto.randomUUID(), type: 'divider' },
  ] };
  render(<ExampleDocument dark={false} initialContent={initialContent} />);
  const body = screen.getByLabelText('Page content');
  const editor = (body as HTMLElement & { editor: TiptapEditor }).editor;
  act(() => { editor.commands.insertContentAt(1, 'Updated '); });
  expect(onContentChange).toHaveBeenLastCalledWith({ ...initialContent, sections: [
    { ...initialContent.sections[0], content: [{ type: 'text', text: 'Updated Original' }] },
    ...initialContent.sections.slice(1),
  ] });
});

describe.each([false, true])('docs formatting with dark theme = %s', dark => {
  it('splits paragraphs, merges empty paragraphs, and undoes across blocks in one editor', () => {
    render(<ExampleDocument dark={dark} />);
    const body = screen.getByLabelText('Page content');
    const editor = (body as HTMLElement & { editor: TiptapEditor }).editor;
    act(() => { editor.commands.focus('end'); });
    fireEvent.keyDown(body, { key: 'Enter' });
    expect(body.querySelectorAll('p')).toHaveLength(2);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
    act(() => { editor.view.dispatch(closeHistory(editor.state.tr)); });
    fireEvent.keyDown(body, { key: 'Backspace' });
    expect(body.querySelectorAll('p')).toHaveLength(1);
    act(() => { editor.commands.undo(); });
    expect(body.querySelectorAll('p')).toHaveLength(2);
    act(() => { editor.commands.undo(); });
    expect(body.querySelectorAll('p')).toHaveLength(1);
    expect(body).toHaveTextContent('Project goals');
    expect(screen.queryByRole('button', { name: 'Add a section' })).not.toBeInTheDocument();
  });

  it('formats a selection spanning paragraphs and preserves it through parent updates', () => {
    render(<ExampleDocument dark={dark} />);
    const body = screen.getByLabelText('Page content');
    const editor = (body as HTMLElement & { editor: TiptapEditor }).editor;
    act(() => {
      editor.commands.setContent('<p>First paragraph</p><p>Second paragraph</p>');
      editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });
      editor.commands.toggleBold();
    });
    expect(body.querySelectorAll('strong')).toHaveLength(2);
    expect(editor.state.selection.empty).toBe(false);
    act(() => { editor.commands.undo(); });
    expect(body.querySelectorAll('strong')).toHaveLength(0);
    expect(body.querySelectorAll('p')).toHaveLength(2);
  });

  it('continues lists and exits an empty item with Enter', async () => {
    render(<ExampleDocument dark={dark} />);
    const body = screen.getByLabelText('Page content');
    const editor = (body as HTMLElement & { editor: TiptapEditor }).editor;
    act(() => { editor.chain().focus('end').toggleBulletList().run(); });
    fireEvent.keyDown(body, { key: 'Enter' });
    expect(body.querySelectorAll('li')).toHaveLength(2);
    fireEvent.keyDown(body, { key: 'Enter' });
    expect(body.querySelectorAll('li')).toHaveLength(1);
    expect(body.lastElementChild?.tagName).toBe('P');
    await waitFor(() => expect(body).toHaveFocus());
  });

  it('appends a paragraph below a final non-text block', () => {
    render(<ExampleDocument dark={dark} initialContent={{ version: 1, sections: [{ id: crypto.randomUUID(), type: 'divider' }] }} />);
    const body = screen.getByLabelText('Page content');
    fireEvent.click(screen.getByRole('button', { name: 'Continue writing' }));
    expect(body.lastElementChild?.tagName).toBe('P');
    expect(body.querySelectorAll('p')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Continue writing' }));
    expect(body.querySelectorAll('p')).toHaveLength(1);
  });

  it('starts a new paragraph below existing text and reuses the empty trailing paragraph', async () => {
    render(<ExampleDocument dark={dark} />);
    const body = screen.getByLabelText('Page content');
    fireEvent.click(screen.getByRole('button', { name: 'Continue writing' }));
    expect(body.querySelectorAll('p')).toHaveLength(2);
    expect(body.lastElementChild?.textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Continue writing' }));
    expect(body.querySelectorAll('p')).toHaveLength(2);
    await waitFor(() => expect(body).toHaveFocus());
  });

  it('pastes multiple paragraphs into a single undo history', () => {
    render(<ExampleDocument dark={dark} />);
    const body = screen.getByLabelText('Page content');
    const editor = (body as HTMLElement & { editor: TiptapEditor }).editor;
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      editor.view.pasteHTML('<p>Pasted first</p><p>Pasted second</p>', new Event('paste') as ClipboardEvent);
    });
    expect(body).toHaveTextContent('Pasted first');
    expect(body).toHaveTextContent('Pasted second');
    act(() => { editor.commands.undo(); });
    expect(body).toHaveTextContent('Project goals');
    expect(body).not.toHaveTextContent('Pasted first');
    expect(body).not.toHaveTextContent('Pasted second');
  });

  it('inserts every existing block type through the transitional insert menu', async () => {
    render(<ExampleDocument dark={dark} />);
    const body = screen.getByLabelText('Page content');
    act(() => { body.focus(); });
    expect(onContentChange).not.toHaveBeenCalled();
    for (const label of ['Heading 1', 'Heading 2', 'Heading 3', 'Bullet list', 'Numbered list', 'To-do list', 'Quote', 'Code', 'Divider', 'Paragraph']) {
      fireEvent.click(screen.getByRole('button', { name: 'Insert block' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: label }));
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    }
    const saved = onContentChange.mock.lastCall?.[0] as ISectionDocument;
    expect(saved.sections.map(section => section.type)).toEqual(['paragraph', 'heading', 'heading', 'heading', 'bulletList', 'numberedList', 'checklist', 'quote', 'code', 'divider', 'paragraph']);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
  });

  it('moves and duplicates blocks, keeping unique IDs, and can delete a selected divider', async () => {
    render(<ExampleDocument dark={dark} initialContent={{ version: 1, sections: [
      { id: crypto.randomUUID(), type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
      { id: crypto.randomUUID(), type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      { id: crypto.randomUUID(), type: 'divider' },
    ] }} />);
    const body = screen.getByLabelText('Page content');
    const editor = (body as HTMLElement & { editor: TiptapEditor }).editor;
    act(() => { body.focus(); editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 1); });
    const action = async (name: string) => {
      fireEvent.click(screen.getByRole('button', { name: 'Block actions' }));
      fireEvent.click(await screen.findByRole('menuitem', { name }));
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    };
    await action('Move up');
    expect(body.firstElementChild).toHaveTextContent('Second');
    await action('Move down');
    expect(body.firstElementChild).toHaveTextContent('First');
    await action('Duplicate');
    expect(body.querySelectorAll('p')).toHaveLength(3);
    const saved = onContentChange.mock.lastCall?.[0] as ISectionDocument;
    expect(new Set(saved.sections.map(section => section.id)).size).toBe(saved.sections.length);
    act(() => { editor.commands.setNodeSelection(editor.state.doc.content.size - 1); });
    await action('Delete');
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(body.querySelector('hr')).toBeNull());
  });

  it('edits checklists with a keyboard-accessible checkbox and retains checked state on save', () => {
    render(<ExampleDocument dark={dark} initialContent={{ version: 1, sections: [{ id: crypto.randomUUID(), type: 'checklist', items: [{ id: crypto.randomUUID(), checked: true, content: [{ type: 'text', text: 'Ship it' }] }] }] }} />);
    const checkbox = screen.getByRole('checkbox', { name: 'Toggle to-do' });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(onContentChange).toHaveBeenLastCalledWith(expect.objectContaining({ sections: [expect.objectContaining({ type: 'checklist', items: [expect.objectContaining({ checked: false })] })] }));
    const body = screen.getByLabelText('Page content');
    const editor = (body as HTMLElement & { editor: TiptapEditor }).editor;
    act(() => { editor.chain().focus('end').updateAttributes('taskItem', { checked: true }).run(); });
    fireEvent.keyDown(body, { key: 'Enter' });
    expect(screen.getAllByRole('checkbox', { name: 'Toggle to-do' })).toHaveLength(2);
    expect(screen.getAllByRole('checkbox', { name: 'Toggle to-do' })[0]).toBeChecked();
    expect(screen.getAllByRole('checkbox', { name: 'Toggle to-do' })[1]).not.toBeChecked();
    fireEvent.keyDown(body, { key: 'Enter' });
    expect(screen.getAllByRole('checkbox', { name: 'Toggle to-do' })).toHaveLength(1);
    expect(body.lastElementChild?.tagName).toBe('P');
  });

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
    await waitFor(() => expect(body).toHaveFocus());
    expect(toolbar.getByRole('button', { name: 'Bullet list' })).toHaveAttribute('aria-pressed', 'true');
    expect(body.querySelector('strong')).toHaveTextContent('Project goals');

    act(() => {
      const range = document.createRange();
      range.selectNodeContents(body.querySelector('p')!);
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
    expect(body.querySelector('ol > li')).toHaveTextContent('Project goals');

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
      sections: [{ id: expect.any(String), type: 'paragraph', content: [
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
      sections: [{ id: expect.any(String), type: 'paragraph', content: [
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
