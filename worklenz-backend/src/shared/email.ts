import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import {
  SendEmailCommand as SendEmailCommandV2,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import nodemailer from "nodemailer";
import { Validator } from "jsonschema";
import { QueryResult } from "pg";
import lodash from "lodash";
import sanitizeHtmlLib from "sanitize-html";
import { log_error, isValidateEmail } from "./utils";
import emailRequestSchema from "../json_schemas/email-request-schema";
import db from "../config/db";

const sesClient = new SESClient({ region: process.env.AWS_REGION });
/** SESv2 is used for attachment sends (Simple content + Attachments maps to ses:SendEmail). */
const sesV2Client = new SESv2Client({ region: process.env.AWS_REGION });

/** SES raw message limit is 10MB; keep headroom for MIME wrappers. */
export const MAX_EMAIL_ATTACHMENT_BYTES = 9 * 1024 * 1024;
export const MAX_EMAIL_ATTACHMENTS = 10;

type EmailProvider = "ses" | "smtp";

interface EmailConfiguration {
  provider: EmailProvider;
  from: string;
}

/** Resolves a supported provider, or null when the configured value is invalid. */
function getEmailProvider(): EmailProvider | null {
  const configuredProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (!configuredProvider || configuredProvider === "ses") {
    return "ses";
  }

  return configuredProvider === "smtp" ? "smtp" : null;
}

/** Returns the selected provider and sender address with backwards-compatible defaults. */
function getEmailConfiguration(): EmailConfiguration {
  return {
    // A configuration error prevents mail delivery before this fallback can be
    // used to create a transport.
    provider: getEmailProvider() || "ses",
    // Backwards-compatible default for existing SES installations.
    from: process.env.EMAIL_FROM?.trim() || "Worklenz <noreply@worklenz.com>",
  };
}

/** Lists configuration problems without exposing credential values. */
export function getEmailConfigurationErrors(): string[] {
  const provider = getEmailProvider();
  const errors: string[] = [];

  if (!provider) {
    errors.push("EMAIL_PROVIDER must be either ses or smtp");
    return errors;
  }

  const requiredKeys = provider === "smtp"
    ? ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"]
    : ["AWS_REGION"];

  for (const key of requiredKeys) {
    if (!process.env[key]?.trim()) {
      errors.push(`${key} is required when EMAIL_PROVIDER=${provider}`);
    }
  }

  if (provider === "smtp" && !getSmtpPort()) {
    errors.push("SMTP_PORT must be an integer from 1 to 65535");
  }

  if (provider === "smtp" && !process.env.EMAIL_FROM?.trim()) {
    errors.push("EMAIL_FROM is required when EMAIL_PROVIDER=smtp");
  }

  return errors;
}

/** Parses a valid TCP port without accepting malformed numeric prefixes. */
function getSmtpPort(): number | null {
  const rawPort = process.env.SMTP_PORT?.trim();
  if (!rawPort || !/^\d+$/.test(rawPort)) {
    return null;
  }

  const port = Number(rawPort);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

/** Creates an SMTP transport after getEmailConfigurationErrors has validated it. */
function createSmtpTransport() {
  const port = getSmtpPort();
  if (!port) {
    throw new Error("SMTP_PORT must be an integer from 1 to 65535");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE?.trim().toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

export interface IEmailAttachment {
  /** Display / download filename for the recipient. */
  filename: string;
  /** File bytes (Buffer) or utf-8 string content. */
  content: Buffer | string;
  /** MIME type, e.g. application/pdf */
  contentType?: string;
  /** Optional Content-ID for inline images. */
  cid?: string;
}

export interface IEmail {
  to?: string[];
  subject: string;
  html: string;
  attachments?: IEmailAttachment[];
}

export interface IEmailResult {
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class EmailRequest implements IEmail {
  public readonly html: string;
  public readonly subject: string;
  public readonly to: string[];
  public readonly attachments?: IEmailAttachment[];

  constructor(
    toEmails: string[],
    subject: string,
    content: string,
    attachments?: IEmailAttachment[]
  ) {
    this.to = toEmails;
    this.subject = subject;
    this.html = content;
    this.attachments = attachments;
  }
}

function isValidMailBody(body: IEmail) {
  const validator = new Validator();
  // Strip binary attachment payloads before JSON-schema validation.
  const { attachments: _ignored, ...core } = body;
  const payload =
    Array.isArray(body.attachments) && body.attachments.length
      ? { ...core, attachments: body.attachments.map(() => ({})) }
      : core;
  return validator.validate(payload, emailRequestSchema).valid;
}

/** Normalize and validate attachments; returns an error message or null when OK. */
export function normalizeEmailAttachments(
  attachments: IEmailAttachment[] | undefined
): { attachments: IEmailAttachment[]; error?: string } {
  if (!attachments?.length) return { attachments: [] };
  if (attachments.length > MAX_EMAIL_ATTACHMENTS) {
    return {
      attachments: [],
      error: `At most ${MAX_EMAIL_ATTACHMENTS} attachments are allowed`,
    };
  }

  const normalized: IEmailAttachment[] = [];
  let totalBytes = 0;

  for (const item of attachments) {
    if (!item || typeof item.filename !== "string" || !item.filename.trim()) {
      return { attachments: [], error: "Each attachment requires a filename" };
    }
    if (item.content == null) {
      return {
        attachments: [],
        error: `Attachment "${item.filename}" has no content`,
      };
    }

    const content =
      typeof item.content === "string"
        ? Buffer.from(item.content, "utf8")
        : Buffer.isBuffer(item.content)
          ? item.content
          : null;

    if (!content) {
      return {
        attachments: [],
        error: `Attachment "${item.filename}" content must be a Buffer or string`,
      };
    }

    totalBytes += content.byteLength;
    if (totalBytes > MAX_EMAIL_ATTACHMENT_BYTES) {
      return {
        attachments: [],
        error: `Attachments exceed the ${MAX_EMAIL_ATTACHMENT_BYTES} byte limit`,
      };
    }

    normalized.push({
      filename: item.filename.trim(),
      content,
      contentType:
        typeof item.contentType === "string" && item.contentType.trim()
          ? item.contentType.trim()
          : undefined,
      cid: typeof item.cid === "string" && item.cid.trim() ? item.cid.trim() : undefined,
    });
  }

  return { attachments: normalized };
}

function toNodemailerAttachments(attachments: IEmailAttachment[]) {
  return attachments.map(a => ({
    filename: a.filename,
    content: a.content,
    contentType: a.contentType,
    cid: a.cid,
  }));
}

/** Maps app attachments to SESv2 Simple.Attachments (IAM action: ses:SendEmail). */
function toSesV2Attachments(attachments: IEmailAttachment[]) {
  return attachments.map(a => {
    const rawContent =
      typeof a.content === "string" ? Buffer.from(a.content, "utf8") : a.content;
    return {
      FileName: a.filename,
      ...(a.contentType ? { ContentType: a.contentType } : {}),
      ContentDisposition: a.cid ? ("INLINE" as const) : ("ATTACHMENT" as const),
      ...(a.cid ? { ContentId: a.cid } : {}),
      ContentTransferEncoding: "BASE64" as const,
      RawContent: rawContent,
    };
  });
}

async function removeMails(query: string, emails: string[]) {
  const result: QueryResult<{ email: string }> = await db.query(query, []);
  const bouncedEmails = result.rows.map((e) => e.email);
  for (let i = emails.length - 1; i >= 0; i--) {
    const email = emails[i];
    if (bouncedEmails.includes(email)) {
      emails.splice(i, 1);
    }
  }
}

async function logEmailAttempt(
  email: string,
  subject: string,
  html: string,
): Promise<string | null> {
  try {
    const q = `
      INSERT INTO email_logs (email, subject, html, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id;
    `;
    const result = await db.query(q, [email, subject, html]);
    return result.rows[0]?.id || null;
  } catch (error) {
    log_error(error);
    return null;
  }
}

async function updateEmailLogStatus(
  logId: string,
  status: "sent" | "failed",
  messageId?: string,
  errorDetails?: string,
): Promise<void> {
  try {
    const q = `
      UPDATE email_logs
      SET status = $2, message_id = $3, error_details = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `;
    await db.query(q, [logId, status, messageId, errorDetails]);
  } catch (error) {
    log_error(error);
  }
}

function categorizeError(error: any): {
  code: string;
  message: string;
  details?: any;
} {
  if (
    error.name === "AccessDenied" ||
    error.Code === "AccessDenied" ||
    error.$metadata?.httpStatusCode === 403
  ) {
    return {
      code: "SES_ACCESS_DENIED",
      message:
        "Amazon SES denied the send. Ensure the IAM identity allows ses:SendEmail (and ses:SendRawEmail if using raw/SMTP).",
      details: error.message || error.Error?.Message,
    };
  }

  if (error.name === "MessageRejected") {
    return {
      code: "MESSAGE_REJECTED",
      message: "Email rejected by Amazon SES",
      details: error.message,
    };
  }

  if (error.name === "SendingQuotaExceeded") {
    return {
      code: "QUOTA_EXCEEDED",
      message: "Daily sending quota exceeded",
      details: error.message,
    };
  }

  if (error.name === "Throttling") {
    return {
      code: "RATE_LIMITED",
      message: "Sending rate exceeded",
      details: error.message,
    };
  }

  if (error.code === "InvalidParameterValue") {
    return {
      code: "INVALID_EMAIL",
      message: "Invalid email address or parameters",
      details: error.message,
    };
  }

  if (error.code === "NetworkingError") {
    return {
      code: "NETWORK_ERROR",
      message: "Network connection failed",
      details: error.message,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: error.message || "Unknown error occurred",
    details: error,
  };
}

async function filterSpamEmails(emails: string[]): Promise<void> {
  await removeMails("SELECT email FROM spam_emails ORDER BY email;", emails);
}

async function filterBouncedEmails(emails: string[]): Promise<void> {
  await removeMails("SELECT email FROM bounced_emails ORDER BY email;", emails);
}

async function filterDeletedAccountEmails(emails: string[]): Promise<void> {
  await removeMails(
    "SELECT email FROM users WHERE is_deleted IS TRUE ORDER BY email;",
    emails,
  );
}

export async function sendEmail(email: IEmail): Promise<string | null> {
  const result = await sendEmailEnhanced(email);
  return result.success ? result.messageId || null : null;
}

export async function sendEmailEnhanced(email: IEmail): Promise<IEmailResult> {
  const logIds: string[] = [];

  try {
    const options = { ...email } as IEmail;
    options.to = Array.isArray(options.to)
      ? Array.from(new Set(options.to))
      : [];

    // Filter out empty, null, undefined, and invalid emails
    options.to = options.to
      .filter(
        (email) =>
          email && typeof email === "string" && email.trim().length > 0,
      )
      .map((email) => email.trim())
      .filter((email) => isValidateEmail(email));

    if (options.to.length) {
      await filterBouncedEmails(options.to);
      await filterSpamEmails(options.to);
      await filterDeletedAccountEmails(options.to);
    }

    // Double-check that we still have valid emails after filtering
    if (!options.to.length) {
      return {
        success: false,
        error: {
          code: "NO_VALID_RECIPIENTS",
          message: "No valid email addresses after filtering",
        },
      };
    }

    if (!isValidMailBody(options)) {
      return {
        success: false,
        error: {
          code: "INVALID_EMAIL_BODY",
          message: "Email body validation failed",
        },
      };
    }

    const attachmentResult = normalizeEmailAttachments(options.attachments);
    if (attachmentResult.error) {
      return {
        success: false,
        error: {
          code: "INVALID_ATTACHMENTS",
          message: attachmentResult.error,
        },
      };
    }
    const attachments = attachmentResult.attachments;
    options.attachments = attachments;

    const configurationErrors = getEmailConfigurationErrors();
    if (configurationErrors.length) {
      return {
        success: false,
        error: {
          code: "EMAIL_CONFIGURATION_ERROR",
          message: configurationErrors.join("; "),
        },
      };
    }

    // Log email attempt for each recipient
    for (const recipient of options.to) {
      const logId = await logEmailAttempt(
        recipient,
        options.subject,
        options.html,
      );
      if (logId) {
        logIds.push(logId);
      }
    }

    let messageId: string | undefined;
    const { provider, from } = getEmailConfiguration();

    console.log(`\n📧 Sending email via ${provider.toUpperCase()}...`);
    console.log("To:", options.to.join(", "));
    console.log("Subject:", options.subject);
    if (attachments.length) {
      console.log(
        "Attachments:",
        attachments.map(a => a.filename).join(", ")
      );
    }

    const charset = "UTF-8";
    
    // Generate plain text version by stripping HTML tags. Use sanitize-html
    // (drops <script>/<style> and their contents reliably) then decode entities
    // so the plaintext body reads naturally.
    const plainText = lodash.unescape(
      sanitizeHtmlLib(options.html, { allowedTags: [], allowedAttributes: {} })
    )
      .replace(/\s+/g, ' ')
      .trim();
    
    if (provider === "smtp") {
      const response = await createSmtpTransport().sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: plainText,
        attachments: toNodemailerAttachments(attachments),
      });
      messageId = response.messageId;
    } else if (attachments.length) {
      // Prefer SESv2 Simple + Attachments so IAM only needs ses:SendEmail
      // (v1 SendRawEmail is often missing from least-privilege SES policies).
      const response = await sesV2Client.send(
        new SendEmailCommandV2({
          FromEmailAddress: from,
          Destination: { ToAddresses: options.to },
          Content: {
            Simple: {
              Subject: { Charset: charset, Data: options.subject },
              Body: {
                Html: { Charset: charset, Data: options.html },
                Text: { Charset: charset, Data: plainText },
              },
              Attachments: toSesV2Attachments(attachments),
            },
          },
        })
      );
      messageId = response.MessageId;
    } else {
      const command = new SendEmailCommand({
        Destination: { ToAddresses: options.to },
        Message: {
          Subject: { Charset: charset, Data: options.subject },
          Body: {
            Html: { Charset: charset, Data: options.html },
            Text: { Charset: charset, Data: plainText },
          },
        },
        Source: from,
      });
      const response = await sesClient.send(command);
      messageId = response.MessageId;
    }
    console.log("✅ Email sent successfully!");
    console.log("Message ID:", messageId);

    // Update log status to sent
    // Append index to messageId to make it unique per recipient when sending to multiple
    for (let i = 0; i < logIds.length; i++) {
      const uniqueMessageId =
        logIds.length > 1 ? `${messageId}-${i}` : messageId;
      await updateEmailLogStatus(logIds[i], "sent", uniqueMessageId);
    }

    return {
      success: true,
      messageId,
    };
  } catch (e) {
    log_error(e);
    const categorizedError = categorizeError(e);

    // Update log status to failed
    for (const logId of logIds) {
      await updateEmailLogStatus(
        logId,
        "failed",
        undefined,
        JSON.stringify(categorizedError),
      );
    }

    return {
      success: false,
      error: categorizedError,
    };
  }
}
