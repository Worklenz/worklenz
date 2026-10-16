import { randomUUID } from "crypto";

export const MAX_DOCUMENT_DEPTH = 5;
export const MAX_DOCUMENT_CONTENT_BYTES = 500 * 1024;
export const MAX_DOCUMENT_TITLE_LENGTH = 500;

const INLINE_NODES = new Set(["text", "hardBreak", "memberMention", "taskMention"]);
const ALLOWED_MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link"]);
const TEXT_SECTION_TYPES = new Set(["paragraph", "heading", "quote", "callout"]);
export const MAX_CONTENT_NESTING = 20;
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
  type: "paragraph" | "heading" | "quote" | "callout";
  level?: 1 | 2 | 3;
  content: DocumentNode[];
  children?: DocumentSection[];
}

export interface ListItem {
  id: string;
  content: DocumentNode[];
  checked?: boolean;
  children?: DocumentSection[];
}

export interface ListSection {
  id: string;
  type: "bulletList" | "numberedList" | "checklist";
  items: ListItem[];
  start?: number;
}

export interface CodeSection {
  id: string;
  type: "code";
  text: string;
  language?: string;
}

export interface DividerSection {
  id: string;
  type: "divider";
}

export type DocumentSection = TextSection | ListSection | CodeSection | DividerSection;

export interface SectionDocument {
  version: 1 | 2;
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
  ids: Set<string>,
  version: 1 | 2,
  depth = 0,
): DocumentSection | null => {
  if (depth > MAX_CONTENT_NESTING) return null;
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
    if (
      value.language !== undefined &&
      (version !== 2 || typeof value.language !== "string" || value.language.length > 64)
    )
      return null;
    return {
      id: value.id,
      type: "code",
      text: value.text,
      ...(typeof value.language === "string" ? { language: value.language } : {}),
    };
  }

  const sanitizeChildren = (children: unknown): DocumentSection[] | null => {
    if (children === undefined) return [];
    if (version !== 2 || !Array.isArray(children)) return null;
    const result: DocumentSection[] = [];
    for (const child of children) {
      const sanitized = sanitizeSection(child, ids, version, depth + 1);
      if (!sanitized) return null;
      result.push(sanitized);
    }
    return result;
  };

  if (TEXT_SECTION_TYPES.has(value.type)) {
    if (value.type === "callout" && version !== 2) return null;
    if (value.children !== undefined && value.type !== "quote" && value.type !== "callout")
      return null;
    const children = sanitizeChildren(value.children);
    if (!children) return null;
    const content = sanitizeInlineList(value.content, "strict");
    if (!content) return null;
    const section: TextSection = {
      id: value.id,
      type: value.type as TextSection["type"],
      content,
      ...(children.length ? { children } : {}),
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
      const children = sanitizeChildren(item.children);
      if (!children) return null;
      const next: ListItem = { id: item.id, content, ...(children.length ? { children } : {}) };
      if (value.type === "checklist") {
        next.checked = item.checked === true;
      }
      items.push(next);
    }
    if (
      value.start !== undefined &&
      (version !== 2 ||
        value.type !== "numberedList" ||
        !Number.isSafeInteger(value.start) ||
        (value.start as number) < 1 ||
        (value.start as number) > 2147483647)
    )
      return null;
    return {
      id: value.id,
      type: value.type as ListSection["type"],
      items,
      ...(typeof value.start === "number" && value.start !== 1 ? { start: value.start } : {}),
    };
  }

  return null;
};

export const validateDocumentContent = (value: unknown): ContentResult => {
  const parsed = parseJson(value);
  if (
    !isRecord(parsed) ||
    (parsed.version !== 1 && parsed.version !== 2) ||
    !Array.isArray(parsed.sections)
  ) {
    return { ok: false, error: "Document content must be a list of sections" };
  }

  try {
    if (Buffer.byteLength(JSON.stringify(parsed), "utf8") > MAX_DOCUMENT_CONTENT_BYTES)
      return { ok: false, error: "Document content is larger than 500 KB" };
  } catch {
    return { ok: false, error: "Invalid document content" };
  }
  const ids = new Set<string>();
  const sections: DocumentSection[] = [];
  for (const section of parsed.sections) {
    const sanitized = sanitizeSection(section, ids, parsed.version);
    if (!sanitized) {
      return { ok: false, error: "Document content contains an unsupported section" };
    }
    sections.push(sanitized);
  }

  return withinByteLimit({ version: parsed.version, sections });
};

const convertLegacyBlocks = (nodes: DocumentNode[], depth = 0): DocumentSection[] => {
  if (depth > MAX_CONTENT_NESTING) return [];
  const sections: DocumentSection[] = [];
  for (const node of nodes) {
    const blocks = Array.isArray(node.content)
      ? (node.content.filter(isRecord) as unknown as DocumentNode[])
      : [];
    const inline = sanitizeInlineList(blocks, "lenient") || [];
    const id = randomUUID();
    if (node.type === "paragraph" || node.type === "heading") {
      sections.push({
        id,
        type: node.type,
        content: inline,
        ...(node.type === "heading"
          ? { level: node.attrs?.level === 2 ? 2 : node.attrs?.level === 3 ? 3 : 1 }
          : {}),
      });
    } else if (["bulletList", "orderedList", "taskList"].includes(node.type)) {
      const type =
        node.type === "orderedList"
          ? "numberedList"
          : node.type === "taskList"
            ? "checklist"
            : "bulletList";
      const items: ListItem[] = blocks
        .filter((child) => child.type === "listItem" || child.type === "taskItem")
        .map((child) => {
          const itemBlocks = Array.isArray(child.content)
            ? (child.content.filter(isRecord) as unknown as DocumentNode[])
            : [];
          const first = itemBlocks[0];
          const hasFirstParagraph =
            first && (first.type === "paragraph" || first.type === "heading");
          const children = convertLegacyBlocks(
            hasFirstParagraph ? itemBlocks.slice(1) : itemBlocks,
            depth + 1,
          );
          return {
            id: randomUUID(),
            content: hasFirstParagraph ? sanitizeInlineList(first.content, "lenient") || [] : [],
            ...(children.length ? { children } : {}),
            ...(type === "checklist" ? { checked: child.attrs?.checked === true } : {}),
          };
        });
      const start = node.attrs?.start;
      sections.push({
        id,
        type,
        items,
        ...(type === "numberedList" &&
        typeof start === "number" &&
        Number.isSafeInteger(start) &&
        start > 1 &&
        start <= 2147483647
          ? { start }
          : {}),
      });
    } else if (node.type === "blockquote" || node.type === "callout") {
      const first = blocks[0];
      const hasFirstParagraph = first && (first.type === "paragraph" || first.type === "heading");
      const children = convertLegacyBlocks(hasFirstParagraph ? blocks.slice(1) : blocks, depth + 1);
      sections.push({
        id,
        type: node.type === "callout" ? "callout" : "quote",
        content: hasFirstParagraph ? sanitizeInlineList(first.content, "lenient") || [] : [],
        ...(children.length ? { children } : {}),
      });
    } else if (node.type === "horizontalRule") {
      sections.push({ id, type: "divider" });
    } else if (node.type === "codeBlock") {
      const language = node.attrs?.language;
      sections.push({
        id,
        type: "code",
        text: blocks
          .filter((child) => child.type === "text")
          .map((child) => child.text || "")
          .join(""),
        ...(typeof language === "string" && language.length <= 64 && language ? { language } : {}),
      });
    }
  }
  return sections;
};

const needsVersion2 = (sections: DocumentSection[]): boolean =>
  sections.some((section) => {
    if (section.type === "callout" || (section.type === "code" && section.language)) return true;
    if ("items" in section)
      return !!section.start || section.items.some((item) => !!item.children?.length);
    return "children" in section && !!section.children?.length;
  });

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
  const sections = convertLegacyBlocks(blocks);
  return { version: needsVersion2(sections) ? 2 : 1, sections };
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

/** Older clients must not flatten a document that has already adopted the v2 format. */
export const canUpdateDocumentContent = (current: unknown, next: SectionDocument): boolean =>
  readDocumentContent(current).version <= next.version;

const appendInlineText = (nodes: DocumentNode[], parts: string[]): void => {
  nodes.forEach(node => {
    if (node.type === "text" && node.text) parts.push(node.text);
    if (node.type === "memberMention" || node.type === "taskMention") parts.push(" ");
    if (node.type === "hardBreak") parts.push("\n");
  });
};

export const extractPlainText = (content: SectionDocument): string => {
  const parts: string[] = [];
  const walk = (sections: DocumentSection[]): void => sections.forEach(section => {
    if (section.type === "paragraph" || section.type === "heading" || section.type === "quote" || section.type === "callout") {
      appendInlineText(section.content, parts);
      parts.push("\n");
      if (section.children) walk(section.children);
      return;
    }
    if (section.type === "bulletList" || section.type === "numberedList" || section.type === "checklist") {
      section.items.forEach(item => {
        appendInlineText(item.content, parts);
        parts.push("\n");
        if (item.children) walk(item.children);
      });
      return;
    }
    if (section.type === "code") {
      parts.push(section.text, "\n");
    }
  });
  walk(content.sections);
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
  const walk = (sections: DocumentSection[]): void => sections.forEach(section => {
    if (section.type === "paragraph" || section.type === "heading" || section.type === "quote" || section.type === "callout") {
      collectInlineMentions(section.content, mentions);
      if (section.children) walk(section.children);
    }
    if (section.type === "bulletList" || section.type === "numberedList" || section.type === "checklist") {
      section.items.forEach(item => {
        collectInlineMentions(item.content, mentions);
        if (item.children) walk(item.children);
      });
    }
  });
  walk(content.sections);
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
