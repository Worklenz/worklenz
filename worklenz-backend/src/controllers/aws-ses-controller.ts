import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {ISESBouncedMessage} from "../interfaces/aws-bounced-email-response";
import db from "../config/db";
import {ISESComplaintMessage} from "../interfaces/aws-complaint-email-response";
import {ISESWebhookMessage, ISESDeliveryMessage, ISESSendMessage, ISESRejectMessage} from "../interfaces/aws-delivery-response";
import {log_error} from "../shared/utils";

export default class AwsSesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async handleBounceResponse(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const message = JSON.parse(req.body.Message) as ISESBouncedMessage;

    if (message.notificationType === "Bounce" && message.bounce.bounceType === "Permanent") {
      const bouncedEmails = Array.from(new Set(message.bounce.bouncedRecipients.map(r => r.emailAddress)));

      for (const email of bouncedEmails) {
        const q = `
          INSERT INTO bounced_emails (email)
          VALUES ($1)
          ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;
        `;
        await db.query(q, [email]);
      }
    }

    return res.status(200).send(new ServerResponse(true, null));
  }

  @HandleExceptions()
  public static async handleComplaintResponse(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const message = JSON.parse(req.body.Message) as ISESComplaintMessage;

    if (message.notificationType === "Complaint") {
      const spamEmails = Array.from(new Set(message.complaint.complainedRecipients.map(r => r.emailAddress)));

      for (const email of spamEmails) {
        const q = `
          INSERT INTO spam_emails (email)
          VALUES ($1)
          ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;
        `;
        await db.query(q, [email]);
      }
    }

    return res.status(200).send(new ServerResponse(true, null));
  }

  @HandleExceptions()
  public static async handleReplies(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return res.status(200).send(new ServerResponse(true, null));
  }

  @HandleExceptions()
  public static async handleDeliveryEvents(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const message = JSON.parse(req.body.Message) as ISESWebhookMessage;

      await this.processDeliveryEvent(message);

      return res.status(200).send(new ServerResponse(true, null));
    } catch (error) {
      log_error(error);
      return res.status(200).send(new ServerResponse(true, null)); // Always return 200 to AWS
    }
  }

  private static async processDeliveryEvent(message: ISESWebhookMessage): Promise<void> {
    const messageId = message.mail.messageId;
    const timestamp = new Date(message.mail.timestamp);
    const recipients = message.mail.destination;

    switch (message.notificationType) {
      case 'Send':
        await this.recordDeliveryEvent(messageId, 'send', recipients, timestamp, null);
        break;

      case 'Delivery':
        const deliveryMessage = message as ISESDeliveryMessage;
        const deliveryTimestamp = new Date(deliveryMessage.delivery.timestamp);
        await this.recordDeliveryEvent(messageId, 'delivery', deliveryMessage.delivery.recipients, deliveryTimestamp, {
          smtpResponse: deliveryMessage.delivery.smtpResponse,
          processingTimeMillis: deliveryMessage.delivery.processingTimeMillis
        });
        break;

      case 'Reject':
        const rejectMessage = message as ISESRejectMessage;
        await this.recordDeliveryEvent(messageId, 'reject', recipients, timestamp, {
          reason: rejectMessage.reject.reason
        });
        break;

      case 'Bounce':
        // Handled by existing handleBounceResponse method
        break;

      case 'Complaint':
        // Handled by existing handleComplaintResponse method
        break;
    }
  }

  private static async recordDeliveryEvent(
    messageId: string,
    eventType: string,
    recipients: string[],
    timestamp: Date,
    details: any
  ): Promise<void> {
    try {
      for (const recipient of recipients) {
        const q = `
          INSERT INTO email_delivery_events (message_id, event_type, recipient_email, timestamp, details)
          VALUES ($1, $2, $3, $4, $5);
        `;
        await db.query(q, [messageId, eventType, recipient, timestamp, details ? JSON.stringify(details) : null]);
      }
    } catch (error) {
      log_error(error);
    }
  }
}
