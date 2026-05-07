import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import uploadHandler from '../api/upload';
import materialsHandler from '../api/materials';
import materialHandler from '../api/material';

const app = express();
app.use(cors());
app.use(express.json());

// Log all requests for debugging
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Mock Vercel req/res objects for the existing handlers
const wrapHandler = (handler: any) => async (req: any, res: any) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error("Local Server Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

app.post('/api/upload', wrapHandler(uploadHandler));
app.get('/api/materials', wrapHandler(materialsHandler));
app.get('/api/material', wrapHandler(materialHandler));

const PORT = 3000;
const HOST = '127.0.0.1'; // Force IPv4
app.listen(PORT, HOST, () => {
  console.log(`Local API Server running at http://${HOST}:${PORT}`);
});
