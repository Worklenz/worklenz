import { htmlToPlainText, sanitizePortalRichText } from "../../shared/utils";
import { badRequest } from "./errors";

/** Raw HTML may be this many times longer than the visible-text cap (markup overhead). */
const HTML_OVERHEAD_FACTOR = 6;

/**
 * Sanitizes a rich-text portal field and enforces the cap on its visible text. Returns "" when
 * nothing visible remains. Throws instead of slicing so stored markup is never cut mid-tag.
 */
export function cleanPortalRichText(value: string | null | undefined, maxChars: number, label = "This field"): string {
  const html = sanitizePortalRichText(value);
  if (!html) return "";
  const text = htmlToPlainText(html);
  if (!text) return "";
  if (text.length > maxChars) throw badRequest(`${label} can be at most ${maxChars} characters`);
  if (html.length > maxChars * HTML_OVERHEAD_FACTOR) throw badRequest(`${label} has too much formatting`);
  return html;
}

/** Non-throwing variant for controllers that answer with their own 400: `error` is set when the visible text exceeds `maxChars`. */
export function cleanRichNotes(value: unknown, maxChars: number): { value: string | null; error?: string } {
  if (value === undefined || value === null) return { value: null };
  const html = sanitizePortalRichText(String(value));
  const text = htmlToPlainText(html);
  if (!text) return { value: null };
  if (text.length > maxChars || html.length > maxChars * HTML_OVERHEAD_FACTOR) {
    return { value: null, error: `Notes can be at most ${maxChars} characters` };
  }
  return { value: html };
}
