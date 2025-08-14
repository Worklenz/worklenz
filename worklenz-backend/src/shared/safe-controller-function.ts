import {NextFunction, Request, Response} from "express";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { log_error } from "../shared/utils";

/**
 * Wraps controller functions to provide consistent error handling
 * Improved version with better promise rejection handling
 */
export default (fn: (req: Request, res: Response, next: NextFunction) => Promise<IWorkLenzResponse | void>) 
: (req: Request, res: Response, next: NextFunction) => void => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Get route information for better error logging
    const routePath = req.route?.path || "unknown route";
    const method = req.method || "unknown method";
    
    // Properly catch both synchronous errors and promise rejections
    try {
      const result = fn(req, res, next);
      
      // Always treat as Promise for consistent handling
      Promise.resolve(result).catch((error) => {
        // Log error with context
        log_error(`Error in controller function [${method} ${routePath}]: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
          log_error(error.stack);
        }
        
        // Only send a response if one hasn't been sent yet
        if (!res.headersSent) {
          // Provide a more specific error message if possible
          let errorMessage = "An error occurred processing your request";
          if (error instanceof Error && error.message) {
            // Don't expose internal error details, just a cleaned version
            const cleanMessage = error.message
              .replace(/Error:/g, "")
              .replace(/\n/g, " ")
              .trim();
              
            errorMessage = cleanMessage.length > 100 
              ? `${cleanMessage.substring(0, 100)}...` 
              : cleanMessage;
          }
          
          // Send appropriate status based on the error
          try {
            res.status(500).send(new ServerResponse(false, null, errorMessage));
          } catch (responseError) {
            log_error(`Failed to send error response: ${responseError instanceof Error ? responseError.message : String(responseError)}`);
          }
        }
        
        next(error);
      });
    } catch (error) {
      // Handle synchronous errors
      log_error(`Synchronous error in controller [${method} ${routePath}]: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        log_error(error.stack);
      }
      
      // Only send a response if one hasn't been sent yet
      if (!res.headersSent) {
        res.status(500).send(new ServerResponse(false, null, "An unexpected error occurred"));
      }
      
      next(error);
    }
  };
};
