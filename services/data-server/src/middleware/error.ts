/**
 * Error Handling Middleware
 * 
 * Centralized error handling for the data server
 */

import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const timestamp = new Date().toISOString();
  const requestId = req.headers['x-request-id'] || 'unknown';
  
  // Log error details
  console.error('💥 Data Server Error:', {
    timestamp,
    requestId,
    method: req.method,
    path: req.path,
    error: {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    }
  });

  // Determine status code
  const statusCode = error.statusCode || 500;
  
  // Prepare error response
  const errorResponse = {
    error: true,
    message: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    timestamp,
    service: 'data-server',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error.details
    })
  };

  res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};