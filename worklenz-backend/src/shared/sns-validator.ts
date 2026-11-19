import crypto from "crypto";
import https from "https";
import { Request, Response, NextFunction } from "express";
import { ServerResponse } from "../models/server-response";
import { log_error } from "./utils";
import { publicHttpsAgent } from "./ssrf-guard";

// In-memory bounded cache for SNS certificates: URL -> PEM certificate string
const MAX_CERT_CACHE_SIZE = 50;
const certCache = new Map<string, { cert: string; expires: number }>();
const CERT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheCert(url: string, cert: string): void {
  if (certCache.size >= MAX_CERT_CACHE_SIZE) {
    const oldestKey = certCache.keys().next().value;
    if (oldestKey) {
      certCache.delete(oldestKey);
    }
  }
  certCache.set(url, { cert, expires: Date.now() + CERT_CACHE_TTL_MS });
}

/**
 * Checks that the topic ARN is either in the configured allowlist (if set)
 * or matches an expected Amazon SNS ARN format.
 */
export function isAllowedTopicArn(topicArn?: string): boolean {
  if (!topicArn || typeof topicArn !== "string") return false;
  const configuredArns = process.env.AWS_SNS_TOPIC_ARNS || process.env.AWS_SES_TOPIC_ARN;
  if (configuredArns) {
    const allowed = configuredArns.split(",").map(a => a.trim()).filter(Boolean);
    return allowed.includes(topicArn);
  }
  return /^arn:aws:sns:[a-zA-Z0-9-]+:\d{12}:[a-zA-Z0-9-_]+$/.test(topicArn);
}

/**
 * Validates that the SigningCertURL is hosted on an official Amazon AWS SNS endpoint
 * Example: https://sns.us-east-1.amazonaws.com/SimpleNotificationService-010a637e18fa1f761b963a447047ff1e.pem
 */
export function validateSnsCertUrl(certUrl: string): boolean {
  if (!certUrl || typeof certUrl !== "string") return false;
  if (certUrl.includes("..")) return false;

  try {
    const parsed = new URL(certUrl);
    // Protocol must strictly be HTTPS
    if (parsed.protocol !== "https:") return false;

    // Reject query parameters, fragments, and credentials to prevent URL manipulation / SSRF tricks
    if (parsed.search || parsed.hash || parsed.username || parsed.password) return false;

    // Host must match sns.<region>.amazonaws.com or sns.<region>.amazonaws.com.cn
    if (!/^sns\.[a-zA-Z0-9-]+\.amazonaws\.com(\.cn)?$/.test(parsed.hostname)) {
      return false;
    }

    // Pathname must strictly be a .pem file name without directory traversal
    if (!/^\/[a-zA-Z0-9-_.]+\.pem$/.test(parsed.pathname) || parsed.pathname.includes("..")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates that the SubscribeURL is a genuine Amazon AWS SNS confirmation endpoint
 */
export function validateSnsSubscribeUrl(subscribeUrl: string, topicArn?: string, token?: string): boolean {
  if (!subscribeUrl || typeof subscribeUrl !== "string") return false;
  if (subscribeUrl.includes("..")) return false;

  try {
    const parsed = new URL(subscribeUrl);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password || parsed.hash) return false;
    if (!/^sns\.[a-zA-Z0-9-]+\.amazonaws\.com(\.cn)?$/.test(parsed.hostname)) return false;
    if (parsed.pathname !== "/") return false;
    if (parsed.searchParams.get("Action") !== "ConfirmSubscription") return false;
    if (topicArn && parsed.searchParams.get("TopicArn") !== topicArn) return false;
    if (token && parsed.searchParams.get("Token") !== token) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Constructs the canonical string to sign according to AWS SNS specification
 */
export function buildSnsStringToSign(message: Record<string, any>): string | null {
  if (!message || typeof message !== "object") return null;
  const type = message.Type;
  if (!type || typeof type !== "string") return null;

  const lines: string[] = [];

  if (type === "Notification") {
    const fields = ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"];
    for (const field of fields) {
      if (field in message && message[field] !== undefined && message[field] !== null) {
        if (typeof message[field] !== "string" && typeof message[field] !== "number") {
          return null;
        }
        lines.push(field);
        lines.push(String(message[field]));
      }
    }
  } else if (type === "SubscriptionConfirmation" || type === "UnsubscribeConfirmation") {
    const fields = ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
    for (const field of fields) {
      if (field in message && message[field] !== undefined && message[field] !== null) {
        if (typeof message[field] !== "string" && typeof message[field] !== "number") {
          return null;
        }
        lines.push(field);
        lines.push(String(message[field]));
      }
    }
  } else {
    return null;
  }

  return lines.join("\n") + "\n";
}

/**
 * Fetches the PEM certificate from the validated AWS SNS URL
 */
export async function fetchSnsCertificate(certUrl: string): Promise<string> {
  if (!validateSnsCertUrl(certUrl)) {
    throw new Error("Invalid or untrusted SNS certificate URL");
  }

  const parsed = new URL(certUrl);
  const cacheKey = parsed.origin + parsed.pathname;
  const cached = certCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.cert;
  }

  return new Promise((resolve, reject) => {
    const requestOptions: https.RequestOptions = {
      protocol: "https:",
      hostname: parsed.hostname,
      path: parsed.pathname,
      agent: publicHttpsAgent,
      timeout: 5000,
    };

    const req = https.get(requestOptions, res => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch SNS cert: HTTP ${res.statusCode}`));
      }
      let data = "";
      res.setEncoding("utf8");
      res.on("data", chunk => {
        data += chunk;
        if (data.length > 50000) {
          req.destroy();
          reject(new Error("SNS certificate exceeds maximum allowed size"));
        }
      });
      res.on("end", () => {
        if (!res.complete) {
          return reject(new Error("SNS certificate stream was interrupted"));
        }
        cacheCert(cacheKey, data);
        resolve(data);
      });
      res.on("close", () => {
        if (!res.complete) {
          reject(new Error("SNS certificate response closed prematurely"));
        }
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout fetching SNS certificate"));
    });
  });
}

export const snsCertFetcher = {
  fetch: fetchSnsCertificate
};

/**
 * Cryptographically verifies an Amazon SNS notification payload
 */
export async function verifySnsSignature(body: Record<string, any>): Promise<boolean> {
  if (!body || typeof body !== "object") return false;

  const { Signature, SignatureVersion, SigningCertURL } = body;
  if (!Signature || !SigningCertURL) return false;

  // Validate topic ARN before performing remote certificate retrieval
  if (!body.TopicArn || !isAllowedTopicArn(body.TopicArn)) {
    return false;
  }

  // Only SignatureVersion "1" (SHA1withRSA) and "2" (SHA256withRSA) are valid
  const hashAlgorithm = SignatureVersion === "2" ? "RSA-SHA256" : SignatureVersion === "1" ? "RSA-SHA1" : null;
  if (!hashAlgorithm) return false;

  if (!validateSnsCertUrl(SigningCertURL)) {
    return false;
  }

  const stringToSign = buildSnsStringToSign(body);
  if (!stringToSign) return false;

  try {
    const certPem = await snsCertFetcher.fetch(SigningCertURL);
    const verifier = crypto.createVerify(hashAlgorithm);
    verifier.update(stringToSign, "utf8");
    return verifier.verify(certPem, Signature, "base64");
  } catch (err) {
    log_error(`SNS signature verification error: ${err}`);
    return false;
  }
}

/**
 * Express middleware to enforce SNS cryptographic signature verification
 */
export async function verifySnsNotification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
        req.body = body;
      } catch {
        return res.status(400).json(new ServerResponse(false, null, "Invalid JSON payload"));
      }
    }

    if (!body || typeof body !== "object") {
      return res.status(400).json(new ServerResponse(false, null, "Malformed SNS payload"));
    }

    const isValid = await verifySnsSignature(body);
    if (!isValid) {
      return res.status(403).json(new ServerResponse(false, null, "Invalid SNS signature"));
    }

    // Handle subscription confirmation if needed
    if (body.Type === "SubscriptionConfirmation") {
      console.log(`[SNS] SubscriptionConfirmation received for topic ${body.TopicArn || ""}`);
      if (body.SubscribeURL && validateSnsSubscribeUrl(body.SubscribeURL, body.TopicArn, body.Token)) {
        const confirmUrl = new URL(body.SubscribeURL);
        await new Promise<void>((resolve, reject) => {
          const req = https.get(
            {
              protocol: "https:",
              hostname: confirmUrl.hostname,
              path: confirmUrl.pathname + confirmUrl.search,
              agent: publicHttpsAgent,
              timeout: 5000,
            },
            confirmationRes => {
              confirmationRes.resume();
              if (confirmationRes.statusCode && confirmationRes.statusCode >= 200 && confirmationRes.statusCode < 300) {
                resolve();
              } else {
                reject(new Error(`Failed to confirm subscription: HTTP ${confirmationRes.statusCode}`));
              }
            }
          );
          req.on("error", reject);
          req.on("timeout", () => {
            req.destroy();
            reject(new Error("Timeout confirming subscription"));
          });
        }).catch(err => {
          log_error(`[SNS] Subscription confirmation error: ${err.message}`);
        });
      }
      return res.status(200).json(new ServerResponse(true, null, "Subscription confirmed"));
    }

    next();
  } catch (error) {
    next(error);
  }
}
