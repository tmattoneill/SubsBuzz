#!/usr/bin/env node
/**
 * Docker Environment Configuration
 * 
 * Handles environment variables for containerized deployment
 */

import { loadEnv, autoLoadEnv } from './env.js';

/**
 * Load environment for Docker containers
 * Priority: Docker ENV vars > .env.prod > .env > defaults
 */
export function loadDockerEnv() {
  // In Docker, NODE_ENV should be set by the container
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    console.log('🐳 Docker Production Mode');
    loadEnv('.env.prod');
  } else {
    console.log('🐳 Docker Development Mode');
    loadEnv('.env.dev');
  }
  
  // Validate required environment variables
  const required = [
    'DATABASE_URL',
    'DATA_SERVER_PORT',
    'API_GATEWAY_PORT',
    'INTERNAL_API_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    process.exit(1);
  }
  
  console.log('✅ All required environment variables loaded for Docker');
}

export default loadDockerEnv;