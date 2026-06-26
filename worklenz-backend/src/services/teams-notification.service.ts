import axios from "axios";
import { log_error } from "../shared/utils";

/**
 * Teams Notification Service
 * Handles sending notifications to Microsoft Teams via webhooks
 */
export class TeamsNotificationService {

  /**
   * Send notification to Teams via webhook
   * @param webhookUrl - The Teams incoming webhook URL
   * @param message - The message object (adaptive card format)
   */
  public static async sendTeamsNotification(
    webhookUrl: string,
    message: any
  ): Promise<void> {
    try {
      await axios.post(webhookUrl, message, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 10000 // 10 seconds timeout
      });
    } catch (error: any) {
      log_error("Teams webhook error:", error?.response?.data || error.message);
      throw error;
    }
  }
}

