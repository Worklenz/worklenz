import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { ISectionDocument } from '@/types/project/project-documents.types';
import { fromEditorDocument, toEditorDocument } from './docs-document-format';
import {
  DocumentStarterKit,
  DocumentStructure,
  DocumentTaskList,
  DocumentCallout,
  createDocumentTaskItem,
} from './extensions/document-structure';

describe('document format compatibility', () => {
  it('round-trips nested mixed lists, multi-paragraph containers, numbering, code language and callouts', () => {
    const extensions = [
      DocumentStarterKit.configure({ trailingNode: false }),
      DocumentStructure,
      DocumentTaskList,
      DocumentCallout,
      createDocumentTaskItem('Toggle to-do'),
    ];
    const editor = new Editor({
      extensions,
      content:
        '<aside data-type="callout"><p>Note</p><blockquote><p>First</p><p>Second</p></blockquote><ul><li><p>Parent</p><ol start="3"><li><p>Nested</p><p>More details</p></li></ol></li></ul><pre><code class="language-typescript">const a = 1;</code></pre></aside>',
    });
    editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph' });
    const saved = fromEditorDocument(editor.getJSON());
    expect(saved.version).toBe(2);
    expect(saved.sections[0]).toMatchObject({
      type: 'callout',
      children: [
        expect.objectContaining({
          type: 'quote',
          children: [expect.objectContaining({ type: 'paragraph' })],
        }),
        expect.objectContaining({ type: 'bulletList' }),
        expect.objectContaining({ type: 'code', language: 'typescript' }),
      ],
    });
    const restored = new Editor({ extensions, content: toEditorDocument(saved) });
    expect(fromEditorDocument(restored.getJSON())).toEqual(saved);
    expect(restored.view.dom.querySelector('ol')).toHaveAttribute('start', '3');
    expect(restored.getHTML()).toContain('More details');
    editor.destroy();
    restored.destroy();
  });

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
    expect(editor.schema.nodes.listItem.spec.content).toBe('paragraph block*');
    expect(editor.schema.nodes.blockquote.spec.content).toBe('paragraph block*');
    expect(saved.version).toBe(2);
    expect(restored.getHTML()).toContain('<ul');
    editor.destroy();
    restored.destroy();
  });
});
