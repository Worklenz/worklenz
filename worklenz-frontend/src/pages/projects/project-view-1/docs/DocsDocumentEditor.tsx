import { Extension, Editor as TiptapEditor } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import { PluginKey } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import Suggestion, { exitSuggestion, SuggestionProps } from '@tiptap/suggestion';
import {
  BoldOutlined,
  LinkOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
} from '@ant-design/icons';
import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ISectionDocument } from '@/types/project/project-documents.types';
import {
  DocsSuggestionItem,
  DocsSuggestionMenu,
  DocsSuggestionMenuHandle,
  suggestionPosition,
} from './DocsSuggestionMenu';
import { MentionHandlers } from './docs-mentions';
import { ToolbarButton } from './docs-toolbar-button';
import { fromEditorDocument, toEditorDocument } from './docs-document-format';
import {
  DocumentStarterKit,
  DocumentStructure,
  DocumentTaskList,
  DocumentCallout,
  createDocumentTaskItem,
} from './extensions/document-structure';
import { MemberMention } from './extensions/member-mention';
import { TaskMention } from './extensions/task-mention';
import { createSlashCommands, slashPluginKey } from './extensions/slash-commands';
import { toggleDocumentList, useDocsBlockCommands } from './docs-block-commands';
import { DocsBlockControls } from './DocsBlockControls';
import { registerDocsEditorRelease } from './docs-editor-release';

interface DocsDocumentEditorProps {
  content: ISectionDocument;
  handlersRef: MutableRefObject<MentionHandlers>;
  onChange: (content: ISectionDocument) => void;
  onActivity: (editor: TiptapEditor) => void;
  onReady?: (editor: TiptapEditor | null) => void;
}

export const DocsDocumentEditor = ({
  content,
  handlersRef,
  onChange,
  onActivity,
  onReady,
}: DocsDocumentEditorProps) => {
  const { t } = useTranslation('project-view-docs');
  const commands = useDocsBlockCommands();
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const slashMenuRef = useRef<DocsSuggestionMenuHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [released, setReleased] = useState(false);
  const contentVersion = useRef(content.version);
  const callbacks = useRef({ onChange, onActivity, onReady });
  callbacks.current = { onChange, onActivity, onReady };
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
          defaultProtocol: 'https',
          protocols: ['http', 'https'],
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
          validate: href => /^https?:\/\//i.test(href),
        },
      }),
      DocumentStructure,
      DocumentTaskList,
      DocumentCallout,
      createSlashCommands(commandsRef, slashMenuRef),
      createDocumentTaskItem(t('toggleItem', { defaultValue: 'Toggle to-do' })),
      Placeholder.configure({
        placeholder: t('writingPlaceholder', {
          defaultValue: "Write, '/' for blocks, '@' for members, '#' for tasks",
        }),
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
            const pluginKey = new PluginKey(`document-mention-${kind}`);
            return Suggestion({
              pluginKey,
              editor: this.editor,
              char: kind === 'member' ? '@' : '#',
              allowSpaces: true,
              allow: ({ editor, state, range }) => {
                const parent = state.doc.resolve(range.from).parent;
                const text = parent.textContent;
                return (
                  ['paragraph', 'heading'].includes(parent.type.name) &&
                  !editor.view.composing &&
                  !text.startsWith('/') &&
                  (kind !== 'task' || !/^#{2,}/.test(text))
                );
              },
              items: ({ query }) => handlersRef.current.mentionItems(query, kind),
              command: ({ editor, range, props }) =>
                handlersRef.current.applyMention(props as DocsSuggestionItem, editor, range),
              render: () => ({
                onStart: props => showMenu(props, false),
                onUpdate: props => showMenu(props, true),
                onExit: () => handlersRef.current.mentionMenu?.close(),
                onKeyDown: ({ event, view }) => {
                  if (event.isComposing || view.composing) return false;
                  if (event.key === 'Escape') {
                    exitSuggestion(view, pluginKey);
                    handlersRef.current.mentionMenu?.close();
                    return true;
                  }
                  return handlersRef.current.mentionMenu?.onKeyDown(event) ?? false;
                },
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
    onUpdate: ({ editor: current }) => {
      const next = fromEditorDocument(current.getJSON(), contentVersion.current);
      contentVersion.current = next.version;
      callbacks.current.onChange(next);
    },
    onFocus: ({ editor: current }) => callbacks.current.onActivity(current),
    onSelectionUpdate: ({ editor: current }) => callbacks.current.onActivity(current),
    onTransaction: ({ editor: current }) => callbacks.current.onActivity(current),
  });

  useEffect(() => {
    callbacks.current.onReady?.(editor);
    return () => callbacks.current.onReady?.(null);
  }, [editor]);

  useEffect(() => registerDocsEditorRelease(() => setReleased(true)), []);

  useEffect(
    () => () => {
      handlersRef.current.mentionMenu?.close();
      slashMenuRef.current?.close();
    },
    [handlersRef]
  );
  const dismissSlash = useCallback(() => {
    if (editor && !editor.isDestroyed) exitSuggestion(editor.view, slashPluginKey);
  }, [editor]);
  const activeSlashOption = useCallback(
    (optionId: string | null, menuId: string | null) => {
      if (!editor || editor.isDestroyed) return;
      const element = editor.view.dom;
      for (const [attribute, value] of [
        ['aria-activedescendant', optionId],
        ['aria-controls', menuId],
        ['aria-autocomplete', menuId ? 'list' : null],
      ] as const) {
        if (value && element.getAttribute(attribute) !== value)
          element.setAttribute(attribute, value);
        else if (!value && element.hasAttribute(attribute)) element.removeAttribute(attribute);
      }
    },
    [editor]
  );

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

  if (released) return <div className="docs-document-editor" />;

  return (
    <div className="docs-document-editor" ref={containerRef}>
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
              label={t('link', { defaultValue: 'Link' })}
              active={editor.isActive('link')}
              onClick={() => editor.view.dom.dispatchEvent(new Event('docs-edit-link'))}
            >
              <LinkOutlined />
            </ToolbarButton>
            <ToolbarButton
              label={t('bulletList', { defaultValue: 'Bullet list' })}
              active={editor.isActive('bulletList')}
              onClick={() => toggleDocumentList(editor, 'bulletList')}
            >
              <UnorderedListOutlined />
            </ToolbarButton>
            <ToolbarButton
              label={t('numberedList', { defaultValue: 'Numbered list' })}
              active={editor.isActive('orderedList')}
              onClick={() => toggleDocumentList(editor, 'numberedList')}
            >
              <OrderedListOutlined />
            </ToolbarButton>
          </div>
        </BubbleMenu>
      ) : null}
      {editor ? (
        <DocsBlockControls editor={editor} containerRef={containerRef} commands={commands} />
      ) : null}
      <DocsSuggestionMenu
        ref={slashMenuRef}
        variant="block"
        ariaLabel={t('slashMenu', { defaultValue: 'Insert block' })}
        emptyLabel={t('noCommands', { defaultValue: 'No matching commands' })}
        onDismiss={dismissSlash}
        onActiveOption={activeSlashOption}
      />
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
