import { NextFunction, Response } from "express";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { ServerResponse } from "../../models/server-response";

/**
 * Validates Slack OAuth response data
 */
export function slackOAuthValidator(req: IWorkLenzRequest, res: Response, next: NextFunction) {
  const { team_id, team_name, access_token } = req.body;

  const errors: string[] = [];

  // Required fields
  if (!team_id || typeof team_id !== "string") {
    errors.push("team_id is required and must be a string");
  } else if (team_id.length > 255) {
    errors.push("team_id must be less than 255 characters");
  }

  if (!team_name || typeof team_name !== "string") {
    errors.push("team_name is required and must be a string");
  } else if (team_name.length > 255) {
    errors.push("team_name must be less than 255 characters");
  }

  if (!access_token || typeof access_token !== "string") {
    errors.push("access_token is required and must be a string");
  } else if (access_token.length > 1000) {
    errors.push("access_token is too long");
  }

  // Optional fields validation
  if (req.body.bot_user_id && typeof req.body.bot_user_id !== "string") {
    errors.push("bot_user_id must be a string");
  }

  if (req.body.scope && typeof req.body.scope !== "string") {
    errors.push("scope must be a string");
  }

  if (req.body.bot?.bot_access_token) {
    if (typeof req.body.bot.bot_access_token !== "string") {
      errors.push("bot_access_token must be a string");
    } else if (req.body.bot.bot_access_token.length > 1000) {
      errors.push("bot_access_token is too long");
    }
  }

  if (req.body.authed_user?.id && typeof req.body.authed_user.id !== "string") {
    errors.push("authed_user.id must be a string");
  }

  if (errors.length > 0) {
    return res.status(400).send(new ServerResponse(false, null, errors.join(", ")));
  }

  next();
}

/**
 * Validates channel sync request
 */
export function channelSyncValidator(req: IWorkLenzRequest, res: Response, next: NextFunction) {
  const { channels } = req.body;

  if (!Array.isArray(channels)) {
    return res.status(400).send(new ServerResponse(false, null, "channels must be an array"));
  }

  if (channels.length > 1000) {
    return res.status(400).send(new ServerResponse(false, null, "Cannot sync more than 1000 channels at once"));
  }

  const errors: string[] = [];

  channels.forEach((channel, index) => {
    if (!channel.id || typeof channel.id !== "string") {
      errors.push(`Channel at index ${index}: id is required and must be a string`);
    }

    if (!channel.name || typeof channel.name !== "string") {
      errors.push(`Channel at index ${index}: name is required and must be a string`);
    } else if (channel.name.length > 255) {
      errors.push(`Channel at index ${index}: name must be less than 255 characters`);
    }

    if (channel.is_private !== undefined && typeof channel.is_private !== "boolean") {
      errors.push(`Channel at index ${index}: is_private must be a boolean`);
    }

    if (channel.is_archived !== undefined && typeof channel.is_archived !== "boolean") {
      errors.push(`Channel at index ${index}: is_archived must be a boolean`);
    }
  });

  if (errors.length > 0) {
    return res.status(400).send(new ServerResponse(false, null, errors.slice(0, 5).join(", "))); // Limit error messages
  }

  next();
}

/**
 * Validates channel configuration creation
 */
export function channelConfigValidator(req: IWorkLenzRequest, res: Response, next: NextFunction) {
  const { projectId, slackChannelId, notificationTypes } = req.body;

  const errors: string[] = [];

  if (!projectId || typeof projectId !== "string") {
    errors.push("projectId is required and must be a string");
  } else {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      errors.push("projectId must be a valid UUID");
    }
  }

  if (!slackChannelId || typeof slackChannelId !== "string") {
    errors.push("slackChannelId is required and must be a string");
  } else {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(slackChannelId)) {
      errors.push("slackChannelId must be a valid UUID");
    }
  }

  if (notificationTypes !== undefined) {
    if (!Array.isArray(notificationTypes)) {
      errors.push("notificationTypes must be an array");
    } else {
      const validTypes = [
        "task_created",
        "task_updated",
        "task_completed",
        "task_assigned",
        "comment_added",
        "status_changed",
        "due_date_changed",
        "priority_changed"
      ];

      notificationTypes.forEach((type, index) => {
        if (typeof type !== "string") {
          errors.push(`notificationTypes[${index}] must be a string`);
        } else if (!validTypes.includes(type)) {
          errors.push(`notificationTypes[${index}] is not a valid notification type`);
        }
      });

      if (notificationTypes.length > 50) {
        errors.push("Cannot specify more than 50 notification types");
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).send(new ServerResponse(false, null, errors.join(", ")));
  }

  next();
}

/**
 * Validates channel config update request
 */
export function channelConfigUpdateValidator(req: IWorkLenzRequest, res: Response, next: NextFunction) {
  const { isActive } = req.body;

  if (isActive === undefined) {
    return res.status(400).send(new ServerResponse(false, null, "isActive field is required"));
  }

  if (typeof isActive !== "boolean") {
    return res.status(400).send(new ServerResponse(false, null, "isActive must be a boolean value"));
  }

  next();
}

/**
 * Validates test notification request
 */
export function testNotificationValidator(req: IWorkLenzRequest, res: Response, next: NextFunction) {
  const { message } = req.body;

  if (message !== undefined && typeof message !== "object") {
    return res.status(400).send(new ServerResponse(false, null, "message must be an object"));
  }

  if (message?.text && typeof message.text !== "string") {
    return res.status(400).send(new ServerResponse(false, null, "message.text must be a string"));
  }

  if (message?.text && message.text.length > 4000) {
    return res.status(400).send(new ServerResponse(false, null, "message.text must be less than 4000 characters"));
  }

  next();
}
