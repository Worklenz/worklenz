import axios from "axios";
import jwt, { Secret } from "jsonwebtoken";
import { log_error } from "../../shared/utils";

const jwtSecret: Secret = process.env.JWT_SECRET ?? "";

if (!process.env.JWT_SECRET) {
  console.error("[SECURITY] JWT_SECRET is not set — PPMBot token generation will use empty secret");
}

export interface IActionItem {
  name: string;
  description?: string;
  assignees?: string[];
  priority_id?: string;
}

export interface IPPMBotConfig {
  /** Base URL of the Worklenz API (e.g. "http://localhost:3000") */
  apiBaseUrl: string;
  /** The team_id context for created tasks */
  teamId: string;
  /** The user_id to attribute bot-created tasks to (service account user) */
  userId: string;
}

/**
 * PPMBot service: parses meeting transcripts for action items and creates tasks
 * via the POST /ppm/api/bot/tasks endpoint using service account JWT authentication.
 */
export class PPMBotService {
  private config: IPPMBotConfig;

  constructor(config: IPPMBotConfig) {
    this.config = config;
  }

  /**
   * Generate a service account JWT for authenticating with the bot tasks API.
   */
  private generateToken(): string {
    return jwt.sign(
      {
        service: "ppmbot",
        team_id: this.config.teamId,
        user_id: this.config.userId,
      },
      jwtSecret,
      { expiresIn: "1h" }
    );
  }

  /**
   * Extract action items from a meeting transcript.
   *
   * Looks for lines that match common action item patterns:
   * - "ACTION: ..." or "Action item: ..."
   * - "TODO: ..." or "To do: ..."
   * - "[ ] ..." (unchecked checkbox)
   * - "@someone will ..." or "@someone to ..."
   * - Lines containing "action item" (case-insensitive)
   */
  public extractActionItems(transcript: string): IActionItem[] {
    const lines = transcript.split("\n").map(l => l.trim()).filter(Boolean);
    const items: IActionItem[] = [];

    const actionPatterns = [
      /^(?:ACTION(?:\s*ITEM)?|TODO|TO\s*DO)\s*:\s*(.+)/i,
      /^\[\s*\]\s*(.+)/,
      /^[-*]\s*(?:ACTION(?:\s*ITEM)?|TODO)\s*:\s*(.+)/i,
    ];

    const assigneePattern = /@(\w+)\s+(?:will|to|should|needs?\s+to|must)\s+(.+)/i;

    for (const line of lines) {
      // Check explicit action patterns
      for (const pattern of actionPatterns) {
        const match = line.match(pattern);
        if (match) {
          items.push({ name: match[1].trim().slice(0, 100) });
          break;
        }
      }

      // Check @assignee patterns (only if not already matched)
      if (!items.some(item => line.includes(item.name))) {
        const assigneeMatch = line.match(assigneePattern);
        if (assigneeMatch) {
          items.push({
            name: assigneeMatch[2].trim().slice(0, 100),
            description: `Assigned from transcript: "${line}"`,
          });
        }
      }
    }

    return items;
  }

  /**
   * Process a meeting transcript: extract action items and create tasks.
   *
   * @param transcript - The raw meeting transcript text
   * @param projectId - The project to create tasks in
   * @returns The created tasks from the API
   */
  public async processTranscript(transcript: string, projectId: string) {
    const actionItems = this.extractActionItems(transcript);

    if (actionItems.length === 0) {
      return { created: [], count: 0 };
    }

    return this.createTasks(
      actionItems.map(item => ({
        ...item,
        project_id: projectId,
      }))
    );
  }

  /**
   * Create tasks via the bot API endpoint.
   */
  public async createTasks(tasks: Array<IActionItem & { project_id: string }>) {
    try {
      const token = this.generateToken();

      const response = await axios.post(
        `${this.config.apiBaseUrl}/ppm/api/bot/tasks`,
        { tasks },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data?.body ?? { created: [], count: 0 };
    } catch (error: any) {
      if (error?.isAxiosError) {
        log_error(error?.response?.data || error);
      } else {
        log_error(error);
      }
      throw error;
    }
  }
}
