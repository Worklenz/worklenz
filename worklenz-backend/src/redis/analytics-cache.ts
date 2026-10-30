import { redisClient } from "./client";
import { ANALYTICS_CACHE_TTL_SECONDS } from "../shared/reporting-analytics.constants";

export interface AnalyticsCachePayload<T> {
  data: T;
  /** ISO timestamp — contract for "Last updated" UI */
  lastUpdatedAt: string;
}

const keyFor = (parts: Array<string | number | undefined | null>) =>
  ["analytics", ...parts.filter(Boolean)].join(":");

export async function getAnalyticsCache<T>(
  ...parts: Array<string | number | undefined | null>
): Promise<AnalyticsCachePayload<T> | null> {
  try {
    if (!redisClient?.isOpen) return null;
    const raw = await redisClient.get(keyFor(parts));
    if (!raw) return null;
    return JSON.parse(raw) as AnalyticsCachePayload<T>;
  } catch {
    return null;
  }
}

export async function setAnalyticsCache<T>(
  data: T,
  parts: Array<string | number | undefined | null>,
  ttlSeconds: number = ANALYTICS_CACHE_TTL_SECONDS
): Promise<AnalyticsCachePayload<T>> {
  const payload: AnalyticsCachePayload<T> = {
    data,
    lastUpdatedAt: new Date().toISOString(),
  };

  try {
    if (redisClient?.isOpen) {
      await redisClient.setEx(keyFor(parts), ttlSeconds, JSON.stringify(payload));
    }
  } catch {
    // Cache is best-effort — callers still receive the payload.
  }

  return payload;
}

export async function invalidateAnalyticsCache(
  ...parts: Array<string | number | undefined | null>
): Promise<void> {
  try {
    if (!redisClient?.isOpen) return;
    await redisClient.del(keyFor(parts));
  } catch {
    // ignore
  }
}

/**
 * Delete all analytics cache entries under a prefix (e.g. velocity series hashes
 * for a team). Uses SCAN so it stays safe on large Redis instances.
 */
export async function invalidateAnalyticsCachePrefix(
  ...parts: Array<string | number | undefined | null>
): Promise<void> {
  try {
    if (!redisClient?.isOpen) return;
    const prefix = `${keyFor(parts)}:`;
    let cursor = 0;
    do {
      const reply = await redisClient.scan(cursor, { MATCH: `${prefix}*`, COUNT: 100 });
      cursor = reply.cursor;
      if (reply.keys.length > 0) {
        await redisClient.del(reply.keys);
      }
    } while (cursor !== 0);
  } catch {
    // ignore
  }
}

/** Standard last-updated envelope for analytics API responses. */
export function withLastUpdated<T extends object>(
  body: T,
  lastUpdatedAt?: string | null
): T & { last_updated_at: string } {
  return {
    ...body,
    last_updated_at: lastUpdatedAt ?? new Date().toISOString(),
  };
}
