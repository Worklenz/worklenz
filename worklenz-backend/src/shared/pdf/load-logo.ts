import { lookup } from "dns/promises";
import { isIP } from "net";
import { assertSafeExternalHost, isPrivateIPv4, isPrivateIPv6 } from "../ssrf-guard";

const LOGO_TIMEOUT_MS = 5000;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_REDIRECTS = 3;

const isPng = (b: Buffer): boolean => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const isJpeg = (b: Buffer): boolean => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

const isPrivateAddress = (address: string): boolean =>
  isIP(address) === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address);

/** Rejects non-http(s) URLs and hosts that are, or resolve to, internal addresses. */
const isSafeLogoUrl = async (rawUrl: string): Promise<boolean> => {
  try {
    if (!/^https?:\/\//i.test(rawUrl)) return false;
    const host = assertSafeExternalHost(rawUrl).replace(/^\[|\]$/g, "");
    if (isIP(host)) return true; // literal IPs are already checked by assertSafeExternalHost
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
  } catch {
    return false;
  }
};

/** Reads the body while counting bytes, so an oversized or unannounced-length response is cut off early. */
const readLimited = async (response: Response): Promise<Buffer | null> => {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > LOGO_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
};

/**
 * Downloads the organization logo for embedding. react-pdf can only draw PNG and JPEG, so
 * anything else (SVG, WebP), or any failure, returns null and the document falls back to the
 * organization's initial. A bad logo must never fail the whole download.
 *
 * The logo URL is user-supplied, so every hop (including redirects) must point at a public host.
 */
export const loadLogo = async (logoUrl: string | null | undefined): Promise<Buffer | null> => {
  if (!logoUrl) return null;

  try {
    const signal = AbortSignal.timeout(LOGO_TIMEOUT_MS);
    let currentUrl = logoUrl;

    for (let hop = 0; hop <= LOGO_MAX_REDIRECTS; hop++) {
      if (!(await isSafeLogoUrl(currentUrl))) return null;

      const response = await fetch(currentUrl, { signal, redirect: "manual" });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (!response.ok) return null;

      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > LOGO_MAX_BYTES) return null;

      const buffer = await readLimited(response);
      if (!buffer) return null;
      return isPng(buffer) || isJpeg(buffer) ? buffer : null;
    }
    return null;
  } catch (error) {
    console.warn("PDF logo could not be loaded, rendering without it:", (error as Error).message);
    return null;
  }
};
