import i18next, { TFunction } from "i18next";
import db from "../config/db";

export class I18nHelper {
  /**
   * Normalizes keys formatted with dot namespace notation (e.g., 'notifications.taskAssigned')
   * to standard i18next namespace notation ('notifications:taskAssigned').
   */
  public static normalizeKey(key: string): string {
    if (key.startsWith("notifications.")) {
      return `notifications:${key.slice("notifications.".length)}`;
    }
    if (key.startsWith("external.")) {
      return `external:${key.slice("external.".length)}`;
    }
    return key;
  }

  /**
   * Fetch user's language preference from database and map to i18n locale code.
   * Handles all PostgreSQL LANGUAGE_TYPE enum values:
   * 'en', 'es', 'pt', 'alb', 'de', 'zh_cn', 'ko', 'pl', 'fr'
   */
  static async getUserLanguage(userId?: string | null): Promise<string> {
    if (!userId) return "en";

    try {
      const result = await db.query(
        "SELECT language FROM users WHERE id = $1 LIMIT 1;",
        [userId]
      );

      const dbLanguage = result.rows[0]?.language || "en";

      const languageMap: Record<string, string> = {
        en: "en",
        de: "de",
        es: "es",
        pt: "pt",
        alb: "alb",
        zh_cn: "zh",
        pl: "pl",
        fr: "fr",
        ko: "en", // Korean not yet supported with full locale, fallback to English
      };

      return languageMap[dbLanguage] || "en";
    } catch {
      return "en";
    }
  }

  /**
   * Translate a key with parameters for a given locale
   */
  static translate(key: string, locale: string, params?: Record<string, any>): string {
    const t = this.getFixedT(locale);
    return t(this.normalizeKey(key), params as any) as string;
  }

  /**
   * Get a fixed translation function for a specific locale
   */
  static getFixedT(locale: string, ns?: string): TFunction {
    return i18next.getFixedT(locale, ns);
  }
}
