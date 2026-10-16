import { Editor as TiptapEditor } from '@tiptap/core';
import { Alert, Button, Flex, Input, Popover, Typography, theme } from '@/shared/antd-imports';
import {
  BoldOutlined,
  CodeOutlined,
  ItalicOutlined,
  LinkOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
} from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ISectionDocument } from '@/types/project/project-documents.types';

import './docs-editor.css';
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
}: DocsEditorProps) => {
  const { t } = useTranslation('project-view-docs');
  const { token } = theme.useToken();
  const mentionMenuRef = useRef<DocsSuggestionMenuHandle>(null);
  const membersRef = useRef<Array<{ id: string; name: string }>>([]);
  const activeEditorRef = useRef<TiptapEditor | null>(null);
  const [, setFormatTick] = useState(0);
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
    <Flex vertical className="docs-prose min-h-0 min-w-0 flex-1" style={surfaceVars} data-document-id={documentId}>
      <Flex
        align="center"
        className="h-11 shrink-0"
        style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Flex align="center" justify="space-between" gap={12} className="mx-auto h-full w-full max-w-[760px] px-8">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {updatedByName
              ? t('updatedBy', { name: updatedByName, defaultValue: 'Edited by {{name}}' })
              : t('edited', { defaultValue: 'Edited' })}
          </Typography.Text>
          <Flex align="center" gap={8}>
            {saveState === 'error' ? (
              <Button size="small" onClick={onRetry}>
                {t('retry', { defaultValue: 'Retry' })}
              </Button>
            ) : null}
            <span
              className="inline-flex items-center gap-1.5 text-xs"
              style={{ color: saveState === 'error' || saveState === 'conflict' ? token.colorError : token.colorTextSecondary }}
            >
              <span className={saveState === 'saving' ? 'docs-save-dot is-saving' : 'docs-save-dot'} style={{ background: saveTone }} />
              {saveLabel}
            </span>
          </Flex>
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
              defaultValue: '{{name}} saved a newer version. Reload to see it. Your unsaved changes stay in this tab until you reload.',
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
        <div className="docs-page-content mx-auto w-full max-w-[760px] px-8 pb-24 pt-8">
          <Input
            className="docs-title-input"
            variant="borderless"
            value={title}
            aria-label={t('pageTitle', { defaultValue: 'Page title' })}
            onChange={event => onTitleChange(event.target.value)}
            style={{ color: token.colorText }}
          />

          <div className="docs-toolbar flex flex-wrap items-center gap-0.5" role="toolbar" aria-label={t('formatting', { defaultValue: 'Formatting' })}>
            <ToolbarButton label={t('bold', { defaultValue: 'Bold' })} active={!!editor?.isActive('bold')} disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()}>
              <BoldOutlined />
            </ToolbarButton>
            <ToolbarButton label={t('italic', { defaultValue: 'Italic' })} active={!!editor?.isActive('italic')} disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()}>
              <ItalicOutlined />
            </ToolbarButton>
            <ToolbarButton label={t('underline', { defaultValue: 'Underline' })} active={!!editor?.isActive('underline')} disabled={!editor} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
              <UnderlineOutlined />
            </ToolbarButton>
            <ToolbarButton label={t('strike', { defaultValue: 'Strikethrough' })} active={!!editor?.isActive('strike')} disabled={!editor} onClick={() => editor?.chain().focus().toggleStrike().run()}>
              <StrikethroughOutlined />
            </ToolbarButton>
            <ToolbarButton label={t('inlineCode', { defaultValue: 'Inline code' })} active={!!editor?.isActive('code')} disabled={!editor} onClick={() => editor?.chain().focus().toggleCode().run()}>
              <CodeOutlined />
            </ToolbarButton>
            <ToolbarDivider />
            <ToolbarButton label={t('bulletList', { defaultValue: 'Bullet list' })} active={!!editor?.isActive('bulletList')} disabled={!editor} onClick={() => handleToggleList('bulletList')}>
              <UnorderedListOutlined />
            </ToolbarButton>
            <ToolbarButton label={t('numberedList', { defaultValue: 'Numbered list' })} active={!!editor?.isActive('orderedList')} disabled={!editor} onClick={() => handleToggleList('numberedList')}>
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
              <ToolbarButton label={t('link', { defaultValue: 'Link' })} active={!!editor?.isActive('link')} disabled={!editor} onClick={() => setLinkOpen(true)}>
                <LinkOutlined />
              </ToolbarButton>
            </Popover>
          </div>

          <DocsDocumentEditor
            content={content}
            handlersRef={handlersRef}
            onChange={onContentChange}
            onActivity={handleActivity}
          />
        </div>
      </div>

      <DocsSuggestionMenu ref={mentionMenuRef} ariaLabel={t('mentionMenu', { defaultValue: 'Mention a person or task' })} />
    </Flex>
  );
};

export default DocsEditor;
