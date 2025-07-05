/**
 * Health Check Middleware
 * 
 * Provides health status for the data server service
 */

import { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { getDatabase } from '../db.js';

export const healthCheck = async (req: Request, res: Response) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'data-server',
    version: '2.0.0',
    dependencies: {
      database: 'disconnected' as 'connected' | 'disconnected',
      redis: 'unknown' as 'connected' | 'disconnected' | 'unknown'
    }
  };

  try {
    // Check database connection
    const db = getDatabase();
    if (db) {
      await db.execute(sql`SELECT 1 as test`);
      healthStatus.dependencies.database = 'connected';
    }
  } catch (error) {
    console.error('Database health check failed:', error);
    healthStatus.status = 'unhealthy';
    healthStatus.dependencies.database = 'disconnected';
  }

  // Set appropriate status code
  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  
  res.status(statusCode).json(healthStatus);
};