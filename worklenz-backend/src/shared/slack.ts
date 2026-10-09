import axios from "axios";
import {isProduction, log_error} from "./utils";

// Maximum size for error payload to prevent excessive memory usage (500KB)
const MAX_ERROR_PAYLOAD_SIZE = 500 * 1024;

/**
 * Safely serialize error object with size limits to prevent circular references
 * and excessive payload sizes
 */
function serializeError(error: any, maxLength = 3000): string {
  try {
    // Handle Axios errors specifically
    if (error?.isAxiosError) {
      const axiosError = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        data: error.response?.data
      };
      const serialized = JSON.stringify(axiosError, null, 2);
      return serialized.length > maxLength 
        ? `${serialized.substring(0, maxLength)  }\n... (truncated)`
        : serialized;
    }

    // Handle standard errors
    if (error instanceof Error) {
      const standardError = {
        message: error.message,
        name: error.name,
        stack: error.stack?.split("\n").slice(0, 10).join("\n") // Limit stack trace
      };
      const serialized = JSON.stringify(standardError, null, 2);
      return serialized.length > maxLength 
        ? `${serialized.substring(0, maxLength)  }\n... (truncated)`
        : serialized;
    }

    // Handle plain objects
    const serialized = JSON.stringify(error, (key, value) => {
      // Skip large nested objects
      if (typeof value === "object" && value !== null) {
        // Limit nested object serialization
        if (JSON.stringify(value).length > 1000) {
          return "[Large Object]";
        }
      }
      return value;
    }, 2);

    return serialized.length > maxLength 
      ? `${serialized.substring(0, maxLength)  }\n... (truncated)`
      : serialized;
  } catch (e) {
    return `Error serialization failed: ${error?.toString() || "Unknown error"}`;
  }
}

export async function send_to_slack(error: any) {
  if (!isProduction()) return;
  if (!process.env.SLACK_WEBHOOK) return;
  if (process.env.ENABLE_SLACK_NOTIFICATIONS === 'false') return;
  
  try {
    const url = process.env.SLACK_WEBHOOK;
    const blocks = [];

    const title = (error?.message || "Error").substring(0, 150); // Slack limit for header text

    // Extract stack trace information safely
    const obj: any = {};
    Error.captureStackTrace(obj, error);
    const traceStack = obj.stack || "";
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

    // Add error details (with size limit)
    const errorDetails = serializeError(error, 2500); // Slack has a 3000 char limit per block
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`\n${errorDetails}\`\`\``
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
    const payload = JSON.stringify(request);

    // Check payload size before sending
    if (Buffer.byteLength(payload) > MAX_ERROR_PAYLOAD_SIZE) {
      console.warn(`Slack payload too large (${Buffer.byteLength(payload)} bytes), skipping`);
      return;
    }

    await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 5000, // 5 second timeout
      maxBodyLength: MAX_ERROR_PAYLOAD_SIZE
    });
  } catch (e: any) {
    // IMPORTANT: Prevent infinite recursion by NOT sending Slack errors back to Slack
    // Just log to console instead
    console.error("\n==== SLACK NOTIFICATION FAILED ====");
    console.error("Failed to send error notification to Slack:");
    if (e?.response?.status === 404) {
      console.error("Slack webhook returned 404 - webhook URL may be expired or invalid");
      console.error("Please update SLACK_WEBHOOK environment variable with a valid webhook URL");
    } else if (e?.code === "ECONNABORTED") {
      console.error("Slack notification timeout");
    } else {
      console.error(e?.message || e);
    }
    console.error("==== END SLACK NOTIFICATION FAILURE ====\n");
    
    // Do NOT call log_error here to prevent infinite recursion
  }
}
