import { randomUUID } from "crypto";

export const MAX_DOCUMENT_DEPTH = 5;
export const MAX_DOCUMENT_CONTENT_BYTES = 500 * 1024;
export const MAX_DOCUMENT_TITLE_LENGTH = 500;

const INLINE_NODES = new Set(["text", "hardBreak", "memberMention", "taskMention"]);
const ALLOWED_MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link"]);
const TEXT_SECTION_TYPES = new Set(["paragraph", "heading", "quote"]);
const LIST_SECTION_TYPES = new Set(["bulletList", "numberedList", "checklist"]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DocumentNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: DocumentMark[];
  content?: DocumentNode[];
}

export interface DocumentMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TextSection {
  id: string;
  type: "paragraph" | "heading" | "quote";
  level?: 1 | 2 | 3;
  content: DocumentNode[];
}

export interface ListItem {
  id: string;
  content: DocumentNode[];
  checked?: boolean;
}

export interface ListSection {
  id: string;
  type: "bulletList" | "numberedList" | "checklist";
  items: ListItem[];
}

export interface CodeSection {
  id: string;
  type: "code";
  text: string;
}

export interface DividerSection {
  id: string;
  type: "divider";
}

export type DocumentSection = TextSection | ListSection | CodeSection | DividerSection;

export interface SectionDocument {
  version: 1;
  sections: DocumentSection[];
}

export interface DocumentMentionRef {
  type: "member" | "task";
  id: string;
}

export interface MentionDiff {
  insertedMemberIds: string[];
  removedMemberIds: string[];
  insertedTaskIds: string[];
  removedTaskIds: string[];
}

export interface TreeItem {
  id: string;
  parentId: string | null;
}

export type ContentResult =
  | { ok: true; content: SectionDocument }
  | { ok: false; error: string };

export const emptyDocument = (): SectionDocument => ({
  version: 1,
  sections: [],
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const sanitizeHref = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!href || href.length > 2000) return null;
  if (!/^https?:\/\//i.test(href)) return null;
  return href;
};

const sanitizeMark = (mark: unknown): DocumentMark | null => {
  if (!isRecord(mark) || typeof mark.type !== "string" || !ALLOWED_MARKS.has(mark.type)) {
    return null;
  }

  if (mark.type !== "link") {
    return { type: mark.type };
  }

  const attrs = isRecord(mark.attrs) ? mark.attrs : {};
  const href = sanitizeHref(attrs.href);
  if (!href) return null;

  const next: DocumentMark = { type: "link", attrs: { href } };
  if (attrs.target === "_blank") {
    next.attrs = { ...next.attrs, target: "_blank" };
  }
  if (typeof attrs.rel === "string" && attrs.rel.length <= 200) {
    next.attrs = { ...next.attrs, rel: attrs.rel };
  }
  return next;
};

const sanitizeInlineNode = (node: unknown): DocumentNode | null => {
  if (!isRecord(node) || typeof node.type !== "string" || !INLINE_NODES.has(node.type)) {
    return null;
  }

  if (node.type === "hardBreak") {
    return { type: "hardBreak" };
  }

  if (node.type === "memberMention" || node.type === "taskMention") {
    const attrs = isRecord(node.attrs) ? node.attrs : {};
    if (!isUuid(attrs.id)) return null;
    return { type: node.type, attrs: { id: attrs.id } };
  }

  if (typeof node.text !== "string") return null;
  const textNode: DocumentNode = { type: "text", text: node.text };
  if (Array.isArray(node.marks)) {
    const marks = node.marks
      .map(sanitizeMark)
      .filter((mark): mark is DocumentMark => !!mark);
    if (marks.length > 0) textNode.marks = marks;
  }
  return textNode;
};

const sanitizeInlineList = (
  value: unknown,
  mode: "strict" | "lenient"
): DocumentNode[] | null => {
  if (value == null) return [];
  if (!Array.isArray(value)) return mode === "strict" ? null : [];

  const content: DocumentNode[] = [];
  for (const child of value) {
    const sanitized = sanitizeInlineNode(child);
    if (!sanitized) {
      if (mode === "strict") return null;
      continue;
    }
    content.push(sanitized);
  }
  return content;
};

const withinByteLimit = (content: SectionDocument): ContentResult => {
  const bytes = Buffer.byteLength(JSON.stringify(content), "utf8");
  if (bytes > MAX_DOCUMENT_CONTENT_BYTES) {
    return { ok: false, error: "Document content is larger than 500 KB" };
  }
  return { ok: true, content };
};

const sanitizeSection = (
  value: unknown,
  ids: Set<string>
): DocumentSection | null => {
  if (!isRecord(value) || typeof value.type !== "string" || !isUuid(value.id)) {
    return null;
  }
  if (ids.has(value.id)) return null;
  ids.add(value.id);

  if (value.type === "divider") {
    return { id: value.id, type: "divider" };
  }

  if (value.type === "code") {
    if (typeof value.text !== "string") return null;
    return { id: value.id, type: "code", text: value.text };
  }

  if (TEXT_SECTION_TYPES.has(value.type)) {
    const content = sanitizeInlineList(value.content, "strict");
    if (!content) return null;
    const section: TextSection = {
      id: value.id,
      type: value.type as TextSection["type"],
      content,
    };
    if (value.type === "heading") {
      if (value.level !== 1 && value.level !== 2 && value.level !== 3) return null;
      section.level = value.level;
    }
    return section;
  }

  if (LIST_SECTION_TYPES.has(value.type)) {
    if (!Array.isArray(value.items)) return null;
    const items: ListItem[] = [];
    for (const item of value.items) {
      if (!isRecord(item) || !isUuid(item.id) || ids.has(item.id)) return null;
      const content = sanitizeInlineList(item.content, "strict");
      if (!content) return null;
      ids.add(item.id);
      const next: ListItem = { id: item.id, content };
      if (value.type === "checklist") {
        next.checked = item.checked === true;
      }
      items.push(next);
    }
    return {
      id: value.id,
      type: value.type as ListSection["type"],
      items,
    };
  }

  return null;
};

export const validateDocumentContent = (value: unknown): ContentResult => {
  const parsed = parseJson(value);
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.sections)) {
    return { ok: false, error: "Document content must be a list of sections" };
  }

  const ids = new Set<string>();
  const sections: DocumentSection[] = [];
  for (const section of parsed.sections) {
    const sanitized = sanitizeSection(section, ids);
    if (!sanitized) {
      return { ok: false, error: "Document content contains an unsupported section" };
    }
    sections.push(sanitized);
  }

  return withinByteLimit({ version: 1, sections });
};

const inlineFromBlocks = (nodes: DocumentNode[]): DocumentNode[] => {
  const content: DocumentNode[] = [];
  nodes.forEach(node => {
    if (node.type !== "paragraph" && node.type !== "heading") return;
    const inline = sanitizeInlineList(node.content, "lenient") || [];
    if (content.length > 0 && inline.length > 0) {
      content.push({ type: "hardBreak" });
    }
    content.push(...inline);
  });
  return content;
};

const convertList = (
  node: DocumentNode,
  type: ListSection["type"],
  extras: DocumentSection[]
): ListSection => {
  const items: ListItem[] = [];
  for (const child of node.content || []) {
    if (child.type !== "listItem" && child.type !== "taskItem") continue;
    const blocks = child.content || [];
    items.push({
      id: randomUUID(),
      content: inlineFromBlocks(blocks.filter(block => block.type === "paragraph" || block.type === "heading")),
      ...(type === "checklist" ? { checked: child.attrs?.checked === true } : {}),
    });
    blocks.forEach(block => {
      if (block.type === "bulletList" || block.type === "orderedList" || block.type === "taskList" || block.type === "blockquote") {
        extras.push(...convertLegacyBlocks([block]));
      }
    });
  }
  return { id: randomUUID(), type, items };
};

const convertLegacyBlocks = (nodes: DocumentNode[]): DocumentSection[] => {
  const sections: DocumentSection[] = [];
  nodes.forEach(node => {
    if (node.type === "paragraph") {
      sections.push({
        id: randomUUID(),
        type: "paragraph",
        content: sanitizeInlineList(node.content, "lenient") || [],
      });
      return;
    }
    if (node.type === "heading") {
      const level = node.attrs?.level;
      sections.push({
        id: randomUUID(),
        type: "heading",
        level: level === 2 || level === 3 ? level : 1,
        content: sanitizeInlineList(node.content, "lenient") || [],
      });
      return;
    }
    if (node.type === "bulletList" || node.type === "orderedList" || node.type === "taskList") {
      const extras: DocumentSection[] = [];
      const type = node.type === "orderedList"
        ? "numberedList"
        : node.type === "taskList"
          ? "checklist"
          : "bulletList";
      sections.push(convertList(node, type, extras));
      sections.push(...extras);
      return;
    }
    if (node.type === "blockquote") {
      const nested = (node.content || []).filter(child =>
        child.type !== "paragraph" && child.type !== "heading"
      );
      sections.push({
        id: randomUUID(),
        type: "quote",
        content: inlineFromBlocks(node.content || []),
      });
      sections.push(...convertLegacyBlocks(nested));
      return;
    }
    if (node.type === "horizontalRule") {
      sections.push({ id: randomUUID(), type: "divider" });
    }
  });
  return sections;
};

const isEmptyParagraphDoc = (nodes: DocumentNode[]): boolean =>
  nodes.length === 1 &&
  nodes[0].type === "paragraph" &&
  (!nodes[0].content || nodes[0].content.length === 0);

export const convertLegacyDocument = (value: unknown): SectionDocument => {
  const parsed = parseJson(value);
  if (!isRecord(parsed) || parsed.type !== "doc" || !Array.isArray(parsed.content)) {
    return emptyDocument();
  }
  const blocks = parsed.content.filter(isRecord) as unknown as DocumentNode[];
  if (isEmptyParagraphDoc(blocks)) return emptyDocument();
  return { version: 1, sections: convertLegacyBlocks(blocks) };
};

/** Saved TipTap documents are converted when a page is read. Section documents are sanitized. */
export const readDocumentContent = (value: unknown): SectionDocument => {
  const parsed = parseJson(value);
  if (isRecord(parsed) && parsed.type === "doc") {
    const converted = convertLegacyDocument(parsed);
    const validated = withinByteLimit(converted);
    return validated.ok ? validated.content : emptyDocument();
  }

  const validated = validateDocumentContent(parsed);
  return validated.ok ? validated.content : emptyDocument();
};

const appendInlineText = (nodes: DocumentNode[], parts: string[]): void => {
  nodes.forEach(node => {
    if (node.type === "text" && node.text) parts.push(node.text);
    if (node.type === "memberMention" || node.type === "taskMention") parts.push(" ");
    if (node.type === "hardBreak") parts.push("\n");
  });
};

export const extractPlainText = (content: SectionDocument): string => {
  const parts: string[] = [];
  content.sections.forEach(section => {
    if (section.type === "paragraph" || section.type === "heading" || section.type === "quote") {
      appendInlineText(section.content, parts);
      parts.push("\n");
      return;
    }
    if (section.type === "bulletList" || section.type === "numberedList" || section.type === "checklist") {
      section.items.forEach(item => {
        appendInlineText(item.content, parts);
        parts.push("\n");
      });
      return;
    }
    if (section.type === "code") {
      parts.push(section.text, "\n");
    }
  });
  return parts.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

const collectInlineMentions = (nodes: DocumentNode[], mentions: DocumentMentionRef[]): void => {
  nodes.forEach(node => {
    const mentionId = node.attrs?.id;
    if (node.type === "memberMention" && isUuid(mentionId)) {
      mentions.push({ type: "member", id: mentionId });
    }
    if (node.type === "taskMention" && isUuid(mentionId)) {
      mentions.push({ type: "task", id: mentionId });
    }
  });
};

export const extractMentions = (content: SectionDocument): DocumentMentionRef[] => {
  const mentions: DocumentMentionRef[] = [];
  content.sections.forEach(section => {
    if (section.type === "paragraph" || section.type === "heading" || section.type === "quote") {
      collectInlineMentions(section.content, mentions);
    }
    if (section.type === "bulletList" || section.type === "numberedList" || section.type === "checklist") {
      section.items.forEach(item => collectInlineMentions(item.content, mentions));
    }
  });
  const seen = new Set<string>();
  return mentions.filter(mention => {
    const key = `${mention.type}:${mention.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const idsOf = (mentions: DocumentMentionRef[], type: DocumentMentionRef["type"]): Set<string> =>
  new Set(mentions.filter(mention => mention.type === type).map(mention => mention.id));

const difference = (next: Set<string>, previous: Set<string>): string[] =>
  [...next].filter(id => !previous.has(id));

export const syncDocumentMentions = (
  previous: DocumentMentionRef[],
  next: DocumentMentionRef[]
): MentionDiff => {
  const previousMembers = idsOf(previous, "member");
  const nextMembers = idsOf(next, "member");
  const previousTasks = idsOf(previous, "task");
  const nextTasks = idsOf(next, "task");

  return {
    insertedMemberIds: difference(nextMembers, previousMembers),
    removedMemberIds: difference(previousMembers, nextMembers),
    insertedTaskIds: difference(nextTasks, previousTasks),
    removedTaskIds: difference(previousTasks, nextTasks),
  };
};

/** Notifications are sent for newly mentioned members only. Task mentions never notify. */
export const memberIdsToNotify = (diff: MentionDiff): string[] => diff.insertedMemberIds;

export const validateDocumentTree = (
  items: TreeItem[]
): { ok: true } | { ok: false; error: string } => {
  const byId = new Map<string, TreeItem>();
  for (const item of items) {
    if (byId.has(item.id)) {
      return { ok: false, error: "Document tree contains a duplicate page" };
    }
    byId.set(item.id, item);
  }

  for (const item of items) {
    if (item.parentId && !byId.has(item.parentId)) {
      return { ok: false, error: "Parent page was not found" };
    }

    const seen = new Set<string>();
    let current: TreeItem | undefined = item;
    let depth = 0;
    while (current) {
      if (seen.has(current.id)) {
        return { ok: false, error: "Document tree contains a cycle" };
      }
      seen.add(current.id);
      depth += 1;
      if (depth > MAX_DOCUMENT_DEPTH) {
        return { ok: false, error: "Document tree is deeper than 5 levels" };
      }
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }

  return { ok: true };
};

export const applyParentMoves = (
  items: TreeItem[],
  moves: Array<{ id: string; parentId: string | null }>
): { ok: true; items: TreeItem[] } | { ok: false; error: string } => {
  const next = items.map(item => ({ ...item }));
  const byId = new Map(next.map(item => [item.id, item]));

  for (const move of moves) {
    const node = byId.get(move.id);
    if (!node) {
      return { ok: false, error: "Page was not found" };
    }
    node.parentId = move.parentId;
  }

  const tree = validateDocumentTree(next);
  if (!tree.ok) return tree;
  return { ok: true, items: next };
};
