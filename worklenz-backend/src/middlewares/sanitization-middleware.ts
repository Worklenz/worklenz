import { NextFunction, Request, Response } from "express";
import { sanitizeObject } from "../shared/utils";

/**
 * Middleware to sanitize all incoming request data
 * This should be applied early in the middleware chain
 */
export function sanitizeRequestData(req: Request, res: Response, next: NextFunction) {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    console.error('Error in sanitization middleware:', error);
    // Continue processing even if sanitization fails, but log the error
    next();
  }
}

/**
 * Middleware specifically for form data sanitization
 * More aggressive sanitization for user-submitted forms
 */
export function sanitizeFormData(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.body && typeof req.body === 'object') {
      // Apply more strict sanitization for form submissions
      const sanitizedBody: any = {};
      
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string') {
          // Apply context-specific sanitization based on field names
          if (key.toLowerCase().includes('email')) {
            const { sanitizeEmail } = require('../shared/utils');
            sanitizedBody[key] = sanitizeEmail(value);
          } else if (key.toLowerCase().includes('name') || key.toLowerCase().includes('title')) {
            const { sanitizeName } = require('../shared/utils');
            sanitizedBody[key] = sanitizeName(value);
          } else if (key.toLowerCase().includes('password')) {
            const { sanitizePassword } = require('../shared/utils');
            sanitizedBody[key] = sanitizePassword(value);
          } else if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
            const { sanitizeUrl } = require('../shared/utils');
            sanitizedBody[key] = sanitizeUrl(value);
          } else {
            const { sanitizeUserInput } = require('../shared/utils');
            sanitizedBody[key] = sanitizeUserInput(value);
          }
        } else {
          sanitizedBody[key] = sanitizeObject(value);
        }
      }
      
      req.body = sanitizedBody;
    }

    next();
  } catch (error) {
    console.error('Error in form sanitization middleware:', error);
    next();
  }
}

/**
 * Middleware for API endpoints that handle rich text content
 */
export function sanitizeRichTextData(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.body && typeof req.body === 'object') {
      const { sanitizeRichText } = require('../shared/utils');
      
      // Fields that commonly contain rich text
      const richTextFields = ['description', 'content', 'body', 'message', 'comment', 'note'];
      
      for (const field of richTextFields) {
        if (req.body[field] && typeof req.body[field] === 'string') {
          req.body[field] = sanitizeRichText(req.body[field]);
        }
      }
    }

    next();
  } catch (error) {
    console.error('Error in rich text sanitization middleware:', error);
    next();
  }
}

export default {
  sanitizeRequestData,
  sanitizeFormData,
  sanitizeRichTextData
}; 