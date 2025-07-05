// Simple server test without complex schema imports
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const app = express();
const port = process.env.DATA_SERVER_PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/subsbuzz_dev';

// Initialize database
let db;
try {
  const client = postgres(DATABASE_URL, {
    max: 10,
    transform: { undefined: null }
  });
  db = drizzle(client);
  console.log('✅ Database initialized');
} catch (error) {
  console.error('❌ Database initialization failed:', error.message);
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await db.execute('SELECT 1 as test, current_timestamp as timestamp');
    res.json({
      status: 'healthy',
      service: 'SubsBuzz Data Server',
      database: 'connected',
      timestamp: result[0].timestamp
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'SubsBuzz Data Server',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Basic root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'SubsBuzz Data Server',
    version: '2.0.0',
    status: 'running',
    database: db ? 'connected' : 'disconnected'
  });
});

// Internal API authentication middleware
app.use('/api', (req, res, next) => {
  const apiKey = req.headers['x-internal-api-key'];
  const expectedKey = process.env.INTERNAL_API_SECRET || 'subsbuzz-internal-api-secret-dev-testing';
  
  if (apiKey !== expectedKey) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Valid internal API key required' 
    });
  }
  next();
});

// Test API endpoint
app.get('/api/test', async (req, res) => {
  try {
    const result = await db.execute('SELECT current_database() as database, current_user as user');
    res.json({
      message: 'Data server API working',
      database_info: result[0],
      authenticated: true
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database query failed',
      message: error.message
    });
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🗄️  SubsBuzz Data Server running on port ${port}`);
  console.log(`📊 Database: ${DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`🔒 Internal API key: ${process.env.INTERNAL_API_SECRET ? 'Configured' : 'Using default'}`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log(`🧪 Test API: http://localhost:${port}/api/test`);
});