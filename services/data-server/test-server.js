// Simple test server to verify basic connectivity
import express from 'express';
import cors from 'cors';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'data-server-test',
    version: '2.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'SubsBuzz Data Server (Test)',
    version: '2.0.0',
    status: 'healthy'
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🗄️ Test Data Server running on port ${port}`);
});