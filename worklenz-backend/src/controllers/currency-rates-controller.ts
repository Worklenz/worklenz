import https from "https";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import HandleExceptions from "../decorators/handle-exceptions";
import WorklenzControllerBase from "./worklenz-controller-base";

/**
 * Exchange Rate Provider: currency-api (fawazahmed0)
 * Completely free, no API key, no rate limits.
 * Updates daily. Hosted on Cloudflare Pages.
 */

interface RatesCache {
  base: string;
  rates: Record<string, number>;
  date: string;
  fetchedAt: number;
}

// Cache for 1 hour — the API updates once daily so this is more than fresh enough
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache: Map<string, RatesCache> = new Map();

// ISO 4217-style currency code — 3 uppercase letters. Anything else is rejected
// before it can reach the outbound fetch URL or become a cache key.
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

function evictExpiredCacheEntries(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.fetchedAt >= CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

function fetchFromUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", (err) => reject(err));
  });
}

async function fetchRates(base: string): Promise<{ rates: Record<string, number>; date: string }> {
  const lowerBase = base.toLowerCase();

  const primaryBase  = process.env.CURRENCY_API_PRIMARY_URL;
  const fallbackBase = process.env.CURRENCY_API_FALLBACK_URL;

  if (!primaryBase) {
    throw new Error("CURRENCY_API_PRIMARY_URL is not set in environment.");
  }

  const primary  = `${primaryBase}/${lowerBase}.json`;
  const fallback = fallbackBase ? `${fallbackBase}/${lowerBase}.json` : null;

  let rawJson: string;
  try {
    rawJson = await fetchFromUrl(primary);
  } catch {
    // Primary failed — try mirror if configured
    if (!fallback) throw new Error("Primary currency API failed and no fallback URL is configured.");
    rawJson = await fetchFromUrl(fallback);
  }

  const json = JSON.parse(rawJson);

  // Response shape: { date: "2026-07-27", "usd": { "eur": 0.877, ... } }
  const rates = json[lowerBase] as Record<string, number>;
  if (!rates || typeof rates !== "object") {
    throw new Error(`Unexpected response shape for base currency: ${base}`);
  }

  // Normalise all keys to uppercase to match our currency codes (USD, EUR, etc.)
  const normalisedRates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(rates)) {
    normalisedRates[code.toUpperCase()] = rate as number;
  }

  return { rates: normalisedRates, date: json.date ?? "" };
}

export default class CurrencyRatesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getRates(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const base = ((req.query.base as string) || "USD").toUpperCase();

    if (!CURRENCY_CODE_PATTERN.test(base)) {
      return res.status(400).send(
        new ServerResponse(false, null, `Invalid currency code: ${base}`)
      );
    }

    evictExpiredCacheEntries();

    // Serve from cache if still fresh
    const cached = cache.get(base);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return res.status(200).send(
        new ServerResponse(true, {
          base,
          rates: cached.rates,
          date: cached.date,
          cached: true,
          fetched_at: new Date(cached.fetchedAt).toISOString(),
        })
      );
    }

    const { rates, date } = await fetchRates(base);

    cache.set(base, { base, rates, date, fetchedAt: Date.now() });

    return res.status(200).send(
      new ServerResponse(true, {
        base,
        rates,
        date,
        cached: false,
        fetched_at: new Date().toISOString(),
      })
    );
  }
}
