import { Request, Response, NextFunction } from "express";

/**
 * Rotates CSRF token after successful state-changing operations to prevent
 * token reuse attacks and enhance security.
 * 
 * This middleware should be applied to routes that handle state-changing
 * operations (POST, PUT, DELETE, PATCH).
 */
export const createCsrfRotation = (generateToken: (req: Request, overwrite?: boolean) => string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to intercept responses
    res.json = function(data: any) {
      // Only rotate token on successful state-changing operations
      const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
      const isSuccess = data && (data.done === true || (res.statusCode >= 200 && res.statusCode < 300));
      
      if (isStateChanging && isSuccess) {
        try {
          // Rotate CSRF token (overwrite = true)
          const newToken = generateToken(req, true);
          
          // Send new token in response header
          res.setHeader('X-CSRF-Token', newToken);
          
          // Also include in response body for frontend convenience
          if (typeof data === 'object' && data !== null) {
            data.csrfToken = newToken;
          }
        } catch (error) {
          // Log error but don't fail the request
          console.error('Error rotating CSRF token:', error);
        }
      }
      
      // Call original json method
      return originalJson(data);
    };
    
    next();
  };
};

