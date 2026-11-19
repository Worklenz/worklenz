import jwt, { JwtPayload } from "jsonwebtoken";
import jwksClient from "jwks-rsa";

interface AppleWebToken extends JwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
}

const appleKeys = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
  cache: true,
  cacheMaxAge: 86400000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

export async function verifyAppleWebToken(idToken: string): Promise<AppleWebToken> {
  const clientId = process.env.APPLE_CLIENT_ID;
  const decoded = typeof idToken === "string" ? jwt.decode(idToken, { complete: true }) : null;
  if (!clientId || !decoded?.header.kid || decoded.header.alg !== "RS256") {
    throw new Error("Invalid Apple ID token");
  }
  const key = await appleKeys.getSigningKey(decoded.header.kid);
  const payload = jwt.verify(idToken, key.getPublicKey(), {
    algorithms: ["RS256"],
    issuer: "https://appleid.apple.com",
    audience: clientId,
  });
  if (typeof payload === "string" || typeof payload.sub !== "string" || !payload.sub ||
      typeof payload.exp !== "number") {
    throw new Error("Invalid Apple ID token claims");
  }
  return payload as AppleWebToken;
}
