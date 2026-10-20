import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { isRichHtml, sanitizeMessageHtml } from './richTextUtils';
import './rich-text.css';

interface RichTextContentProps {
  /** A message body: sanitized HTML from the composer, or plain text from before rich text existed. */
  text: string;
  /** Rendered instead of the HTML when the body is legacy plain text (keeps @Name highlighting). */
  renderPlain: (text: string) => ReactNode;
  /** CSS variable overrides, e.g. the mention chip colors that suit the bubble. */
  style?: CSSProperties;
}

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

export const RichTextContent = ({ text, renderPlain, style }: RichTextContentProps) => {
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
