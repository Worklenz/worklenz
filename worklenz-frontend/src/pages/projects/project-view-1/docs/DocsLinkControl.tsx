import { Editor, getMarkRange } from '@tiptap/core';
import { SelectionBookmark, TextSelection } from '@tiptap/pm/state';
import { LinkOutlined } from '@ant-design/icons';
import { Button, Flex, Input, Popover, Typography } from '@/shared/antd-imports';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ToolbarButton } from './docs-toolbar-button';
import { normalizeDocsLink } from './docs-link-utils';

interface DocsLinkControlProps {
  editor: Editor | null;
}

interface LinkPanel {
  top: number;
  left: number;
  href: string;
  text: string;
  isEditing: boolean;
}

export const DocsLinkControl = ({ editor }: DocsLinkControlProps) => {
  const { t } = useTranslation('project-view-docs');
  const [panel, setPanel] = useState<LinkPanel | null>(null);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const isPanelOpen = useRef(false);
  isPanelOpen.current = !!panel;
  const bookmark = useRef<SelectionBookmark | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<(isEditing: boolean, position?: number) => void>(() => undefined);

  const close = (restoreFocus = false) => {
    setPanel(null);
    if (restoreFocus && editor && !editor.isDestroyed && bookmark.current) {
      const selection = bookmark.current.resolve(editor.state.doc);
      editor.chain().setTextSelection({ from: selection.from, to: selection.to }).focus().run();
    }
  };

  openRef.current = (isEditing, position) => {
    if (!editor || editor.isDestroyed) return;
    const selection = editor.state.selection;
    const resolved = position === undefined ? selection.$from : editor.state.doc.resolve(position);
    const range = getMarkRange(resolved, editor.schema.marks.link);
    const from = range?.from ?? selection.from;
    const to = range?.to ?? selection.to;
    const href: unknown = range
      ? editor.state.doc.nodeAt(from)?.marks.find(mark => mark.type.name === 'link')?.attrs.href
      : '';
    const safeHref = typeof href === 'string' ? normalizeDocsLink(href) || '' : '';
    const label = editor.state.doc.textBetween(from, to, ' ');
    bookmark.current = TextSelection.create(editor.state.doc, from, to).getBookmark();
    const coords = editor.view.coordsAtPos(from);
    setPanel({
      top: coords.bottom + 6,
      left: Math.max(8, Math.min(coords.left, window.innerWidth - 336)),
      href: safeHref,
      text: label,
      isEditing: isEditing || !safeHref,
    });
    setUrl(safeHref);
    setText(label);
    setError('');
    setCopyStatus('');
  };

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const editLink = () => openRef.current(true);
    let hoverTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelHover = () => clearTimeout(hoverTimer);
    const hover = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor || isPanelOpen.current || !editor.state.selection.empty) return;
      if (event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget)) return;
      cancelHover();
      hoverTimer = setTimeout(() => {
        if (!isPanelOpen.current && !editor.isDestroyed && anchor.isConnected)
          openRef.current(false, editor.view.posAtDOM(anchor, 0));
      }, 350);
    };
    const keydown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        !event.isComposing
      ) {
        event.preventDefault();
        editLink();
      }
    };
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor || !dom.contains(anchor)) return;
      event.preventDefault();
      const href = normalizeDocsLink(anchor.getAttribute('href') || '');
      if ((event.metaKey || event.ctrlKey) && href) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      openRef.current(false, editor.view.posAtDOM(anchor, 0));
    };
    const paste = (event: ClipboardEvent) => {
      if (editor.state.selection.empty || editor.state.selection.$from.parent.type.spec.code)
        return;
      const href = normalizeDocsLink(event.clipboardData?.getData('text/plain') || '');
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      editor.chain().setLink({ href }).run();
    };
    const mapBookmark = ({
      transaction,
    }: {
      transaction: import('@tiptap/pm/state').Transaction;
    }) => {
      if (bookmark.current) bookmark.current = bookmark.current.map(transaction.mapping);
    };
    dom.addEventListener('keydown', keydown);
    dom.addEventListener('click', click);
    dom.addEventListener('mouseover', hover);
    dom.addEventListener('mouseout', cancelHover);
    dom.addEventListener('paste', paste, true);
    dom.addEventListener('docs-edit-link', editLink);
    editor.on('transaction', mapBookmark);
    return () => {
      dom.removeEventListener('keydown', keydown);
      dom.removeEventListener('click', click);
      dom.removeEventListener('mouseover', hover);
      dom.removeEventListener('mouseout', cancelHover);
      cancelHover();
      dom.removeEventListener('paste', paste, true);
      dom.removeEventListener('docs-edit-link', editLink);
      editor.off('transaction', mapBookmark);
    };
  }, [editor]);

  useEffect(() => {
    if (!panel) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) setPanel(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    };
    const dismissOnScroll = (event: Event) => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      setPanel(null);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape, true);
    document.addEventListener('scroll', dismissOnScroll, true);
    window.addEventListener('resize', dismissOnScroll);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape, true);
      document.removeEventListener('scroll', dismissOnScroll, true);
      window.removeEventListener('resize', dismissOnScroll);
    };
  }, [panel, editor]);

  const apply = () => {
    if (!editor || editor.isDestroyed || !bookmark.current || !panel) return;
    const href = normalizeDocsLink(url);
    if (!href) {
      setError(
        t('invalidLinkUrl', {
          defaultValue: 'Enter a valid web address, such as https://example.com.',
        })
      );
      return;
    }
    const selection = bookmark.current.resolve(editor.state.doc);
    const chain = editor.chain().setTextSelection({ from: selection.from, to: selection.to });
    const label = text.trim() || href;
    if (selection.empty || text !== panel.text) {
      const marks = selection.$from
        .marks()
        .filter(mark => mark.type.name !== 'link')
        .map(mark => mark.toJSON());
      chain.insertContent({
        type: 'text',
        text: label,
        marks: [...marks, { type: 'link', attrs: { href } }],
      });
    } else chain.setLink({ href });
    chain.focus().run();
    setPanel(null);
  };

  const remove = () => {
    if (!editor || editor.isDestroyed || !bookmark.current) return;
    const selection = bookmark.current.resolve(editor.state.doc);
    editor
      .chain()
      .setTextSelection({ from: selection.from, to: selection.to })
      .unsetLink()
      .focus()
      .run();
    setPanel(null);
  };

  return (
    <>
      <ToolbarButton
        label={t('link', { defaultValue: 'Link' })}
        active={!!editor?.isActive('link')}
        disabled={!editor}
        onClick={() => openRef.current(true)}
      >
        <LinkOutlined />
      </ToolbarButton>
      {panel
        ? createPortal(
            <Popover
              open
              placement="bottomLeft"
              content={
                <div
                  ref={panelRef}
                  role="dialog"
                  aria-label={t('link', { defaultValue: 'Link' })}
                  style={{ width: 'min(304px, calc(100vw - 48px))' }}
                >
                  {panel.isEditing ? (
                    <form
                      onSubmit={event => {
                        event.preventDefault();
                        apply();
                      }}
                    >
                      <Flex vertical gap={8}>
                        <label>
                          {t('linkText', { defaultValue: 'Text to display' })}
                          <Input value={text} onChange={event => setText(event.target.value)} />
                        </label>
                        <label>
                          {t('linkUrl', { defaultValue: 'Link URL' })}
                          <Input
                            autoFocus
                            value={url}
                            status={error ? 'error' : undefined}
                            aria-invalid={!!error}
                            onChange={event => {
                              setUrl(event.target.value);
                              setError('');
                            }}
                          />
                        </label>
                        {error ? (
                          <Typography.Text type="danger" role="alert">
                            {error}
                          </Typography.Text>
                        ) : null}
                        <Flex gap={8} justify="end">
                          <Button size="small" onClick={() => close(true)}>
                            {t('cancel', { defaultValue: 'Cancel' })}
                          </Button>
                          <Button size="small" type="primary" htmlType="submit">
                            {t('apply', { defaultValue: 'Apply' })}
                          </Button>
                        </Flex>
                      </Flex>
                    </form>
                  ) : (
                    <Flex vertical gap={8}>
                      <Typography.Link
                        href={panel.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        {panel.href}
                      </Typography.Link>
                      <Flex gap={4} wrap>
                        <Button
                          size="small"
                          onClick={() => setPanel({ ...panel, isEditing: true })}
                        >
                          {t('editLink', { defaultValue: 'Edit link' })}
                        </Button>
                        <Button
                          size="small"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(panel.href);
                              setCopyStatus(t('linkCopied', { defaultValue: 'Link copied' }));
                            } catch {
                              setCopyStatus(
                                t('linkCopyFailed', {
                                  defaultValue: 'Could not copy. Select the address to copy it.',
                                })
                              );
                            }
                          }}
                        >
                          {t('copyLink', { defaultValue: 'Copy link' })}
                        </Button>
                        <Button size="small" onClick={remove}>
                          {t('removeLink', { defaultValue: 'Remove link' })}
                        </Button>
                      </Flex>
                      {copyStatus ? (
                        <Typography.Text role="status">{copyStatus}</Typography.Text>
                      ) : null}
                    </Flex>
                  )}
                </div>
              }
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'fixed',
                  top: panel.top,
                  left: panel.left,
                  width: 1,
                  height: 1,
                  pointerEvents: 'none',
                }}
              />
            </Popover>,
            document.body
          )
        : null}
    </>
  );
};
