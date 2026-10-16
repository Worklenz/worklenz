import { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { Dropdown, Modal } from '@/shared/antd-imports';
import { HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DocsBlockCommand,
  DocsBlockTarget,
  findDocumentBlock,
  insertDocumentBlock,
  moveDocumentBlock,
  turnBlockInto,
} from './docs-block-commands';

export const BLOCK_DRAG_TYPE = 'application/x-worklenz-doc-block';

interface DocsBlockControlsProps {
  editor: Editor;
  containerRef: RefObject<HTMLDivElement | null>;
  commands: DocsBlockCommand[];
}

interface ControlPosition {
  id: string | null;
  position: number;
  top: number;
}

export const DocsBlockControls = ({ editor, containerRef, commands }: DocsBlockControlsProps) => {
  const { t } = useTranslation('project-view-docs');
  const [dragSession] = useState(() => crypto.randomUUID());
  const [hasOpenMenu, setHasOpenMenu] = useState(false);
  const [anchor, setAnchor] = useState<ControlPosition | null>(null);
  const anchorRef = useRef<ControlPosition | null>(null);
  const isMenuOpen = useRef(false);
  const refreshAnchorRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const publish = (block: DocsBlockTarget | null) => {
      if (!block) return;
      const element = editor.view.nodeDOM(block.position);
      if (!(element instanceof HTMLElement)) return;
      const next = {
        id: block.id,
        position: block.position,
        top: element.getBoundingClientRect().top - container.getBoundingClientRect().top,
      };
      anchorRef.current = next;
      setAnchor(previous =>
        previous &&
        previous.id === next.id &&
        previous.position === next.position &&
        previous.top === next.top
          ? previous
          : next
      );
    };
    const fromElement = (element: EventTarget | null) => {
      if (!(element instanceof HTMLElement)) return null;
      let block = element;
      while (block.parentElement && block.parentElement !== editor.view.dom)
        block = block.parentElement;
      if (block.parentElement !== editor.view.dom) return null;
      const position = editor.view.posAtDOM(block, 0);
      const resolved = editor.state.doc.resolve(position);
      return findDocumentBlock(editor, null, resolved.depth ? resolved.before(1) : position);
    };
    const hover = (event: PointerEvent) => {
      if (!isMenuOpen.current) publish(fromElement(event.target));
    };
    const keyboardMenu = (event: KeyboardEvent) => {
      if (event.key !== 'F10' || !event.shiftKey || event.isComposing) return;
      event.preventDefault();
      active();
      const handle = container.querySelector<HTMLButtonElement>('.docs-drag-handle');
      handle?.focus();
      handle?.click();
    };
    const active = () => {
      const previous = anchorRef.current;
      publish(
        isMenuOpen.current && previous
          ? findDocumentBlock(editor, previous.id, previous.position)
          : findDocumentBlock(editor)
      );
    };
    refreshAnchorRef.current = active;
    let dropElement: HTMLElement | null = null;
    const clearDrop = () => {
      dropElement?.removeAttribute('data-docs-drop');
      dropElement = null;
    };
    const dragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(BLOCK_DRAG_TYPE)) return;
      const block = fromElement(event.target);
      if (!block) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      clearDrop();
      const element = editor.view.nodeDOM(block.position);
      if (element instanceof HTMLElement) {
        const bounds = element.getBoundingClientRect();
        element.dataset.docsDrop =
          event.clientY > bounds.top + bounds.height / 2 ? 'after' : 'before';
        dropElement = element;
      }
    };
    const drop = (event: DragEvent) => {
      const payload = event.dataTransfer?.getData(BLOCK_DRAG_TYPE);
      if (!payload) return;
      event.preventDefault();
      event.stopPropagation();
      clearDrop();
      let sourceId: string;
      try {
        const data: unknown = JSON.parse(payload);
        if (
          !data ||
          typeof data !== 'object' ||
          !('session' in data) ||
          data.session !== dragSession ||
          !('blockId' in data) ||
          typeof data.blockId !== 'string'
        )
          return;
        sourceId = data.blockId;
      } catch {
        return;
      }
      const source = findDocumentBlock(editor, sourceId);
      const target = fromElement(event.target);
      const element = target ? editor.view.nodeDOM(target.position) : null;
      const bounds = element instanceof HTMLElement ? element.getBoundingClientRect() : null;
      if (source && target && bounds)
        moveDocumentBlock(editor, source, target, event.clientY > bounds.top + bounds.height / 2);
      clearDrop();
    };
    container.addEventListener('pointermove', hover);
    editor.view.dom.addEventListener('keydown', keyboardMenu);
    container.addEventListener('dragover', dragOver, true);
    // Capture before ProseMirror's generic HTML drop handler.
    container.addEventListener('drop', drop, true);
    container.addEventListener('dragend', clearDrop);
    editor.on('focus', active);
    editor.on('selectionUpdate', active);
    editor.on('transaction', active);
    window.addEventListener('resize', active);
    const observer = new ResizeObserver(active);
    observer.observe(container);
    active();
    return () => {
      container.removeEventListener('pointermove', hover);
      editor.view.dom.removeEventListener('keydown', keyboardMenu);
      container.removeEventListener('dragover', dragOver, true);
      container.removeEventListener('drop', drop, true);
      container.removeEventListener('dragend', clearDrop);
      editor.off('focus', active);
      editor.off('selectionUpdate', active);
      editor.off('transaction', active);
      window.removeEventListener('resize', active);
      observer.disconnect();
      clearDrop();
    };
  }, [editor, containerRef, dragSession]);

  const target = () =>
    anchorRef.current
      ? findDocumentBlock(editor, anchorRef.current.id, anchorRef.current.position)
      : findDocumentBlock(editor);
  const menuOpen = (open: boolean) => {
    isMenuOpen.current = open;
    setHasOpenMenu(open);
    if (!open)
      queueMicrotask(() => {
        if (!editor.isDestroyed) refreshAnchorRef.current();
      });
  };
  const action = (key: string) => {
    const block = target();
    if (!block) return;
    if (key.startsWith('turn:')) {
      const command = commands.find(item => item.kind === key.slice(5));
      if (command) turnBlockInto(editor, command.kind, block);
    } else if (key === 'duplicate') {
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          closeHistory(tr);
          return true;
        })
        .insertContentAt(block.position + block.node.nodeSize, block.node.toJSON())
        .run();
    } else if (key === 'moveUp') {
      const previous = editor.state.doc.resolve(block.position).nodeBefore;
      if (previous) {
        const destination = findDocumentBlock(editor, null, block.position - previous.nodeSize);
        if (destination) moveDocumentBlock(editor, block, destination, false);
      }
    } else if (key === 'moveDown') {
      const destination = findDocumentBlock(editor, null, block.position + block.node.nodeSize);
      if (destination) moveDocumentBlock(editor, block, destination, true);
    } else if (key === 'delete') {
      Modal.confirm({
        title: t('deleteBlockConfirm', { defaultValue: 'Delete this block?' }),
        okText: t('delete', { defaultValue: 'Delete' }),
        cancelText: t('cancel', { defaultValue: 'Cancel' }),
        okButtonProps: { danger: true },
        onOk: () => {
          if (editor.isDestroyed) return;
          const current = findDocumentBlock(editor, block.id, block.position);
          if (current)
            editor
              .chain()
              .focus()
              .command(({ tr }) => {
                closeHistory(tr);
                return true;
              })
              .deleteRange({ from: current.position, to: current.position + current.node.nodeSize })
              .run();
        },
        onCancel: () => {
          if (!editor.isDestroyed) editor.commands.focus();
        },
      });
    }
  };

  return (
    <div
      className="docs-block-controls"
      data-open={hasOpenMenu}
      style={{ top: anchor?.top || 0 }}
      role="group"
      aria-label={t('blockControls', { defaultValue: 'Block controls' })}
    >
      <Dropdown
        autoFocus
        trigger={['click']}
        onOpenChange={menuOpen}
        menu={{
          items: commands.map(command => ({ key: command.kind, label: command.label })),
          onClick: ({ key }) => {
            const command = commands.find(item => item.kind === key);
            if (command) insertDocumentBlock(editor, command.kind, target());
          },
        }}
      >
        <button
          type="button"
          className="docs-tool-btn"
          aria-label={t('slashMenu', { defaultValue: 'Insert block' })}
          onMouseDown={event => event.preventDefault()}
        >
          <PlusOutlined />
        </button>
      </Dropdown>
      <Dropdown
        autoFocus
        trigger={['click']}
        onOpenChange={menuOpen}
        menu={{
          items: [
            {
              key: 'turnInto',
              label: t('turnInto', { defaultValue: 'Turn into' }),
              children: commands.map(command => ({
                key: `turn:${command.kind}`,
                label: command.label,
              })),
            },
            { key: 'duplicate', label: t('duplicate', { defaultValue: 'Duplicate' }) },
            {
              key: 'moveUp',
              label: t('moveUp', { defaultValue: 'Move up' }),
              disabled: anchor?.position === 0,
            },
            {
              key: 'moveDown',
              label: t('moveDown', { defaultValue: 'Move down' }),
              disabled:
                !!anchor &&
                anchor.position + (target()?.node.nodeSize || 0) === editor.state.doc.content.size,
            },
            { type: 'divider' },
            { key: 'delete', label: t('delete', { defaultValue: 'Delete' }), danger: true },
          ],
          onClick: ({ key }) => action(key),
        }}
      >
        <button
          type="button"
          draggable
          className="docs-tool-btn docs-drag-handle"
          aria-label={t('blockActions', { defaultValue: 'Block actions' })}
          title={t('dragBlock', { defaultValue: 'Drag to reorder or click for block actions' })}
          onDragStart={event => {
            const block = target();
            if (!block?.id) {
              event.preventDefault();
              return;
            }
            event.dataTransfer.setData(
              BLOCK_DRAG_TYPE,
              JSON.stringify({ session: dragSession, blockId: block.id })
            );
            event.dataTransfer.effectAllowed = 'move';
          }}
        >
          <HolderOutlined />
        </button>
      </Dropdown>
    </div>
  );
};
