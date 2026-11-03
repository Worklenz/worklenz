import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  CodeOutlined,
  LinkOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  CheckSquareOutlined,
  FontColorsOutlined,
} from '@ant-design/icons';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import { Placeholder } from '@tiptap/extensions';
import { Button, Input, Popover, Tooltip, theme } from '@/shared/antd-imports';
import { TaskList, TaskItem } from './extensions/task-list';
import { ColorMark } from './extensions/color';
import './rich-comment-editor.css';

export interface MentionMemberOption {
  id: string;
  name: string;
  avatar_url?: string;
}

export interface RichCommentChange {
  html: string;
  text: string;
  mentions: MentionMemberOption[];
}

export interface RichCommentEditorProps {
  value?: string;
  controlled?: boolean;
  onChange?: (change: RichCommentChange) => void;
  onSubmit?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  maxLength?: number;
  minHeight?: number;
  maxHeight?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  themeMode?: 'light' | 'dark';
  mentionOptions?: MentionMemberOption[];
  className?: string;
  style?: CSSProperties;
}

interface SuggestionState {
  items: MentionMemberOption[];
  command: (attrs: { id: string; label: string }) => void;
  rect: DOMRect | null;
  selected: number;
}

const MAX_SUGGESTIONS = 8;
const SAFE_URL_REGEX = /^(?:https?:\/\/|mailto:)/i;

const COLOR_PALETTE = [
  { key: 'Default', label: 'Default', value: '' },
  { key: 'Blue', label: 'Blue', value: '#1890ff' },
  { key: 'Purple', label: 'Purple', value: '#722ed1' },
  { key: 'Cyan', label: 'Cyan', value: '#13c2c2' },
  { key: 'Green', label: 'Green', value: '#52c41a' },
  { key: 'Yellow', label: 'Yellow', value: '#faad14' },
  { key: 'Orange', label: 'Orange', value: '#fa8c16' },
  { key: 'Red', label: 'Red', value: '#f5222d' },
  { key: 'Magenta', label: 'Magenta', value: '#eb2f96' },
  { key: 'Gray', label: 'Gray', value: '#8c8c8c' },
];

/**
 * Escapes ampersands and angle brackets in plain text for safe HTML text content.
 *
 * @param text - Plaintext string to escape
 * @returns HTML-escaped string
 */
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Detects recognized rich-text tags. This is a format heuristic, not sanitization.
 *
 * @param text - String to inspect for recognized rich-text tags
 * @returns True if a recognized tag is present
 */
const isHtml = (text: string): boolean => /<\/?(?:p|br|h[1-6]|strong|b|em|i|u|s|del|strike|ul|ol|li|a|blockquote|code|pre|span|div)\b[^>]*>/i.test(text);

/**
 * Preserves recognized HTML or wraps each escaped plain-text line in a paragraph.
 *
 * @param value - Raw text or HTML input
 * @returns HTML string suitable for TipTap editor content
 */
const toEditorHtml = (value: string): string => {
  if (!value) return '';
  if (isHtml(value)) return value;
  return value
    .split(/\r?\n/)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('');
};

/**
 * Returns supplied member options whose IDs occur in mention nodes, in option order.
 *
 * @param editor - TipTap editor instance
 * @param options - Available member mention options
 * @returns Mention options referenced in the document
 */
const extractMentions = (editor: Editor, options: MentionMemberOption[]): MentionMemberOption[] => {
  const ids = new Set<string>();
  editor.state.doc.descendants(node => {
    if (node.type.name === 'mention' && typeof node.attrs.id === 'string') {
      ids.add(node.attrs.id);
    }
  });

  return options.filter(opt => ids.has(opt.id));
};

/**
 * TipTap-based rich text editor component for task comments and project updates.
 * Supports 10 rich text formatting options, inline member mentions, URL autolinking,
 * keyboard shortcuts (Ctrl/Cmd+Enter), and light/dark theme adaptation.
 *
 * With controlled=true, value changes replace content without emitting onChange;
 * otherwise value initializes content, and setting it to an empty string clears
 * the editor in either mode. Plain text is converted to paragraphs. Changes emit
 * HTML (empty when the editor is empty), trimmed text with spaces between blocks,
 * and matching mentionOptions. Ctrl/Cmd+Enter invokes onSubmit without validating
 * content. minHeight and maxHeight are in pixels. maxLength only displays a
 * counter and over-limit styling; edits count HTML UTF-16 code units and are not
 * truncated.
 *
 * @param props - Configuration and event handler properties for the editor
 * @returns The rendered rich comment editor element
 */
export const RichCommentEditor = ({
  value = '',
  controlled = false,
  onChange,
  onSubmit,
  onFocus,
  onBlur,
  placeholder,
  ariaLabel,
  maxLength,
  minHeight = 60,
  maxHeight = 220,
  disabled = false,
  autoFocus = false,
  themeMode,
  mentionOptions = [],
  className = '',
  style,
}: RichCommentEditorProps) => {
  const { t } = useTranslation('common');
  const { token } = theme.useToken();
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);
  const [charCount, setCharCount] = useState<number>(0);
  const lastEmittedRef = useRef<string>(value);

  const optionsRef = useRef(mentionOptions);
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  const suggestionRef = useRef<SuggestionState | null>(null);

  optionsRef.current = mentionOptions;
  onChangeRef.current = onChange;
  onSubmitRef.current = onSubmit;

  /** Updates both the rendered mention menu and the state used by keyboard handlers. */
  const updateSuggestion = (next: SuggestionState | null) => {
    suggestionRef.current = next;
    setSuggestion(next);
  };

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        link: false,
        codeBlock: { HTMLAttributes: { class: 'rich-code-block' } },
        blockquote: { HTMLAttributes: { class: 'rich-blockquote' } },
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
          class: 'comment-link',
        },
        validate: href => /^https?:\/\//i.test(href) || /^mailto:/i.test(href),
      }),
      TaskList,
      TaskItem,
      ColorMark,
      Placeholder.configure({
        placeholder: placeholder || t('addComment', { defaultValue: 'Add a comment...' }),
      }),
      Mention.extend({
        parseHTML() {
          return [
            {
              tag: 'span[data-type="mention"]',
            },
            {
              tag: 'span.mentions',
              getAttrs: node => {
                const el = node as HTMLElement;
                const text = (el.textContent || '').replace(/^@/, '').trim();
                const matched = optionsRef.current.find(
                  m => m.name.toLowerCase() === text.toLowerCase()
                );
                return {
                  id: matched?.id || el.getAttribute('data-id') || text,
                  label: matched?.name || el.getAttribute('data-label') || text,
                };
              },
            },
            {
              tag: 'span.mention',
              getAttrs: node => {
                const el = node as HTMLElement;
                const text = (el.textContent || '').replace(/^@/, '').trim();
                const matched = optionsRef.current.find(
                  m => m.name.toLowerCase() === text.toLowerCase()
                );
                return {
                  id: matched?.id || el.getAttribute('data-id') || text,
                  label: matched?.name || el.getAttribute('data-label') || text,
                };
              },
            },
          ];
        },
      }).configure({
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
                items: props.items as MentionMemberOption[],
                command: props.command,
                rect: props.clientRect?.() ?? null,
                selected: 0,
              });
            },
            onUpdate: props => {
              const items = props.items as MentionMemberOption[];
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
                if (chosen) {
                  current.command({ id: chosen.id, label: chosen.name });
                  return true;
                }
              }
              return false;
            },
            onExit: () => updateSuggestion(null),
          }),
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const editor = useEditor({
    extensions,
    content: controlled ? toEditorHtml(value) : value,
    editable: !disabled,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel || t('commentInput', { defaultValue: 'Comment input' }),
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          onSubmitRef.current?.();
          return true;
        }
        return false;
      },
    },
    onFocus,
    onBlur,
    onUpdate: ({ editor: current }) => {
      const html = current.isEmpty ? '' : current.getHTML();
      const text = current.getText({ blockSeparator: ' ' }).trim();
      lastEmittedRef.current = html;
      setCharCount(html.length);
      onChangeRef.current?.({
        html,
        text,
        mentions: extractMentions(current, optionsRef.current),
      });
    },
  });

  useEffect(() => {
    if (!editor || !controlled || value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    editor.commands.setContent(toEditorHtml(value), { emitUpdate: false });
    setCharCount(value.length);
  }, [editor, controlled, value]);

  useEffect(() => {
    if (editor && value === '' && !editor.isEmpty) {
      editor.commands.clearContent();
      setCharCount(0);
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor || !placeholder) return;
    const placeholderExtension = editor.extensionManager.extensions.find(
      extension => extension.name === 'placeholder'
    );
    if (placeholderExtension) {
      placeholderExtension.options.placeholder = placeholder;
      editor.view.dispatch(editor.state.tr);
    }
  }, [editor, placeholder]);

  const isDark = themeMode === 'dark';
  const cssVars = {
    '--rce-bg': isDark ? token.colorBgContainer : '#ffffff',
    '--rce-text': isDark ? token.colorText : 'rgba(0, 0, 0, 0.88)',
    '--rce-text-secondary': isDark ? token.colorTextSecondary : 'rgba(0, 0, 0, 0.65)',
    '--rce-text-tertiary': token.colorTextTertiary,
    '--rce-border': isDark ? token.colorBorder : '#d9d9d9',
    '--rce-border-secondary': isDark ? token.colorBorderSecondary : '#f0f0f0',
    '--rce-focus-border': token.colorPrimary,
    '--rce-focus-ring': token.controlOutline,
    '--rce-primary': token.colorPrimary,
    '--rce-placeholder': token.colorTextPlaceholder,
    '--rce-hover-bg': isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
    '--rce-active-bg': isDark ? 'rgba(24, 144, 255, 0.2)' : 'rgba(24, 144, 255, 0.12)',
    '--rce-code-bg': isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
    '--rce-code-text': isDark ? '#ff7875' : '#eb2f96',
    '--rce-pre-bg': isDark ? '#141414' : '#282c34',
    '--rce-pre-text': isDark ? '#d9d9d9' : '#abb2bf',
    '--rce-menu-bg': token.colorBgElevated,
    '--rce-menu-border': token.colorBorderSecondary,
    '--rce-menu-hover-bg': token.colorFillTertiary,
    '--rce-mention-bg': isDark ? 'rgba(24, 144, 255, 0.25)' : 'rgba(24, 144, 255, 0.12)',
    '--rce-mention-color': token.colorPrimary,
    '--rce-min-height': `${minHeight}px`,
    '--rce-max-height': `${maxHeight}px`,
  } as CSSProperties;

  return (
    <div
      className={`rich-comment-editor-wrapper ${disabled ? 'is-disabled' : ''} ${className}`}
      style={{ ...cssVars, ...style }}
    >
      {editor && <Toolbar editor={editor} disabled={disabled} />}
      <div className="rich-comment-content">
        <EditorContent editor={editor} />
      </div>

      {maxLength !== undefined && (
        <div
          className="rich-comment-counter"
          style={{ color: charCount > maxLength ? token.colorError : token.colorTextTertiary }}
        >
          {charCount}/{maxLength}
        </div>
      )}

      {suggestion &&
        suggestion.rect &&
        createPortal(
          <div
            className="rich-comment-mention-menu"
            role="listbox"
            aria-label={t('peopleYouCanMention', { defaultValue: 'People you can mention' })}
            style={{
              ...cssVars,
              left: Math.max(8, Math.min(suggestion.rect.left, window.innerWidth - 310)),
              bottom: window.innerHeight - suggestion.rect.top + 6,
            }}
          >
            {suggestion.items.length === 0 ? (
              <div className="rich-comment-mention-empty">
                {t('noMatchingPeople', { defaultValue: 'No matching people' })}
              </div>
            ) : (
              suggestion.items.map((person, index) => (
                <button
                  key={person.id}
                  type="button"
                  role="option"
                  aria-selected={index === suggestion.selected}
                  className={`rich-comment-mention-item ${index === suggestion.selected ? 'is-selected' : ''}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => suggestion.command({ id: person.id, label: person.name })}
                >
                  <span style={{ fontWeight: 500 }}>{person.name}</span>
                </button>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

/**
 * Renders the inline SVG quote icon for the blockquote formatting action.
 *
 * @returns The SVG icon element
 */
const QuoteGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
  </svg>
);

/**
 * Renders the formatting toolbar with text styles, code blocks, quotes, lists,
 * links, and color controls reflecting the editor's current selection.
 *
 * @param props - Editor instance and disabled state
 * @returns The toolbar element
 */
const Toolbar = ({ editor, disabled }: { editor: Editor; disabled: boolean }) => {
  const { t } = useTranslation('common');

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      strike: current.isActive('strike'),
      codeBlock: current.isActive('codeBlock'),
      blockquote: current.isActive('blockquote'),
      taskList: current.isActive('taskList'),
      orderedList: current.isActive('orderedList'),
      bulletList: current.isActive('bulletList'),
      link: current.isActive('link'),
      textColor: current.getAttributes('textStyle').color || '',
    }),
  });

  /** Renders a labeled action that preserves the editor selection on mouse down. */
  const btn = (label: string, isActive: boolean, action: () => void, icon: ReactNode) => (
    <Tooltip title={label} placement="top">
      <Button
        type="text"
        size="small"
        disabled={disabled}
        aria-label={label}
        className={isActive ? 'is-active' : ''}
        onMouseDown={e => e.preventDefault()}
        onClick={action}
        icon={icon}
      />
    </Tooltip>
  );

  return (
    <div className="rich-comment-toolbar" role="toolbar" aria-label={t('formatting', { defaultValue: 'Formatting' })}>
      {/* 1. Bold */}
      {btn(
        t('bold', { defaultValue: 'Bold' }),
        active.bold,
        () => editor.chain().focus().toggleBold().run(),
        <BoldOutlined />
      )}

      {/* 2. Italic */}
      {btn(
        t('italic', { defaultValue: 'Italic' }),
        active.italic,
        () => editor.chain().focus().toggleItalic().run(),
        <ItalicOutlined />
      )}

      {/* 3. Strikethrough */}
      {btn(
        t('strikethrough', { defaultValue: 'Strikethrough' }),
        active.strike,
        () => editor.chain().focus().toggleStrike().run(),
        <StrikethroughOutlined />
      )}

      <div className="rich-comment-toolbar-divider" />

      {/* 4. Code Block */}
      {btn(
        t('codeBlock', { defaultValue: 'Code block' }),
        active.codeBlock,
        () => editor.chain().focus().toggleCodeBlock().run(),
        <CodeOutlined />
      )}

      {/* 5. Quote Block */}
      {btn(
        t('quoteBlock', { defaultValue: 'Quote block' }),
        active.blockquote,
        () => editor.chain().focus().toggleBlockquote().run(),
        <QuoteGlyph />
      )}

      {/* 6. Link */}
      <LinkControl editor={editor} isActive={active.link} disabled={disabled} />

      {/* 7. Type Color */}
      <ColorControl editor={editor} currentColor={active.textColor} disabled={disabled} />

      <div className="rich-comment-toolbar-divider" />

      {/* 8. Checklist */}
      {btn(
        t('checklist', { defaultValue: 'Checklist' }),
        active.taskList,
        () => editor.chain().focus().toggleTaskList().run(),
        <CheckSquareOutlined />
      )}

      {/* 9. Numbered List */}
      {btn(
        t('numberedList', { defaultValue: 'Numbered list' }),
        active.orderedList,
        () => editor.chain().focus().toggleOrderedList().run(),
        <OrderedListOutlined />
      )}

      {/* 10. Unordered List */}
      {btn(
        t('unorderedList', { defaultValue: 'Bullet list' }),
        active.bulletList,
        () => editor.chain().focus().toggleBulletList().run(),
        <UnorderedListOutlined />
      )}
    </div>
  );
};

/**
 * Lets users attach or remove hyperlinks on selected text through a URL popover;
 * unsupported schemes are displayed as errors.
 *
 * @param props - Editor instance, active link status, and disabled flag
 * @returns The link control popover element
 */
const LinkControl = ({
  editor,
  isActive,
  disabled,
}: {
  editor: Editor;
  isActive: boolean;
  disabled: boolean;
}) => {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [hasError, setHasError] = useState(false);

  /**
   * Removes the link for blank input, or applies an HTTP(S)/mailto URL, adding
   * https:// when no scheme is supplied. Invalid schemes leave the popover open.
   */
  const apply = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setOpen(false);
      return;
    }
    const href = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (!SAFE_URL_REGEX.test(href)) {
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
        <div style={{ display: 'flex', gap: 6, width: 280, padding: 4 }}>
          <Input
            autoFocus
            size="small"
            value={url}
            status={hasError ? 'error' : undefined}
            aria-label={t('linkAddress', { defaultValue: 'Link URL' })}
            placeholder={t('linkPlaceholder', { defaultValue: 'https://example.com' })}
            onChange={e => {
              setUrl(e.target.value);
              setHasError(false);
            }}
            onPressEnter={apply}
          />
          <Button type="primary" size="small" onClick={apply}>
            {t('apply', { defaultValue: 'Apply' })}
          </Button>
        </div>
      }
    >
      <Tooltip title={t('link', { defaultValue: 'Link' })} placement="top">
        <Button
          type="text"
          size="small"
          disabled={disabled}
          className={isActive ? 'is-active' : ''}
          aria-label={t('link', { defaultValue: 'Link' })}
          onMouseDown={e => e.preventDefault()}
          icon={<LinkOutlined />}
        />
      </Tooltip>
    </Popover>
  );
};

/**
 * Lets users apply a preset text color or clear it with the Default palette option.
 *
 * @param props - Editor instance, active text color, and disabled flag
 * @returns The color control popover element
 */
const ColorControl = ({
  editor,
  currentColor,
  disabled,
}: {
  editor: Editor;
  currentColor: string;
  disabled: boolean;
}) => {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      trigger="click"
      placement="topLeft"
      onOpenChange={setOpen}
      content={
        <div className="rich-comment-color-palette">
          {COLOR_PALETTE.map(item => (
            <button
              key={item.key}
              type="button"
              className="rich-comment-color-btn"
              title={t(`color${item.key}`, { defaultValue: item.label })}
              style={{
                backgroundColor: item.value || 'transparent',
                borderColor: item.value ? 'transparent' : '#bfbfbf',
              }}
              onClick={() => {
                if (item.value) {
                  editor.chain().focus().setColor(item.value).run();
                } else {
                  editor.chain().focus().unsetColor().run();
                }
                setOpen(false);
              }}
            >
              {!item.value && <span style={{ fontSize: 10, color: '#8c8c8c' }}>✕</span>}
            </button>
          ))}
        </div>
      }
    >
      <Tooltip title={t('textColor', { defaultValue: 'Text color' })} placement="top">
        <Button
          type="text"
          size="small"
          disabled={disabled}
          className={currentColor ? 'is-active' : ''}
          aria-label={t('textColor', { defaultValue: 'Text color' })}
          onMouseDown={e => e.preventDefault()}
          icon={
            <FontColorsOutlined
              style={{
                color: currentColor || undefined,
              }}
            />
          }
        />
      </Tooltip>
    </Popover>
  );
};

export default RichCommentEditor;
