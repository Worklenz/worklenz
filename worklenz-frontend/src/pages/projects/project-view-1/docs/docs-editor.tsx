import { Editor as TiptapEditor } from '@tiptap/core';
import {
  Alert,
  Button,
  Dropdown,
  Flex,
  Input,
  Popover,
  Tooltip,
  theme,
} from '@/shared/antd-imports';
import {
  BoldOutlined,
  ColumnWidthOutlined,
  MoreOutlined,
  ProfileOutlined,
  StarFilled,
  StarOutlined,
  CodeOutlined,
  ItalicOutlined,
  LinkOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
} from '@ant-design/icons';
import { ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { IProjectDocumentSummary, ISectionDocument } from '@/types/project/project-documents.types';

import './docs-editor.css';
import { DocsBreadcrumbs, DocsOutline } from './docs-page-navigation';
import { ToolbarButton, ToolbarDivider } from './docs-toolbar-button';
import { DocsSaveState } from './use-docs-autosave';
import { DocsDocumentEditor } from './docs-document-editor';
import { toggleDocumentList } from './docs-block-commands';
import { DocsSuggestionMenu, DocsSuggestionMenuHandle } from './docs-suggestion-menu';
import { insertMention, loadMentionItems, MentionHandlers } from './docs-mentions';

interface DocsEditorProps {
  documentId: string;
  projectId: string;
  title: string;
  content: ISectionDocument;
  saveState: DocsSaveState;
  updatedByName: string | null;
  conflictByName: string | null;
  onTitleChange: (title: string) => void;
  onContentChange: (content: ISectionDocument) => void;
  onReload: () => void;
  onRetry: () => void;
  pages?: IProjectDocumentSummary[];
  onSelectPage?: (id: string) => void;
  isFavorite?: boolean;
  isFavoriteDisabled?: boolean;
  onToggleFavorite?: () => void;
}

const DocsEditor = ({
  documentId,
  projectId,
  title,
  content,
  saveState,
  updatedByName,
  conflictByName,
  onTitleChange,
  onContentChange,
  onReload,
  onRetry,
  pages = [],
  onSelectPage,
  isFavorite = false,
  isFavoriteDisabled = false,
  onToggleFavorite,
}: DocsEditorProps) => {
  const { t } = useTranslation('project-view-docs');
  const { token } = theme.useToken();
  const mentionMenuRef = useRef<DocsSuggestionMenuHandle>(null);
  const membersRef = useRef<Array<{ id: string; name: string }>>([]);
  const activeEditorRef = useRef<TiptapEditor | null>(null);
  const [, setFormatTick] = useState(0);
  const documentEditorRef = useRef<TiptapEditor | null>(null);
  const handleReady = useCallback((next: TiptapEditor | null) => {
    documentEditorRef.current = next;
  }, []);
  const [isFullWidth, setIsFullWidth] = useState(() => {
    try {
      return localStorage.getItem('worklenz.docs.fullWidth') === 'true';
    } catch {
      return false;
    }
  });
  const outlineButtonRef = useRef<ComponentRef<typeof Button>>(null);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const toggleFullWidth = () => {
    const next = !isFullWidth;
    setIsFullWidth(next);
    try {
      localStorage.setItem('worklenz.docs.fullWidth', String(next));
    } catch {
      /* Device preferences are optional. */
    }
  };
  const navigateHeading = (id: string) => {
    const current = documentEditorRef.current;
    if (!current || current.isDestroyed) return;
    let target: number | undefined;
    current.state.doc.descendants((node, position) => {
      if (node.type.name === 'heading' && node.attrs.id === id) target = position;
    });
    if (target === undefined) return;
    setIsOutlineOpen(false);
    current
      .chain()
      .focus()
      .setTextSelection(target + 1)
      .run();
    const element = current.view.nodeDOM(target);
    if (element instanceof HTMLElement)
      element.scrollIntoView?.({ block: 'center', behavior: 'instant' });
  };
  const [isFormattingOpen, setIsFormattingOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const handlersRef = useRef<MentionHandlers>({
    mentionItems: async () => [],
    applyMention: () => undefined,
    mentionMenu: null,
  });

  useEffect(() => {
    handlersRef.current.mentionMenu = mentionMenuRef.current;
  });
  handlersRef.current.mentionItems = (query, kind) =>
    loadMentionItems(
      projectId,
      query,
      membersRef,
      t('members', { defaultValue: 'Members' }),
      t('tasks', { defaultValue: 'Tasks' }),
      kind
    );
  handlersRef.current.applyMention = insertMention;

  const editor = activeEditorRef.current?.isDestroyed ? null : activeEditorRef.current;

  const handleActivity = (next: TiptapEditor) => {
    if (!next.isFocused && activeEditorRef.current !== next) return;
    activeEditorRef.current = next;
    setFormatTick(tick => tick + 1);
  };

  const handleToggleList = (type: 'bulletList' | 'numberedList') => {
    if (editor) toggleDocumentList(editor, type);
  };

  const handleApplyLink = () => {
    const href = linkValue.trim();
    if (!editor || !/^https?:\/\//i.test(href)) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setLinkOpen(false);
  };

  const saveLabel =
    saveState === 'saving'
      ? t('saving', { defaultValue: 'Saving…' })
      : saveState === 'error'
        ? t('saveFailed', { defaultValue: "Couldn't save" })
        : saveState === 'conflict'
          ? t('conflictShort', { defaultValue: 'Needs reload' })
          : t('saved', { defaultValue: 'Saved' });

  const saveTone =
    saveState === 'error' || saveState === 'conflict'
      ? token.colorError
      : saveState === 'saving'
        ? token.colorPrimary
        : token.colorSuccess;

  const surfaceVars = {
    color: token.colorText,
    background: token.colorBgContainer,
    ['--docs-link' as string]: token.colorPrimary,
    ['--docs-text' as string]: token.colorText,
    ['--docs-muted' as string]: token.colorTextSecondary,
    ['--docs-hover' as string]: token.colorFillTertiary,
    ['--docs-active' as string]: token.colorPrimaryBg,
    ['--docs-border' as string]: token.colorBorderSecondary,
    ['--docs-surface' as string]: token.colorBgContainer,
    ['--docs-shadow' as string]: token.boxShadowSecondary,
    ['--docs-code-bg' as string]: token.colorFillSecondary,
    ['--docs-chip-bg' as string]: token.colorFillSecondary,
    ['--docs-chip-border' as string]: token.colorBorderSecondary,
  };

  return (
    <Flex
      vertical
      className="docs-prose min-h-0 min-w-0 flex-1"
      style={surfaceVars}
      data-document-id={documentId}
    >
      <Flex
        align="center"
        justify="space-between"
        gap={8}
        wrap
        className="docs-page-header shrink-0 px-4 py-2"
        style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <DocsBreadcrumbs
          pages={pages}
          documentId={documentId}
          title={title}
          onSelect={onSelectPage}
        />
        <Flex align="center" gap={4} className="docs-page-header-actions">
          <Tooltip
            title={
              updatedByName
                ? t('updatedBy', { name: updatedByName, defaultValue: 'Edited by {{name}}' })
                : t('edited', { defaultValue: 'Edited' })
            }
          >
            <span
              role="status"
              className="inline-flex items-center gap-1.5 text-xs mr-2"
              style={{
                color:
                  saveState === 'error' || saveState === 'conflict'
                    ? token.colorError
                    : token.colorTextSecondary,
              }}
            >
              <span
                className={saveState === 'saving' ? 'docs-save-dot is-saving' : 'docs-save-dot'}
                style={{ background: saveTone }}
              />
              {saveLabel}
            </span>
          </Tooltip>
          {saveState === 'error' ? (
            <Button size="small" onClick={onRetry}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          ) : null}
          {onToggleFavorite ? (
            <Tooltip
              title={
                isFavorite
                  ? t('removeFavorite', { defaultValue: 'Remove from favorites' })
                  : t('addFavorite', { defaultValue: 'Add to favorites' })
              }
            >
              <Button
                type="text"
                size="small"
                aria-label={
                  isFavorite
                    ? t('removeFavorite', { defaultValue: 'Remove from favorites' })
                    : t('addFavorite', { defaultValue: 'Add to favorites' })
                }
                aria-pressed={isFavorite}
                disabled={isFavoriteDisabled}
                icon={
                  isFavorite ? (
                    <StarFilled style={{ color: token.colorPrimary }} />
                  ) : (
                    <StarOutlined />
                  )
                }
                onClick={onToggleFavorite}
              />
            </Tooltip>
          ) : null}
          <Tooltip title={t('fullWidth', { defaultValue: 'Full width' })}>
            <Button
              type="text"
              size="small"
              aria-label={t('fullWidth', { defaultValue: 'Full width' })}
              aria-pressed={isFullWidth}
              icon={<ColumnWidthOutlined />}
              onClick={toggleFullWidth}
            />
          </Tooltip>
          <Popover
            trigger="click"
            placement="bottomRight"
            destroyOnHidden
            open={isOutlineOpen}
            onOpenChange={setIsOutlineOpen}
            content={
              <DocsOutline
                content={content}
                onSelect={navigateHeading}
                onClose={() => {
                  setIsOutlineOpen(false);
                  outlineButtonRef.current?.focus();
                }}
              />
            }
          >
            <Button
              ref={outlineButtonRef}
              type="text"
              size="small"
              aria-label={t('documentOutline', { defaultValue: 'Document outline' })}
              aria-expanded={isOutlineOpen}
              icon={<ProfileOutlined />}
            />
          </Popover>
        </Flex>
      </Flex>

      {saveState === 'conflict' ? (
        <div className="px-6 pt-3">
          <Alert
            type="warning"
            showIcon
            message={t('conflictTitle', { defaultValue: 'This page was updated' })}
            description={t('conflictDescription', {
              name: conflictByName || t('someoneElse', { defaultValue: 'someone else' }),
              defaultValue:
                '{{name}} saved a newer version. Reload to see it. Your unsaved changes stay in this tab until you reload.',
            })}
            action={
              <Button size="small" type="primary" onClick={onReload}>
                {t('reload', { defaultValue: 'Reload' })}
              </Button>
            }
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className={`docs-page-content mx-auto w-full px-8 pb-24 pt-8${isFullWidth ? ' is-full-width' : ''}`}
        >
          <Input
            className="docs-title-input"
            variant="borderless"
            value={title}
            aria-label={t('pageTitle', { defaultValue: 'Page title' })}
            onChange={event => onTitleChange(event.target.value)}
            style={{ color: token.colorText }}
          />

          <div
            className="docs-toolbar flex flex-wrap items-center gap-0.5"
            role="toolbar"
            aria-label={t('formatting', { defaultValue: 'Formatting' })}
          >
            <ToolbarButton
              label={t('bold', { defaultValue: 'Bold' })}
              active={!!editor?.isActive('bold')}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <BoldOutlined />
            </ToolbarButton>
            <ToolbarButton
              label={t('italic', { defaultValue: 'Italic' })}
              active={!!editor?.isActive('italic')}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <ItalicOutlined />
            </ToolbarButton>
            <ToolbarDivider />
            <ToolbarButton
              label={t('bulletList', { defaultValue: 'Bullet list' })}
              active={!!editor?.isActive('bulletList')}
              disabled={!editor}
              onClick={() => handleToggleList('bulletList')}
            >
              <UnorderedListOutlined />
            </ToolbarButton>
            <ToolbarButton
              label={t('numberedList', { defaultValue: 'Numbered list' })}
              active={!!editor?.isActive('orderedList')}
              disabled={!editor}
              onClick={() => handleToggleList('numberedList')}
            >
              <OrderedListOutlined />
            </ToolbarButton>
            <ToolbarDivider />
            <Popover
              open={linkOpen}
              onOpenChange={open => {
                setLinkOpen(open);
                if (open) setLinkValue(editor?.getAttributes('link').href || 'https://');
              }}
              trigger="click"
              content={
                <Flex vertical gap={8} style={{ width: 260 }}>
                  <Input
                    value={linkValue}
                    aria-label={t('linkUrl', { defaultValue: 'Link URL' })}
                    onChange={event => setLinkValue(event.target.value)}
                    onPressEnter={handleApplyLink}
                  />
                  <Button size="small" type="primary" onClick={handleApplyLink}>
                    {t('apply', { defaultValue: 'Apply' })}
                  </Button>
                </Flex>
              }
            >
              <ToolbarButton
                label={t('link', { defaultValue: 'Link' })}
                active={!!editor?.isActive('link')}
                disabled={!editor}
                onClick={() => setLinkOpen(true)}
              >
                <LinkOutlined />
              </ToolbarButton>
            </Popover>
            <Dropdown
              open={isFormattingOpen}
              onOpenChange={setIsFormattingOpen}
              trigger={['click']}
              autoFocus
              menu={{
                items: [
                  {
                    key: 'underline',
                    icon: <UnderlineOutlined aria-hidden />,
                    label: t('underline', { defaultValue: 'Underline' }),
                  },
                  {
                    key: 'strike',
                    icon: <StrikethroughOutlined aria-hidden />,
                    label: t('strike', { defaultValue: 'Strikethrough' }),
                  },
                  {
                    key: 'code',
                    icon: <CodeOutlined aria-hidden />,
                    label: t('inlineCode', { defaultValue: 'Inline code' }),
                  },
                ],
                selectedKeys: ['underline', 'strike', 'code'].filter(mark =>
                  editor?.isActive(mark)
                ),
                selectable: true,
                onClick: ({ key }) => {
                  setIsFormattingOpen(false);
                  editor?.chain().focus().toggleMark(key).run();
                },
              }}
            >
              <ToolbarButton
                label={t('moreFormatting', { defaultValue: 'More formatting' })}
                tooltipOpen={isFormattingOpen ? false : undefined}
                active={false}
                disabled={!editor}
                onClick={() => undefined}
              >
                <MoreOutlined />
              </ToolbarButton>
            </Dropdown>
          </div>

          <DocsDocumentEditor
            content={content}
            handlersRef={handlersRef}
            onChange={onContentChange}
            onActivity={handleActivity}
            onReady={handleReady}
          />
        </div>
      </div>

      <DocsSuggestionMenu
        ref={mentionMenuRef}
        ariaLabel={t('mentionMenu', { defaultValue: 'Mention a person or task' })}
      />
    </Flex>
  );
};

export default DocsEditor;
