/**
 * Utility functions for handling HTML entity encoding/decoding
 */

/**
 * Decodes HTML entities back to their original characters
 * This is the counterpart to the backend's sanitizePlainText() function
 *
 * @param text - Text that may contain HTML entities
 * @returns Decoded text with HTML entities converted back to readable characters
 */
export function decodeHtmlEntities(text: string | undefined): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Decode without assigning untrusted input to `innerHTML` (avoids the
  // xss-through-dom sink). The backend only emits a small, known set of named
  // entities plus numeric character references, both handled below.
  return decodeHtmlEntitiesFallback(text);
}

/**
 * Safe text display that decodes HTML entities
 * Use this for displaying text that was sanitized on the backend
 *
 * @param text - Text that may contain HTML entities
 * @returns Decoded text safe for display
 */
export function safeTextDisplay(text: string | undefined): string {
  return decodeHtmlEntities(text);
}

/**
 * Common HTML entity patterns and their replacements
 * This is a fallback method for environments where DOM manipulation might not be available
 */
export const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&#x27;': "'",
  '&#39;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&apos;': "'",
};

/**
 * Alternative decoding method using string replacement
 * Use this as a fallback when DOM methods are not available
 *
 * @param text - Text that may contain HTML entities
 * @returns Decoded text using string replacement
 */
export function decodeHtmlEntitiesFallback(text: string): string {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  let decoded = text;

  // Numeric character references: &#123; and &#x1F600;
  decoded = decoded
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)));

  Object.entries(HTML_ENTITY_MAP).forEach(([entity, char]) => {
    if (entity === '&amp;') return; // handled last, see below
    const regex = new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    decoded = decoded.replace(regex, char);
  });

  // &amp; must be decoded last so "&amp;lt;" does not collapse to "<"
  decoded = decoded.replace(/&amp;/g, '&');

  return decoded;
}

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}
