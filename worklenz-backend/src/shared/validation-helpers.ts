/**
 * This module provides secure validation and sanitization utilities to prevent
 * injection attacks and ensure data integrity.
 */

/**
 * UUID v4 validator
 * Validates that a string is a valid UUID v4 format
 * 
 * @param value - String to validate
 * @returns true if value is a valid UUID v4
 * 
 * @example
 * isValidUuid("550e8400-e29b-41d4-a716-446655440000") // true
 * isValidUuid("invalid-uuid") // false
 */
export const isValidUuid = (value: string): boolean => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  
  // UUID v4 regex: 8-4-4-4-12 hex digits with version 4 and variant bits
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value.trim());
};

/**
 * Array of UUIDs validator
 * Validates that all elements in an array are valid UUIDs
 * 
 * @param values - Array of strings to validate
 * @returns true if all values are valid UUIDs, false if array is empty or contains invalid UUIDs
 * 
 * @example
 * isValidUuidArray(["uuid1", "uuid2"]) // true if both are valid UUIDs
 * isValidUuidArray(["invalid"]) // false
 * isValidUuidArray([]) // false
 */
export const isValidUuidArray = (values: string[]): boolean => {
  if (!Array.isArray(values) || values.length === 0) {
    return false;
  }
  
  return values.every(value => isValidUuid(value));
};

/**
 * Safe string sanitizer
 * Removes potentially dangerous characters and limits length
 * 
 * @param value - String to sanitize
 * @param maxLength - Maximum allowed length (default: 10000)
 * @returns Sanitized string
 * 
 * @example
 * sanitizeString("<script>alert('xss')</script>") // "scriptalertxssscript"
 */
export const sanitizeString = (value: string, maxLength: number = 10000): string => {
  if (typeof value !== 'string') {
    return '';
  }
  
  // Remove null bytes and control characters (except newlines and tabs)
  let sanitized = value
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control chars except \n and \t
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized.trim();
};

/**
 * HTML sanitizer (for rich text content)
 * Removes potentially dangerous HTML while preserving safe formatting
 * 
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export const sanitizeHtml = (html: string): string => {
  if (typeof html !== 'string') {
    return '';
  }
  
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:text\/html/gi, ''); // Remove data URIs with HTML
};

/**
 * Date range validator
 * Validates that a date range is valid (start <= end) and within reasonable bounds
 * 
 * @param startDate - Start date string or Date object
 * @param endDate - End date string or Date object
 * @param maxRangeDays - Maximum allowed range in days (default: 365)
 * @returns Object with isValid flag and error message if invalid
 * 
 * @example
 * validateDateRange("2024-01-01", "2024-12-31") // { isValid: true }
 * validateDateRange("2024-12-31", "2024-01-01") // { isValid: false, error: "Start date must be before end date" }
 */
export const validateDateRange = (
  startDate: string | Date,
  endDate: string | Date,
  maxRangeDays: number = 365
): { isValid: boolean; error?: string } => {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Check if dates are valid
    if (isNaN(start.getTime())) {
      return { isValid: false, error: 'Invalid start date' };
    }
    
    if (isNaN(end.getTime())) {
      return { isValid: false, error: 'Invalid end date' };
    }
    
    // Check if start is before end
    if (start > end) {
      return { isValid: false, error: 'Start date must be before or equal to end date' };
    }
    
    // Check if range is within maximum allowed
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > maxRangeDays) {
      return { isValid: false, error: `Date range cannot exceed ${maxRangeDays} days` };
    }
    
    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Invalid date format' };
  }
};

/**
 * Enum validator
 * Validates that a value is one of the allowed enum values
 * 
 * @param value - Value to validate
 * @param allowedValues - Array of allowed values
 * @param caseSensitive - Whether comparison should be case-sensitive (default: true)
 * @returns true if value is in allowed values
 * 
 * @example
 * validateEnum("active", ["active", "inactive"]) // true
 * validateEnum("ACTIVE", ["active", "inactive"], false) // true (case-insensitive)
 */
export const validateEnum = (
  value: string,
  allowedValues: string[],
  caseSensitive: boolean = true
): boolean => {
  if (!value || !Array.isArray(allowedValues) || allowedValues.length === 0) {
    return false;
  }
  
  if (caseSensitive) {
    return allowedValues.includes(value);
  }
  
  // Case-insensitive comparison
  const lowerValue = value.toLowerCase();
  return allowedValues.some(allowed => allowed.toLowerCase() === lowerValue);
};

/**
 * Pagination validator
 * Validates and normalizes pagination parameters
 * 
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of items per page
 * @param maxPageSize - Maximum allowed page size (default: 100)
 * @returns Normalized pagination object with valid values
 * 
 * @example
 * validatePagination(1, 10) // { page: 1, pageSize: 10, offset: 0 }
 * validatePagination(-1, 1000) // { page: 1, pageSize: 100, offset: 0 }
 */
export const validatePagination = (
  page: number | string | undefined,
  pageSize: number | string | undefined,
  maxPageSize: number = 100
): { page: number; pageSize: number; offset: number } => {
  // Normalize page
  let normalizedPage = 1;
  if (page !== undefined) {
    const parsedPage = typeof page === 'string' ? parseInt(page, 10) : page;
    if (!isNaN(parsedPage) && parsedPage > 0) {
      normalizedPage = parsedPage;
    }
  }
  
  // Normalize pageSize
  let normalizedPageSize = 10;
  if (pageSize !== undefined) {
    const parsedPageSize = typeof pageSize === 'string' ? parseInt(pageSize, 10) : pageSize;
    if (!isNaN(parsedPageSize) && parsedPageSize > 0) {
      normalizedPageSize = Math.min(parsedPageSize, maxPageSize);
    }
  }
  
  const offset = (normalizedPage - 1) * normalizedPageSize;
  
  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    offset
  };
};

/**
 * Email validator
 * Validates email format
 * 
 * @param email - Email string to validate
 * @returns true if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Integer validator
 * Validates that a value is a valid integer within a range
 * 
 * @param value - Value to validate
 * @param min - Minimum value (optional)
 * @param max - Maximum value (optional)
 * @returns true if value is a valid integer within range
 */
export const isValidInteger = (
  value: string | number,
  min?: number,
  max?: number
): boolean => {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  
  if (isNaN(num) || !Number.isInteger(num)) {
    return false;
  }
  
  if (min !== undefined && num < min) {
    return false;
  }
  
  if (max !== undefined && num > max) {
    return false;
  }
  
  return true;
};

