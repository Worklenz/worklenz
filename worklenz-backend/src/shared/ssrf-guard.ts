import { isIP } from "net";
import createHttpError from "http-errors";

/**
 * Guards against Server-Side Request Forgery (SSRF) when an outbound HTTP
 * request targets a host that originates from user input (e.g. a self-hosted
 * JIRA domain supplied during an import).
 *
 * It rejects hostnames that point at the local machine or private/internal
 * network ranges, so a caller cannot coerce the server into probing
 * `localhost`, cloud metadata endpoints (169.254.169.254) or RFC1918 hosts.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
]);

export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;                       // 10.0.0.0/8
  if (a === 127) return true;                      // loopback
  if (a === 0) return true;                        // "this" network
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;         // 192.168.0.0/16
  if (a === 169 && b === 254) return true;         // link-local / cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true;                       // multicast / reserved
  return false;
}

/**
 * Expands an IPv6 literal into its eight 16-bit groups, or null when it is malformed.
 * Handles "::" compression and a trailing dotted IPv4 part (::ffff:127.0.0.1).
 */
function parseIPv6(ip: string): number[] | null {
  let text = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const dotted = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const octets = dotted.slice(1).map(Number);
    if (octets.some(o => o > 255)) return null;
    text = text.slice(0, dotted.index) + ((octets[0] << 8) | octets[1]).toString(16) + ":" + ((octets[2] << 8) | octets[3]).toString(16);
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map(g => parseInt(g, 16));
}

const embeddedIPv4 = (high: number, low: number): string =>
  `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;

export function isPrivateIPv6(ip: string): boolean {
  const groups = parseIPv6(ip);
  if (!groups) return true; // unparseable: refuse rather than guess
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  if (groups.every(g => g === 0)) return true; // ::
  if (groups.slice(0, 7).every(g => g === 0) && g7 === 1) return true; // ::1
  // IPv4-mapped (::ffff:0:0/96), IPv4-compatible (::/96) and NAT64 (64:ff9b::/96) carry an IPv4 address in the last 32 bits,
  // whether the literal was written dotted (::ffff:127.0.0.1) or as hex (::ffff:7f00:1, which is how URL parsing serialises it).
  const zeroPrefix = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  if ((zeroPrefix && (g5 === 0xffff || g5 === 0)) || (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0)) {
    return isPrivateIPv4(embeddedIPv4(g6, g7));
  }
  if (g0 === 0x2002) return isPrivateIPv4(embeddedIPv4(g1, g2)); // 6to4 embeds the IPv4 address after the prefix
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g0 === 0x2001 && g1 === 0) return true; // Teredo
  return false;
}

/**
 * Validates and normalizes a user-supplied host (optionally with scheme / path)
 * for use as an outbound request target. Returns the bare hostname (no scheme,
 * no trailing slash). Throws a 400 HttpError when the value is malformed or
 * resolves to a disallowed address.
 */
export function assertSafeExternalHost(rawInput: string | undefined | null): string {
  const value = (rawInput ?? "").trim();
  if (!value) throw createHttpError(400, "A valid domain is required");

  let url: URL;
  try {
    // Accept "example.com", "https://example.com/x" and "example.com/x" alike.
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    throw createHttpError(400, "Invalid domain");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw createHttpError(400, "Only http(s) domains are supported");
  }
  if (url.username || url.password) {
    throw createHttpError(400, "Domain must not contain credentials");
  }
  const host = url.hostname;

  const lowerHost = host.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(lowerHost) || lowerHost.endsWith(".localhost") || lowerHost.endsWith(".local") || lowerHost.endsWith(".internal")) {
    throw createHttpError(400, "The provided domain is not allowed");
  }

  // URL parsing keeps IPv6 literals bracketed (e.g. "[::1]") — strip for isIP().
  const bareHost = host.replace(/^\[|\]$/g, "");
  const ipVersion = isIP(bareHost);
  if (ipVersion === 4 && isPrivateIPv4(bareHost)) {
    throw createHttpError(400, "The provided domain is not allowed");
  }
  if (ipVersion === 6 && isPrivateIPv6(bareHost)) {
    throw createHttpError(400, "The provided domain is not allowed");
  }
  if (ipVersion === 0 && /:/.test(bareHost)) {
    // Malformed IPv6-looking host that isIP() rejects — refuse rather than guess.
    throw createHttpError(400, "Invalid domain");
  }

  return host;
}
