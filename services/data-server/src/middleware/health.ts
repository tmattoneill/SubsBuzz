/**
 * Health Check Middleware
 * 
 * Provides health status for the data server service
 */

import { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { getDatabase } from '../db.js';

/**
 * Shallow liveness check — confirms the process is up WITHOUT touching Postgres.
 *
 * Used by the Docker healthcheck (every 30s). The deep `healthCheck` below runs
 * `SELECT 1`, and at 30s intervals that query never lets Neon's compute reach the
 * ~5min idle window it needs to scale to zero — which kept the DB awake 24/7 and
 * burned the whole free-tier compute allowance. Liveness must stay DB-free.
 */
export const livenessCheck = (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive', service: 'data-server' });
};

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