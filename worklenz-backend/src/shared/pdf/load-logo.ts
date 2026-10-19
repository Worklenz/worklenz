const LOGO_TIMEOUT_MS = 5000;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const isPng = (b: Buffer): boolean => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const isJpeg = (b: Buffer): boolean => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/**
 * Downloads the organization logo for embedding. react-pdf can only draw PNG and JPEG, so
 * anything else (SVG, WebP), or any failure, returns null and the document falls back to the
 * organization's initial. A bad logo must never fail the whole download.
 */
export const loadLogo = async (logoUrl: string | null | undefined): Promise<Buffer | null> => {
  if (!logoUrl || !/^https?:\/\//i.test(logoUrl)) return null;

  try {
    const response = await fetch(logoUrl, { signal: AbortSignal.timeout(LOGO_TIMEOUT_MS) });
    if (!response.ok) return null;

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > LOGO_MAX_BYTES) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > LOGO_MAX_BYTES) return null;
    return isPng(buffer) || isJpeg(buffer) ? buffer : null;
  } catch (error) {
    console.warn("PDF logo could not be loaded, rendering without it:", (error as Error).message);
    return null;
  }
};
