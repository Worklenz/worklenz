import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {ISESBouncedMessage} from "../interfaces/aws-bounced-email-response";
import db from "../config/db";
import {ISESComplaintMessage} from "../interfaces/aws-complaint-email-response";

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
    console.log("\n");
    console.log(JSON.stringify(req.body));
    console.log("\n");
    return res.status(200).send(new ServerResponse(true, null));
  }
}
