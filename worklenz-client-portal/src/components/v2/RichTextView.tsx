import type { CSSProperties } from 'react';
import { MentionText } from './MentionText';
import { RichTextContent } from './RichTextContent';

interface RichTextViewProps {
  /** Stored value: sanitized HTML, or plain text saved before the rich-text editor existed. */
  value: string | null | undefined;
  style?: CSSProperties;
}

const PLAIN_STYLE: CSSProperties = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };

/** Read-only display of a rich-text field. Legacy plain text keeps its line breaks and @Name chips. */
export const RichTextView = ({ value, style }: RichTextViewProps) => {
  if (!value) return null;
  return (
    <RichTextContent
      text={value}
      style={style}
      renderPlain={text => (
        <span style={{ ...PLAIN_STYLE, ...style }}>
          <MentionText text={text} />
        </span>
      )}
    />
  );
};
