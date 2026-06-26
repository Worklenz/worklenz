import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const chatId = req.params.chatId;
  
  if (!chatId) {
    return res.status(400).send(new ServerResponse(false, null, "Chat ID parameter is required"));
  }

  // Pattern: UUID v4 format (8-4-4-4-12 hex chars) followed by dash and ISO date (YYYY-MM-DD)
  // Format: clientUuid-YYYY-MM-DD
  const chatIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-\d{4}-\d{2}-\d{2}$/i;
  
  if (!chatIdPattern.test(chatId)) {
    return res.status(400).send(new ServerResponse(false, null, "Invalid chat ID format"));
  }
  
  return next();
}

