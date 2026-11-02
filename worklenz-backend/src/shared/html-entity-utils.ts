export function escapeHtmlEntities(value: string): string {
  if (!value) return "";

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

export function getHtmlTextSearchVariants(value: string): string[] {
  const decoded = decodeHtmlEntities(value);
  return [...new Set([decoded, escapeHtmlEntities(decoded)])];
}
