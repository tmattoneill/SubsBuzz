import express from 'express';
import { createServer } from 'http';
import { setupVite } from './server/vite.ts';

const app = express();
const server = createServer(app);

// Setup Vite middleware to serve the React frontend
await setupVite(app, server);

const PORT = 5500;

server.listen(PORT, () => {
  console.log(`🚀 Frontend server running on http://localhost:${PORT}`);
  console.log(`📡 API Gateway: http://localhost:8000`);
  console.log(`🗄️ Data Server: http://localhost:3001`);
});