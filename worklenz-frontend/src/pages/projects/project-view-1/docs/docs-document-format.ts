import { JSONContent } from '@tiptap/core';
import {
  IDocumentNode,
  IDocumentSection,
  ISectionDocument,
} from '@/types/project/project-documents.types';

/** Keep the persisted section format (v1 or v2) independent of the document editor's schema. */
export const toEditorDocument = (document: ISectionDocument): JSONContent => ({
  type: 'doc',
  content: document.sections.length
    ? document.sections.map(sectionToEditorNode)
    : [{ type: 'paragraph' }],
});

const sectionToEditorNode = (section: IDocumentSection): JSONContent => {
  const attrs = { id: section.id };
  if (section.type === 'divider') return { type: 'horizontalRule', attrs };
  if (section.type === 'code')
    return {
      type: 'codeBlock',
      attrs: { ...attrs, ...(section.language ? { language: section.language } : {}) },
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
      attrs: { ...attrs, ...(section.start ? { start: section.start } : {}) },
      content: section.items.length
        ? section.items.map(item => ({
            type: section.type === 'checklist' ? 'taskItem' : 'listItem',
            attrs: {
              id: item.id,
              ...(section.type === 'checklist' ? { checked: item.checked === true } : {}),
            },
            content: [
              { type: 'paragraph', content: item.content },
              ...(item.children || []).map(sectionToEditorNode),
            ],
          }))
        : [
            {
              type: section.type === 'checklist' ? 'taskItem' : 'listItem',
              content: [{ type: 'paragraph' }],
            },
          ],
    };
  if (section.type === 'quote' || section.type === 'callout')
    return {
      type: section.type === 'callout' ? 'callout' : 'blockquote',
      attrs,
      content: [
        { type: 'paragraph', content: section.content },
        ...(section.children || []).map(sectionToEditorNode),
      ],
    };
  return {
    type: section.type,
    attrs: { ...attrs, ...(section.type === 'heading' ? { level: section.level } : {}) },
    content: section.content,
  };
};

/** IDs are repaired in the editor too; this fallback also covers imported JSON. */
export const fromEditorDocument = (
  document: JSONContent,
  minimumVersion: 1 | 2 = 1
): ISectionDocument => {
  const ids = new Set<string>();
  let hasAdvancedContent = false;
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
  const childrenFrom = (nodes: JSONContent[]) => {
    if (nodes.length) hasAdvancedContent = true;
    return nodes.length ? { children: nodes.map(parseBlock) } : {};
  };
  const parseBlock = (node: JSONContent): IDocumentSection => {
    const id = nodeId(node);
    const start = typeof node.attrs?.start === 'number' ? node.attrs.start : 1;
    switch (node.type) {
      case 'horizontalRule':
        return { id, type: 'divider' };
      case 'codeBlock':
        if (node.attrs?.language) hasAdvancedContent = true;
        return {
          id,
          type: 'code',
          text: (node.content || []).map(child => child.text || '').join(''),
          ...(typeof node.attrs?.language === 'string' && node.attrs.language
            ? { language: node.attrs.language }
            : {}),
        };
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        if (node.type === 'orderedList' && start > 1) hasAdvancedContent = true;
        return {
          id,
          type:
            node.type === 'taskList'
              ? 'checklist'
              : node.type === 'orderedList'
                ? 'numberedList'
                : 'bulletList',
          ...(node.type === 'orderedList' && start > 1 ? { start } : {}),
          items: (node.content || []).map(item => ({
            id: nodeId(item),
            content: inline(item.content?.[0] || {}),
            ...childrenFrom((item.content || []).slice(1)),
            ...(node.type === 'taskList' ? { checked: item.attrs?.checked === true } : {}),
          })),
        };
      case 'blockquote':
      case 'callout':
        if (node.type === 'callout') hasAdvancedContent = true;
        return {
          id,
          type: node.type === 'callout' ? 'callout' : 'quote',
          content: inline(node.content?.[0] || {}),
          ...childrenFrom((node.content || []).slice(1)),
        };
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
  };
  const sections = (document.content || []).map(parseBlock);
  return { version: hasAdvancedContent || minimumVersion === 2 ? 2 : 1, sections };
};
