import axios from "axios";
import {isProduction, log_error} from "./utils";

export async function send_to_slack(error: any) {
  if (!isProduction()) return;
  if (!process.env.SLACK_WEBHOOK) return;
  
  try {
    const url = process.env.SLACK_WEBHOOK;
    const blocks = [];

    const title = error.message || "Error";

    // Extract stack trace information
    const obj: any = {};
    Error.captureStackTrace(obj, error);
    const traceStack = obj.stack;
    const errorStack = traceStack.split("\n");
    const errorOrigin = errorStack[3]?.trim() || "Unknown origin";

    // Add error title
    blocks.push({
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": title,
        "emoji": true
      }
    });

    // Add error details
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`\n${JSON.stringify(error)}\`\`\``
      }
    });

    // Add stack trace origin
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`\n${JSON.stringify({errorOrigin})}\`\`\``
      }
    });

    // Add divider
    blocks.push({
      "type": "divider"
    });

    const request = {blocks};
    await axios.post(url, JSON.stringify(request));
  } catch (e) {
    log_error(e);
  }
}
