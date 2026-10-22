import { Editor, Node } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { ISectionDocument, SectionKind } from '@/types/project/project-documents.types';
import { findDocumentBlock, turnBlockInto, toggleDocumentList } from './docs-block-commands';
import { fromEditorDocument, toEditorDocument } from './docs-document-format';
import {
  DocumentStarterKit,
  DocumentStructure,
  DocumentTaskList,
  DocumentCallout,
  createDocumentTaskItem,
} from './extensions/document-structure';

const editors: Editor[] = [];
const createEditor = (content: ISectionDocument) => {
  const editor = new Editor({
    extensions: [
      DocumentStarterKit.configure({ trailingNode: false }),
      DocumentStructure,
      DocumentTaskList,
      DocumentCallout,
      createDocumentTaskItem('Toggle to-do'),
      ...['memberMention', 'taskMention'].map(name =>
        Node.create({
          name,
          group: 'inline',
          inline: true,
          atom: true,
          addAttributes: () => ({ id: { default: null } }),
          renderHTML: ({ HTMLAttributes }) => ['span', HTMLAttributes],
        })
      ),
    ],
    content: toEditorDocument(content),
  });
  editors.push(editor);
  return editor;
};
afterEach(() => {
  editors.splice(0).forEach(editor => editor.destroy());
});

describe('block conversions', () => {
  it('preserves inline marks, mention IDs and block identity through text, list and container conversions', () => {
    const id = crypto.randomUUID();
    const content = [
      { type: 'text', text: 'Formatted ', marks: [{ type: 'bold' }] },
      { type: 'memberMention', attrs: { id: crypto.randomUUID() } },
      { type: 'taskMention', attrs: { id: crypto.randomUUID() } },
    ];
    const editor = createEditor({ version: 1, sections: [{ id, type: 'paragraph', content }] });
    for (const kind of [
      'heading2',
      'quote',
      'callout',
      'bulletList',
      'numberedList',
      'checklist',
      'heading3',
      'paragraph',
    ] as SectionKind[]) {
      expect(turnBlockInto(editor, kind, findDocumentBlock(editor, id))).toBe(true);
      const saved = fromEditorDocument(editor.getJSON());
      const block = saved.sections[0];
      expect(block.id).toBe(id);
      expect(
        'items' in block ? block.items[0].content : 'content' in block ? block.content : []
      ).toEqual(content);
    }
  });

  it('keeps all paragraphs and nested children when converting containers or list types', () => {
    const id = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const editor = createEditor({
      version: 2,
      sections: [
        {
          id,
          type: 'checklist',
          items: [
            {
              id: itemId,
              checked: true,
              content: [{ type: 'text', text: 'Parent' }],
              children: [
                {
                  id: crypto.randomUUID(),
                  type: 'numberedList',
                  start: 4,
                  items: [{ id: crypto.randomUUID(), content: [{ type: 'text', text: 'Nested' }] }],
                },
                {
                  id: crypto.randomUUID(),
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Extra paragraph' }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(turnBlockInto(editor, 'checklist', findDocumentBlock(editor, id))).toBe(true);
    expect(fromEditorDocument(editor.getJSON()).sections[0]).toMatchObject({
      type: 'checklist',
      items: [{ id: itemId, checked: true }],
    });
    toggleDocumentList(editor, 'bulletList');
    expect(fromEditorDocument(editor.getJSON()).sections[0]).toMatchObject({
      type: 'bulletList',
      items: [
        {
          id: itemId,
          children: [
            expect.objectContaining({ type: 'numberedList', start: 4 }),
            expect.objectContaining({ type: 'paragraph' }),
          ],
        },
      ],
    });
    expect(turnBlockInto(editor, 'quote', findDocumentBlock(editor, id))).toBe(true);
    expect(editor.getText()).toContain('Nested');
    expect(editor.getText()).toContain('Extra paragraph');
    expect(turnBlockInto(editor, 'heading1', findDocumentBlock(editor, id))).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe('heading');
    expect(editor.getText()).toContain('Extra paragraph');
  });

  it('retains text beside a divider and preserves line breaks through code conversion', () => {
    const id = crypto.randomUUID();
    const editor = createEditor({
      version: 1,
      sections: [{ id, type: 'code', text: 'first\nsecond' }],
    });
    expect(turnBlockInto(editor, 'paragraph', findDocumentBlock(editor, id))).toBe(true);
    expect(turnBlockInto(editor, 'code', findDocumentBlock(editor, id))).toBe(true);
    expect(fromEditorDocument(editor.getJSON()).sections[0]).toMatchObject({
      type: 'code',
      text: 'first\nsecond',
    });
    expect(turnBlockInto(editor, 'divider', findDocumentBlock(editor, id))).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe('horizontalRule');
    expect(editor.getText()).toContain('second');
  });
});
