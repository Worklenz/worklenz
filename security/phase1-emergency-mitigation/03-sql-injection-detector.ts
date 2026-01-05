/**
 * This is a TEMPORARY security measure to detect and block SQL injection attempts
 * while we implement proper parameterized queries in Phase 2-4.
 * 
 * WARNING: This is NOT a replacement for proper input validation and parameterized queries.
 * This should be removed once all SQL injection vulnerabilities are fixed.
 */

import { Request, Response, NextFunction } from "express";

/**
 * Common SQL injection patterns to detect
 */
const SQL_INJECTION_PATTERNS = [
  // UNION-based injection
  /(\bUNION\b.*\bSELECT\b)/i,
  /(\bUNION\b.*\bALL\b.*\bSELECT\b)/i,
  
  // Boolean-based blind injection
  /(\bOR\b\s+[0-9]+\s*=\s*[0-9]+)/i,
  /(\bAND\b\s+[0-9]+\s*=\s*[0-9]+)/i,
  /(\bOR\b\s+['"][^'"]*['"]\s*=\s*['"][^'"]*['"])/i,
  
  // Time-based blind injection
  /(\bSLEEP\s*\()/i,
  /(\bPG_SLEEP\s*\()/i,
  /(\bWAITFOR\b.*\bDELAY\b)/i,
  /(\bBENCHMARK\s*\()/i,
  
  // Stacked queries
  /(;\s*DROP\b)/i,
  /(;\s*DELETE\b)/i,
  /(;\s*UPDATE\b)/i,
  /(;\s*INSERT\b)/i,
  /(;\s*CREATE\b)/i,
  /(;\s*ALTER\b)/i,
  /(;\s*TRUNCATE\b)/i,
  
  // Information schema access
  /(information_schema)/i,
  /(pg_catalog)/i,
  /(pg_tables)/i,
  /(pg_database)/i,
  
  // Comment-based injection
  /(--[^\r\n]*)/,
  /(\/\*.*\*\/)/,
  /(#[^\r\n]*)/,
  
  // Command execution
  /(exec\s*\()/i,
  /(execute\s*\()/i,
  /(xp_cmdshell)/i,
  
  // Dangerous functions
  /(\bDROP\b.*\bTABLE\b)/i,
  /(\bDROP\b.*\bDATABASE\b)/i,
  /(\bTRUNCATE\b.*\bTABLE\b)/i,
  /(\bDELETE\b.*\bFROM\b)/i,
  
  // Encoded attacks
  /(0x[0-9a-f]+)/i,
  /(CHAR\s*\()/i,
  /(CHR\s*\()/i,
  /(ASCII\s*\()/i,
  
  // PostgreSQL specific
  /(\bCOPY\b.*\bFROM\b)/i,
  /(\bCOPY\b.*\bTO\b)/i,
  /(pg_read_file)/i,
  /(pg_ls_dir)/i,
  /(pg_stat_file)/i,
  
  // Multiple single quotes (common in injection)
  /('{2,})/,
  
  // Hex encoding
  /(\\x[0-9a-f]{2})/i,
];

/**
 * Suspicious parameter names that are commonly used in attacks
 */
const SUSPICIOUS_PARAM_NAMES = [
  'id[]',
  'id[0]',
  'union',
  'select',
  'where',
  'from',
  'table',
];

/**
 * Check if a value contains SQL injection patterns
 */
function containsSqlInjection(value: any): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  
  // Decode URL encoding to catch encoded attacks
  let decodedValue = value;
  try {
    decodedValue = decodeURIComponent(value);
  } catch (e) {
    // If decoding fails, use original value
  }
  
  // Check against all patterns
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(decodedValue));
}

/**
 * Recursively check an object for SQL injection patterns
 */
function checkObjectForInjection(obj: any, path: string = ''): { found: boolean; location: string; value: string } | null {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj === 'string') {
    if (containsSqlInjection(obj)) {
      return { found: true, location: path, value: obj };
    }
    return null;
  }
  
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = checkObjectForInjection(obj[i], `${path}[${i}]`);
      if (result) return result;
    }
    return null;
  }
  
  if (typeof obj === 'object') {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const result = checkObjectForInjection(obj[key], path ? `${path}.${key}` : key);
        if (result) return result;
      }
    }
    return null;
  }
  
  return null;
}

/**
 * Log security incident
 */
function logSecurityIncident(req: Request, detection: { location: string; value: string }) {
  const incident = {
    timestamp: new Date().toISOString(),
    type: 'SQL_INJECTION_ATTEMPT',
    ip: req.ip || req.socket.remoteAddress,
    method: req.method,
    url: req.originalUrl || req.url,
    headers: {
      userAgent: req.headers['user-agent'],
      referer: req.headers['referer'],
      origin: req.headers['origin'],
    },
    detection: {
      location: detection.location,
      value: detection.value.substring(0, 200), // Limit logged value length
    },
    user: (req as any).user?.id || 'anonymous',
  };
  
  // Log to console (in production, send to monitoring service)
  console.error('[SECURITY ALERT] SQL Injection Attempt Detected:', JSON.stringify(incident, null, 2));
  
  // TODO: Send alert to security team
  // TODO: Log to security audit table
  // TODO: Send to Azure Monitor / Application Insights
}

/**
 * SQL Injection Detection Middleware
 * 
 * This middleware checks all incoming requests for SQL injection patterns
 * and blocks suspicious requests.
 */
export const sqlInjectionDetector = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip for certain paths (static files, health checks)
    const skipPaths = [
      '/health',
      '/favicon.ico',
      '/static/',
      '/public/',
      '/_next/',
    ];
    
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    // Check query parameters
    const queryCheck = checkObjectForInjection(req.query, 'query');
    if (queryCheck) {
      logSecurityIncident(req, queryCheck);
      return res.status(403).json({
        done: false,
        message: 'Forbidden: Suspicious request detected',
        body: null,
      });
    }
    
    // Check request body
    const bodyCheck = checkObjectForInjection(req.body, 'body');
    if (bodyCheck) {
      logSecurityIncident(req, bodyCheck);
      return res.status(403).json({
        done: false,
        message: 'Forbidden: Suspicious request detected',
        body: null,
      });
    }
    
    // Check URL parameters
    const paramsCheck = checkObjectForInjection(req.params, 'params');
    if (paramsCheck) {
      logSecurityIncident(req, paramsCheck);
      return res.status(403).json({
        done: false,
        message: 'Forbidden: Suspicious request detected',
        body: null,
      });
    }
    
    // Check for suspicious parameter names
    const allParams = { ...req.query, ...req.body, ...req.params };
    for (const paramName of SUSPICIOUS_PARAM_NAMES) {
      if (paramName in allParams) {
        logSecurityIncident(req, { location: `param.${paramName}`, value: String(allParams[paramName]) });
        return res.status(403).json({
          done: false,
          message: 'Forbidden: Suspicious parameter detected',
          body: null,
        });
      }
    }
    
    next();
  } catch (error) {
    // Don't let the security middleware crash the app
    console.error('[SQL Injection Detector] Error:', error);
    next();
  }
};

/**
 * Rate limiting for detected attacks
 * Keep track of IPs that trigger the detector
 */
const attackAttempts = new Map<string, { count: number; firstAttempt: number }>();

// Clean up old entries every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [ip, data] of attackAttempts.entries()) {
    if (data.firstAttempt < oneHourAgo) {
      attackAttempts.delete(ip);
    }
  }
}, 60 * 60 * 1000);

/**
 * Enhanced detector with IP blocking
 */
export const sqlInjectionDetectorWithBlocking = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  // Check if IP is already blocked
  const attempts = attackAttempts.get(ip);
  if (attempts && attempts.count >= 5) {
    const timeSinceFirst = Date.now() - attempts.firstAttempt;
    if (timeSinceFirst < 60 * 60 * 1000) { // Block for 1 hour
      return res.status(403).json({
        done: false,
        message: 'Forbidden: Too many suspicious requests',
        body: null,
      });
    } else {
      // Reset after 1 hour
      attackAttempts.delete(ip);
    }
  }
  
  // Run the detector
  const originalNext = next;
  let blocked = false;
  
  const wrappedNext = (err?: any) => {
    if (!blocked) {
      originalNext(err);
    }
  };
  
  const wrappedRes = {
    ...res,
    status: (code: number) => {
      if (code === 403) {
        blocked = true;
        // Increment attack counter
        const current = attackAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
        attackAttempts.set(ip, {
          count: current.count + 1,
          firstAttempt: current.firstAttempt,
        });
      }
      return res.status(code);
    },
  } as Response;
  
  sqlInjectionDetector(req, wrappedRes, wrappedNext);
};

export default sqlInjectionDetectorWithBlocking;
