/**
 * Shared API Types for SubsBuzz Microservices
 * 
 * These types are used for communication between services
 * and for API request/response validation
 */

// User Authentication
export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface AuthToken {
  token: string;
  expiresAt: string;
  user: User;
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Service Health Check
export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  dependencies?: {
    database?: 'connected' | 'disconnected';
    redis?: 'connected' | 'disconnected';
    [key: string]: string | undefined;
  };
}

// Internal service communication
export interface InternalApiRequest {
  service: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
}

export interface InternalApiResponse<T = any> {
  status: number;
  data?: T;
  error?: string;
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  service: string;
}