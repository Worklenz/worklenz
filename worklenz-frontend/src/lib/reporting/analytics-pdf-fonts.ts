import type { jsPDF } from 'jspdf';
import droidSansFallbackUrl from '@reductoai/portable-fonts/files/DroidSansFallback.ttf?url';

/** Unicode-capable face (Latin + CJK) for analytics branded PDF text. */
export const ANALYTICS_PDF_FONT_FAMILY = 'WorklenzPdfSans';

const FONT_FILE = 'DroidSansFallback.ttf';

let fontBase64Promise: Promise<string> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadFontBase64(): Promise<string> {
  if (!fontBase64Promise) {
    fontBase64Promise = (async () => {
      const response = await fetch(droidSansFallbackUrl);
      if (!response.ok) {
        throw new Error(`Failed to load PDF font (${response.status})`);
      }
      return arrayBufferToBase64(await response.arrayBuffer());
    })().catch(error => {
      fontBase64Promise = null;
      throw error;
    });
  }
  return fontBase64Promise;
}

/**
 * Register a Unicode font on the jsPDF instance (Helvetica lacks CJK glyphs).
 * Bold uses the same face — DroidSansFallback ships a single weight.
 */
export async function registerAnalyticsPdfFont(doc: jsPDF): Promise<string> {
  const base64 = await loadFontBase64();
  doc.addFileToVFS(FONT_FILE, base64);
  doc.addFont(FONT_FILE, ANALYTICS_PDF_FONT_FAMILY, 'normal');
  doc.addFont(FONT_FILE, ANALYTICS_PDF_FONT_FAMILY, 'bold');
  doc.setFont(ANALYTICS_PDF_FONT_FAMILY, 'normal');
  return ANALYTICS_PDF_FONT_FAMILY;
}
