import crypto from "crypto";
import jwt from "jsonwebtoken";

import db from "../../config/db";
import { IPassportSession } from "../../interfaces/passport-session";

export interface IAccessTokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

export interface ITokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

interface IRefreshTokenRecord {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET || "development-access-secret";
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.JWT_ACCESS_TOKEN_TTL_SECONDS || 900);
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.JWT_REFRESH_TOKEN_TTL_DAYS || 30);
const REFRESH_TOKEN_COOKIE_NAME = process.env.JWT_REFRESH_TOKEN_COOKIE_NAME || "wl_refresh_token";

const REFRESH_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export default class TokenService {
  public static getRefreshCookieName() {
    return REFRESH_TOKEN_COOKIE_NAME;
  }

  public static getAccessTokenTtlSeconds() {
    return ACCESS_TOKEN_TTL_SECONDS;
  }

  public static async issueTokens(user: IPassportSession, metadata: { userAgent?: string; ip?: string; existingRefreshToken?: string | null } = {}): Promise<ITokenPair> {
    const { token: refreshToken, expiresAt } = await this.generateRefreshToken(user.id as string, metadata);
    const { token: accessToken } = await this.generateAccessToken(user);

    return {
      accessToken,
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      refreshTokenExpiresAt: expiresAt
    };
  }

  public static async generateAccessToken(user: IPassportSession) {
    if (!user?.id) {
      throw new Error("Unable to issue token without user id");
    }

    const payload = {
      sub: user.id,
      team_id: user.team_id,
      owner_id: user.owner_id
    };

    const token = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS
    });

    return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  public static async verifyAccessToken(token: string) {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as IAccessTokenPayload & { team_id?: string; owner_id?: string; };
    return decoded;
  }

  public static async revokeRefreshToken(token: string | null | undefined) {
    if (!token) return;
    const tokenHash = this.hashToken(token);
    await db.query(`UPDATE user_refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1;`, [tokenHash]);
  }

  public static async revokeAllUserTokens(userId?: string) {
    if (!userId) return;
    await db.query(`UPDATE user_refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL;`, [userId]);
  }

  public static async replaceRefreshToken(oldToken: string, user: IPassportSession, metadata: { userAgent?: string; ip?: string; }) {
    await this.revokeRefreshToken(oldToken);
    return this.issueTokens(user, metadata);
  }

  public static async findValidRefreshToken(token: string): Promise<IRefreshTokenRecord | null> {
    const tokenHash = this.hashToken(token);
    const q = `SELECT id, user_id, expires_at, revoked_at
               FROM user_refresh_tokens
               WHERE token_hash = $1
               LIMIT 1;`;
    const result = await db.query(q, [tokenHash]);
    if (!result.rowCount) return null;
    const [data] = result.rows;
    if (data.revoked_at) return null;
    if (new Date(data.expires_at) < new Date()) return null;
    return data;
  }

  private static async generateRefreshToken(userId: string, metadata: { userAgent?: string; ip?: string; existingRefreshToken?: string | null }) {
    const token = crypto.randomBytes(48).toString("hex");
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    await db.query(`INSERT INTO user_refresh_tokens (user_id, token_hash, expires_at, created_by_ip, user_agent)
                    VALUES ($1, $2, $3, $4, $5);`, [
      userId,
      tokenHash,
      expiresAt,
      metadata.ip || null,
      metadata.userAgent || null
    ]);

    if (metadata.existingRefreshToken) {
      await this.revokeRefreshToken(metadata.existingRefreshToken);
    }

    return { token, expiresAt };
  }

  private static hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
