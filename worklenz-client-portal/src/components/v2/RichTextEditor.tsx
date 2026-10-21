import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  BoldOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import { Placeholder } from '@tiptap/extensions';
import { Button, Input, Popover, theme } from '@/shared/antd-imports';
import { isRichHtml } from './richTextUtils';
import './rich-text.css';

export interface MentionOption {
  id: string;
  name: string;
}

export interface RichTextChange {
  /** Sanitized-on-the-server HTML. Empty string when the editor has no content. */
  html: string;
  /** The visible text, for length checks and the empty check. */
  text: string;
  /** Ids of the people whose @mention chip is still in the message. */
  mentionIds: string[];
}

interface RichTextEditorProps {
  /**
   * By default only used to clear the editor from outside (pass an empty string after sending).
   * With `controlled`, it is the HTML (or legacy plain text) the editor shows, e.g. a form field value.
   */
  value: string;
  /** Follow `value` when it changes from outside, so the editor can sit in a form and be prefilled or reset. */
  controlled?: boolean;
  /** `basic` drops the headings and underline, for notes and short descriptions. */
  toolbar?: 'full' | 'basic';
  /** Red border, for a failed form validation. */
  status?: 'error';
  /** Visible-text limit. Shows a counter; the host still validates. */
  maxLength?: number;
  minHeight?: number;
  maxHeight?: number;
  onChange: (change: RichTextChange) => void;
  /** Who `@` can suggest. Chips for anyone no longer in this list are turned back into plain text. */
  mentionOptions?: MentionOption[];
  /** Ctrl/Cmd+Enter. Plain Enter always writes, so lists and paragraphs work. */
  onSubmit?: () => void;
  placeholder: string;
  ariaLabel: string;
  /** `internal` tints the editor so an internal comment cannot be mistaken for a client-visible reply. */
  tone?: 'default' | 'internal';
  disabled?: boolean;
}

interface SuggestionState {
  items: MentionOption[];
  command: (attrs: { id: string; label: string }) => void;
  rect: DOMRect | null;
  selected: number;
}

const MAX_SUGGESTIONS = 8;
const SAFE_URL = /^(?:https?:\/\/|mailto:)/i;

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Editor content for a stored value: HTML as-is, legacy plain text as one paragraph per line. */
const toEditorHtml = (value: string): string => {
  if (!value || isRichHtml(value)) return value;
  return value
    .split(/\r?\n/)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('');
};

const collectMentionIds = (editor: Editor): string[] => {
  const ids = new Set<string>();
  editor.state.doc.descendants(node => {
    if (node.type.name === 'mention' && typeof node.attrs.id === 'string') ids.add(node.attrs.id);
  });
  return Array.from(ids);
};

/**
 * Rich text composer for discussion messages: headings, bold / italic / underline, bullet and numbered
 * lists, links, and @mentions that carry the person's id in the document (so the ids sent with a
 * message always match the chips that are really in it).
 */
export const RichTextEditor = ({
  value,
  controlled = false,
  toolbar = 'full',
  status,
  maxLength,
  minHeight,
  maxHeight,
  onChange,
  mentionOptions = [],
  onSubmit,
  placeholder,
  ariaLabel,
  tone = 'default',
  disabled = false,
}: RichTextEditorProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);
  const [charCount, setCharCount] = useState(0);
  const lastEmittedRef = useRef(value);

  // The editor is created once; these refs let it see the latest props without being rebuilt.
  const optionsRef = useRef(mentionOptions);
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  const suggestionRef = useRef<SuggestionState | null>(null);
  optionsRef.current = mentionOptions;
  onChangeRef.current = onChange;
  onSubmitRef.current = onSubmit;

  const updateSuggestion = (next: SuggestionState | null) => {
    suggestionRef.current = next;
    setSuggestion(next);
  };

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: {
          char: '@',
          items: ({ query }: { query: string }) =>
            optionsRef.current
              .filter(person => person.name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, MAX_SUGGESTIONS),
          render: () => ({
            onStart: props => {
              updateSuggestion({
                items: props.items as MentionOption[],
                command: props.command,
                rect: props.clientRect?.() ?? null,
                selected: 0,
              });
            },
            onUpdate: props => {
              const items = props.items as MentionOption[];
              updateSuggestion({
                items,
                command: props.command,
                rect: props.clientRect?.() ?? null,
                selected: Math.min(suggestionRef.current?.selected ?? 0, Math.max(items.length - 1, 0)),
              });
            },
            onKeyDown: ({ event }) => {
              const current = suggestionRef.current;
              if (!current) return false;
              if (event.key === 'Escape') {
                updateSuggestion(null);
                return true;
              }
              if (current.items.length === 0) return false;
              const count = current.items.length;
              if (event.key === 'ArrowDown') {
                updateSuggestion({ ...current, selected: (current.selected + 1) % count });
                return true;
              }
              if (event.key === 'ArrowUp') {
                updateSuggestion({ ...current, selected: (current.selected - 1 + count) % count });
                return true;
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                const chosen = current.items[current.selected];
                current.command({ id: chosen.id, label: chosen.name });
                return true;
              }
              return false;
            },
            onExit: () => updateSuggestion(null),
          }),
        },
      }),
    ],
    // Built once. The placeholder text is set below when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const editor = useEditor({
    extensions,
    content: controlled ? toEditorHtml(value) : value,
    editable: !disabled,
    editorProps: {
      attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': ariaLabel },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          onSubmitRef.current?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.isEmpty ? '' : current.getHTML();
      const text = current.getText({ blockSeparator: ' ' }).trim();
      lastEmittedRef.current = html;
      setCharCount(text.length);
      onChangeRef.current({ html, text, mentionIds: collectMentionIds(current) });
    },
  });

  // A controlled editor follows value changes that did not come from typing (form prefill / reset).
  useEffect(() => {
    if (!editor || !controlled || value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    editor.commands.setContent(toEditorHtml(value), { emitUpdate: false });
    setCharCount(editor.getText({ blockSeparator: ' ' }).trim().length);
  }, [editor, controlled, value]);

  // Clear from outside after a message is sent.
  useEffect(() => {
    if (editor && value === '' && !editor.isEmpty) editor.commands.clearContent();
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const placeholderExtension = editor.extensionManager.extensions.find(extension => extension.name === 'placeholder');
    if (placeholderExtension) {
      placeholderExtension.options.placeholder = placeholder;
      editor.view.dispatch(editor.state.tr);
    }
  }, [editor, placeholder]);

  // Switching between a client-visible reply and an internal comment changes who can be mentioned.
  // A chip for someone who no longer can be becomes plain "@Name" text instead of being sent.
  useEffect(() => {
    if (!editor) return;
    const stale: Array<{ pos: number; size: number; label: string }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'mention' && !mentionOptions.some(person => person.id === node.attrs.id)) {
        stale.push({ pos, size: node.nodeSize, label: String(node.attrs.label ?? '') });
      }
    });
    if (stale.length === 0) return;
    const tr = editor.state.tr;
    [...stale].reverse().forEach(({ pos, size, label }) => {
      tr.replaceWith(pos, pos + size, editor.state.schema.text(`@${label}`));
    });
    editor.view.dispatch(tr);
  }, [editor, mentionOptions]);

  const isInternal = tone === 'internal';
  const cssVars = {
    '--rich-message-text': token.colorText,
    '--rich-message-bg': isInternal ? token.colorWarningBg : token.colorBgContainer,
    '--rich-message-border': status === 'error' ? token.colorError : isInternal ? token.colorWarning : token.colorBorder,
    '--rich-message-focus': status === 'error' ? token.colorError : isInternal ? token.colorWarning : token.colorPrimary,
    '--rich-message-focus-ring': token.controlOutline,
    '--rich-message-placeholder': token.colorTextPlaceholder,
    '--rich-message-hover': token.colorFillTertiary,
    '--rich-message-link': token.colorPrimary,
    '--rich-message-mention-bg': token.colorPrimaryBg,
    '--rich-message-mention-color': token.colorPrimary,
    '--rich-message-menu-bg': token.colorBgElevated,
    '--rich-message-menu-border': token.colorBorderSecondary,
    '--rich-message-min-height': `${minHeight ?? 24}px`,
    '--rich-message-max-height': `${maxHeight ?? 180}px`,
  } as CSSProperties;

  return (
    <div className="rich-message-editor" style={{ ...cssVars, flex: 1, minWidth: 0 }}>
      <div className="rich-message-editor-surface">
        {editor && <Toolbar editor={editor} disabled={disabled} basic={toolbar === 'basic'} />}
        <EditorContent editor={editor} />
      </div>
      {maxLength !== undefined && (
        <div
          className="rich-message-counter"
          aria-hidden="true"
          style={{ color: charCount > maxLength ? token.colorError : token.colorTextTertiary }}
        >
          {charCount}/{maxLength}
        </div>
      )}
      {suggestion &&
        suggestion.rect &&
        createPortal(
          <div
            className="rich-message-mention-menu"
            role="listbox"
            aria-label={t('richText.mentionList', { defaultValue: 'People you can mention' })}
            style={{
              ...cssVars,
              left: Math.max(8, Math.min(suggestion.rect.left, window.innerWidth - 290)),
              bottom: window.innerHeight - suggestion.rect.top + 6,
            }}
          >
            {suggestion.items.length === 0 ? (
              <div className="rich-message-mention-empty">
                {t('richText.mentionNoMatch', { defaultValue: 'No matching people' })}
              </div>
            ) : (
              suggestion.items.map((person, index) => (
                <button
                  key={person.id}
                  type="button"
                  role="option"
                  aria-selected={index === suggestion.selected}
                  className="rich-message-mention-item"
                  // Keep the caret in the editor while choosing.
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => suggestion.command({ id: person.id, label: person.name })}
                >
                  {person.name}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

const Toolbar = ({ editor, disabled, basic }: { editor: Editor; disabled: boolean; basic: boolean }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h1: current.isActive('heading', { level: 1 }),
      h2: current.isActive('heading', { level: 2 }),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      bullet: current.isActive('bulletList'),
      ordered: current.isActive('orderedList'),
      link: current.isActive('link'),
    }),
  });

  const button = (
    label: string,
    isActive: boolean,
    run: () => void,
    content: ReactNode
  ) => (
    <Button
      type="text"
      size="small"
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={isActive}
      style={{ background: isActive ? token.colorFillSecondary : undefined, minWidth: 28, fontWeight: 600 }}
      // Keep the selection in the editor when a toolbar button is pressed.
      onMouseDown={event => event.preventDefault()}
      onClick={run}
    >
      {content}
    </Button>
  );

  return (
    <div className="rich-message-toolbar" role="toolbar" aria-label={t('richText.formatting', { defaultValue: 'Formatting' })}>
      {!basic &&
        button(
          t('richText.heading1', { defaultValue: 'Heading 1' }),
          active.h1,
          () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          'H1'
        )}
      {!basic &&
        button(
          t('richText.heading2', { defaultValue: 'Heading 2' }),
          active.h2,
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          'H2'
        )}
      {button(t('richText.bold', { defaultValue: 'Bold' }), active.bold, () => editor.chain().focus().toggleBold().run(), <BoldOutlined />)}
      {button(
        t('richText.italic', { defaultValue: 'Italic' }),
        active.italic,
        () => editor.chain().focus().toggleItalic().run(),
        <ItalicOutlined />
      )}
      {!basic &&
        button(
          t('richText.underline', { defaultValue: 'Underline' }),
          active.underline,
          () => editor.chain().focus().toggleUnderline().run(),
          <UnderlineOutlined />
        )}
      {button(
        t('richText.bulletList', { defaultValue: 'Bulleted list' }),
        active.bullet,
        () => editor.chain().focus().toggleBulletList().run(),
        <UnorderedListOutlined />
      )}
      {button(
        t('richText.numberedList', { defaultValue: 'Numbered list' }),
        active.ordered,
        () => editor.chain().focus().toggleOrderedList().run(),
        <OrderedListOutlined />
      )}
      <LinkControl editor={editor} isActive={active.link} disabled={disabled} />
    </div>
  );
};

const LinkControl = ({ editor, isActive, disabled }: { editor: Editor; isActive: boolean; disabled: boolean }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [hasError, setHasError] = useState(false);

  const label = t('richText.link', { defaultValue: 'Link' });

  const apply = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setOpen(false);
      return;
    }
    const href = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (!SAFE_URL.test(href)) {
      setHasError(true);
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      trigger="click"
      placement="topLeft"
      onOpenChange={next => {
        setOpen(next);
        if (next) {
          setUrl(editor.getAttributes('link').href ?? '');
          setHasError(false);
        }
      }}
      content={
        <div style={{ display: 'flex', gap: 6, width: 280 }}>
          <Input
            autoFocus
            size="small"
            value={url}
            status={hasError ? 'error' : undefined}
            aria-label={t('richText.linkAddress', { defaultValue: 'Link address' })}
            placeholder={t('richText.linkPlaceholder', { defaultValue: 'https://example.com' })}
            onChange={event => {
              setUrl(event.target.value);
              setHasError(false);
            }}
            onPressEnter={apply}
          />
          <Button type="primary" size="small" onClick={apply}>
            {t('richText.linkApply', { defaultValue: 'Apply' })}
          </Button>
        </div>
      }
    >
      <Button
        type="text"
        size="small"
        disabled={disabled}
        aria-label={label}
        title={label}
        aria-pressed={isActive}
        style={{ background: isActive ? token.colorFillSecondary : undefined, minWidth: 28 }}
        onMouseDown={event => event.preventDefault()}
      >
        <LinkOutlined />
      </Button>
    </Popover>
  );
};
