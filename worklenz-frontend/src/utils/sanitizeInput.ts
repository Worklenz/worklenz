import DOMPurify from 'dompurify';

/**
 * Sanitizes user input to prevent XSS attacks
 *
 * @param input - The user input string to sanitize
 * @param options - Optional configuration for DOMPurify
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string, options?: DOMPurify.Config): string => {
  if (!input) return '';

  // Default options for plain text inputs (strip all HTML)
  const defaultOptions: DOMPurify.Config = {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  };

  return DOMPurify.sanitize(input, options || defaultOptions);
};

/**
 * Sanitizes a string for use in HTML contexts (allows some basic tags)
 * Enhanced configuration to prevent XSS attacks while allowing safe formatting
 *
 * @param input - The input containing HTML to sanitize
 * @returns Sanitized HTML string
 */
export const sanitizeHtml = (input: string): string => {
  if (!input) return '';

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span'],
    ALLOWED_ATTR: {
      a: ['href', 'target', 'rel'],
      span: ['class'],
    },
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // Remove dangerous protocols
    ALLOWED_PROTOCOLS: ['http', 'https', 'mailto'],
    // Ensure all links have proper security attributes
    ADD_ATTR: ['target', 'rel'],
    // Remove any script tags, event handlers, and dangerous attributes
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    // Enforce HTML boundary
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
};

/**
 * Sanitizes comment content to prevent XSS attacks and open redirects
 * Matches backend sanitization: allows safe formatting but NO external links
 * Use this for comments to prevent HTML injection and open redirect attacks
 *
 * @param input - The comment content to sanitize
 * @returns Sanitized comment content
 */
export const sanitizeCommentContent = (input: string): string => {
  if (!input) return '';

  return DOMPurify.sanitize(input, {
    // Only allow safe formatting tags - NO links to prevent open redirect attacks
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'span'],
    ALLOWED_ATTR: {
      // Only allow class attribute on span for mentions
      span: ['class'],
    },
    // No URL schemes allowed since we're not allowing links
    ALLOWED_URI_REGEXP: /^$/,
    ALLOWED_PROTOCOLS: [],
    // Remove any script tags, event handlers, and dangerous attributes
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'a', 'link'],
    FORBID_ATTR: [
      'onerror',
      'onload',
      'onclick',
      'onmouseover',
      'onfocus',
      'onblur',
      'href',
      'src',
    ],
    // Enforce HTML boundary
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
};
