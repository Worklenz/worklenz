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

  if (typeof document === 'undefined') {
    return decodeHtmlEntitiesFallback(text);
  }

  // Create a temporary element to decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
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
  Object.entries(HTML_ENTITY_MAP).forEach(([entity, char]) => {
    const regex = new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    decoded = decoded.replace(regex, char);
  });

  return decoded;
}
