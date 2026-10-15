import { Tag } from '@/shared/antd-imports';

const MENTION = /(@[A-Z][a-z]+ [A-Z][a-z]+)/g;

/**
 * Message text with "@First Last" shown as a chip. Rendered as React text nodes, never as HTML,
 * so a message can't inject markup. Clients don't pick mentions; only staff messages carry them.
 */
export const MentionText = ({ text }: { text: string }) => (
  <>
    {text.split(MENTION).map((part, index) =>
      /^@[A-Z]/.test(part) ? (
        <Tag key={index} color="blue" style={{ marginInlineEnd: 0 }}>
          {part}
        </Tag>
      ) : (
        <span key={index}>{part}</span>
      )
    )}
  </>
);
