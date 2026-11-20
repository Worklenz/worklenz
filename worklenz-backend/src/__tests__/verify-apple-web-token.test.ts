import { generateKeyPairSync } from "crypto";
import jwt from "jsonwebtoken";

jest.mock("jwks-rsa", () => ({ __esModule: true, default: () => ({ getSigningKey: async () => ({ getPublicKey: () => (globalThis as any).__appleTestPublicKey }) }) }));
import { verifyAppleWebToken } from "../passport/passport-strategies/verify-apple-web-token";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const sign = (claims: object, key = privateKey) => jwt.sign(claims, key, {
  algorithm: "RS256", keyid: "key", issuer: "https://appleid.apple.com",
  audience: "web-client", expiresIn: "1h",
});

beforeEach(() => {
  process.env.APPLE_CLIENT_ID = "web-client";
  (globalThis as any).__appleTestPublicKey = publicKey.export({ type: "spki", format: "pem" });
});

test("accepts a signed Apple token for the configured web client", async () => {
  await expect(verifyAppleWebToken(sign({ sub: "apple-user", email: "user@example.com", email_verified: true })))
    .resolves.toMatchObject({ sub: "apple-user", email: "user@example.com" });
});

test("rejects a token signed by an attacker", async () => {
  const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 });
  await expect(verifyAppleWebToken(sign({ sub: "attacker" }, attacker.privateKey))).rejects.toThrow();
});

test("rejects a token for another client", async () => {
  process.env.APPLE_CLIENT_ID = "other-client";
  await expect(verifyAppleWebToken(sign({ sub: "apple-user" }))).rejects.toThrow();
});

test("rejects a token without an expiration or subject", async () => {
  const token = jwt.sign({}, privateKey, { algorithm: "RS256", keyid: "key", issuer: "https://appleid.apple.com", audience: "web-client" });
  await expect(verifyAppleWebToken(token)).rejects.toThrow();
});
