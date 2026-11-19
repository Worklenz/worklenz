import crypto from "crypto";
import {
  validateSnsCertUrl,
  buildSnsStringToSign,
  verifySnsSignature,
  verifySnsNotification,
} from "../shared/sns-validator";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

// Generate an ephemeral RSA key pair for testing verification
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});

describe("SNS signature verification", () => {
  describe("validateSnsCertUrl", () => {
    it("allows genuine AWS SNS certificate URLs", () => {
      expect(validateSnsCertUrl("https://sns.us-east-1.amazonaws.com/SimpleNotificationService-1234.pem")).toBe(true);
      expect(validateSnsCertUrl("https://sns.eu-west-1.amazonaws.com/cert.pem")).toBe(true);
      expect(validateSnsCertUrl("https://sns.cn-north-1.amazonaws.com.cn/cert.pem")).toBe(true);
    });

    it("rejects non-HTTPS URLs", () => {
      expect(validateSnsCertUrl("http://sns.us-east-1.amazonaws.com/cert.pem")).toBe(false);
    });

    it("rejects untrusted domains and spoofed hostnames", () => {
      expect(validateSnsCertUrl("https://attacker.example.com/cert.pem")).toBe(false);
      expect(validateSnsCertUrl("https://sns.us-east-1.amazonaws.com.attacker.com/cert.pem")).toBe(false);
      expect(validateSnsCertUrl("https://evil-amazonaws.com/cert.pem")).toBe(false);
    });

    it("rejects non-pem file extensions", () => {
      expect(validateSnsCertUrl("https://sns.us-east-1.amazonaws.com/cert.txt")).toBe(false);
      expect(validateSnsCertUrl("https://sns.us-east-1.amazonaws.com/cert.js")).toBe(false);
    });

    it("rejects URLs with query strings, hashes, or path traversal", () => {
      expect(validateSnsCertUrl("https://sns.us-east-1.amazonaws.com/cert.pem?redirect=evil.com")).toBe(false);
      expect(validateSnsCertUrl("https://sns.us-east-1.amazonaws.com/cert.pem#fragment")).toBe(false);
      expect(validateSnsCertUrl("https://sns.us-east-1.amazonaws.com/../evil.pem")).toBe(false);
    });
  });

  describe("buildSnsStringToSign", () => {
    it("builds the correct canonical string for Notification", () => {
      const msg = {
        Type: "Notification",
        Message: "test message",
        MessageId: "id-123",
        Timestamp: "2026-11-19T12:00:00Z",
        TopicArn: "arn:aws:sns:us-east-1:12345:topic"
      };
      const expected = "Message\ntest message\nMessageId\nid-123\nTimestamp\n2026-11-19T12:00:00Z\nTopicArn\narn:aws:sns:us-east-1:12345:topic\nType\nNotification\n";
      expect(buildSnsStringToSign(msg)).toBe(expected);
    });
  });

  describe("verifySnsNotification middleware", () => {
    it("rejects unsigned webhook requests with 403", async () => {
      const req = createMockRequest({
        body: {
          Type: "Notification",
          Message: "{\"notificationType\":\"Bounce\"}"
        }
      });
      const res = createMockResponse();
      const next = jest.fn();

      await verifySnsNotification(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects requests with untrusted SigningCertURL with 403", async () => {
      const req = createMockRequest({
        body: {
          Type: "Notification",
          Message: "{\"notificationType\":\"Bounce\"}",
          Signature: "c29tZXNpZw==",
          SignatureVersion: "1",
          SigningCertURL: "https://attacker.com/cert.pem"
        }
      });
      const res = createMockResponse();
      const next = jest.fn();

      await verifySnsNotification(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes verification and calls next when signature is valid", async () => {
      const msg: Record<string, any> = {
        Type: "Notification",
        Message: JSON.stringify({ notificationType: "Bounce" }),
        MessageId: "msg-123",
        Timestamp: "2026-11-19T12:00:00Z",
        TopicArn: "arn:aws:sns:us-east-1:123456789012:worklenz-ses",
        SignatureVersion: "1",
        SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem"
      };

      const stringToSign = buildSnsStringToSign(msg)!;
      const signer = crypto.createSign("RSA-SHA1");
      signer.update(stringToSign, "utf8");
      msg.Signature = signer.sign(privateKey, "base64");

      // Mock certificate fetch to return our test public key
      const { snsCertFetcher } = require("../shared/sns-validator");
      jest.spyOn(snsCertFetcher, "fetch").mockResolvedValue(publicKey);

      const req = createMockRequest({ body: msg });
      const res = createMockResponse();
      const next = jest.fn();

      await verifySnsNotification(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it("confirms subscription without outbound HTTP requests when signature is valid", async () => {
      const msg: Record<string, any> = {
        Type: "SubscriptionConfirmation",
        Message: "Subscription confirmation",
        MessageId: "sub-123",
        SubscribeURL: "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription",
        Timestamp: "2026-11-19T12:00:00Z",
        Token: "236245235342",
        TopicArn: "arn:aws:sns:us-east-1:123456789012:worklenz-ses",
        SignatureVersion: "1",
        SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem"
      };

      const stringToSign = buildSnsStringToSign(msg)!;
      const signer = crypto.createSign("RSA-SHA1");
      signer.update(stringToSign, "utf8");
      msg.Signature = signer.sign(privateKey, "base64");

      const { snsCertFetcher } = require("../shared/sns-validator");
      jest.spyOn(snsCertFetcher, "fetch").mockResolvedValue(publicKey);

      const req = createMockRequest({ body: JSON.stringify(msg) });
      const res = createMockResponse();
      const next = jest.fn();

      await verifySnsNotification(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
