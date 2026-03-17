import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { Validator } from "jsonschema";
import { QueryResult } from "pg";
import { log_error, isValidateEmail } from "./utils";
import emailRequestSchema from "../json_schemas/email-request-schema";
import db from "../config/db";

const sesClient = new SESClient({ region: process.env.AWS_REGION });

export interface IEmail {
  to?: string[];
  subject: string;
  html: string;
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

  constructor(toEmails: string[], subject: string, content: string) {
    this.to = toEmails;
    this.subject = subject;
    this.html = content;
  }
}

function isValidMailBody(body: IEmail) {
  const validator = new Validator();
  return validator.validate(body, emailRequestSchema).valid;
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

    // Send via AWS SES
    console.log("\n📧 Sending email via AWS SES...");
    console.log("To:", options.to.join(", "));
    console.log("Subject:", options.subject);

    const charset = "UTF-8";
    
    // Generate plain text version by stripping HTML tags
    const plainText = options.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const command = new SendEmailCommand({
      Destination: {
        ToAddresses: options.to,
      },
      Message: {
        Subject: {
          Charset: charset,
          Data: options.subject,
        },
        Body: {
          Html: {
            Charset: charset,
            Data: options.html,
          },
          Text: {
            Charset: charset,
            Data: plainText,
          },
        },
      },
      Source: "Worklenz <noreply@worklenz.com>",
    });

    const res = await sesClient.send(command);
    messageId = res.MessageId;
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
