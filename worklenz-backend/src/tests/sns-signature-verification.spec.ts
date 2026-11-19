import crypto from "crypto";
import https from "https";
import EventEmitter from "events";
import {
  validateSnsCertUrl,
  validateSnsSubscribeUrl,
  isAllowedTopicArn,
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
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

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

  describe("isAllowedTopicArn", () => {
    it("fails closed when neither AWS_SNS_TOPIC_ARNS nor AWS_SES_TOPIC_ARN is configured", () => {
      delete process.env.AWS_SNS_TOPIC_ARNS;
      delete process.env.AWS_SES_TOPIC_ARN;
      expect(isAllowedTopicArn("arn:aws:sns:us-east-1:123456789012:worklenz-ses")).toBe(false);
      expect(isAllowedTopicArn("arn:aws:sns:eu-west-1:999888777666:topic_name")).toBe(false);
    });

    it("allows configured topic ARNs when AWS_SNS_TOPIC_ARNS is set", () => {
      process.env.AWS_SNS_TOPIC_ARNS = "arn:aws:sns:us-east-1:123456789012:worklenz-ses, arn:aws:sns:eu-west-1:999888777666:topic_name";
      expect(isAllowedTopicArn("arn:aws:sns:us-east-1:123456789012:worklenz-ses")).toBe(true);
      expect(isAllowedTopicArn("arn:aws:sns:eu-west-1:999888777666:topic_name")).toBe(true);
      expect(isAllowedTopicArn("arn:aws:sns:us-east-1:123456789012:attacker-topic")).toBe(false);
    });

    it("allows configured topic ARN when AWS_SES_TOPIC_ARN is set", () => {
      delete process.env.AWS_SNS_TOPIC_ARNS;
      process.env.AWS_SES_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:worklenz-ses";
      expect(isAllowedTopicArn("arn:aws:sns:us-east-1:123456789012:worklenz-ses")).toBe(true);
      expect(isAllowedTopicArn("arn:aws:sns:us-east-1:123456789012:other-topic")).toBe(false);
    });

    it("rejects invalid Topic ARNs", () => {
      process.env.AWS_SNS_TOPIC_ARNS = "arn:aws:sns:us-east-1:123456789012:worklenz-ses";
      expect(isAllowedTopicArn("invalid-arn")).toBe(false);
      expect(isAllowedTopicArn("arn:aws:sqs:us-east-1:123456789012:queue")).toBe(false);
      expect(isAllowedTopicArn(undefined)).toBe(false);
    });
  });

  describe("validateSnsSubscribeUrl", () => {
    const topic = "arn:aws:sns:us-east-1:123456789012:worklenz-ses";
    const token = "tok-12345";
    const validUrl = `https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=${encodeURIComponent(topic)}&Token=${token}`;

    it("accepts authentic AWS confirmation URL matching topic and token", () => {
      expect(validateSnsSubscribeUrl(validUrl, topic, token)).toBe(true);
    });

    it("rejects URL with wrong action or mismatched topic/token", () => {
      expect(validateSnsSubscribeUrl(validUrl.replace("ConfirmSubscription", "Unsubscribe"), topic, token)).toBe(false);
      expect(validateSnsSubscribeUrl(validUrl, "mismatched-topic", token)).toBe(false);
      expect(validateSnsSubscribeUrl(validUrl, topic, "mismatched-token")).toBe(false);
    });

    it("rejects non-AWS hosts or non-root path", () => {
      expect(validateSnsSubscribeUrl(`https://attacker.com/?Action=ConfirmSubscription&TopicArn=${encodeURIComponent(topic)}&Token=${token}`, topic, token)).toBe(false);
      expect(validateSnsSubscribeUrl(`https://sns.us-east-1.amazonaws.com/path?Action=ConfirmSubscription&TopicArn=${encodeURIComponent(topic)}&Token=${token}`, topic, token)).toBe(false);
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
    const allowedTopic = "arn:aws:sns:us-east-1:123456789012:worklenz-ses";

    beforeEach(() => {
      process.env.AWS_SNS_TOPIC_ARNS = allowedTopic;
    });

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
          TopicArn: allowedTopic,
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

    it("rejects requests from unauthorized TopicArn even if well-formed", async () => {
      const req = createMockRequest({
        body: {
          Type: "Notification",
          TopicArn: "arn:aws:sns:us-east-1:123456789012:attacker-topic",
          Message: "{\"notificationType\":\"Bounce\"}",
          Signature: "c29tZXNpZw==",
          SignatureVersion: "1",
          SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem"
        }
      });
      const res = createMockResponse();
      const next = jest.fn();

      await verifySnsNotification(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes verification and calls next when signature and topic are valid", async () => {
      const msg: Record<string, any> = {
        Type: "Notification",
        Message: JSON.stringify({ notificationType: "Bounce" }),
        MessageId: "msg-123",
        Timestamp: "2026-11-19T12:00:00Z",
        TopicArn: allowedTopic,
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

    it("confirms subscription successfully with 200 when SubscribeURL is valid and fetch succeeds", async () => {
      const token = "236245235342";
      const subscribeUrl = `https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=${encodeURIComponent(allowedTopic)}&Token=${token}`;
      const msg: Record<string, any> = {
        Type: "SubscriptionConfirmation",
        Message: "Subscription confirmation",
        MessageId: "sub-123",
        SubscribeURL: subscribeUrl,
        Timestamp: "2026-11-19T12:00:00Z",
        Token: token,
        TopicArn: allowedTopic,
        SignatureVersion: "1",
        SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem"
      };

      const stringToSign = buildSnsStringToSign(msg)!;
      const signer = crypto.createSign("RSA-SHA1");
      signer.update(stringToSign, "utf8");
      msg.Signature = signer.sign(privateKey, "base64");

      const { snsCertFetcher } = require("../shared/sns-validator");
      jest.spyOn(snsCertFetcher, "fetch").mockResolvedValue(publicKey);

      // Mock https.get for subscription confirmation to return 200 OK
      const getSpy = jest.spyOn(https, "get").mockImplementation((options: any, callback: any) => {
        const fakeReq = new EventEmitter() as any;
        fakeReq.destroy = jest.fn();
        process.nextTick(() => {
          const fakeRes = new EventEmitter() as any;
          fakeRes.statusCode = 200;
          fakeRes.resume = jest.fn();
          if (typeof callback === "function") {
            callback(fakeRes);
          }
        });
        return fakeReq;
      });

      const req = createMockRequest({ body: JSON.stringify(msg) });
      const res = createMockResponse();
      const next = jest.fn();

      await verifySnsNotification(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(next).not.toHaveBeenCalled();
      getSpy.mockRestore();
    });

    it("returns 500 when subscription confirmation fetch fails so SNS can retry", async () => {
      const token = "236245235342";
      const subscribeUrl = `https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=${encodeURIComponent(allowedTopic)}&Token=${token}`;
      const msg: Record<string, any> = {
        Type: "SubscriptionConfirmation",
        Message: "Subscription confirmation",
        MessageId: "sub-123",
        SubscribeURL: subscribeUrl,
        Timestamp: "2026-11-19T12:00:00Z",
        Token: token,
        TopicArn: allowedTopic,
        SignatureVersion: "1",
        SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem"
      };

      const stringToSign = buildSnsStringToSign(msg)!;
      const signer = crypto.createSign("RSA-SHA1");
      signer.update(stringToSign, "utf8");
      msg.Signature = signer.sign(privateKey, "base64");

      const { snsCertFetcher } = require("../shared/sns-validator");
      jest.spyOn(snsCertFetcher, "fetch").mockResolvedValue(publicKey);

      // Mock https.get to fail with 500 error
      const getSpy = jest.spyOn(https, "get").mockImplementation((options: any, callback: any) => {
        const fakeReq = new EventEmitter() as any;
        fakeReq.destroy = jest.fn();
        process.nextTick(() => {
          const fakeRes = new EventEmitter() as any;
          fakeRes.statusCode = 500;
          fakeRes.resume = jest.fn();
          if (typeof callback === "function") {
            callback(fakeRes);
          }
        });
        return fakeReq;
      });

      const req = createMockRequest({ body: JSON.stringify(msg) });
      const res = createMockResponse();
      const next = jest.fn();

      await verifySnsNotification(req, res, next);

      expect(res.statusCode).toBe(500);
      expect(next).not.toHaveBeenCalled();
      getSpy.mockRestore();
    });

    it("returns 400 when SubscriptionConfirmation has missing or invalid SubscribeURL", async () => {
      const msg: Record<string, any> = {
        Type: "SubscriptionConfirmation",
        Message: "Subscription confirmation",
        MessageId: "sub-123",
        SubscribeURL: "https://attacker.com/evil",
        Timestamp: "2026-11-19T12:00:00Z",
        Token: "236245235342",
        TopicArn: allowedTopic,
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

      expect(res.statusCode).toBe(400);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
