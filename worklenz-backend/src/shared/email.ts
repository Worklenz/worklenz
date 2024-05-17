import {SendEmailCommand, SESClient} from "@aws-sdk/client-ses";
import {Validator} from "jsonschema";
import {QueryResult} from "pg";
import {log_error} from "./utils";
import emailRequestSchema from "../json_schemas/email-request-schema";
import db from "../config/db";

const sesClient = new SESClient({region: process.env.AWS_REGION});

export interface IEmail {
  to?: string[];
  subject: string;
  html: string;
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
  const result: QueryResult<{ email: string; }> = await db.query(query, []);
  const bouncedEmails = result.rows.map(e => e.email);
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    if (bouncedEmails.includes(email)) {
      emails.splice(i, 1);
    }
  }
}

async function filterSpamEmails(emails: string[]): Promise<void> {
  await removeMails("SELECT email FROM spam_emails ORDER BY email;", emails);
}

async function filterBouncedEmails(emails: string[]): Promise<void> {
  await removeMails("SELECT email FROM bounced_emails ORDER BY email;", emails);
}

export async function sendEmail(email: IEmail): Promise<string | null> {
  try {
    const options = {...email} as IEmail;
    options.to = Array.isArray(options.to) ? Array.from(new Set(options.to)) : [];

    if (options.to.length) {
      await filterBouncedEmails(options.to);
      await filterSpamEmails(options.to);
    }

    if (!isValidMailBody(options)) return null;

    const charset = "UTF-8";

    const command = new SendEmailCommand({
      Destination: {
        ToAddresses: options.to
      },
      Message: {
        Subject: {
          Charset: charset,
          Data: options.subject
        },
        Body: {
          Html: {
            Charset: charset,
            Data: options.html
          }
        }
      },
      Source: process.env.SOURCE_EMAIL // Ex: Worklenz <noreply@worklenz.com>
    });

    const res = await sesClient.send(command);
    return res.MessageId || null;
  } catch (e) {
    log_error(e);
  }

  return null;
}
