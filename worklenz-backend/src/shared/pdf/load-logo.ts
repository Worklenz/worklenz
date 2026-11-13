import dns from "dns";
import http, { IncomingMessage } from "http";
import https from "https";
import { isIP, LookupFunction } from "net";
import { assertSafeExternalHost, isPrivateIPv4, isPrivateIPv6 } from "../ssrf-guard";

const LOGO_TIMEOUT_MS = 5000;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_REDIRECTS = 3;

const isPng = (b: Buffer): boolean => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const isJpeg = (b: Buffer): boolean => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

const isPrivateAddress = (address: string): boolean =>
  isIP(address) === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address);

/**
 * DNS lookup used for the actual connection. Validating the host and then letting fetch() resolve it again
 * would leave a DNS-rebinding gap, so the check runs on the very addresses the socket connects to.
 */
export const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      return callback(new Error(`Blocked non-public address for ${hostname}`), "", 4);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
};

/** Rejects non-http(s) URLs and internal hosts or IP literals. Hostnames are checked again at connect time by safeLookup. */
const isSafeLogoUrl = (rawUrl: string): boolean => {
  try {
    if (!/^https?:\/\//i.test(rawUrl)) return false;
    assertSafeExternalHost(rawUrl);
    return true;
  } catch {
    return false;
  }
};

const requestPublic = (url: string, signal: AbortSignal): Promise<IncomingMessage> =>
  new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.request(url, { method: "GET", lookup: safeLookup, signal }, resolve);
    request.on("error", reject);
    request.end();
  });

/** Reads the body while counting bytes, so an oversized or unannounced-length response is cut off early. */
const readLimited = async (response: IncomingMessage): Promise<Buffer | null> => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response) {
    total += (chunk as Buffer).length;
    if (total > LOGO_MAX_BYTES) {
      response.destroy();
      return null;
    }
    chunks.push(chunk as Buffer);
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
      if (!isSafeLogoUrl(currentUrl)) return null;

      const response = await requestPublic(currentUrl, signal);
      const status = response.statusCode ?? 0;

      if (status >= 300 && status < 400) {
        response.resume();
        const location = response.headers.location;
        if (!location) return null;
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        return null;
      }

      const declaredLength = Number(response.headers["content-length"] || 0);
      if (declaredLength > LOGO_MAX_BYTES) {
        response.destroy();
        return null;
      }

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
