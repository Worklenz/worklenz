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

const COMMENT_SANITIZE_MARKER = '__worklenzCommentSanitize';

const SAFE_COLOR_REGEX = /^(?:#(?:[0-9a-f]{3,4}){1,2}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-z]+)$/i;

const COMMENT_ALLOWED_CLASSES = new Set([
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

interface CommentSanitizeConfig extends DOMPurify.Config {
  [COMMENT_SANITIZE_MARKER]?: boolean;
}

type PurifyHookFn = (node: Element, data: unknown, config: DOMPurify.Config) => void;

interface PurifyWithHooks {
  addHook(entryPoint: string, cb: PurifyHookFn): void;
}

let commentHooksInstalled = false;

/**
 * Registers comment-content transformations as a DOMPurify hook on the shared
 * instance. The hook checks the config marker, so it only affects comment
 * sanitization and leaves every other DOMPurify call site untouched.
 *
 * Running these transformations inside DOMPurify (on the DOM it parsed) means
 * they are enforced in every environment - including when no global `document`
 * exists - so unfiltered styles, classes, or input types can never survive on
 * the no-document fallback path.
 *
 * @param purify - The DOMPurify instance to register the hook on
 */
const installCommentSanitizeHooks = (purify: PurifyWithHooks): void => {
  if (commentHooksInstalled || typeof purify.addHook !== 'function') return;
  commentHooksInstalled = true;

  purify.addHook('afterSanitizeAttributes', (node: Element, _data: unknown, config: DOMPurify.Config) => {
    if (!config || (config as CommentSanitizeConfig)[COMMENT_SANITIZE_MARKER] !== true) return;

    const el = node as HTMLElement;

    // Inline styles are reduced to a single validated color declaration so
    // position/url()/expression() payloads can never survive.
    if (el.hasAttribute('style')) {
      const rawStyle = el.getAttribute('style') || '';
      el.removeAttribute('style');
      const match = rawStyle.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
      if (match) {
        const val = match[1].trim();
        if (SAFE_COLOR_REGEX.test(val)) {
          el.setAttribute('style', `color: ${val};`);
        }
      }
    }

    // Classes are restricted to the editor allowlist.
    if (el.hasAttribute('class')) {
      const filtered = Array.from(el.classList).filter(cls => COMMENT_ALLOWED_CLASSES.has(cls));
      if (filtered.length > 0) {
        el.setAttribute('class', filtered.join(' '));
      } else {
        el.removeAttribute('class');
      }
    }

    // Inputs are strictly checkboxes and links open safely in a new tab.
    if (el.tagName === 'INPUT') {
      el.setAttribute('type', 'checkbox');
      el.setAttribute('disabled', '');
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
};

/**
 * Sanitizes comment HTML while retaining rich formatting, mentions, and checklists.
 * Link URLs must start with http:, https:, or mailto:.
 * Style attributes are reduced to validated color declarations, classes are
 * restricted to the editor allowlist, inputs are forced to checkboxes, and
 * anchors are set to target="_blank" with rel="noopener noreferrer nofollow".
 * These transformations run inside a DOMPurify hook, so they apply even when
 * no global `document` is available.
 *
 * @param input - The comment content to sanitize
 * @returns Sanitized comment HTML, or an empty string for empty input
 */
export const sanitizeCommentContent = (input: string): string => {
  if (!input) return '';

  const purify = getPurify();
  installCommentSanitizeHooks(purify as unknown as PurifyWithHooks);

  const options = {
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
    [COMMENT_SANITIZE_MARKER]: true,
  } as CommentSanitizeConfig;

  return purify.sanitize(input, options);
};
