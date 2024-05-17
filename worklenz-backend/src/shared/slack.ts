import axios from "axios";
import {isProduction, log_error} from "./utils";

export async function send_to_slack(error: any) {
  if (!isProduction()) return;
  if (!process.env.SLACK_WEBHOOK) return;
  try {
    const url = process.env.SLACK_WEBHOOK;
    const blocks = [];

    const title = error.message || "Error";

    blocks.push({
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": title,
        "emoji": true
      }
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`\n${JSON.stringify(error)}\`\`\``
      }
    });

    const request = {blocks};
    await axios.post(url, JSON.stringify(request));
  } catch (e) {
    log_error(e);
  }
}
