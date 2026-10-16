import { BoldOutlined, ItalicOutlined, UnderlineOutlined, UnorderedListOutlined, OrderedListOutlined } from '@ant-design/icons';
import { ToolbarButton, ToolbarDivider } from './docs-toolbar-button';
import { Extension, Editor as TiptapEditor } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { SuggestionProps } from '@tiptap/suggestion';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { IDocumentNode } from '@/types/project/project-documents.types';

import { MemberMention } from './extensions/member-mention';
import { TaskMention } from './extensions/task-mention';
import { mentionStore } from './mention-store';
import {
  DocsSuggestionItem,
  DocsSuggestionMenuHandle,
  suggestionPosition,
} from './docs-suggestion-menu';

const EMPTY_TASK_ID = '00000000-0000-4000-8000-000000000000';

export interface MentionHandlers {
  mentionItems: (query: string, kind: 'member' | 'task') => Promise<DocsSuggestionItem[]>;
  applyMention: (item: DocsSuggestionItem, editor: TiptapEditor, range: { from: number; to: number }) => void;
  mentionMenu: DocsSuggestionMenuHandle | null;
  toggleList: (fieldKey: string, type: 'bulletList' | 'numberedList') => void;
  listTypeForField: (fieldKey: string) => string | undefined;
}

interface DocsInlineEditorProps {
  fieldKey: string;
  projectId: string;
  content: IDocumentNode[];
  placeholder: string;
  ariaLabel: string;
  className?: string;
  autoFocus?: boolean;
  handlersRef: MutableRefObject<MentionHandlers>;
  onChange: (content: IDocumentNode[]) => void;
  onSplit?: (before: IDocumentNode[], after: IDocumentNode[]) => void;
  onEmptyBackspace?: () => void;
  onActivity: (editor: TiptapEditor) => void;
}

const inlineDocument = (content: IDocumentNode[]) => ({
  type: 'doc',
  content: [content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' }],
});

const inlineFromNode = (node: { toJSON: () => { content?: IDocumentNode[] } }): IDocumentNode[] =>
  node.toJSON().content || [];

const openMentionMenu = (
  props: SuggestionProps<DocsSuggestionItem>,
  handlers: MutableRefObject<MentionHandlers>
) => {
  handlers.current.mentionMenu?.open({
    items: props.items,
    ...suggestionPosition(props.clientRect),
    command: item => props.command(item),
  });
};

export const loadMentionItems = async (
  projectId: string,
  query: string,
  membersRef: MutableRefObject<Array<{ id: string; name: string }>>,
  memberGroup: string,
  taskGroup: string,
  kind: 'member' | 'task'
): Promise<DocsSuggestionItem[]> => {
  if (!projectId) return [];
  if (kind === 'member') {
    try {
      if (membersRef.current.length === 0) {
        const response = await projectCommentsApiService.getMentionMembers(projectId, 1, 200, null, null, '');
        membersRef.current = (response.body || [])
          .filter(member => member.id && member.name)
          .map(member => ({ id: member.id as string, name: member.name as string }));
      }
      const needle = query.trim().toLowerCase();
      return membersRef.current
        .filter(member => member.name.toLowerCase().includes(needle))
        .slice(0, 8)
        .map(member => ({
          id: `member:${member.id}`,
          entityId: member.id,
          kind: 'member' as const,
          label: member.name,
          group: memberGroup,
        }));
    } catch {
      return [];
    }
  }

  try {
    const response = await tasksApiService.searchTask(EMPTY_TASK_ID, projectId, query.trim());
    return (response.body || []).slice(0, 8).map(task => ({
      id: `task:${task.value}`,
      entityId: task.value,
      kind: 'task' as const,
      label: task.label,
      detail: task.task_key,
      group: taskGroup,
    }));
  } catch {
    return [];
  }
};

export const insertMention = (
  item: DocsSuggestionItem,
  editor: TiptapEditor,
  range: { from: number; to: number }
) => {
  if (!item.entityId || (item.kind !== 'member' && item.kind !== 'task')) return;
  const mentions = mentionStore.get();
  // Seed display data before the node renders; the save response supplies authoritative details.
  if (item.kind === 'member') {
    mentionStore.merge({
      members: {
        [item.entityId]: {
          id: item.entityId,
          avatar_url: mentions.members[item.entityId]?.avatar_url ?? null,
          name: item.label,
          unavailable: false,
        },
      },
      tasks: {},
    });
  } else {
    mentionStore.merge({
      members: {},
      tasks: {
        [item.entityId]: {
          id: item.entityId,
          task_key: item.detail || mentions.tasks[item.entityId]?.task_key || null,
          status_name: mentions.tasks[item.entityId]?.status_name ?? null,
          status_color: mentions.tasks[item.entityId]?.status_color ?? null,
          name: item.label,
          unavailable: false,
        },
      },
    });
  }
  editor
    .chain()
    .focus()
    .insertContentAt(range, [
      {
        type: item.kind === 'member' ? 'memberMention' : 'taskMention',
        attrs: { id: item.entityId },
      },
      { type: 'text', text: ' ' },
    ])
    .run();
};

const DocsInlineEditor = ({
  fieldKey,
  content,
  placeholder,
  ariaLabel,
  className,
  autoFocus = false,
  handlersRef,
  onChange,
  onSplit,
  onEmptyBackspace,
  onActivity,
}: DocsInlineEditorProps) => {
  const { t } = useTranslation('project-view-docs');
  const onChangeRef = useRef(onChange);
  const onSplitRef = useRef(onSplit);
  const onEmptyBackspaceRef = useRef(onEmptyBackspace);
  const onActivityRef = useRef(onActivity);
  onChangeRef.current = onChange;
  onSplitRef.current = onSplit;
  onEmptyBackspaceRef.current = onEmptyBackspace;
  onActivityRef.current = onActivity;

  const extensions = useMemo(() => {
    return [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        listKeymap: false,
        link: {
          openOnClick: true,
          autolink: true,
          protocols: ['http', 'https'],
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
          validate: href => /^https?:\/\//i.test(href),
        },
      }),
      Placeholder.configure({ placeholder }),
      MemberMention,
      TaskMention,
      Extension.create({
        name: 'sectionKeys',
        addKeyboardShortcuts() {
          return {
            Enter: () => {
              const { state } = this.editor;
              if (!state.selection.empty) return true;
              const parent = state.selection.$from.parent;
              if (parent.type.name !== 'paragraph') return true;
              const offset = state.selection.$from.parentOffset;
              const before = inlineFromNode(parent.cut(0, offset));
              const after = inlineFromNode(parent.cut(offset));
              this.editor.commands.setContent(inlineDocument(before), { emitUpdate: false });
              onSplitRef.current?.(before, after);
              return true;
            },
            Backspace: () => {
              const { state } = this.editor;
              const { $from, empty } = state.selection;
              if (!empty || $from.parentOffset !== 0 || $from.parent.content.size > 0) return false;
              if (!onEmptyBackspaceRef.current) return false;
              onEmptyBackspaceRef.current();
              return true;
            },
          };
        },
      }),
      Extension.create({
        name: 'docsMention',
        addProseMirrorPlugins() {
          return (['member', 'task'] as const).map(kind =>
            Suggestion({
              pluginKey: new PluginKey(`docsMention-${kind}-${fieldKey}`),
              editor: this.editor,
              char: kind === 'member' ? '@' : '#',
              allowSpaces: true,
              items: ({ query }) => handlersRef.current.mentionItems(query, kind),
              command: ({ editor, range, props }) => {
                handlersRef.current.applyMention(props as DocsSuggestionItem, editor, range);
              },
              render: () => ({
                onStart: props => openMentionMenu(props, handlersRef),
                onUpdate: props => openMentionMenu(props, handlersRef),
                onExit: () => handlersRef.current.mentionMenu?.close(),
                onKeyDown: ({ event }) => handlersRef.current.mentionMenu?.onKeyDown(event) ?? false,
              }),
            })
          );
        },
      }),
    ];
  }, [fieldKey, handlersRef, placeholder]);

  const editor = useEditor(
    {
      extensions,
      content: inlineDocument(content),
      editorProps: {
        attributes: {
          'aria-label': ariaLabel,
          'data-docs-field-key': fieldKey,
        },
      },
      onUpdate: ({ editor: current }) => {
        const json = current.getJSON();
        const inline = (json.content?.[0]?.content || []) as IDocumentNode[];
        onChangeRef.current(inline);
      },
    },
    [fieldKey]
  );

  useEffect(() => {
    if (!editor) return;
    const notify = () => onActivityRef.current(editor);
    editor.on('focus', notify);
    editor.on('selectionUpdate', notify);
    editor.on('transaction', notify);
    return () => {
      editor.off('focus', notify);
      editor.off('selectionUpdate', notify);
      editor.off('transaction', notify);
    };
  }, [editor]);

  useEffect(() => {
    if (!autoFocus || !editor) return;
    editor.commands.focus('end');
  }, [autoFocus, editor]);

  return (
    <div className={className}>
      {editor ? (
        <BubbleMenu editor={editor} options={{ placement: 'top' }}>
          <div className="docs-bubble-toolbar" role="toolbar" aria-label={t('formatting', { defaultValue: 'Formatting' })}>
            <ToolbarButton label={t('bold', { defaultValue: 'Bold' })} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <BoldOutlined />
            </ToolbarButton>
            <ToolbarButton label={t('italic', { defaultValue: 'Italic' })} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <ItalicOutlined />
            </ToolbarButton>
            <ToolbarButton label={t('underline', { defaultValue: 'Underline' })} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
              <UnderlineOutlined />
            </ToolbarButton>
            <ToolbarDivider />
            <ToolbarButton label={t('bulletList', { defaultValue: 'Bullet list' })} active={handlersRef.current.listTypeForField(fieldKey) === 'bulletList'} onClick={() => handlersRef.current.toggleList(fieldKey, 'bulletList')}>
              <UnorderedListOutlined />
            </ToolbarButton>
            <ToolbarButton label={t('numberedList', { defaultValue: 'Numbered list' })} active={handlersRef.current.listTypeForField(fieldKey) === 'numberedList'} onClick={() => handlersRef.current.toggleList(fieldKey, 'numberedList')}>
              <OrderedListOutlined />
            </ToolbarButton>
          </div>
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
};

export default DocsInlineEditor;
