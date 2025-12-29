import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";
import {sanitizeCommentContent} from "../../shared/utils";

/**
 * Validates and sanitizes task comment input to prevent XSS attacks
 */
export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {content, task_id} = req.body;
  
  if (!task_id)
    return res.status(200).send(new ServerResponse(false, null, "Unable to create comment"));
  
  if (content && typeof content === 'string') {
    // Validate length before sanitization
    if (content.length > 5000)
      return res.status(200).send(new ServerResponse(false, null, "Message length exceeded"));
    
    // Sanitize content to prevent XSS attacks
    // This allows safe HTML (mentions, links) while blocking dangerous content
    req.body.content = sanitizeCommentContent(content);
  }

  req.body.mentions = Array.isArray(req.body.mentions)
    ? req.body.mentions
    : [];

  return next();
}
