import { RichTextEditor } from './RichTextEditor';

interface RichTextFieldProps {
  /** Stored HTML (or legacy plain text). */
  value?: string;
  /** Emits the editor HTML, or an empty string when nothing visible is typed. */
  onChange?: (html: string) => void;
  placeholder?: string;
  ariaLabel: string;
  /** Visible-text limit, shown as a counter. The host still validates. */
  maxLength?: number;
  /** `basic` drops headings and underline, for short notes. */
  toolbar?: 'full' | 'basic';
  status?: 'error';
  disabled?: boolean;
  minHeight?: number;
  maxHeight?: number;
  /** Ctrl/Cmd+Enter. */
  onSubmit?: () => void;
}

/**
 * The rich-text editor as a controlled field: the same box used by the discussion composer, for
 * descriptions, notes and comments. Use it in place of `Input.TextArea`.
 */
export const RichTextField = ({
  value = '',
  onChange,
  placeholder = '',
  ariaLabel,
  maxLength,
  toolbar = 'full',
  status,
  disabled,
  minHeight = 80,
  maxHeight = 240,
  onSubmit,
}: RichTextFieldProps) => (
  <RichTextEditor
    controlled
    value={value}
    onChange={change => onChange?.(change.html)}
    onSubmit={onSubmit}
    placeholder={placeholder}
    ariaLabel={ariaLabel}
    maxLength={maxLength}
    toolbar={toolbar}
    status={status}
    disabled={disabled}
    minHeight={minHeight}
    maxHeight={maxHeight}
  />
);
