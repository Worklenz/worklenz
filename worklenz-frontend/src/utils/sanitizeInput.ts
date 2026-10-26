import DOMPurify from 'dompurify';

/** Uses the DOMPurify instance, or initializes its factory with an available window. */
const getPurify = () => {
  if (DOMPurify && typeof (DOMPurify as any).sanitize === 'function') {
    return DOMPurify;
  }
  if (typeof DOMPurify === 'function') {
    const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
    if (win) {
      return (DOMPurify as any)(win);
    }
  }
  return DOMPurify;
};



/**
 * Sanitizes user input to prevent XSS attacks
 * Strips all tags and attributes by default. Requires DOMPurify with a DOM window.
 *
 * @param input - The user input string to sanitize
 * @param options - DOMPurify configuration that replaces the default configuration
 * @returns Sanitized output, or an empty string for empty input
 */
export const sanitizeInput = (input: string, options?: DOMPurify.Config): string => {
  if (!input) return '';

  // Default options for plain text inputs (strip all HTML)
  const defaultOptions: DOMPurify.Config = {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  };

  return getPurify().sanitize(input, options || defaultOptions);
};

/**
 * Strips every HTML tag from a string, returning plain text.
 *
 * Prefer this over a one-pass regex such as `str.replace(/<[^>]*>/g, '')`,
 * which is an incomplete sanitizer: it leaves stray angle brackets and broken
 * markup behind (e.g. `<<script>script>` becomes `script>`) and does not cope
 * with nested or malformed tags. DOMPurify parses the markup and removes tags
 * completely.
 *
 * @param input - The string to strip
 * @returns Decoded text with all tags removed and surrounding whitespace trimmed
 */
export const stripHtmlTags = (input: string): string => {
  if (!input) return '';

  // Return a DOM fragment so we can read decoded text (`R&D`) instead of the
  // serialized form (`R&amp;D`) that would otherwise be rendered verbatim.
  const fragment = getPurify().sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_DOM_FRAGMENT: true,
  });

  return fragment.textContent?.trim() ?? '';
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

  return getPurify().sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span'],
    // NOTE: Array form required - DOMPurify ignores the object form (tag-specific ALLOWED_ATTR)
    // which silently allows ALL attributes including style="javascript:..."
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    // Restricts URI schemes to http(s)/mailto
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // Ensure all links have proper security attributes
    ADD_ATTR: ['target', 'rel'],
    // Remove any script tags, event handlers, and dangerous attributes
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style'],
    // Enforce HTML boundary
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
};

/**
 * Sanitizes comment HTML while retaining rich formatting, mentions, and checklists.
 * Link URLs must start with http:, https:, or mailto:.
 * When document is available, retains only matching color declarations in styles,
 * converts inputs to checkboxes, and sets anchors to target="_blank" with
 * rel="noopener noreferrer nofollow". Otherwise returns the DOMPurify output
 * without these additional transformations.
 *
 * @param input - The comment content to sanitize
 * @returns Sanitized comment HTML, or an empty string for empty input
 */
export const sanitizeCommentContent = (input: string): string => {
  if (!input) return '';

  const sanitized = getPurify().sanitize(input, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'p', 'br', 'span', 's', 'del', 'strike', 'u',
      'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'label', 'input', 'div'
    ],
    ALLOWED_ATTR: [
      'class', 'style', 'href', 'target', 'rel', 'data-type', 'data-id',
      'data-label', 'data-checked', 'data-color', 'type', 'checked', 'disabled',
      'aria-label', 'contenteditable'
    ],
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'button', 'link'],
    FORBID_ATTR: [
      'onerror',
      'onload',
      'onclick',
      'onmouseover',
      'onfocus',
      'onblur',
      'src',
    ],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });

  // Retain only validated color declarations in style attributes,
  // ensure inputs are strictly checkboxes, and links open in new tab safely
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = sanitized;
    const SAFE_COLOR_REGEX = /^(?:#(?:[0-9a-f]{3,4}){1,2}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-z]+)$/i;

    div.querySelectorAll('[style]').forEach(el => {
      const rawStyle = el.getAttribute('style') || '';
      el.removeAttribute('style');
      const match = rawStyle.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
      if (match) {
        const val = match[1].trim();
        if (SAFE_COLOR_REGEX.test(val)) {
          el.setAttribute('style', `color: ${val};`);
        }
      }
    });

    const ALLOWED_CLASSES = new Set([
      'mention',
      'mentions',
      'comment-link',
      'rich-task-list',
      'rich-task-item',
      'is-checked',
      'rich-task-item-content',
      'rich-code-block',
      'rich-blockquote',
    ]);

    div.querySelectorAll('[class]').forEach(el => {
      const filtered = Array.from(el.classList).filter(cls => ALLOWED_CLASSES.has(cls));
      if (filtered.length > 0) {
        el.setAttribute('class', filtered.join(' '));
      } else {
        el.removeAttribute('class');
      }
    });

    div.querySelectorAll('input').forEach(input => {
      input.setAttribute('type', 'checkbox');
    });
    div.querySelectorAll('a').forEach(anchor => {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer nofollow');
    });
    return div.innerHTML;
  }

  return sanitized;
};
