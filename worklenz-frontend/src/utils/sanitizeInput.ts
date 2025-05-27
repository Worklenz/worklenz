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
    KEEP_CONTENT: false,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
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
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    FORBID_ATTR: ['style', 'class', 'id'],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'],
  });
};

/**
 * Sanitizes form input data by removing potentially dangerous characters
 * while preserving legitimate content
 * 
 * @param input - The form input to sanitize
 * @returns Sanitized string safe for form processing
 */
export const sanitizeFormInput = (input: string): string => {
  if (!input) return '';
  
  // First pass: Remove all HTML tags and attributes
  let sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
  
  // Second pass: Remove potentially dangerous characters but keep normal punctuation
  sanitized = sanitized
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
    .trim();
  
  return sanitized;
};

/**
 * Sanitizes email input specifically
 * 
 * @param email - The email input to sanitize
 * @returns Sanitized email string
 */
export const sanitizeEmail = (email: string): string => {
  if (!email) return '';
  
  // Remove all HTML and keep only valid email characters
  let sanitized = DOMPurify.sanitize(email, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
  
  // Keep only valid email characters: letters, numbers, @, ., -, _, +
  sanitized = sanitized.replace(/[^a-zA-Z0-9@.\-_+]/g, '').toLowerCase().trim();
  
  return sanitized;
};

/**
 * Sanitizes name input (for user names, team names, etc.)
 * 
 * @param name - The name input to sanitize
 * @returns Sanitized name string
 */
export const sanitizeName = (name: string): string => {
  if (!name) return '';
  
  // Remove all HTML and keep only valid name characters
  let sanitized = DOMPurify.sanitize(name, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
  
  // Keep letters, numbers, spaces, hyphens, apostrophes, and periods
  // Remove multiple consecutive spaces
  sanitized = sanitized
    .replace(/[^a-zA-Z0-9\s\-'.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return sanitized;
};

/**
 * Sanitizes URL input
 * 
 * @param url - The URL input to sanitize
 * @returns Sanitized URL string
 */
export const sanitizeUrl = (url: string): string => {
  if (!url) return '';
  
  // Remove all HTML
  let sanitized = DOMPurify.sanitize(url, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
  
  // Remove dangerous protocols
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/file:/gi, '')
    .trim();
  
  // Ensure it starts with http:// or https:// if it looks like a URL
  if (sanitized && !sanitized.match(/^https?:\/\//i) && sanitized.includes('.')) {
    sanitized = 'https://' + sanitized;
  }
  
  return sanitized;
};

/**
 * Sanitizes rich text content (for editors, comments, etc.)
 * 
 * @param content - The rich text content to sanitize
 * @returns Sanitized HTML string
 */
export const sanitizeRichText = (content: string): string => {
  if (!content) return '';
  
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'code', 'pre', 'span', 'div'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height',
      'colspan', 'rowspan', 'class'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: true,
    FORBID_ATTR: ['style', 'id'],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'iframe'],
  });
}; 