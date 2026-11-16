import fs from "fs";
import path from "path";
import { Font } from "@react-pdf/renderer";

/**
 * Fonts come from @fontsource packages (plain npm deps, so `npm ci` is the only install step).
 * Helvetica, react-pdf's default, can't render non-Latin text, hence Noto Sans plus the
 * Latin Extended, Sinhala and Tamil faces as fallbacks.
 * The portable Droid fallback covers Chinese, Japanese, and Korean glyphs when available.
 */
export const PDF_FONT_FAMILY = ["NotoSans", "NotoSansLatinExt", "NotoSansSinhala", "NotoSansTamil"];

const packageRoot = (pkg: string): string => path.dirname(require.resolve(`${pkg}/package.json`));

/** @fontsource stores faces under `files/`; @reductoai/portable-fonts keeps them at the package root. */
const fontFile = (pkg: string, file: string): string => {
  const root = packageRoot(pkg);
  const nested = path.join(root, "files", file);
  if (fs.existsSync(nested)) return nested;
  const flat = path.join(root, file);
  if (fs.existsSync(flat)) return flat;
  throw new Error(`Font file not found: ${pkg}/${file}`);
};

const tryFontFile = (pkg: string, file: string): string | null => {
  try {
    return fontFile(pkg, file);
  } catch {
    return null;
  }
};

let registered = false;

export const registerPdfFonts = (): void => {
  if (registered) return;

  const families: Array<{ family: string; pkg: string; subset: string }> = [
    { family: "NotoSans", pkg: "@fontsource/noto-sans", subset: "noto-sans-latin" },
    { family: "NotoSansLatinExt", pkg: "@fontsource/noto-sans", subset: "noto-sans-latin-ext" },
    { family: "NotoSansSinhala", pkg: "@fontsource/noto-sans-sinhala", subset: "noto-sans-sinhala-sinhala" },
    { family: "NotoSansTamil", pkg: "@fontsource/noto-sans-tamil", subset: "noto-sans-tamil-tamil" },
  ];

  for (const { family, pkg, subset } of families) {
    const regular = tryFontFile(pkg, `${subset}-400-normal.woff`);
    const bold = tryFontFile(pkg, `${subset}-700-normal.woff`);
    if (!regular || !bold) continue;
    Font.register({
      family,
      fonts: [
        { src: regular, fontWeight: 400 },
        { src: bold, fontWeight: 700 },
      ],
    });
  }

  const carlitoRegular = tryFontFile("@reductoai/portable-fonts", "Carlito-Regular.ttf");
  const carlitoBold = tryFontFile("@reductoai/portable-fonts", "Carlito-Bold.ttf");
  const cjk = tryFontFile("@reductoai/portable-fonts", "DroidSansFallback.ttf");
  const notoRegular = tryFontFile("@fontsource/noto-sans", "noto-sans-latin-400-normal.woff");
  const notoBold = tryFontFile("@fontsource/noto-sans", "noto-sans-latin-700-normal.woff");

  // Prefer Carlito when present; otherwise reuse Noto Sans so Roadmap PDF still exports.
  const roadmapRegular = carlitoRegular || notoRegular;
  const roadmapBold = carlitoBold || notoBold;
  if (roadmapRegular && roadmapBold) {
    Font.register({
      family: "RoadmapSans",
      fonts: [
        { src: roadmapRegular, fontWeight: 400 },
        { src: roadmapBold, fontWeight: 700 },
      ],
    });
  }

  if (cjk) {
    Font.register({
      family: "DroidSansFallback",
      fonts: [
        { src: cjk, fontWeight: 400 },
        { src: cjk, fontWeight: 700 },
      ],
    });
  } else if (roadmapRegular && roadmapBold) {
    // Keep CJK font-family lookups valid even without the portable package.
    Font.register({
      family: "DroidSansFallback",
      fonts: [
        { src: roadmapRegular, fontWeight: 400 },
        { src: roadmapBold, fontWeight: 700 },
      ],
    });
  }

  // Never hyphenate: names, numbers and addresses should wrap whole.
  Font.registerHyphenationCallback(word => [word]);
  registered = true;
};
