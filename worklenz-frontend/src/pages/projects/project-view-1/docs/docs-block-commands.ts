import { Editor, JSONContent } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { closeHistory } from '@tiptap/pm/history';
import { TextSelection } from '@tiptap/pm/state';
import { useTranslation } from 'react-i18next';
import { createSection, SectionKind } from '@/types/project/project-documents.types';
import { toEditorDocument } from './docs-document-format';
import { mentionStore } from './mention-store';

export interface DocsBlockCommand {
  kind: SectionKind;
  label: string;
  keywords: string;
}

export interface DocsBlockTarget {
  id: string | null;
  position: number;
  node: ProseMirrorNode;
}

export const useDocsBlockCommands = (): DocsBlockCommand[] => {
  const { t } = useTranslation('project-view-docs');
  return [
    {
      kind: 'paragraph',
      label: t('paragraph', { defaultValue: 'Paragraph' }),
      keywords: 'text paragraph',
    },
    {
      kind: 'heading1',
      label: t('heading1', { defaultValue: 'Heading 1' }),
      keywords: 'heading title h1',
    },
    {
      kind: 'heading2',
      label: t('heading2', { defaultValue: 'Heading 2' }),
      keywords: 'heading subtitle h2',
    },
    {
      kind: 'heading3',
      label: t('heading3', { defaultValue: 'Heading 3' }),
      keywords: 'heading h3',
    },
    {
      kind: 'bulletList',
      label: t('bulletList', { defaultValue: 'Bullet list' }),
      keywords: 'bullet unordered list',
    },
    {
      kind: 'numberedList',
      label: t('numberedList', { defaultValue: 'Numbered list' }),
      keywords: 'numbered ordered list',
    },
    {
      kind: 'checklist',
      label: t('taskList', { defaultValue: 'To-do list' }),
      keywords: 'todo task checklist checkbox',
    },
    { kind: 'quote', label: t('quote', { defaultValue: 'Quote' }), keywords: 'quote blockquote' },
    { kind: 'code', label: t('code', { defaultValue: 'Code' }), keywords: 'code preformatted' },
    {
      kind: 'divider',
      label: t('divider', { defaultValue: 'Divider' }),
      keywords: 'divider horizontal rule separator',
    },
    {
      kind: 'callout',
      label: t('callout', { defaultValue: 'Callout' }),
      keywords: 'callout note info',
    },
  ];
};

export const findDocumentBlock = (
  editor: Editor,
  id?: string | null,
  position?: number
): DocsBlockTarget | null => {
  const selected = editor.state.selection.$from;
  const targetPosition = position ?? (selected.depth ? selected.before(1) : selected.pos);
  let result: DocsBlockTarget | null = null;
  editor.state.doc.forEach((node, offset) => {
    if (id ? node.attrs.id === id : offset === targetPosition)
      result = {
        id: typeof node.attrs.id === 'string' ? node.attrs.id : null,
        position: offset,
        node,
      };
  });
  return result;
};

const asParagraphs = (node: JSONContent): JSONContent[] => {
  if (['bulletList', 'orderedList', 'taskList'].includes(node.type || ''))
    return (node.content || []).flatMap(item => item.content || []);
  if (node.type === 'blockquote' || node.type === 'callout')
    return node.content || [{ type: 'paragraph' }];
  if (node.type === 'horizontalRule') return [{ type: 'paragraph' }];
  if (node.type === 'codeBlock') {
    const lines = (node.content || [])
      .map(child => child.text || '')
      .join('')
      .split('\n');
    return [
      {
        type: 'paragraph',
        content: lines.flatMap((line, index) => [
          ...(index ? [{ type: 'hardBreak' }] : []),
          ...(line ? [{ type: 'text', text: line }] : []),
        ]),
      },
    ];
  }
  return [{ ...node, type: 'paragraph' }];
};

/** Convert a whole block, preserving remaining paragraphs and nested blocks. */
export const turnBlockInto = (
  editor: Editor,
  kind: SectionKind,
  target?: DocsBlockTarget | null,
  range?: { from: number; to: number }
): boolean => {
  if (!target || editor.isDestroyed) return false;
  const transaction = closeHistory(editor.state.tr);
  if (range) transaction.delete(range.from, range.to);
  const current = transaction.doc.nodeAt(target.position);
  if (!current) return false;
  const body = asParagraphs(current.toJSON());
  const id = current.attrs.id;
  let nodes: JSONContent[];
  const desiredType = kind.startsWith('heading')
    ? 'heading'
    : (
        {
          quote: 'blockquote',
          code: 'codeBlock',
          divider: 'horizontalRule',
          numberedList: 'orderedList',
          checklist: 'taskList',
        } as Partial<Record<SectionKind, string>>
      )[kind] || kind;
  if (
    current.type.name === desiredType &&
    (desiredType !== 'heading' || current.attrs.level === Number(kind.slice(-1)))
  ) {
    nodes = [current.toJSON()];
  } else if (kind === 'divider') {
    // A divider has no text. Keep the original content beside it instead of discarding it.
    nodes = [
      { type: 'horizontalRule', attrs: { id } },
      ...(current.content.size ? body : [{ type: 'paragraph' }]),
    ];
  } else if (kind === 'code') {
    const mentions = mentionStore.get();
    const text = current.textBetween(0, current.content.size, '\n', node => {
      const entityId = String(node.attrs.id || '');
      if (node.type.name === 'memberMention')
        return `@${mentions.members[entityId]?.name || entityId}`;
      if (node.type.name === 'taskMention')
        return `#${mentions.tasks[entityId]?.task_key || entityId}`;
      return node.type.name === 'hardBreak' ? '\n' : '';
    });
    nodes = [
      { type: 'codeBlock', attrs: { id }, ...(text ? { content: [{ type: 'text', text }] } : {}) },
    ];
  } else if (kind === 'quote' || kind === 'callout') {
    nodes = [{ type: kind === 'quote' ? 'blockquote' : 'callout', attrs: { id }, content: body }];
  } else if (['bulletList', 'numberedList', 'checklist'].includes(kind)) {
    if (['bulletList', 'orderedList', 'taskList'].includes(current.type.name)) {
      const converted: JSONContent = current.toJSON();
      converted.type = desiredType;
      converted.content = converted.content?.map(item => ({
        ...item,
        type: kind === 'checklist' ? 'taskItem' : 'listItem',
      }));
      nodes = [converted];
    } else {
      const items: JSONContent[] = [];
      for (const block of body) {
        if (block.type === 'paragraph' || !items.length)
          items.push({
            type: kind === 'checklist' ? 'taskItem' : 'listItem',
            content: block.type === 'paragraph' ? [block] : [{ type: 'paragraph' }, block],
          });
        else items[items.length - 1].content?.push(block);
      }
      nodes = [
        {
          type:
            kind === 'checklist'
              ? 'taskList'
              : kind === 'numberedList'
                ? 'orderedList'
                : 'bulletList',
          attrs: { id },
          content: items,
        },
      ];
    }
  } else {
    const first = body[0] || { type: 'paragraph' };
    nodes = [
      {
        ...first,
        type: kind === 'paragraph' ? 'paragraph' : 'heading',
        attrs: { id, ...(kind !== 'paragraph' ? { level: Number(kind.slice(-1)) } : {}) },
      },
      ...body.slice(1),
    ];
  }
  const replacements = nodes.map(node => editor.schema.nodeFromJSON(node));
  if (replacements.some(node => !node.type.validContent(node.content))) return false;
  transaction.replaceWith(target.position, target.position + current.nodeSize, replacements);
  transaction.setSelection(
    TextSelection.near(
      transaction.doc.resolve(Math.min(target.position + 1, transaction.doc.content.size))
    )
  );
  editor.view.dispatch(transaction.scrollIntoView());
  editor.commands.focus();
  return true;
};

export const insertDocumentBlock = (
  editor: Editor,
  kind: SectionKind,
  target: DocsBlockTarget | null
) => {
  if (!target || editor.isDestroyed) return;
  const node = toEditorDocument({ version: 1, sections: [createSection(kind)] }).content?.[0];
  if (!node) return;
  const position = target.position + target.node.nodeSize;
  const nodes = [editor.schema.nodeFromJSON(node)];
  if (kind === 'divider' && position === editor.state.doc.content.size)
    nodes.push(editor.schema.nodes.paragraph.create());
  const transaction = closeHistory(editor.state.tr).insert(position, nodes);
  transaction.setSelection(TextSelection.near(transaction.doc.resolve(position + 1)));
  editor.view.dispatch(transaction.scrollIntoView());
  editor.commands.focus();
};

export const moveDocumentBlock = (
  editor: Editor,
  source: DocsBlockTarget,
  target: DocsBlockTarget,
  after: boolean
) => {
  if (source.position === target.position) return;
  const destination = target.position + (after ? target.node.nodeSize : 0);
  const position = destination > source.position ? destination - source.node.nodeSize : destination;
  const transaction = closeHistory(editor.state.tr)
    .delete(source.position, source.position + source.node.nodeSize)
    .insert(position, source.node);
  transaction.setSelection(
    TextSelection.near(
      transaction.doc.resolve(Math.min(position + 1, transaction.doc.content.size))
    )
  );
  editor.view.dispatch(transaction.scrollIntoView());
  editor.commands.focus();
};

/** Native regular-list commands cannot replace taskItem nodes. Convert that wrapper explicitly. */
export const toggleDocumentList = (editor: Editor, kind: 'bulletList' | 'numberedList') => {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (!['bulletList', 'orderedList', 'taskList'].includes(node.type.name)) continue;
    const desired = kind === 'numberedList' ? 'orderedList' : 'bulletList';
    if (node.type.name !== desired) {
      turnBlockInto(editor, kind, {
        node,
        position: $from.before(depth),
        id: typeof node.attrs.id === 'string' ? node.attrs.id : null,
      });
      return;
    }
    break;
  }
  if (kind === 'bulletList') editor.chain().focus().toggleBulletList().run();
  else editor.chain().focus().toggleOrderedList().run();
};
