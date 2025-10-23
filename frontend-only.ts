import express from "express";
import { createServer } from "http";
import { setupVite } from "./server/vite.js";

const app = express();
const server = createServer(app);

// Set port to 5500 from env
const PORT = process.env.UI_PORT || 5500;

// Setup Vite to serve React app
await setupVite(app, server);

server.listen(PORT, () => {
  console.log(`🚀 Frontend running on http://localhost:${PORT}`);
  console.log(`📡 API: Configured for http://localhost:8000`);
});