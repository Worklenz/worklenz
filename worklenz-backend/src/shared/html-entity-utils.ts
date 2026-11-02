export function escapeHtmlEntities(value: string): string {
  if (!value) return "";

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#x27;": "'",
    "&#39;": "'",
  };
  return text.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, entity => entities[entity]);
}

export function getHtmlTextSearchVariants(value: string): string[] {
  const decoded = decodeHtmlEntities(value);
  return [...new Set([decoded, escapeHtmlEntities(decoded)])];
}
