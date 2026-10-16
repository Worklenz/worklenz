import { Editor as TiptapEditor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { Alert, Button, Dropdown, Flex, Input, Modal, Popover, Typography, theme } from '@/shared/antd-imports';
import {
  BoldOutlined,
  MoreOutlined,
  PlusOutlined,
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

import { createSection, ISectionDocument, SectionKind } from '@/types/project/project-documents.types';

import './docs-editor.css';
import { ToolbarButton, ToolbarDivider } from './docs-toolbar-button';
import { DocsSaveState } from './use-docs-autosave';
import { DocsDocumentEditor } from './docs-document-editor';
import { toEditorDocument } from './docs-document-format';
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
    if (type === 'bulletList') editor?.chain().focus().toggleBulletList().run();
    else editor?.chain().focus().toggleOrderedList().run();
  };

  const blockKinds: Array<{ key: SectionKind; label: string }> = [
    { key: 'paragraph', label: t('paragraph', { defaultValue: 'Paragraph' }) },
    { key: 'heading1', label: t('heading1', { defaultValue: 'Heading 1' }) },
    { key: 'heading2', label: t('heading2', { defaultValue: 'Heading 2' }) },
    { key: 'heading3', label: t('heading3', { defaultValue: 'Heading 3' }) },
    { key: 'bulletList', label: t('bulletList', { defaultValue: 'Bullet list' }) },
    { key: 'numberedList', label: t('numberedList', { defaultValue: 'Numbered list' }) },
    { key: 'checklist', label: t('taskList', { defaultValue: 'To-do list' }) },
    { key: 'quote', label: t('quote', { defaultValue: 'Quote' }) },
    { key: 'code', label: t('code', { defaultValue: 'Code' }) },
    { key: 'divider', label: t('divider', { defaultValue: 'Divider' }) },
  ];

  const insertBlock = (key: string) => {
    const kind = blockKinds.find(item => item.key === key)?.key;
    if (!editor || !kind) return;
    const { $from } = editor.state.selection;
    const position = $from.depth ? $from.after(1) : $from.pos + ($from.nodeAfter?.nodeSize || 0);
    const node = toEditorDocument({ version: 1, sections: [createSection(kind)] }).content?.[0];
    if (!node) return;
    editor.chain().focus().insertContentAt(position, node, { updateSelection: true }).run();
  };

  const blockAction = (action: string) => {
    if (!editor) return;
    const { $from } = editor.state.selection;
    const position = $from.depth ? $from.before(1) : $from.pos;
    const node = editor.state.doc.nodeAt(position);
    if (!node) return;
    const end = position + node.nodeSize;
    if (action === 'duplicate') editor.chain().focus().insertContentAt(end, node.toJSON()).run();
    if (action === 'moveUp' && position > 0) {
      const previous = editor.state.doc.resolve(position).nodeBefore;
      if (previous) {
        const transaction = editor.state.tr.delete(position, end).insert(position - previous.nodeSize, node);
        transaction.setSelection(TextSelection.near(transaction.doc.resolve(position - previous.nodeSize)));
        editor.view.dispatch(transaction.scrollIntoView());
        editor.commands.focus();
      }
    }
    if (action === 'moveDown' && end < editor.state.doc.content.size) {
      const next = editor.state.doc.nodeAt(end);
      if (next) {
        const transaction = editor.state.tr.delete(position, end).insert(position + next.nodeSize, node);
        transaction.setSelection(TextSelection.near(transaction.doc.resolve(position + next.nodeSize)));
        editor.view.dispatch(transaction.scrollIntoView());
        editor.commands.focus();
      }
    }
    if (action === 'delete') Modal.confirm({
      title: t('deleteBlockConfirm', { defaultValue: 'Delete this block?' }),
      okText: t('delete', { defaultValue: 'Delete' }), cancelText: t('cancel', { defaultValue: 'Cancel' }), okButtonProps: { danger: true },
      onOk: () => {
        if (!editor.isDestroyed) editor.chain().focus().deleteRange({ from: position, to: end }).run();
      },
    });
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
            <ToolbarDivider />
            <Dropdown trigger={['click']} menu={{ items: blockKinds, onClick: ({ key }) => insertBlock(key) }} disabled={!editor}>
              <button type="button" className="docs-tool-btn" disabled={!editor} aria-label={t('slashMenu', { defaultValue: 'Insert block' })} onMouseDown={event => event.preventDefault()}><PlusOutlined /></button>
            </Dropdown>
            <Dropdown trigger={['click']} disabled={!editor} menu={{
              items: [
                { key: 'duplicate', label: t('duplicate', { defaultValue: 'Duplicate' }) },
                { key: 'moveUp', label: t('moveUp', { defaultValue: 'Move up' }) },
                { key: 'moveDown', label: t('moveDown', { defaultValue: 'Move down' }) },
                { key: 'delete', label: t('delete', { defaultValue: 'Delete' }), danger: true },
              ],
              onClick: ({ key }) => blockAction(key),
            }}>
              <button type="button" className="docs-tool-btn" disabled={!editor} aria-label={t('blockActions', { defaultValue: 'Block actions' })} onMouseDown={event => event.preventDefault()}><MoreOutlined /></button>
            </Dropdown>
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
