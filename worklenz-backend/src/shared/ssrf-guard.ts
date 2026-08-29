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

function isPrivateIPv4(ip: string): boolean {
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

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
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
