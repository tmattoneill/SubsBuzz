#!/usr/bin/env node
/**
 * Environment Variable Loader
 * 
 * Custom implementation that doesn't depend on dotenv package
 * Works for local development and Docker containers
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Load environment variables from .env file
 * @param {string} envFile - Path to env file (default: .env)
 */
export function loadEnv(envFile = '.env') {
  const envPath = resolve(envFile);
  
  if (!existsSync(envPath)) {
    console.log(`⚠️  Environment file ${envFile} not found, using process.env`);
    return;
  }

  try {
    const content = readFileSync(envPath, 'utf8');
    
    content.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line.startsWith('#') || !line.includes('=') || line.trim() === '') {
        return;
      }
      
      const equalIndex = line.indexOf('=');
      const key = line.slice(0, equalIndex).trim();
      const value = line.slice(equalIndex + 1).trim();
      
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');
      
      // Only set if not already in environment
      if (!process.env[key]) {
        process.env[key] = cleanValue;
      }
    });
    
    console.log(`✅ Loaded environment variables from ${envFile}`);
  } catch (error) {
    console.error(`❌ Error loading ${envFile}:`, error.message);
  }
}

/**
 * Load development environment (.env.dev)
 */
export function loadDevEnv() {
  loadEnv('.env.dev');
}

/**
 * Load production environment (.env.prod)
 */
export function loadProdEnv() {
  loadEnv('.env.prod');
}

/**
 * Auto-load based on NODE_ENV
 */
export function autoLoadEnv() {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    loadProdEnv();
  } else {
    loadDevEnv();
  }
}

// Export default function for easy importing
export default loadEnv;