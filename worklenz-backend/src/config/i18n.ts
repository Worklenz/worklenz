import i18next from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";

let initialized = false;

export async function initializeI18n(): Promise<typeof i18next> {
  if (initialized) {
    return i18next;
  }

  const localesPath = path.resolve(__dirname, "../public/locales/{{lng}}/{{ns}}.json");

  return new Promise((resolve, reject) => {
    i18next
      .use(Backend)
      .init(
        {
          fallbackLng: "en",
          preload: ["en", "de", "es", "pt", "alb", "zh", "pl", "fr"],
          ns: ["notifications", "external"],
          defaultNS: "notifications",
          backend: {
            loadPath: localesPath,
          },
          interpolation: {
            escapeValue: false,
          },
        },
        (err) => {
          if (err) {
            return reject(err);
          }
          initialized = true;
          resolve(i18next);
        }
      );
  });
}

export default i18next;
