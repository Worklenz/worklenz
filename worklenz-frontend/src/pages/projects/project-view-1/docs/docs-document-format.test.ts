import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { ISectionDocument } from '@/types/project/project-documents.types';
import { fromEditorDocument, toEditorDocument } from './docs-document-format';
import {
  DocumentStarterKit,
  DocumentStructure,
  DocumentTaskList,
  createDocumentTaskItem,
} from './extensions/document-structure';

describe('document format compatibility', () => {
  it('round-trips every existing section, inline mark, mention, checked state, and ID', () => {
    const document: ISectionDocument = {
      version: 1,
      sections: [
        {
          id: crypto.randomUUID(),
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'A link',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }, { type: 'bold' }],
            },
            { type: 'hardBreak' },
            { type: 'memberMention', attrs: { id: crypto.randomUUID() } },
            { type: 'taskMention', attrs: { id: crypto.randomUUID() } },
          ],
        },
        ...([1, 2, 3] as const).map(level => ({
          id: crypto.randomUUID(),
          type: 'heading' as const,
          level,
          content: [{ type: 'text', text: 'Heading' }],
        })),
        { id: crypto.randomUUID(), type: 'quote', content: [{ type: 'text', text: 'Quotation' }] },
        ...(['bulletList', 'numberedList', 'checklist'] as const).map(type => ({
          id: crypto.randomUUID(),
          type,
          items: [
            {
              id: crypto.randomUUID(),
              content: [{ type: 'text', text: 'First' }],
              ...(type === 'checklist' ? { checked: true } : {}),
            },
            {
              id: crypto.randomUUID(),
              content: [],
              ...(type === 'checklist' ? { checked: false } : {}),
            },
          ],
        })),
        { id: crypto.randomUUID(), type: 'code', text: 'const count = 1;\n\nconsole.log(count);' },
        { id: crypto.randomUUID(), type: 'code', text: '' },
        { id: crypto.randomUUID(), type: 'divider' },
      ],
    };
    expect(fromEditorDocument(toEditorDocument(document))).toEqual(document);
  });

  it('opens an empty document as an editable paragraph', () => {
    expect(toEditorDocument({ version: 1, sections: [] })).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });
  });

  it('repairs duplicated IDs without changing the original block', () => {
    const id = crypto.randomUUID();
    const document = fromEditorDocument({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { id } },
        { type: 'paragraph', attrs: { id } },
      ],
    });
    expect(document.sections[0].id).toBe(id);
    expect(document.sections[1].id).not.toBe(id);
  });

  it('normalizes pasted nested and multi-paragraph content without losing text', () => {
    const editor = new Editor({
      extensions: [
        DocumentStarterKit.configure({ trailingNode: false }),
        DocumentStructure,
        DocumentTaskList,
        createDocumentTaskItem('Toggle to-do'),
      ],
      content:
        '<blockquote><p>First quote</p><p>Second quote</p></blockquote><ul><li><p>Outer</p><ul><li>Inner</li></ul><p>Last</p></li></ul>',
    });
    const saved = fromEditorDocument(editor.getJSON());
    const restored = new Editor({
      extensions: [
        DocumentStarterKit.configure({ trailingNode: false }),
        DocumentStructure,
        DocumentTaskList,
        createDocumentTaskItem('Toggle to-do'),
      ],
      content: toEditorDocument(saved),
    });
    for (const text of ['First quote', 'Second quote', 'Outer', 'Inner', 'Last']) {
      expect(restored.getText()).toContain(text);
    }
    expect(editor.schema.nodes.listItem.spec.content).toBe('paragraph');
    expect(editor.schema.nodes.blockquote.spec.content).toBe('paragraph');
    editor.destroy();
    restored.destroy();
  });
});
