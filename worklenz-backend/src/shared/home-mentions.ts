// Turns a stored task-comment body into the one-line plain-text excerpt shown by the "Comments
// mentioning me" widget on the Home overview. Pure and free of any `db` import so it can be unit
// tested without Postgres.
//
// Comments are stored as sanitized HTML (see sanitizeCommentContent) in which every @mention was
// swapped for a `{n}` placeholder, n being task_comment_mentions.mentioned_index.

export const MENTION_EXCERPT_MAX_LENGTH = 200;

export interface IMentionedName {
  index: number;
  name: string;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&#39;": "'",
  "&nbsp;": " ",
};

export function toMentionExcerpt(
  content: string | null | undefined,
  mentions: IMentionedName[],
  maxLength: number = MENTION_EXCERPT_MAX_LENGTH
): string {
  if (!content) return "";

  const namesByIndex = new Map(mentions.map(mention => [mention.index, mention.name]));

  const text = content
    // Block-level breaks become a space so "one</p><p>two" doesn't read as "onetwo".
    .replace(/<\/?(p|br)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, entity => HTML_ENTITIES[entity] ?? entity)
    // After the tags are gone, so a mentioned person's name can never be read back as markup.
    .replace(/\{(\d+)\}/g, (_, index: string) => {
      const name = namesByIndex.get(Number(index));
      return name ? `@${name}` : "";
    })
    .replace(/\s+/g, " ")
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}
