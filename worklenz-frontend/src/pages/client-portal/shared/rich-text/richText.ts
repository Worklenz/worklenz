import { isRichHtml, sanitizeMessageHtml } from '../../discussions/RichMessageContent';

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

/**
 * `Form` rule helpers. `required` and `max` compare the visible text, not the raw HTML, which
 * would count the markup.
 */
export const richTextRules = (options: { required?: boolean; requiredMessage?: string; max?: number; maxMessage?: string }) => [
  ...(options.required
    ? [
        {
          validator: (_: unknown, value: string | undefined) =>
            isRichTextEmpty(value) ? Promise.reject(new Error(options.requiredMessage)) : Promise.resolve(),
        },
      ]
    : []),
  ...(options.max
    ? [
        {
          validator: (_: unknown, value: string | undefined) =>
            richTextToPlain(value).length > (options.max as number)
              ? Promise.reject(new Error(options.maxMessage))
              : Promise.resolve(),
        },
      ]
    : []),
];

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Safe HTML string for print/export templates: sanitized rich text, or escaped legacy text with its line breaks. */
export const richTextToSafeHtml = (value: string | null | undefined): string => {
  if (!value) return '';
  return isRichHtml(value) ? sanitizeMessageHtml(value) : escapeText(value).replace(/\r?\n/g, '<br>');
};
