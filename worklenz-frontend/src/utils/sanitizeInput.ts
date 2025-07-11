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
 *
 * @param input - The input containing HTML to sanitize
 * @returns Sanitized HTML string
 */
export const sanitizeHtml = (input: string): string => {
  if (!input) return '';

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });
};
