/**
 * Middleware functions to validate query parameters and prevent injection attacks
 */

import { NextFunction, Request, Response } from "express";
import { ServerResponse } from "../../models/server-response";
import {
  isValidUuid,
  isValidUuidArray,
  validateDateRange,
  validatePagination,
  validateEnum,
  isValidInteger
} from "../../shared/validation-helpers";

/**
 * Validates a UUID parameter from request params, query, or body
 * 
 * @param paramName - Name of the parameter to validate
 * @param source - Where to get the parameter from: 'params', 'query', or 'body' (default: 'params')
 * @returns Express middleware function
 * 
 * @example
 * router.get('/tasks/:id', validateUuidParam('id'), controller.getTask);
 */
export const validateUuidParam = (
  paramName: string,
  source: 'params' | 'query' | 'body' = 'params'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const sourceObj = source === 'params' ? req.params : source === 'query' ? req.query : req.body;
    const value = sourceObj[paramName];
    
    if (!value) {
      res.status(400).json(new ServerResponse(false, null, `${paramName} is required`));
      return;
    }
    
    if (typeof value !== 'string') {
      res.status(400).json(new ServerResponse(false, null, `${paramName} must be a string`));
      return;
    }
    
    if (!isValidUuid(value)) {
      res.status(400).json(new ServerResponse(false, null, `Invalid ${paramName} format`));
      return;
    }
    
    next();
  };
};

/**
 * Validates an array of UUIDs from query parameters
 * 
 * @param paramName - Name of the query parameter (should contain comma-separated or space-separated UUIDs)
 * @param separator - Separator used in the string (default: ',' for comma-separated, common in reporting routes)
 * @returns Express middleware function
 * 
 * @example
 * router.get('/tasks', validateUuidArrayParam('task_ids', ' '), controller.getTasks);
 * // URL: /tasks?task_ids=uuid1 uuid2 uuid3
 * 
 * router.get('/projects', validateUuidArrayParam('statuses', ','), controller.getProjects);
 * // URL: /projects?statuses=uuid1,uuid2,uuid3
 */
export const validateUuidArrayParam = (
  paramName: string,
  separator: string = ','
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.query[paramName];
    
    // Optional parameter - if not provided, skip validation
    if (!value) {
      return next();
    }
    
    if (typeof value !== 'string') {
      res.status(400).json(new ServerResponse(false, null, `${paramName} must be a string`));
      return;
    }
    
    // Split by separator, trim whitespace, and filter empty strings
    const uuids = value.split(separator)
      .map(id => id.trim())
      .filter(Boolean);
    
    if (uuids.length === 0) {
      res.status(400).json(new ServerResponse(false, null, `${paramName} must contain at least one UUID`));
      return;
    }
    
    if (!isValidUuidArray(uuids)) {
      res.status(400).json(new ServerResponse(false, null, `Invalid ${paramName} format. All values must be valid UUIDs`));
      return;
    }
    
    // Store validated array in request for use in controller
    (req as any)[`validated_${paramName}`] = uuids;
    
    next();
  };
};

/**
 * Validates date range parameters
 * 
 * @param startParam - Name of start date parameter (default: 'start_date')
 * @param endParam - Name of end date parameter (default: 'end_date')
 * @param maxRangeDays - Maximum allowed range in days (default: 365)
 * @returns Express middleware function
 * 
 * @example
 * router.get('/reports', validateDateRangeParams('from', 'to', 90), controller.getReport);
 */
export const validateDateRangeParams = (
  startParam: string = 'start_date',
  endParam: string = 'end_date',
  maxRangeDays: number = 365
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startDate = req.query[startParam];
    const endDate = req.query[endParam];
    
    // Both dates are optional, but if one is provided, validate the range
    if (!startDate && !endDate) {
      return next();
    }
    
    if (!startDate) {
      res.status(400).json(new ServerResponse(false, null, `${startParam} is required when ${endParam} is provided`));
      return;
    }
    
    if (!endDate) {
      res.status(400).json(new ServerResponse(false, null, `${endParam} is required when ${startParam} is provided`));
      return;
    }
    
    if (typeof startDate !== 'string' || typeof endDate !== 'string') {
      res.status(400).json(new ServerResponse(false, null, 'Date parameters must be strings'));
      return;
    }
    
    const validation = validateDateRange(startDate, endDate, maxRangeDays);
    
    if (!validation.isValid) {
      res.status(400).json(new ServerResponse(false, null, validation.error));
      return;
    }
    
    // Store validated dates in request
    (req as any).validatedDateRange = {
      start: new Date(startDate),
      end: new Date(endDate)
    };
    
    next();
  };
};

/**
 * Validates pagination parameters
 * 
 * @param pageParam - Name of page parameter (default: 'page')
 * @param pageSizeParam - Name of page size parameter (default: 'page_size' or 'limit')
 * @param maxPageSize - Maximum allowed page size (default: 100)
 * @returns Express middleware function
 * 
 * @example
 * router.get('/tasks', validatePaginationParams(), controller.getTasks);
 * // URL: /tasks?page=1&page_size=20
 */
export const validatePaginationParams = (
  pageParam: string = 'page',
  pageSizeParam: string = 'page_size',
  maxPageSize: number = 100
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const page = req.query[pageParam];
    const pageSize = req.query[pageSizeParam] || req.query['limit'];
    
    const pagination = validatePagination(
      page as string | number | undefined,
      pageSize as string | number | undefined,
      maxPageSize
    );
    
    // Store validated pagination in request
    (req as any).pagination = pagination;
    
    next();
  };
};

/**
 * Validates enum parameter
 * 
 * @param paramName - Name of the parameter to validate
 * @param allowedValues - Array of allowed values
 * @param caseSensitive - Whether comparison should be case-sensitive (default: true)
 * @param source - Where to get the parameter from: 'params', 'query', or 'body' (default: 'query')
 * @returns Express middleware function
 * 
 * @example
 * router.get('/tasks', validateEnumParam('status', ['active', 'inactive']), controller.getTasks);
 */
export const validateEnumParam = (
  paramName: string,
  allowedValues: string[],
  caseSensitive: boolean = true,
  source: 'params' | 'query' | 'body' = 'query'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const sourceObj = source === 'params' ? req.params : source === 'query' ? req.query : req.body;
    const value = sourceObj[paramName];
    
    // Optional parameter - if not provided, skip validation
    if (!value) {
      return next();
    }
    
    if (typeof value !== 'string') {
      res.status(400).json(new ServerResponse(false, null, `${paramName} must be a string`));
      return;
    }
    
    if (!validateEnum(value, allowedValues, caseSensitive)) {
      res.status(400).json(new ServerResponse(false, null, `${paramName} must be one of: ${allowedValues.join(', ')}`));
      return;
    }
    
    next();
  };
};

/**
 * Validates integer parameter
 * 
 * @param paramName - Name of the parameter to validate
 * @param min - Minimum value (optional)
 * @param max - Maximum value (optional)
 * @param required - Whether parameter is required (default: false)
 * @param source - Where to get the parameter from: 'params', 'query', or 'body' (default: 'query')
 * @returns Express middleware function
 * 
 * @example
 * router.get('/tasks', validateIntegerParam('priority', 1, 5), controller.getTasks);
 */
export const validateIntegerParam = (
  paramName: string,
  min?: number,
  max?: number,
  required: boolean = false,
  source: 'params' | 'query' | 'body' = 'query'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const sourceObj = source === 'params' ? req.params : source === 'query' ? req.query : req.body;
    const value = sourceObj[paramName];
    
    if (!value) {
      if (required) {
        res.status(400).json(new ServerResponse(false, null, `${paramName} is required`));
        return;
      }
      return next();
    }
    
    if (!isValidInteger(value, min, max)) {
      const rangeMsg = min !== undefined && max !== undefined 
        ? ` between ${min} and ${max}`
        : min !== undefined 
        ? ` >= ${min}`
        : max !== undefined 
        ? ` <= ${max}`
        : '';
      res.status(400).json(new ServerResponse(false, null, `${paramName} must be a valid integer${rangeMsg}`));
      return;
    }
    
    next();
  };
};

