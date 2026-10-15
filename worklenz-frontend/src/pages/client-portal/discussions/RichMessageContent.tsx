import { useMemo, type CSSProperties, type ReactNode } from 'react';
import DOMPurify from 'dompurify';
import './rich-message.css';

interface RichMessageContentProps {
  /** A message body: sanitized HTML from the composer, or plain text from before rich text existed. */
  text: string;
  /** Rendered instead of the HTML when the body is legacy plain text (keeps @Name highlighting). */
  renderPlain: (text: string) => ReactNode;
  /** CSS variable overrides, e.g. the mention chip colors that suit the bubble. */
  style?: CSSProperties;
}

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

/** Makes links open safely and drops every class except the @mention chip's. */
const keepSafeLinks = (html: string): string => {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('a').forEach(link => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer nofollow');
  });
  template.content.querySelectorAll('[class]').forEach(element => {
    if (!(element.tagName === 'SPAN' && element.getAttribute('class') === 'mention')) element.removeAttribute('class');
  });
  return template.innerHTML;
};

export const RichMessageContent = ({ text, renderPlain, style }: RichMessageContentProps) => {
  const html = useMemo(() => (isRichHtml(text) ? keepSafeLinks(sanitizeMessageHtml(text)) : null), [text]);

  if (html === null) return <>{renderPlain(text)}</>;
  return (
    <div
      className="rich-message-content"
      style={style}
      // The HTML was sanitized above: allow-listed tags and attributes, http(s)/mailto links only.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
