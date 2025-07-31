import { NextFunction } from "express";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import loggerModule from "../utils/logger";

const { logger } = loggerModule;

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export class RateLimiter {
  private static store: RateLimitStore = {};
  private static cleanupInterval: NodeJS.Timeout;

  static {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      Object.keys(this.store).forEach(key => {
        if (this.store[key].resetTime < now) {
          delete this.store[key];
        }
      });
    }, 5 * 60 * 1000);
  }

  public static inviteRateLimit(
    maxRequests = 5,
    windowMs: number = 15 * 60 * 1000 // 15 minutes
  ) {
    return (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
      const identifier = req.user?.id || req.ip;
      const key = `invite_${identifier}`;
      const now = Date.now();

      if (!this.store[key] || this.store[key].resetTime < now) {
        this.store[key] = {
          count: 1,
          resetTime: now + windowMs
        };
        return next();
      }

      if (this.store[key].count >= maxRequests) {
        const remainingTime = Math.ceil((this.store[key].resetTime - now) / 1000);
        
        // Log rate limit exceeded for Slack notifications
        logger.warn("⚠️ RATE LIMIT EXCEEDED - INVITE ATTEMPTS", {
          user_id: req.user?.id,
          user_email: req.user?.email,
          ip_address: req.ip,
          attempts: this.store[key].count,
          max_attempts: maxRequests,
          remaining_time: remainingTime,
          timestamp: new Date().toISOString(),
          alert_type: "rate_limit_exceeded"
        });
        
        return res.status(429).send(
          new ServerResponse(
            false, 
            null, 
            `Too many invitation attempts. Please try again in ${remainingTime} seconds.`
          )
        );
      }

      this.store[key].count++;
      next();
    };
  }

  public static organizationCreationRateLimit(
    maxRequests = 3,
    windowMs: number = 60 * 60 * 1000 // 1 hour
  ) {
    return (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
      const identifier = req.user?.id || req.ip;
      const key = `org_creation_${identifier}`;
      const now = Date.now();

      if (!this.store[key] || this.store[key].resetTime < now) {
        this.store[key] = {
          count: 1,
          resetTime: now + windowMs
        };
        return next();
      }

      if (this.store[key].count >= maxRequests) {
        const remainingTime = Math.ceil((this.store[key].resetTime - now) / (1000 * 60));
        
        // Log organization creation rate limit exceeded
        logger.warn("⚠️ RATE LIMIT EXCEEDED - ORG CREATION", {
          user_id: req.user?.id,
          user_email: req.user?.email,
          ip_address: req.ip,
          attempts: this.store[key].count,
          max_attempts: maxRequests,
          remaining_time_minutes: remainingTime,
          timestamp: new Date().toISOString(),
          alert_type: "org_creation_rate_limit"
        });
        
        return res.status(429).send(
          new ServerResponse(
            false, 
            null, 
            `Too many organization creation attempts. Please try again in ${remainingTime} minutes.`
          )
        );
      }

      this.store[key].count++;
      next();
    };
  }

  public static getStats(identifier: string): { invites: number; orgCreations: number } {
    const inviteKey = `invite_${identifier}`;
    const orgKey = `org_creation_${identifier}`;
    
    return {
      invites: this.store[inviteKey]?.count || 0,
      orgCreations: this.store[orgKey]?.count || 0
    };
  }

  public static clearStats(identifier: string): void {
    const inviteKey = `invite_${identifier}`;
    const orgKey = `org_creation_${identifier}`;
    
    delete this.store[inviteKey];
    delete this.store[orgKey];
  }
}