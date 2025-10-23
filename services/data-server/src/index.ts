/**
 * Data Server Service - Internal Database Operations
 * 
 * This service handles:
 * - All PostgreSQL operations using existing Drizzle ORM
 * - Thematic digest processing business logic
 * - Internal REST API for other services
 * - Data validation and complex query operations
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { storageRoutes } from './routes/storage';
import { digestRoutes } from './routes/digest';
import { thematicRoutes } from './routes/thematic';
import { healthCheck } from './middleware/health';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { initializeDatabase } from './db';

const app = express();
const port = process.env.PORT || 3001;

// Initialize database connection
try {
  initializeDatabase();
  console.log('✅ Database initialized successfully');
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// Compression middleware
app.use(compression());

// CORS middleware
app.use(cors({
  origin: ['http://localhost:8000', 'http://api-gateway:8000', 'http://localhost:3000'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined'));

// Health check endpoint (no auth required)
app.get('/health', healthCheck);

// Internal API authentication middleware
app.use('/api', authMiddleware);

// Routes
app.use('/api/storage', storageRoutes);
app.use('/api/digest', digestRoutes);
app.use('/api/thematic', thematicRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'SubsBuzz Data Server',
    version: '2.0.0',
    status: 'healthy',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🗄️  SubsBuzz Data Server running on port ${port}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured'}`);
  console.log(`🔒 Internal API authentication: ${process.env.INTERNAL_API_SECRET ? 'Enabled' : 'Disabled'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏥 Health check available at: http://localhost:${port}/health`);
});