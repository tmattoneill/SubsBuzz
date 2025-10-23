/**
 * Internal API Authentication Middleware
 * 
 * Validates internal service-to-service communication using shared secret
 */

import { Request, Response, NextFunction } from 'express';

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';

export interface AuthenticatedRequest extends Request {
  isInternalRequest?: boolean;
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-internal-api-key'] as string;
  
  if (!INTERNAL_API_SECRET) {
    console.warn('⚠️  INTERNAL_API_SECRET not configured - allowing all requests in development');
    req.isInternalRequest = true;
    return next();
  }
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'Missing internal API key',
      code: 'MISSING_API_KEY' 
    });
  }
  
  if (apiKey !== INTERNAL_API_SECRET) {
    console.warn(`🚫 Invalid internal API key attempt: ${apiKey.substring(0, 8)}...`);
    return res.status(401).json({ 
      error: 'Invalid internal API key',
      code: 'INVALID_API_KEY' 
    });
  }
  
  req.isInternalRequest = true;
  next();
};