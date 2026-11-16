import path from "path";
import { Font } from "@react-pdf/renderer";

/**
 * Fonts come from @fontsource packages (plain npm deps, so `npm ci` is the only install step).
 * Helvetica, react-pdf's default, can't render non-Latin text, hence Noto Sans plus the
 * Latin Extended, Sinhala and Tamil faces as fallbacks.
 * The portable Droid fallback covers Chinese, Japanese, and Korean glyphs.
 */
export const PDF_FONT_FAMILY = ["NotoSans", "NotoSansLatinExt", "NotoSansSinhala", "NotoSansTamil"];

const fontFile = (pkg: string, file: string): string =>
  path.join(path.dirname(require.resolve(`${pkg}/package.json`)), "files", file);

let registered = false;

export const registerPdfFonts = (): void => {
  if (registered) return;

  const families: Array<{ family: string; pkg: string; subset: string }> = [
    { family: "NotoSans",        pkg: "@fontsource/noto-sans",        subset: "noto-sans-latin" },
    { family: "NotoSansLatinExt",pkg: "@fontsource/noto-sans",        subset: "noto-sans-latin-ext" },
    { family: "NotoSansSinhala", pkg: "@fontsource/noto-sans-sinhala", subset: "noto-sans-sinhala-sinhala" },
    { family: "NotoSansTamil",   pkg: "@fontsource/noto-sans-tamil",   subset: "noto-sans-tamil-tamil" },
  ];

  for (const { family, pkg, subset } of families) {
    Font.register({
      family,
      fonts: [
        { src: fontFile(pkg, `${subset}-400-normal.woff`), fontWeight: 400 },
        { src: fontFile(pkg, `${subset}-700-normal.woff`), fontWeight: 700 },
      ],
    });
  }

  const cjk = fontFile("@reductoai/portable-fonts", "DroidSansFallback.ttf");
  Font.register({ family: "RoadmapSans", fonts: [
    { src: fontFile("@reductoai/portable-fonts", "Carlito-Regular.ttf"), fontWeight: 400 },
    { src: fontFile("@reductoai/portable-fonts", "Carlito-Bold.ttf"), fontWeight: 700 },
  ] });
  Font.register({ family: "DroidSansFallback", fonts: [
    { src: cjk, fontWeight: 400 },
    { src: cjk, fontWeight: 700 },
  ] });

  // Never hyphenate: names, numbers and addresses should wrap whole.
  Font.registerHyphenationCallback(word => [word]);
  registered = true;
};
