import { JSONContent } from '@tiptap/core';
import {
  IDocumentNode,
  IDocumentSection,
  ISectionDocument,
} from '@/types/project/project-documents.types';

/** Keep the persisted v1 format independent of the document editor's schema. */
export const toEditorDocument = (document: ISectionDocument): JSONContent => ({
  type: 'doc',
  content: document.sections.length
    ? document.sections.map(section => {
        const attrs = { id: section.id };
        if (section.type === 'divider') return { type: 'horizontalRule', attrs };
        if (section.type === 'code')
          return {
            type: 'codeBlock',
            attrs,
            content: section.text ? [{ type: 'text', text: section.text }] : undefined,
          };
        if ('items' in section)
          return {
            type:
              section.type === 'checklist'
                ? 'taskList'
                : section.type === 'numberedList'
                  ? 'orderedList'
                  : 'bulletList',
            attrs,
            content: section.items.length
              ? section.items.map(item => ({
                  type: section.type === 'checklist' ? 'taskItem' : 'listItem',
                  attrs: {
                    id: item.id,
                    ...(section.type === 'checklist' ? { checked: item.checked === true } : {}),
                  },
                  content: [{ type: 'paragraph', content: item.content }],
                }))
              : [
                  {
                    type: section.type === 'checklist' ? 'taskItem' : 'listItem',
                    content: [{ type: 'paragraph' }],
                  },
                ],
          };
        if (section.type === 'quote')
          return {
            type: 'blockquote',
            attrs,
            content: [{ type: 'paragraph', content: section.content }],
          };
        return {
          type: section.type,
          attrs: { ...attrs, ...(section.type === 'heading' ? { level: section.level } : {}) },
          content: section.content,
        };
      })
    : [{ type: 'paragraph' }],
});

/** IDs are repaired in the editor too; this fallback also covers imported JSON. */
export const fromEditorDocument = (document: JSONContent): ISectionDocument => {
  const ids = new Set<string>();
  const nodeId = (node: JSONContent) => {
    const candidate: unknown = node.attrs?.id;
    const id =
      typeof candidate === 'string' && candidate && !ids.has(candidate)
        ? candidate
        : crypto.randomUUID();
    ids.add(id);
    return id;
  };
  const inline = (node: JSONContent): IDocumentNode[] => (node.content || []) as IDocumentNode[];
  const sections: IDocumentSection[] = (document.content || []).map(node => {
    const id = nodeId(node);
    switch (node.type) {
      case 'horizontalRule':
        return { id, type: 'divider' };
      case 'codeBlock':
        return {
          id,
          type: 'code',
          text: (node.content || []).map(child => child.text || '').join(''),
        };
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        return {
          id,
          type:
            node.type === 'taskList'
              ? 'checklist'
              : node.type === 'orderedList'
                ? 'numberedList'
                : 'bulletList',
          items: (node.content || []).map(item => ({
            id: nodeId(item),
            content: inline(item.content?.[0] || {}),
            ...(node.type === 'taskList' ? { checked: item.attrs?.checked === true } : {}),
          })),
        };
      case 'blockquote':
        return { id, type: 'quote', content: inline(node.content?.[0] || {}) };
      case 'heading':
        return {
          id,
          type: 'heading',
          level: node.attrs?.level === 2 ? 2 : node.attrs?.level === 3 ? 3 : 1,
          content: inline(node),
        };
      default:
        return { id, type: 'paragraph', content: inline(node) };
    }
  });
  return { version: 1, sections };
};
