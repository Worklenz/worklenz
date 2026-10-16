import DOMPurify from 'dompurify';

const TAG = /<[^>]*>/g;

/** Visible text of a stored value (HTML or legacy plain text), for length and emptiness checks. */
export const richTextToPlain = (value: string | null | undefined): string => {
  if (!value) return '';
  if (!/<\/?[a-z][^>]*>/i.test(value)) return value.trim();
  const template = document.createElement('template');
  template.innerHTML = value.replace(/<\/(p|li|h[1-6]|blockquote|pre)>|<br\s*\/?>/gi, ' ');
  return (template.content.textContent ?? value.replace(TAG, ' ')).replace(/\s+/g, ' ').trim();
};

/** True when the value has no visible text. */
export const isRichTextEmpty = (value: string | null | undefined): boolean => richTextToPlain(value) === '';

const ALLOWED_TAGS = [
  'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'span',
];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'data-type', 'data-id', 'data-label'];
const HTML_PATTERN = /<\/?(?:p|br|h[1-3]|strong|b|em|i|u|s|ul|ol|li|a|blockquote|code|pre|span)\b[^>]*>/i;

/** True when the body carries composer markup rather than being a plain-text message. */
export const isRichHtml = (text: string): boolean => HTML_PATTERN.test(text);

/** Sanitizes at render time too, since the table can be written by other paths than the composer. */
export const sanitizeMessageHtml = (html: string): string =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
  });
