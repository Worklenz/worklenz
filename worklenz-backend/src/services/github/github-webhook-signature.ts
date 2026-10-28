import crypto from "crypto";

/**
 * Verify GitHub's `X-Hub-Signature-256` header against the raw request body.
 * Uses a constant-time comparison.
 */
export function verifyGithubSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !signatureHeader) return false;
  if (!signatureHeader.startsWith("sha256=")) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}
