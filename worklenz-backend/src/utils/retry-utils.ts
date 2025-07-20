import { log_error } from "../shared/utils";

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoffFactor?: number;
  onRetry?: (error: any, attempt: number) => void;
}

export class RetryUtils {
  /**
   * Execute a function with retry logic
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    const { maxRetries, delayMs, backoffFactor = 1.5, onRetry } = options;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw error;
        }

        const delay = delayMs * Math.pow(backoffFactor, attempt - 1);
        
        if (onRetry) {
          onRetry(error, attempt);
        }

        log_error(`Attempt ${attempt} failed. Retrying in ${delay}ms...`, error);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Execute database operations with retry logic
   */
  static async withDatabaseRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    return this.withRetry(operation, {
      maxRetries: 3,
      delayMs: 1000,
      backoffFactor: 2,
      onRetry: (error, attempt) => {
        log_error(`Database operation '${operationName}' failed on attempt ${attempt}:`, error);
      }
    });
  }

  /**
   * Check if an error is retryable
   */
  static isRetryableError(error: any): boolean {
    // PostgreSQL error codes that are retryable
    const retryableErrorCodes = [
      '40001', // serialization_failure
      '40P01', // deadlock_detected
      '55P03', // lock_not_available
      '57P01', // admin_shutdown
      '57P02', // crash_shutdown
      '57P03', // cannot_connect_now
      '58000', // system_error
      '58030', // io_error
      '53000', // insufficient_resources
      '53100', // disk_full
      '53200', // out_of_memory
      '53300', // too_many_connections
      '53400', // configuration_limit_exceeded
    ];

    if (error.code && retryableErrorCodes.includes(error.code)) {
      return true;
    }

    // Network-related errors
    if (error.message && (
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ECONNREFUSED')
    )) {
      return true;
    }

    return false;
  }

  /**
   * Execute with conditional retry based on error type
   */
  static async withConditionalRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    const { maxRetries, delayMs, backoffFactor = 1.5, onRetry } = options;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (!this.isRetryableError(error) || attempt === maxRetries) {
          throw error;
        }

        const delay = delayMs * Math.pow(backoffFactor, attempt - 1);
        
        if (onRetry) {
          onRetry(error, attempt);
        }

        log_error(`Retryable error on attempt ${attempt}. Retrying in ${delay}ms...`, error);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}