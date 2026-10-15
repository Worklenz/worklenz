import crypto from "crypto";

/**
 * The one place the client-portal JWT secret is read. There is no fallback value: a deploy without
 * JWT_SECRET must fail loudly instead of silently signing tokens and sign-in codes with a known string.
 * Under jest (NODE_ENV=test) a fixed test value is used so specs need no environment.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "test") return "test-only-jwt-secret";
  throw new Error("JWT_SECRET is not set. Set it in the environment before starting the server.");
}

/**
 * Key for hashing client sign-in codes. Derived from the JWT secret (or an explicit
 * CLIENT_SIGN_IN_CODE_SECRET) so a leaked code hash can never double as a token signature.
 */
export function getSignInCodeKey(): string {
  const explicit = process.env.CLIENT_SIGN_IN_CODE_SECRET;
  if (explicit) return explicit;
  return crypto.createHmac("sha256", getJwtSecret()).update("client-sign-in-code").digest("hex");
}
