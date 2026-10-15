import { RichMessageEditor } from '../../discussions/RichMessageEditor';

interface RichTextFieldProps {
  /** Stored HTML (or legacy plain text). `Form.Item` supplies this. */
  value?: string;
  /** Emits the editor HTML, or an empty string when nothing visible is typed. `Form.Item` supplies this. */
  onChange?: (html: string) => void;
  placeholder?: string;
  ariaLabel: string;
  /** Visible-text limit, shown as a counter. Pair it with a `Form` rule using `richTextMaxLength`. */
  maxLength?: number;
  /** `internal` tints the field so staff-only notes are not mistaken for client-visible text. */
  tone?: 'default' | 'internal';
  /** `basic` drops headings and underline, for document notes. */
  toolbar?: 'full' | 'basic';
  status?: 'error';
  disabled?: boolean;
  minHeight?: number;
  maxHeight?: number;
}

/**
 * The discussion composer's rich-text editor as a form field, used for notes, descriptions and other
 * long text in the Client Portal. Drop it inside `Form.Item` in place of `Input.TextArea`.
 */
export const RichTextField = ({
  value = '',
  onChange,
  placeholder = '',
  ariaLabel,
  maxLength,
  tone = 'default',
  toolbar = 'full',
  status,
  disabled,
  minHeight = 80,
  maxHeight = 240,
}: RichTextFieldProps) => (
  <RichMessageEditor
    controlled
    value={value}
    onChange={change => onChange?.(change.html)}
    placeholder={placeholder}
    ariaLabel={ariaLabel}
    maxLength={maxLength}
    tone={tone}
    toolbar={toolbar}
    status={status}
    disabled={disabled}
    minHeight={minHeight}
    maxHeight={maxHeight}
  />
);
