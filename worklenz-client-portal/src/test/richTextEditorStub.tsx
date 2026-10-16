import type { RichTextChange } from '@/components/v2/RichTextEditor';

interface StubProps {
  value: string;
  onChange: (change: RichTextChange) => void;
  onSubmit?: () => void;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Parses via a <template> element (safe: never executes scripts) instead of a tag-stripping
 * regex, but — unlike richTextToPlain — does not collapse or trim whitespace, since this feeds
 * a controlled textarea's live value and must round-trip exactly what was typed.
 */
const htmlToEditableText = (html: string): string => {
  if (!html) return '';
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.textContent ?? '';
};

/**
 * Test stand-in for RichTextEditor (ProseMirror needs a real layout engine). A textarea plays the
 * editor and emits what it holds as one paragraph, the way the real editor does.
 */
export const RichTextEditorStub = ({ value, onChange, onSubmit, placeholder, ariaLabel, disabled }: StubProps) => {
  const text = htmlToEditableText(value);
  return (
    <textarea
      aria-label={ariaLabel}
      placeholder={placeholder}
      disabled={disabled}
      value={text}
      onChange={event => {
        const next = event.target.value;
        onChange({ html: next.trim() ? `<p>${escapeHtml(next)}</p>` : '', text: next.trim(), mentionIds: [] });
      }}
      onKeyDown={event => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') onSubmit?.();
      }}
    />
  );
};
