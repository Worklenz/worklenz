export interface GoogleOneTapConfig {
  clientId: string;
  allowedOrigins: string[];
  hostedDomains: string[];
}

/** No deployment-specific defaults: an incomplete opt-in must fail closed. */
export function getGoogleOneTapConfig(env = process.env): GoogleOneTapConfig | null {
  if (env.GOOGLE_ONE_TAP_ENABLED !== "true") return null;
  const clientId = env.GOOGLE_CLIENT_ID?.trim() || "";
  const allowedOrigins = splitList(env.GOOGLE_ONE_TAP_ALLOWED_ORIGINS);
  const sessionSecret = env.SESSION_SECRET?.trim() || "";
  if (!clientId.endsWith(".apps.googleusercontent.com") || !allowedOrigins.length ||
      sessionSecret.length < 32 || sessionSecret.includes("CHANGE_THIS")) return null;

  try {
    for (const origin of allowedOrigins) {
      const url = new URL(origin);
      const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (url.origin !== origin || (url.protocol !== "https:" && !(isLocal && url.protocol === "http:"))) {
        return null;
      }
      if (!isLocal && env.SESSION_COOKIE_SECURE !== "true") return null;
    }
  } catch {
    return null;
  }

  return {
    clientId,
    allowedOrigins,
    hostedDomains: splitList(env.GOOGLE_ONE_TAP_HOSTED_DOMAINS).map(domain => domain.toLowerCase()),
  };
}

function splitList(value?: string): string[] {
  return (value || "").split(",").map(item => item.trim()).filter(Boolean);
}
