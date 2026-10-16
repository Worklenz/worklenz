import { describe, expect, it } from 'vitest';
import { IDocumentNode, ISectionDocument } from '@/types/project/project-documents.types';
import { findFormattingSection, toggleSectionList } from './docs-formatting';

const inlineContent: IDocumentNode[] = [
  { type: 'text', text: 'Project goals', marks: [{ type: 'bold' }, { type: 'italic' }] },
  { type: 'memberMention', attrs: { id: 'member-1' } },
  { type: 'taskMention', attrs: { id: 'task-1' } },
];

const paragraph: ISectionDocument = {
  version: 1,
  sections: [{ id: 'section-1', type: 'paragraph', content: inlineContent }],
};

const list: ISectionDocument = {
  version: 1,
  sections: [{ id: 'section-1', type: 'bulletList', items: [
    { id: 'item-1', content: inlineContent },
    { id: 'item-2', content: [{ type: 'text', text: 'Next goal' }] },
  ] }],
};

describe('document list formatting', () => {
  it.each(['bulletList', 'numberedList'] as const)('converts a paragraph to %s without losing marks or mentions', type => {
    const result = toggleSectionList(paragraph, 'section-1', type);
    expect(result.sections).toEqual([
      { id: 'section-1', type, items: [{ id: 'section-1', content: inlineContent }] },
    ]);
    expect(paragraph.sections[0].type).toBe('paragraph');
  });

  it('switches the whole list to numbered format from any item', () => {
    const result = toggleSectionList(list, 'item-2', 'numberedList');
    expect(result.sections[0]).toEqual({ ...list.sections[0], type: 'numberedList' });
    expect(list.sections[0].type).toBe('bulletList');
  });

  it('toggles a list back to paragraphs, preserving order, content and focus IDs', () => {
    expect(toggleSectionList(list, 'item-2', 'bulletList').sections).toEqual([
      { id: 'item-1', type: 'paragraph', content: inlineContent },
      { id: 'item-2', type: 'paragraph', content: [{ type: 'text', text: 'Next goal' }] },
    ]);
  });

  it('keeps surrounding sections in order and unchanged', () => {
    const document: ISectionDocument = {
      version: 1,
      sections: [
        { id: 'before', type: 'divider' },
        ...list.sections,
        { id: 'after', type: 'code', text: 'const value = 1;' },
      ],
    };
    const result = toggleSectionList(document, 'item-1', 'bulletList');
    expect(result.sections.map(section => section.id)).toEqual(['before', 'item-1', 'item-2', 'after']);
    expect(result.sections[0]).toBe(document.sections[0]);
    expect(result.sections[3]).toBe(document.sections[2]);
  });

  it('supports empty paragraphs and a round trip through list formatting', () => {
    const empty: ISectionDocument = { version: 1, sections: [{ id: 'empty', type: 'paragraph', content: [] }] };
    const result = toggleSectionList(empty, 'empty', 'numberedList');
    expect(toggleSectionList(result, 'empty', 'numberedList')).toEqual(empty);
  });

  it('ignores missing fields and sections that cannot be formatted as lists', () => {
    const document: ISectionDocument = { version: 1, sections: [{ id: 'code', type: 'code', text: 'code' }] };
    expect(toggleSectionList(document, 'code', 'bulletList')).toBe(document);
    expect(toggleSectionList(paragraph, 'missing', 'bulletList')).toBe(paragraph);
    expect(findFormattingSection(list.sections, 'item-2')).toBe(list.sections[0]);
    expect(findFormattingSection(list.sections, null)).toBeUndefined();
  });
});
