/** Locales a release note can be translated into. Values match the
 * `users.language` enum (LANGUAGE_TYPE) and the frontend's `Language` enum, so a
 * user's language can be used as the lookup key without mapping. English is the
 * required source locale and the fallback for every other one. */
export const DEFAULT_RELEASE_NOTE_LOCALE = "en";

export const RELEASE_NOTE_LOCALES = ["en", "es", "pt", "alb", "de", "zh_cn", "pl", "fr"] as const;

export type ReleaseNoteLocale = (typeof RELEASE_NOTE_LOCALES)[number];

/** Maps any language code the clients may send (`zh-CN`, `sq`, `pt-BR`…) to a
 * supported locale, or null when it isn't one. */
export function normalizeReleaseNoteLocale(value: unknown): ReleaseNoteLocale | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase().trim().replace(/-/g, "_");
  if (lower === "zh" || lower === "zh_cn") return "zh_cn";
  if (lower === "sq") return "alb";
  const match = RELEASE_NOTE_LOCALES.find(locale => locale === lower || locale === lower.split("_")[0]);
  return match ?? null;
}
