export interface IDocumentNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: IDocumentNode[];
}

export interface IResolvedMember {
  id: string;
  name: string | null;
  avatar_url: string | null;
  unavailable: boolean;
}

export interface IResolvedTask {
  id: string;
  name: string | null;
  task_key: string | null;
  status_name: string | null;
  status_color: string | null;
  unavailable: boolean;
}

export interface IDocumentMentionMap {
  members: Record<string, IResolvedMember>;
  tasks: Record<string, IResolvedTask>;
}

export interface IProjectDocumentSummary {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  position: number;
  updated_at: string;
  updated_by_name: string | null;
}

export type DocsTextSectionType = 'paragraph' | 'heading' | 'quote' | 'callout';
export type DocsListSectionType = 'bulletList' | 'numberedList' | 'checklist';

export interface ITextSection {
  id: string;
  type: DocsTextSectionType;
  level?: 1 | 2 | 3;
  content: IDocumentNode[];
  children?: IDocumentSection[];
}

export interface IListItem {
  id: string;
  content: IDocumentNode[];
  checked?: boolean;
  children?: IDocumentSection[];
}

export interface IListSection {
  id: string;
  type: DocsListSectionType;
  items: IListItem[];
  start?: number;
}

export interface ICodeSection {
  id: string;
  type: 'code';
  text: string;
  language?: string;
}

export interface IDividerSection {
  id: string;
  type: 'divider';
}

export type IDocumentSection = ITextSection | IListSection | ICodeSection | IDividerSection;

export interface ISectionDocument {
  version: 1 | 2;
  sections: IDocumentSection[];
}

export type SectionKind =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'checklist'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider';

export const createSection = (kind: SectionKind): IDocumentSection => {
  const id = crypto.randomUUID();
  if (kind === 'divider') return { id, type: 'divider' };
  if (kind === 'code') return { id, type: 'code', text: '' };
  if (kind === 'heading1' || kind === 'heading2' || kind === 'heading3') {
    const level = kind === 'heading1' ? 1 : kind === 'heading2' ? 2 : 3;
    return { id, type: 'heading', level, content: [] };
  }
  if (kind === 'bulletList' || kind === 'numberedList' || kind === 'checklist') {
    return {
      id,
      type: kind,
      items: [
        {
          id: crypto.randomUUID(),
          content: [],
          ...(kind === 'checklist' ? { checked: false } : {}),
        },
      ],
    };
  }
  if (kind === 'quote' || kind === 'callout') return { id, type: kind, content: [] };
  return { id, type: 'paragraph', content: [] };
};

export interface IProjectDocument extends IProjectDocumentSummary {
  content: ISectionDocument;
  created_at: string;
  created_by: string | null;
  updated_by: string | null;
  mentions: IDocumentMentionMap;
}

export interface IProjectDocumentSearchResult {
  id: string;
  parent_id: string | null;
  title: string;
  snippet: string;
  updated_at: string;
}

export interface IProjectDocumentBacklink {
  id: string;
  title: string;
  project_id: string;
  updated_at: string;
}

export interface IReorderDocumentItem {
  id: string;
  parent_id: string | null;
  position: number;
}

export const EMPTY_DOCUMENT: ISectionDocument = {
  version: 1,
  sections: [],
};

export const EMPTY_MENTIONS: IDocumentMentionMap = {
  members: {},
  tasks: {},
};
