import { createHash, randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";
import db from "../config/db";
import { GoogleOneTapConfig } from "../config/google-one-tap";

const googleClient = new OAuth2Client();

export interface VerifiedGoogleIdentity {
  subject: string;
  email: string;
  name: string;
  picture?: string;
}

export interface GoogleAccount {
  id: string;
  email: string;
  name?: string;
  active_team?: string | null;
}

export class GoogleOneTapRejected extends Error {}

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");

export async function issueGoogleChallenge(sessionId: string): Promise<string> {
  const nonce = randomBytes(32).toString("hex");
  await db.query("DELETE FROM google_one_tap_challenges WHERE expires_at <= NOW();");
  await db.query(
    `INSERT INTO google_one_tap_challenges (session_hash, nonce_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
     ON CONFLICT (session_hash) DO UPDATE SET nonce_hash = EXCLUDED.nonce_hash, expires_at = EXCLUDED.expires_at;`,
    [hash(sessionId), hash(nonce)],
  );
  return nonce;
}

/** Verify Google's signature/claims, then atomically consume a session-bound nonce across replicas. */
export async function verifyGoogleCredential(
  credential: string, sessionId: string, config: GoogleOneTapConfig,
): Promise<VerifiedGoogleIdentity> {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.clientId });
    payload = ticket.getPayload();
  } catch {
    // Never propagate library errors: they can contain the submitted credential.
    throw new GoogleOneTapRejected();
  }
  const nonce = payload && "nonce" in payload ? payload.nonce : undefined;
  if (!payload?.sub || !payload.email || payload.email_verified !== true ||
      typeof nonce !== "string" || !/^[a-f0-9]{64}$/.test(nonce) ||
      (config.hostedDomains.length && !config.hostedDomains.includes(payload.hd?.toLowerCase() || ""))) {
    throw new GoogleOneTapRejected();
  }
  const consumed = await db.query(
    `DELETE FROM google_one_tap_challenges
     WHERE session_hash = $1 AND nonce_hash = $2 AND expires_at > NOW() RETURNING id;`,
    [hash(sessionId), hash(nonce)],
  );
  if (consumed.rowCount !== 1) throw new GoogleOneTapRejected();
  return {
    subject: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: payload.name?.trim() || payload.email,
    picture: payload.picture,
  };
}

/** One Tap never links by email or accepts membership fields from the browser. */
export async function resolveGoogleAccount(identity: VerifiedGoogleIdentity): Promise<GoogleAccount> {
  const result = await db.query(
    `SELECT id, email, name, active_team, is_deleted FROM users WHERE google_id = $1;`,
    [identity.subject],
  );
  // Fail closed even if historical data contains a duplicate or deleted identity.
  if (result.rows.length !== 1 || result.rows[0].is_deleted !== false) throw new GoogleOneTapRejected();
  return result.rows[0] as GoogleAccount;
}
