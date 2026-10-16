import { Extension, Editor as TiptapEditor } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import { PluginKey } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import Suggestion, { SuggestionProps } from '@tiptap/suggestion';
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
} from '@ant-design/icons';
import { MutableRefObject, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ISectionDocument } from '@/types/project/project-documents.types';
import { DocsSuggestionItem, suggestionPosition } from './docs-suggestion-menu';
import { MentionHandlers } from './docs-mentions';
import { ToolbarButton } from './docs-toolbar-button';
import { fromEditorDocument, toEditorDocument } from './docs-document-format';
import {
  DocumentStarterKit,
  DocumentStructure,
  DocumentTaskList,
  createDocumentTaskItem,
} from './extensions/document-structure';
import { MemberMention } from './extensions/member-mention';
import { TaskMention } from './extensions/task-mention';

interface DocsDocumentEditorProps {
  content: ISectionDocument;
  handlersRef: MutableRefObject<MentionHandlers>;
  onChange: (content: ISectionDocument) => void;
  onActivity: (editor: TiptapEditor) => void;
}

export const DocsDocumentEditor = ({
  content,
  handlersRef,
  onChange,
  onActivity,
}: DocsDocumentEditorProps) => {
  const { t } = useTranslation('project-view-docs');
  const callbacks = useRef({ onChange, onActivity });
  callbacks.current = { onChange, onActivity };
  // The page owns the document lifetime (keyed by page ID/reload token). Local echoes
  // must never call setContent: that would reset selection and document history.
  const editor = useEditor({
    extensions: [
      DocumentStarterKit.configure({
        heading: { levels: [1, 2, 3] },
        trailingNode: false,
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ['http', 'https'],
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
          validate: href => /^https?:\/\//i.test(href),
        },
      }),
      DocumentStructure,
      DocumentTaskList,
      createDocumentTaskItem(t('toggleItem', { defaultValue: 'Toggle to-do' })),
      Placeholder.configure({
        placeholder: t('placeholder', { defaultValue: "Write, '@' for members, '#' for tasks" }),
      }),
      MemberMention,
      TaskMention,
      Extension.create({
        name: 'documentMentions',
        addProseMirrorPlugins() {
          return (['member', 'task'] as const).map(kind => {
            const showMenu = (props: SuggestionProps<DocsSuggestionItem>, isUpdate: boolean) => {
              const state = {
                items: props.items,
                ...suggestionPosition(props.clientRect),
                command: (item: DocsSuggestionItem) => props.command(item),
              };
              if (isUpdate) handlersRef.current.mentionMenu?.update(state);
              else handlersRef.current.mentionMenu?.open(state);
            };
            return Suggestion({
              pluginKey: new PluginKey(`document-mention-${kind}`),
              editor: this.editor,
              char: kind === 'member' ? '@' : '#',
              allowSpaces: true,
              items: ({ query }) => handlersRef.current.mentionItems(query, kind),
              command: ({ editor, range, props }) =>
                handlersRef.current.applyMention(props as DocsSuggestionItem, editor, range),
              render: () => ({
                onStart: props => showMenu(props, false),
                onUpdate: props => showMenu(props, true),
                onExit: () => handlersRef.current.mentionMenu?.close(),
                onKeyDown: ({ event }) =>
                  handlersRef.current.mentionMenu?.onKeyDown(event) ?? false,
              }),
            });
          });
        },
      }),
    ],
    content: toEditorDocument(content),
    editorProps: {
      attributes: {
        'aria-label': t('pageBody', { defaultValue: 'Page content' }),
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: current }) =>
      callbacks.current.onChange(fromEditorDocument(current.getJSON())),
    onFocus: ({ editor: current }) => callbacks.current.onActivity(current),
    onSelectionUpdate: ({ editor: current }) => callbacks.current.onActivity(current),
    onTransaction: ({ editor: current }) => callbacks.current.onActivity(current),
  });

  useEffect(() => () => handlersRef.current.mentionMenu?.close(), [handlersRef]);

  const focusBelow = () => {
    if (!editor) return;
    const lastBlock = editor.state.doc.lastChild;
    if (lastBlock?.type.name !== 'paragraph' || lastBlock.content.size > 0) {
      editor
        .chain()
        .insertContentAt(editor.state.doc.content.size, { type: 'paragraph' })
        .focus('end')
        .run();
    } else editor.commands.focus('end');
  };

  return (
    <div className="docs-document-editor">
      {editor ? (
        <BubbleMenu editor={editor} options={{ placement: 'top' }}>
          <div
            className="docs-bubble-toolbar"
            role="toolbar"
            aria-label={t('formatting', { defaultValue: 'Formatting' })}
          >
            <ToolbarButton
              label={t('bold', { defaultValue: 'Bold' })}
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <BoldOutlined />
            </ToolbarButton>
            <ToolbarButton
              label={t('italic', { defaultValue: 'Italic' })}
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <ItalicOutlined />
            </ToolbarButton>
            <ToolbarButton
              label={t('underline', { defaultValue: 'Underline' })}
              active={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineOutlined />
            </ToolbarButton>
            <ToolbarButton
              label={t('bulletList', { defaultValue: 'Bullet list' })}
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <UnorderedListOutlined />
            </ToolbarButton>
            <ToolbarButton
              label={t('numberedList', { defaultValue: 'Numbered list' })}
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <OrderedListOutlined />
            </ToolbarButton>
          </div>
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
      <button
        type="button"
        className="docs-writing-tail"
        aria-label={t('continueWriting', { defaultValue: 'Continue writing' })}
        onClick={focusBelow}
      />
    </div>
  );
};
