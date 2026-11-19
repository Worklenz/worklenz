import crypto from "crypto";
import https from "https";
import { Request, Response, NextFunction } from "express";
import { ServerResponse } from "../models/server-response";
import { log_error } from "./utils";

// In-memory cache for SNS certificates: URL -> PEM certificate string
const certCache = new Map<string, { cert: string; expires: number }>();
const CERT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Validates that the SigningCertURL is hosted on an official Amazon AWS SNS endpoint
 * Example: https://sns.us-east-1.amazonaws.com/SimpleNotificationService-010a637e18fa1f761b963a447047ff1e.pem
 */
export function validateSnsCertUrl(certUrl: string): boolean {
  if (!certUrl || typeof certUrl !== "string") return false;

  try {
    const parsed = new URL(certUrl);
    if (parsed.protocol !== "https:") return false;
    // Host must match sns.<region>.amazonaws.com or sns.<region>.amazonaws.com.cn
    if (!/^sns\.[a-zA-Z0-9-]+\.amazonaws\.com(\.cn)?$/.test(parsed.hostname)) {
      return false;
    }
    // File must be a .pem certificate
    if (!parsed.pathname.endsWith(".pem")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Constructs the canonical string to sign according to AWS SNS specification
 */
export function buildSnsStringToSign(message: Record<string, any>): string | null {
  const type = message.Type;
  if (!type) return null;

  const lines: string[] = [];

  if (type === "Notification") {
    const fields = ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"];
    for (const field of fields) {
      if (field in message && message[field] !== undefined && message[field] !== null) {
        lines.push(field);
        lines.push(String(message[field]));
      }
    }
  } else if (type === "SubscriptionConfirmation" || type === "UnsubscribeConfirmation") {
    const fields = ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
    for (const field of fields) {
      if (field in message && message[field] !== undefined && message[field] !== null) {
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
  const cached = certCache.get(certUrl);
  if (cached && cached.expires > Date.now()) {
    return cached.cert;
  }

  return new Promise((resolve, reject) => {
    const req = https.get(certUrl, { timeout: 5000 }, res => {
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
        certCache.set(certUrl, { cert: data, expires: Date.now() + CERT_CACHE_TTL_MS });
        resolve(data);
      });
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

  // Handle subscription confirmation if needed
  if (body.Type === "SubscriptionConfirmation") {
    const isValid = await verifySnsSignature(body);
    if (!isValid) {
      return res.status(403).json(new ServerResponse(false, null, "Invalid SNS signature"));
    }
    // Safely confirm subscription if SubscribeURL is an AWS URL
    if (body.SubscribeURL && validateSnsCertUrl(body.SubscribeURL.split("?")[0])) {
      https.get(body.SubscribeURL, () => {});
    }
    return res.status(200).json(new ServerResponse(true, null, "Subscription confirmed"));
  }

  const isValid = await verifySnsSignature(body);
  if (!isValid) {
    return res.status(403).json(new ServerResponse(false, null, "Invalid SNS signature"));
  }

  next();
}
