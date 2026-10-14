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
 * Test stand-in for RichTextEditor (ProseMirror needs a real layout engine). A textarea plays the
 * editor and emits what it holds as one paragraph, the way the real editor does.
 */
export const RichTextEditorStub = ({ value, onChange, onSubmit, placeholder, ariaLabel, disabled }: StubProps) => {
  const text = value.replace(/<[^>]*>/g, '');
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
