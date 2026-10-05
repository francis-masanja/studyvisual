import * as dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import apiHandler from '../api/[...slug].ts';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Log all requests for debugging
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Mock Vercel req/res objects for the existing handler
type VercelHandler = (req: VercelRequest, res: VercelResponse) => unknown;

const wrapHandler = (handler: VercelHandler) => async (req: Request, res: Response) => {
  try {
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
  } catch (error) {
    console.error('Local Server Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

// Route all API calls through the catch‑all handler
app.use('/api', wrapHandler(apiHandler));

const PORT = 3000;
const HOST = '127.0.0.1'; // Force IPv4
app.listen(PORT, HOST, () => {
  console.log(`Local API Server running at http://${HOST}:${PORT}`);
});
