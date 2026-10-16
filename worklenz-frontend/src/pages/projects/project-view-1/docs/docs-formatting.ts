import {
  IDocumentSection,
  ISectionDocument,
  IListSection,
  ITextSection,
} from '@/types/project/project-documents.types';

export const findFormattingSection = (sections: IDocumentSection[], fieldKey?: string | null) =>
  sections.find((section): section is ITextSection | IListSection =>
    'content' in section ? section.id === fieldKey : 'items' in section
      ? section.items.some(item => item.id === fieldKey) : false
  );

/** Lists use section data rather than nested Tiptap blocks. Keep inline marks and mention IDs intact. */
export const toggleSectionList = (
  document: ISectionDocument,
  fieldKey: string,
  type: 'bulletList' | 'numberedList'
): ISectionDocument => {
  const section = findFormattingSection(document.sections, fieldKey);
  if (!section) return document;
  let replacement: IDocumentSection[];
  if ('content' in section) {
    replacement = [{ id: section.id, type, items: [{ id: fieldKey, content: section.content }] }];
  } else if (section.type === type) {
    replacement = section.items.map(item => ({ id: item.id, type: 'paragraph', content: item.content }));
  } else {
    replacement = [{ ...section, type }];
  }
  return {
    ...document,
    sections: document.sections.flatMap(current => current.id === section.id ? replacement : [current]),
  };
};
